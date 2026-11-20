import { db } from '../db/index.ts';
import {
  examAttempts,
  examQuestions,
  exams,
  lessonProgress,
  lessons,
  mcqAnswers,
  notifications,
  questionOptions,
  questions,
  topics,
  users,
  writtenSubmissions,
} from '../db/schema.ts';
import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  assertTeacherTopicScope,
  getTeacherAssignedTopicIds,
  hasActiveCourseAccess,
} from './authorizationService.ts';

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function listPublishedExams() {
  return db
    .select()
    .from(exams)
    .where(and(eq(exams.isDeleted, false), eq(exams.status, 'Published')))
    .orderBy(desc(exams.createdAt));
}

export async function startMcqOrWrittenAttempt(examId: number, studentUserId: number, role: string) {
  const access = await hasActiveCourseAccess(studentUserId, role);
  if (!access.hasAccess) {
    throw new Error('SUBSCRIPTION_REQUIRED');
  }

  const [exam] = await db
    .select()
    .from(exams)
    .where(and(eq(exams.id, examId), eq(exams.isDeleted, false)));
  if (!exam) throw new Error('Exam not found');

  const now = new Date();
  if (now < exam.startsAt || now > exam.endsAt) {
    throw new Error('Exam is outside its active schedule window');
  }

  // Check if there is an existing InProgress attempt
  const existingAttempts = await db
    .select()
    .from(examAttempts)
    .where(
      and(
        eq(examAttempts.examId, examId),
        eq(examAttempts.studentUserId, studentUserId),
        eq(examAttempts.status, 'InProgress')
      )
    )
    .orderBy(desc(examAttempts.startedAt));

  let attempt = existingAttempts[0];
  const eqRows = await db
    .select()
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId))
    .orderBy(examQuestions.sortOrder);

  const qIds = eqRows.map((r) => r.questionId);
  const qRows =
    qIds.length > 0
      ? await db
          .select()
          .from(questions)
          .where(and(inArray(questions.id, qIds), eq(questions.isDeleted, false)))
      : [];

  if (!attempt) {
    const orderedIds = exam.randomizeQuestions ? shuffleArray(qIds) : qIds;
    const expiresAt = new Date(now.getTime() + exam.durationMinutes * 60 * 1000);
    const [created] = await db
      .insert(examAttempts)
      .values({
        examId,
        studentUserId,
        startedAt: now,
        expiresAt,
        status: 'InProgress',
        questionOrderJson: orderedIds,
      })
      .returning();
    attempt = created;
  }

  const optRows =
    qIds.length > 0
      ? await db
          .select({
            id: questionOptions.id,
            questionId: questionOptions.questionId,
            optionLabel: questionOptions.optionLabel,
            contentLatexBn: questionOptions.contentLatexBn,
            contentLatexEn: questionOptions.contentLatexEn,
            sortOrder: questionOptions.sortOrder,
          })
          .from(questionOptions)
          .where(inArray(questionOptions.questionId, qIds))
      : [];

  const qMap = new Map(qRows.map((q) => [q.id, q]));
  const orderedIds = Array.isArray(attempt.questionOrderJson)
    ? (attempt.questionOrderJson as number[])
    : qIds;

  // NEVER expose isCorrect or solutionLatex during active attempt!
  const sanitizedQuestions = orderedIds
    .map((qid) => {
      const q = qMap.get(qid);
      if (!q) return null;
      const qOpts = optRows.filter((o) => o.questionId === qid);
      const arrangedOpts = exam.randomizeOptions
        ? shuffleArray(qOpts)
        : qOpts.sort((a, b) => a.sortOrder - b.sortOrder);
      return {
        id: q.id,
        topicId: q.topicId,
        questionType: q.questionType,
        promptLatexBn: q.promptLatexBn,
        promptLatexEn: q.promptLatexEn,
        marks: Number(q.marks),
        negativeMarks: exam.negativeMarkingEnabled ? Number(q.negativeMarks) : 0,
        options: arrangedOpts,
      };
    })
    .filter(Boolean);

  return {
    attempt: {
      id: attempt.id,
      examId: attempt.examId,
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      status: attempt.status,
    },
    exam: {
      id: exam.id,
      titleBn: exam.titleBn,
      titleEn: exam.titleEn,
      examType: exam.examType,
      durationMinutes: exam.durationMinutes,
      totalMarks: Number(exam.totalMarks),
      negativeMarkingEnabled: exam.negativeMarkingEnabled,
      showScoreImmediately: exam.showScoreImmediately,
      solutionPublishAt: exam.solutionPublishAt,
    },
    questions: sanitizedQuestions,
  };
}

export async function submitMcqAttempt(
  attemptId: number,
  studentUserId: number,
  answers: Array<{ questionId: number; selectedOptionId: number | null }>,
  autoSubmitted: boolean
) {
  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .select()
      .from(examAttempts)
      .where(and(eq(examAttempts.id, attemptId), eq(examAttempts.studentUserId, studentUserId)));

    if (!attempt) throw new Error('Exam attempt not found');
    if (attempt.status !== 'InProgress') {
      throw new Error('Exam attempt already submitted');
    }

    const [exam] = await tx.select().from(exams).where(eq(exams.id, attempt.examId));
    if (!exam) throw new Error('Exam not found');

    const eqRows = await tx
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, exam.id));
    const qIds = eqRows.map((r) => r.questionId);

    const qRows =
      qIds.length > 0
        ? await tx.select().from(questions).where(inArray(questions.id, qIds))
        : [];
    const optRows =
      qIds.length > 0
        ? await tx.select().from(questionOptions).where(inArray(questionOptions.questionId, qIds))
        : [];

    const qMap = new Map(qRows.map((q) => [q.id, q]));
    const optMap = new Map(optRows.map((o) => [o.id, o]));
    const answerByQ = new Map(answers.map((a) => [a.questionId, a.selectedOptionId]));

    let totalScore = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    for (const qId of qIds) {
      const q = qMap.get(qId);
      if (!q) continue;
      const selectedOptionId = answerByQ.get(qId) ?? null;
      let isCorrect: boolean | null = null;
      let marksAwarded = 0;

      if (selectedOptionId !== null) {
        const chosen = optMap.get(selectedOptionId);
        if (chosen && chosen.questionId === qId) {
          isCorrect = chosen.isCorrect;
          if (chosen.isCorrect) {
            marksAwarded = Number(q.marks);
            correctCount++;
          } else {
            marksAwarded = exam.negativeMarkingEnabled ? -Number(q.negativeMarks) : 0;
            wrongCount++;
          }
        } else {
          unansweredCount++;
        }
      } else {
        unansweredCount++;
      }

      totalScore += marksAwarded;

      await tx
        .insert(mcqAnswers)
        .values({
          attemptId,
          questionId: qId,
          selectedOptionId,
          isCorrect,
          marksAwarded: marksAwarded.toFixed(2),
        })
        .onConflictDoUpdate({
          target: [mcqAnswers.attemptId, mcqAnswers.questionId],
          set: {
            selectedOptionId,
            isCorrect,
            marksAwarded: marksAwarded.toFixed(2),
            answeredAt: new Date(),
          },
        });
    }

    const now = new Date();
    const [updated] = await tx
      .update(examAttempts)
      .set({
        submittedAt: now,
        autoSubmitted,
        status: 'Evaluated',
        totalScore: totalScore.toFixed(2),
      })
      .where(eq(examAttempts.id, attemptId))
      .returning();

    await tx.insert(notifications).values({
      recipientUserId: studentUserId,
      channel: 'Web',
      category: 'ExamSubmitted',
      titleBn: 'পরীক্ষা জমা হয়েছে',
      titleEn: 'Exam Submitted',
      bodyBn: `${exam.titleBn} সফলভাবে জমা দেওয়া হয়েছে।`,
      bodyEn: `${exam.titleEn} has been submitted.`,
    });

    const solutionsUnlocked =
      exam.solutionForcePublished || now >= exam.solutionPublishAt;

    return {
      attempt: updated,
      showScoreImmediately: exam.showScoreImmediately,
      scoreSummary: exam.showScoreImmediately
        ? {
            totalScore: Number(totalScore.toFixed(2)),
            totalMarks: Number(exam.totalMarks),
            correctCount,
            wrongCount,
            unansweredCount,
          }
        : null,
      solutionsUnlocked,
      solutionPublishAt: exam.solutionPublishAt,
    };
  });
}

export async function getAttemptSolutionsIfAllowed(
  attemptId: number,
  viewerUserId: number,
  viewerRole: string,
  ipAddress: string
) {
  const [attempt] = await db
    .select()
    .from(examAttempts)
    .where(eq(examAttempts.id, attemptId));
  if (!attempt) throw new Error('Attempt not found');

  if (viewerRole === 'Student' && attempt.studentUserId !== viewerUserId) {
    throw new Error('FORBIDDEN');
  }

  const [exam] = await db.select().from(exams).where(eq(exams.id, attempt.examId));
  if (!exam) throw new Error('Exam not found');

  if (viewerRole === 'Teacher' && exam.topicId) {
    const allowed = await assertTeacherTopicScope(
      viewerUserId,
      viewerRole,
      exam.topicId,
      'canManageExams',
      ipAddress
    );
    if (!allowed) throw new Error('FORBIDDEN');
  }

  const now = new Date();
  const isStaff = viewerRole === 'SuperAdmin' || viewerRole === 'Teacher';
  const solutionsUnlocked =
    isStaff || exam.solutionForcePublished || now >= exam.solutionPublishAt;

  // Enforce strict backend embargo: DO NOT include correct options or solutionLatex if locked!
  if (!solutionsUnlocked) {
    return {
      solutionsUnlocked: false,
      solutionPublishAt: exam.solutionPublishAt,
      totalScore: exam.showScoreImmediately ? Number(attempt.totalScore ?? 0) : null,
      totalMarks: Number(exam.totalMarks),
      items: [],
    };
  }

  const ansRows = await db
    .select()
    .from(mcqAnswers)
    .where(eq(mcqAnswers.attemptId, attemptId));
  const eqRows = await db
    .select()
    .from(examQuestions)
    .where(eq(examQuestions.examId, exam.id));
  const qIds = eqRows.map((r) => r.questionId);
  const qRows =
    qIds.length > 0 ? await db.select().from(questions).where(inArray(questions.id, qIds)) : [];
  const optRows =
    qIds.length > 0
      ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, qIds))
      : [];

  const ansMap = new Map(ansRows.map((a) => [a.questionId, a]));

  const items = qRows.map((q) => {
    const ans = ansMap.get(q.id);
    const opts = optRows.filter((o) => o.questionId === q.id);
    return {
      questionId: q.id,
      promptLatexBn: q.promptLatexBn,
      promptLatexEn: q.promptLatexEn,
      solutionLatexBn: q.solutionLatexBn,
      solutionLatexEn: q.solutionLatexEn,
      selectedOptionId: ans?.selectedOptionId ?? null,
      isCorrect: ans?.isCorrect ?? null,
      marksAwarded: ans ? Number(ans.marksAwarded) : 0,
      options: opts.map((o) => ({
        id: o.id,
        optionLabel: o.optionLabel,
        contentLatexBn: o.contentLatexBn,
        contentLatexEn: o.contentLatexEn,
        isCorrect: o.isCorrect,
      })),
    };
  });

  return {
    solutionsUnlocked: true,
    solutionPublishAt: exam.solutionPublishAt,
    totalScore: Number(attempt.totalScore ?? 0),
    totalMarks: Number(exam.totalMarks),
    items,
  };
}

export async function getExamLeaderboard(examId: number) {
  const rows = await db
    .select({
      attemptId: examAttempts.id,
      studentUserId: examAttempts.studentUserId,
      fullName: users.fullName,
      totalScore: examAttempts.totalScore,
      submittedAt: examAttempts.submittedAt,
    })
    .from(examAttempts)
    .innerJoin(users, eq(examAttempts.studentUserId, users.id))
    .where(and(eq(examAttempts.examId, examId), eq(examAttempts.status, 'Evaluated')))
    .orderBy(desc(examAttempts.totalScore));

  return rows.map((r, idx) => ({
    rank: idx + 1,
    attemptId: r.attemptId,
    studentName: r.fullName,
    score: Number(r.totalScore ?? 0),
    submittedAt: r.submittedAt,
  }));
}

export async function getStudentAnalytics(studentUserId: number) {
  const allLessons = await db
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.isDeleted, false));
  const completedRows = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, studentUserId), eq(lessonProgress.isCompleted, true)));

  const attempts = await db
    .select({
      attemptId: examAttempts.id,
      examId: examAttempts.examId,
      titleBn: exams.titleBn,
      titleEn: exams.titleEn,
      examType: exams.examType,
      topicId: exams.topicId,
      totalScore: examAttempts.totalScore,
      totalMarks: exams.totalMarks,
      status: examAttempts.status,
      submittedAt: examAttempts.submittedAt,
      solutionPublishAt: exams.solutionPublishAt,
      solutionForcePublished: exams.solutionForcePublished,
    })
    .from(examAttempts)
    .innerJoin(exams, eq(examAttempts.examId, exams.id))
    .where(eq(examAttempts.studentUserId, studentUserId))
    .orderBy(desc(examAttempts.startedAt));

  const evaluated = attempts.filter((a) => a.status === 'Evaluated' && a.totalScore !== null);
  const averagePercent =
    evaluated.length > 0
      ? Math.round(
          evaluated.reduce(
            (sum, a) => sum + (Number(a.totalScore) / Math.max(1, Number(a.totalMarks))) * 100,
            0
          ) / evaluated.length
        )
      : 0;

  // Topic-wise performance from MCQ answers
  const topicRows = await db.select().from(topics).where(eq(topics.isDeleted, false));
  const topicMap = new Map(topicRows.map((t) => [t.id, t]));
  const topicScoreBuckets = new Map<number, { earned: number; possible: number }>();

  for (const a of evaluated) {
    if (!a.topicId) continue;
    const prev = topicScoreBuckets.get(a.topicId) || { earned: 0, possible: 0 };
    prev.earned += Math.max(0, Number(a.totalScore ?? 0));
    prev.possible += Number(a.totalMarks);
    topicScoreBuckets.set(a.topicId, prev);
  }

  const topicPerformance = Array.from(topicScoreBuckets.entries()).map(([tid, stats]) => {
    const t = topicMap.get(tid);
    const pct = stats.possible > 0 ? Math.round((stats.earned / stats.possible) * 100) : 0;
    return {
      topicId: tid,
      titleBn: t?.titleBn || `Topic #${tid}`,
      titleEn: t?.titleEn || `Topic #${tid}`,
      percentage: pct,
    };
  });

  const strongTopics = topicPerformance.filter((t) => t.percentage >= 70);
  const weakTopics = topicPerformance.filter((t) => t.percentage < 70);

  return {
    totalLessons: allLessons.length,
    completedLessons: completedRows.length,
    remainingLessons: Math.max(0, allLessons.length - completedRows.length),
    totalExamsTaken: attempts.length,
    averageScorePercent: averagePercent,
    topicPerformance,
    strongTopics,
    weakTopics,
    attempts,
  };
}

export async function getWrittenSubmissionsForReviewer(userId: number, role: string) {
  const allRows = await db
    .select({
      id: writtenSubmissions.id,
      attemptId: writtenSubmissions.attemptId,
      examId: writtenSubmissions.examId,
      examTitleBn: exams.titleBn,
      examTitleEn: exams.titleEn,
      topicId: exams.topicId,
      studentUserId: writtenSubmissions.studentUserId,
      studentName: users.fullName,
      studentEmail: users.email,
      studentPdfFileId: writtenSubmissions.studentPdfFileId,
      checkedPdfFileId: writtenSubmissions.checkedPdfFileId,
      compressionProfile: writtenSubmissions.compressionProfile,
      pageCount: writtenSubmissions.pageCount,
      status: writtenSubmissions.status,
      marksObtained: writtenSubmissions.marksObtained,
      maxMarks: writtenSubmissions.maxMarks,
      teacherFeedbackBn: writtenSubmissions.teacherFeedbackBn,
      teacherFeedbackEn: writtenSubmissions.teacherFeedbackEn,
      submittedAt: writtenSubmissions.submittedAt,
      evaluatedAt: writtenSubmissions.evaluatedAt,
    })
    .from(writtenSubmissions)
    .innerJoin(exams, eq(writtenSubmissions.examId, exams.id))
    .innerJoin(users, eq(writtenSubmissions.studentUserId, users.id))
    .orderBy(desc(writtenSubmissions.submittedAt));

  if (role === 'SuperAdmin') return allRows;
  if (role === 'Teacher') {
    const { topicIds } = await getTeacherAssignedTopicIds(userId);
    const allowedSet = new Set(topicIds);
    return allRows.filter((r) => r.topicId && allowedSet.has(r.topicId));
  }
  return allRows.filter((r) => r.studentUserId === userId);
}
