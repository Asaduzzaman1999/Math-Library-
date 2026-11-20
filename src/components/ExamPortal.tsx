import React, { useEffect, useState } from 'react';
import { Clock, Trophy, Lock, CheckCircle2, ScanLine, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { Lang, pick } from '../lib/i18n';
import { MathRenderer } from './MathRenderer';
import { DocumentScannerModal } from './DocumentScannerModal';

interface ExamPortalProps {
  lang: Lang;
  isAuthenticated: boolean;
  onSignIn: () => void;
  onOpenPlans: () => void;
}

export const ExamPortal: React.FC<ExamPortalProps> = ({
  lang,
  isAuthenticated,
  onSignIn,
  onOpenPlans,
}) => {
  const [examsList, setExamsList] = useState<any[]>([]);
  const [activeRun, setActiveRun] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [solutionView, setSolutionView] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<{ examTitle: string; rows: any[] } | null>(null);
  const [scannerExam, setScannerExam] = useState<any>(null);
  const [writtenSummary, setWrittenSummary] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/exams')
      .then((res) => setExamsList(res.exams || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeRun || secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitMcq(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRun]);

  const handleStartExam = async (exam: any) => {
    setError('');
    setSubmissionResult(null);
    setSolutionView(null);
    if (!isAuthenticated) {
      onSignIn();
      return;
    }

    if (exam.examType === 'Written') {
      try {
        await apiFetch(`/api/exams/${exam.id}/start`, { method: 'POST' });
        setScannerExam(exam);
      } catch (e: any) {
        if (e.status === 402) onOpenPlans();
        else setError(e.message);
      }
      return;
    }

    try {
      const data = await apiFetch(`/api/exams/${exam.id}/start`, { method: 'POST' });
      setActiveRun(data);
      setAnswers({});
      const msLeft = new Date(data.attempt.expiresAt).getTime() - Date.now();
      setSecondsLeft(Math.max(10, Math.floor(msLeft / 1000)));
    } catch (e: any) {
      if (e.status === 402) onOpenPlans();
      else setError(e.message);
    }
  };

  const handleSubmitMcq = async (autoSubmitted = false) => {
    if (!activeRun) return;
    try {
      const payload = activeRun.questions.map((q: any) => ({
        questionId: q.id,
        selectedOptionId: answers[q.id] ?? null,
      }));
      const res = await apiFetch(`/api/exams/attempts/${activeRun.attempt.id}/submit-mcq`, {
        method: 'POST',
        body: JSON.stringify({ answers: payload, autoSubmitted }),
      });
      setSubmissionResult(res);
      setActiveRun(null);

      // Fetch solution status from server (enforces backend embargo!)
      const solRes = await apiFetch(`/api/exams/attempts/${res.attempt.id}/solutions`);
      setSolutionView(solRes);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadLeaderboard = async (exam: any) => {
    const res = await apiFetch(`/api/exams/${exam.id}/leaderboard`);
    setLeaderboard({
      examTitle: pick(exam.titleBn, exam.titleEn, lang),
      rows: res.leaderboard || [],
    });
  };

  const fmtTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {lang === 'bn' ? 'স্বয়ংক্রিয় মূল্যায়ন ও ডকুমেন্ট স্ক্যানার' : 'MCQ & Written Examination System'}
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
          {lang === 'bn' ? 'অনলাইন এমসিকিউ ও লিখিত পরীক্ষা' : 'Live Examinations'}
        </h2>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {writtenSummary && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 p-5 space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
            {lang === 'bn' ? 'লিখিত উত্তরপত্র অপ্টিমাইজড PDF হিসেবে জমা হয়েছে' : 'Written Script Optimized & Submitted'}
          </div>
          <div className="text-xs font-mono text-emerald-700 dark:text-emerald-300">
            {writtenSummary.pageCount} pages · {(writtenSummary.originalSizeBytes / 1024).toFixed(1)} KB →{' '}
            {(writtenSummary.optimizedSizeBytes / 1024).toFixed(1)} KB · Profile: {writtenSummary.profile}
          </div>
        </div>
      )}

      {/* Active MCQ Runner */}
      {activeRun && (
        <div className="rounded-xl border border-sky-300 dark:border-sky-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {pick(activeRun.exam.titleBn, activeRun.exam.titleEn, lang)}
              </h3>
              <div className="text-xs text-slate-500 mt-0.5">
                {activeRun.exam.negativeMarkingEnabled
                  ? lang === 'bn'
                    ? 'নেগেটিভ মার্কিং প্রযোজ্য'
                    : 'Negative marking enabled'
                  : lang === 'bn'
                  ? 'নেগেটিভ মার্কিং নেই'
                  : 'No negative marking'}
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono text-sm font-semibold">
              <Clock className="w-4 h-4 text-sky-600" />
              <span>{fmtTimer(secondsLeft)}</span>
            </div>
          </div>

          <div className="space-y-6">
            {activeRun.questions.map((q: any, idx: number) => (
              <div key={q.id} className="space-y-3 pb-5 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {idx + 1}.
                  </div>
                  <div className="flex-1">
                    <MathRenderer
                      text={pick(q.promptLatexBn, q.promptLatexEn, lang)}
                      className="text-sm font-medium text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <span className="text-xs font-mono text-slate-500 shrink-0">
                    +{q.marks} / -{q.negativeMarks}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-4">
                  {q.options.map((opt: any) => {
                    const selected = answers[q.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                        className={`text-left px-3.5 py-2.5 rounded-lg border text-sm flex items-center gap-2.5 transition-colors ${
                          selected
                            ? 'border-sky-600 bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-100'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="font-mono text-xs font-semibold">{opt.optionLabel}.</span>
                        <MathRenderer text={pick(opt.contentLatexBn, opt.contentLatexEn, lang)} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => handleSubmitMcq(false)}
              className="py-2.5 px-6 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium"
            >
              {lang === 'bn' ? 'উত্তর জমা দিন' : 'Submit Answers'}
            </button>
          </div>
        </div>
      )}

      {/* Submission Score + Embargoed Solutions Gate */}
      {submissionResult && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          {submissionResult.scoreSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-xs text-slate-500">{lang === 'bn' ? 'প্রাপ্ত নম্বর' : 'Score'}</div>
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100">
                  {submissionResult.scoreSummary.totalScore} / {submissionResult.scoreSummary.totalMarks}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{lang === 'bn' ? 'সঠিক' : 'Correct'}</div>
                <div className="text-xl font-bold font-mono text-emerald-600">
                  {submissionResult.scoreSummary.correctCount}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{lang === 'bn' ? 'ভুল' : 'Wrong'}</div>
                <div className="text-xl font-bold font-mono text-red-600">
                  {submissionResult.scoreSummary.wrongCount}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">{lang === 'bn' ? 'উত্তরহীন' : 'Skipped'}</div>
                <div className="text-xl font-bold font-mono text-slate-500">
                  {submissionResult.scoreSummary.unansweredCount}
                </div>
              </div>
            </div>
          )}

          {solutionView && !solutionView.solutionsUnlocked ? (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-4 flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                <div className="font-semibold">
                  {lang === 'bn'
                    ? 'পূর্ণাঙ্গ সমাধান নির্ধারিত সময় পর্যন্ত লক করা আছে'
                    : 'Full Solutions Embargoed Until Scheduled Publication'}
                </div>
                <div>
                  {lang === 'bn' ? 'প্রকাশের সময়:' : 'Scheduled Release:'}{' '}
                  <span className="font-mono">
                    {new Date(solutionView.solutionPublishAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ) : solutionView?.items?.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {lang === 'bn' ? 'প্রকাশিত প্রশ্ন ও সমাধান বিশ্লেষণ' : 'Published Question & Solution Review'}
              </h4>
              {solutionView.items.map((item: any, idx: number) => (
                <div
                  key={item.questionId}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Q{idx + 1}</span>
                    <span className="font-mono">
                      {item.isCorrect === true
                        ? lang === 'bn'
                          ? `সঠিক (+${item.marksAwarded})`
                          : `Correct (+${item.marksAwarded})`
                        : item.isCorrect === false
                        ? lang === 'bn'
                          ? `ভুল (${item.marksAwarded})`
                          : `Wrong (${item.marksAwarded})`
                        : lang === 'bn'
                        ? 'উত্তর দেওয়া হয়নি'
                        : 'Skipped'}
                    </span>
                  </div>
                  <MathRenderer
                    text={pick(item.promptLatexBn, item.promptLatexEn, lang)}
                    className="text-sm font-medium"
                  />
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 pt-1">
                    <MathRenderer text={pick(item.solutionLatexBn, item.solutionLatexEn, lang)} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Exams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {examsList.map((exam) => (
          <div
            key={exam.id}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
          >
            <div className="space-y-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {exam.examType === 'Written'
                  ? lang === 'bn'
                    ? 'লিখিত পরীক্ষা · মোবাইল স্ক্যানার'
                    : 'Written Exam · Scanner PDF'
                  : lang === 'bn'
                  ? 'এমসিকিউ পরীক্ষা'
                  : 'MCQ Exam'}{' '}
                · <span className="font-mono">{exam.durationMinutes} min</span> ·{' '}
                <span className="font-mono">{exam.totalMarks} marks</span>
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {pick(exam.titleBn, exam.titleEn, lang)}
              </h3>
              <div className="text-xs text-slate-500">
                {exam.solutionForcePublished || new Date() >= new Date(exam.solutionPublishAt)
                  ? lang === 'bn'
                    ? 'সমাধান উন্মুক্ত'
                    : 'Solutions Available'
                  : `${lang === 'bn' ? 'সমাধান প্রকাশ:' : 'Solutions open:'} ${new Date(
                      exam.solutionPublishAt
                    ).toLocaleDateString()}`}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleStartExam(exam)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium"
              >
                {exam.examType === 'Written' && <ScanLine className="w-3.5 h-3.5" />}
                {exam.examType === 'Written'
                  ? lang === 'bn'
                    ? 'স্ক্যান করে জমা দিন'
                    : 'Open Scanner & Submit'
                  : lang === 'bn'
                  ? 'পরীক্ষা শুরু করুন'
                  : 'Start Exam'}
              </button>
              <button
                type="button"
                onClick={() => loadLeaderboard(exam)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                title={lang === 'bn' ? 'লিডারবোর্ড' : 'Leaderboard'}
              >
                <Trophy className="w-4 h-4 text-amber-600" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard Panel */}
      {leaderboard && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'bn' ? 'লিডারবোর্ড:' : 'Leaderboard:'} {leaderboard.examTitle}
            </h4>
            <button
              type="button"
              onClick={() => setLeaderboard(null)}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
          {leaderboard.rows.length === 0 ? (
            <p className="text-xs text-slate-500">
              {lang === 'bn' ? 'এখনও কোনো শিক্ষার্থী অংশগ্রহণ করেনি।' : 'No evaluated submissions yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <th className="py-2 text-left">Rank</th>
                    <th className="py-2 text-left">{lang === 'bn' ? 'শিক্ষার্থী' : 'Student'}</th>
                    <th className="py-2 text-right">{lang === 'bn' ? 'স্কোর' : 'Score'}</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.rows.map((r) => (
                    <tr key={r.attemptId} className="border-b border-slate-100 dark:border-slate-800/60">
                      <td className="py-2 font-mono">#{r.rank}</td>
                      <td className="py-2">{r.studentName}</td>
                      <td className="py-2 text-right font-mono font-semibold">{r.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Built-In Mobile Document Scanner Modal */}
      {scannerExam && (
        <DocumentScannerModal
          lang={lang}
          examId={scannerExam.id}
          examTitle={pick(scannerExam.titleBn, scannerExam.titleEn, lang)}
          onClose={() => setScannerExam(null)}
          onSubmitted={(summary) => {
            setScannerExam(null);
            setWrittenSummary(summary);
          }}
        />
      )}
    </div>
  );
};
