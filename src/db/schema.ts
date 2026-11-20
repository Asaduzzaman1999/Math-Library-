import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  smallint,
  boolean,
  timestamp,
  numeric,
  jsonb,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// 1. IDENTITY, ROLES, MANDATORY 2FA & SESSION MANAGEMENT
// ============================================================================

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: varchar('email', { length: 255 }).notNull().unique(),
  fullName: varchar('full_name', { length: 160 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 30 }),
  passwordHash: text('password_hash'),
  recoveryPinHash: text('recovery_pin_hash'),
  role: varchar('role', { length: 24 }).notNull().default('Student'), // SuperAdmin | Teacher | Student
  preferredLanguage: varchar('preferred_language', { length: 5 }).notNull().default('bn'), // bn | en
  themePreference: varchar('theme_preference', { length: 10 }).notNull().default('light'), // light | dark
  institution: varchar('institution', { length: 200 }),
  targetTrack: varchar('target_track', { length: 120 }),
  employeeCode: varchar('employee_code', { length: 40 }),
  designation: varchar('designation', { length: 120 }),
  isActive: boolean('is_active').notNull().default(true),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: varchar('code_hash', { length: 128 }).notNull(),
    channel: varchar('channel', { length: 32 }).notNull().default('AdminIssued'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    usedAt: timestamp('used_at', { withTimezone: true }),
    issuedByUserId: integer('issued_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_pwd_reset_user').on(table.userId, table.expiresAt)]
);

export const userTwoFactorSettings = pgTable('user_two_factor_settings', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  isEnabled: boolean('is_enabled').notNull().default(false),
  isMandatory: boolean('is_mandatory').notNull().default(false),
  totpSecretEnc: text('totp_secret_enc'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const recoveryCodes = pgTable(
  'recovery_codes',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: varchar('code_hash', { length: 255 }).notNull(),
    isUsed: boolean('is_used').notNull().default(false),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_recovery_codes_user').on(table.userId, table.isUsed)]
);

export const userSessions = pgTable(
  'user_sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: varchar('session_id', { length: 128 }).notNull().unique(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: text('user_agent'),
    isRevoked: boolean('is_revoked').notNull().default(false),
    revokedByUserId: integer('revoked_by_user_id').references(() => users.id),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_user_sessions_user').on(table.userId, table.isRevoked)]
);

// ============================================================================
// 2. SINGLE MAIN COURSE & HIERARCHICAL CONTENT STRUCTURE
// ============================================================================

export const course = pgTable(
  'course',
  {
    id: serial('id').primaryKey(),
    singletonKey: smallint('singleton_key').notNull().default(1).unique(),
    titleBn: varchar('title_bn', { length: 240 }).notNull(),
    titleEn: varchar('title_en', { length: 240 }).notNull(),
    descriptionBn: text('description_bn').notNull(),
    descriptionEn: text('description_en').notNull(),
    isPublished: boolean('is_published').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [check('chk_single_course', sql`singleton_key = 1`)]
);

export const units = pgTable(
  'units',
  {
    id: serial('id').primaryKey(),
    courseId: integer('course_id')
      .notNull()
      .references(() => course.id, { onDelete: 'cascade' }),
    titleBn: varchar('title_bn', { length: 240 }).notNull(),
    titleEn: varchar('title_en', { length: 240 }).notNull(),
    summaryBn: text('summary_bn'),
    summaryEn: text('summary_en'),
    sortOrder: integer('sort_order').notNull().default(1),
    status: varchar('status', { length: 20 }).notNull().default('Published'), // Draft | Published | Archived
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_units_order').on(table.courseId, table.sortOrder)]
);

export const subUnits = pgTable(
  'sub_units',
  {
    id: serial('id').primaryKey(),
    unitId: integer('unit_id')
      .notNull()
      .references(() => units.id, { onDelete: 'cascade' }),
    titleBn: varchar('title_bn', { length: 240 }).notNull(),
    titleEn: varchar('title_en', { length: 240 }).notNull(),
    sortOrder: integer('sort_order').notNull().default(1),
    status: varchar('status', { length: 20 }).notNull().default('Published'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_sub_units_order').on(table.unitId, table.sortOrder)]
);

export const topics = pgTable(
  'topics',
  {
    id: serial('id').primaryKey(),
    subUnitId: integer('sub_unit_id')
      .notNull()
      .references(() => subUnits.id, { onDelete: 'cascade' }),
    titleBn: varchar('title_bn', { length: 250 }).notNull(),
    titleEn: varchar('title_en', { length: 250 }).notNull(),
    summaryBn: text('summary_bn'),
    summaryEn: text('summary_en'),
    sortOrder: integer('sort_order').notNull().default(1),
    isFreePreview: boolean('is_free_preview').notNull().default(false),
    status: varchar('status', { length: 20 }).notNull().default('Published'),
    isDeleted: boolean('is_deleted').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_topics_order').on(table.subUnitId, table.sortOrder)]
);

// ============================================================================
// 3. TEACHER RESOURCE-SCOPED ASSIGNMENTS
// ============================================================================

export const teacherAssignments = pgTable(
  'teacher_assignments',
  {
    id: serial('id').primaryKey(),
    teacherUserId: integer('teacher_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scopeType: varchar('scope_type', { length: 20 }).notNull(), // Unit | SubUnit | Topic
    unitId: integer('unit_id').references(() => units.id, { onDelete: 'cascade' }),
    subUnitId: integer('sub_unit_id').references(() => subUnits.id, { onDelete: 'cascade' }),
    topicId: integer('topic_id').references(() => topics.id, { onDelete: 'cascade' }),
    canManageContent: boolean('can_manage_content').notNull().default(true),
    canManageExams: boolean('can_manage_exams').notNull().default(true),
    canEvaluateScripts: boolean('can_evaluate_scripts').notNull().default(true),
    assignedByUserId: integer('assigned_by_user_id').references(() => users.id),
    isActive: boolean('is_active').notNull().default(true),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('idx_teacher_assignments_teacher').on(table.teacherUserId, table.isActive)]
);

// ============================================================================
// 4. FILES, VIDEOS & PROCESSING PIPELINE
// ============================================================================

export const storedFiles = pgTable('stored_files', {
  id: serial('id').primaryKey(),
  bucketCategory: varchar('bucket_category', { length: 50 }).notNull(), // LessonVideos | VideoThumbnails | StudentAnswerScripts | EvaluatedAnswerScripts | PdfResources | Images | GeneratedReports
  objectKey: varchar('object_key', { length: 500 }).notNull().unique(),
  originalFilename: varchar('original_filename', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 120 }).notNull(),
  extension: varchar('extension', { length: 20 }).notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  originalSizeBytes: integer('original_size_bytes').notNull(),
  compressionProfile: varchar('compression_profile', { length: 30 }).notNull().default('Balanced'), // HighQuality | Balanced | SmallSize | None
  sha256Checksum: varchar('sha256_checksum', { length: 64 }).notNull(),
  ownerUserId: integer('owner_user_id').references(() => users.id),
  isPrivate: boolean('is_private').notNull().default(true),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const videos = pgTable('videos', {
  id: serial('id').primaryKey(),
  titleBn: varchar('title_bn', { length: 240 }).notNull(),
  titleEn: varchar('title_en', { length: 240 }).notNull(),
  uploadedByUserId: integer('uploaded_by_user_id').references(() => users.id),
  sourceFileId: integer('source_file_id').references(() => storedFiles.id),
  thumbnailFileId: integer('thumbnail_file_id').references(() => storedFiles.id),
  playbackUrl: text('playback_url'),
  availableResolutions: varchar('available_resolutions', { length: 60 }).notNull().default('360p,480p,720p'),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  processingStatus: varchar('processing_status', { length: 30 }).notNull().default('Ready'), // Pending | Processing | Ready | Failed
  isPublished: boolean('is_published').notNull().default(true),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const videoProcessingJobs = pgTable('video_processing_jobs', {
  id: serial('id').primaryKey(),
  videoId: integer('video_id')
    .notNull()
    .references(() => videos.id, { onDelete: 'cascade' }),
  targetProfiles: varchar('target_profiles', { length: 100 }).notNull().default('360p,480p,720p'),
  status: varchar('status', { length: 30 }).notNull().default('Queued'), // Queued | Processing | Succeeded | Failed
  progressPercent: smallint('progress_percent').notNull().default(0),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  sourcePurged: boolean('source_purged').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 5. LESSONS, DISCUSSIONS, EXAMPLES & STUDENT PROGRESS
// ============================================================================

export const lessons = pgTable('lessons', {
  id: serial('id').primaryKey(),
  topicId: integer('topic_id')
    .notNull()
    .references(() => topics.id, { onDelete: 'cascade' }),
  titleBn: varchar('title_bn', { length: 240 }).notNull(),
  titleEn: varchar('title_en', { length: 240 }).notNull(),
  contentBn: text('content_bn').notNull(),
  contentEn: text('content_en').notNull(),
  videoId: integer('video_id').references(() => videos.id),
  resourceFileId: integer('resource_file_id').references(() => storedFiles.id),
  sortOrder: integer('sort_order').notNull().default(1),
  status: varchar('status', { length: 20 }).notNull().default('Published'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdByUserId: integer('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const discussions = pgTable('discussions', {
  id: serial('id').primaryKey(),
  topicId: integer('topic_id')
    .notNull()
    .references(() => topics.id, { onDelete: 'cascade' }),
  titleBn: varchar('title_bn', { length: 240 }).notNull(),
  titleEn: varchar('title_en', { length: 240 }).notNull(),
  bodyLatexBn: text('body_latex_bn').notNull(),
  bodyLatexEn: text('body_latex_en').notNull(),
  diagramFileId: integer('diagram_file_id').references(() => storedFiles.id),
  authorUserId: integer('author_user_id').references(() => users.id),
  status: varchar('status', { length: 20 }).notNull().default('Published'),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mathematicalExamples = pgTable('mathematical_examples', {
  id: serial('id').primaryKey(),
  topicId: integer('topic_id')
    .notNull()
    .references(() => topics.id, { onDelete: 'cascade' }),
  titleBn: varchar('title_bn', { length: 240 }).notNull(),
  titleEn: varchar('title_en', { length: 240 }).notNull(),
  problemLatexBn: text('problem_latex_bn').notNull(),
  problemLatexEn: text('problem_latex_en').notNull(),
  solutionStepsLatexBn: text('solution_steps_latex_bn').notNull(),
  solutionStepsLatexEn: text('solution_steps_latex_en').notNull(),
  videoId: integer('video_id').references(() => videos.id),
  sortOrder: integer('sort_order').notNull().default(1),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdByUserId: integer('created_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lessonId: integer('lesson_id')
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    isCompleted: boolean('is_completed').notNull().default(true),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_lesson_progress').on(table.userId, table.lessonId)]
);

export const favourites = pgTable(
  'favourites',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    topicId: integer('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_user_fav_topic').on(table.userId, table.topicId)]
);

export const studyRoutines = pgTable('study_routines', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  topicId: integer('topic_id')
    .notNull()
    .references(() => topics.id, { onDelete: 'cascade' }),
  dayOfWeek: smallint('day_of_week').notNull(), // 0 (Sun) - 6 (Sat)
  startTime: varchar('start_time', { length: 10 }).notNull(), // HH:mm
  durationMinutes: integer('duration_minutes').notNull().default(45),
  notes: text('notes'),
  isCompleted: boolean('is_completed').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 6. QUESTION BANK, MCQ & WRITTEN EXAMS, ANSWER SCRIPTS & EMBARGOED SOLUTIONS
// ============================================================================

export const questions = pgTable('questions', {
  id: serial('id').primaryKey(),
  topicId: integer('topic_id')
    .notNull()
    .references(() => topics.id, { onDelete: 'cascade' }),
  questionType: varchar('question_type', { length: 20 }).notNull(), // MCQ | Written
  promptLatexBn: text('prompt_latex_bn').notNull(),
  promptLatexEn: text('prompt_latex_en').notNull(),
  marks: numeric('marks', { precision: 6, scale: 2 }).notNull().default('1.00'),
  negativeMarks: numeric('negative_marks', { precision: 6, scale: 2 }).notNull().default('0.25'),
  difficulty: varchar('difficulty', { length: 20 }).notNull().default('Medium'),
  solutionLatexBn: text('solution_latex_bn'),
  solutionLatexEn: text('solution_latex_en'),
  solutionVideoId: integer('solution_video_id').references(() => videos.id),
  createdByUserId: integer('created_by_user_id').references(() => users.id),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const questionOptions = pgTable('question_options', {
  id: serial('id').primaryKey(),
  questionId: integer('question_id')
    .notNull()
    .references(() => questions.id, { onDelete: 'cascade' }),
  optionLabel: varchar('option_label', { length: 4 }).notNull(), // A | B | C | D
  contentLatexBn: text('content_latex_bn').notNull(),
  contentLatexEn: text('content_latex_en').notNull(),
  isCorrect: boolean('is_correct').notNull().default(false),
  sortOrder: smallint('sort_order').notNull().default(1),
});

export const exams = pgTable('exams', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id')
    .notNull()
    .references(() => course.id),
  unitId: integer('unit_id').references(() => units.id),
  subUnitId: integer('sub_unit_id').references(() => subUnits.id),
  topicId: integer('topic_id').references(() => topics.id),
  titleBn: varchar('title_bn', { length: 240 }).notNull(),
  titleEn: varchar('title_en', { length: 240 }).notNull(),
  examType: varchar('exam_type', { length: 20 }).notNull(), // MCQ | Written
  durationMinutes: integer('duration_minutes').notNull().default(30),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  totalMarks: numeric('total_marks', { precision: 7, scale: 2 }).notNull(),
  passMarks: numeric('pass_marks', { precision: 7, scale: 2 }).notNull(),
  negativeMarkingEnabled: boolean('negative_marking_enabled').notNull().default(true),
  randomizeQuestions: boolean('randomize_questions').notNull().default(true),
  randomizeOptions: boolean('randomize_options').notNull().default(true),
  showScoreImmediately: boolean('show_score_immediately').notNull().default(true),
  solutionPublishAt: timestamp('solution_publish_at', { withTimezone: true }).notNull(),
  solutionForcePublished: boolean('solution_force_published').notNull().default(false),
  status: varchar('status', { length: 20 }).notNull().default('Published'), // Draft | Published | Archived
  createdByUserId: integer('created_by_user_id').references(() => users.id),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const examQuestions = pgTable(
  'exam_questions',
  {
    id: serial('id').primaryKey(),
    examId: integer('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(1),
  },
  (table) => [uniqueIndex('uq_exam_question').on(table.examId, table.questionId)]
);

export const examAttempts = pgTable(
  'exam_attempts',
  {
    id: serial('id').primaryKey(),
    examId: integer('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    studentUserId: integer('student_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    autoSubmitted: boolean('auto_submitted').notNull().default(false),
    status: varchar('status', { length: 24 }).notNull().default('InProgress'), // InProgress | Submitted | Evaluated
    totalScore: numeric('total_score', { precision: 7, scale: 2 }),
    questionOrderJson: jsonb('question_order_json'),
  },
  (table) => [index('idx_exam_attempts_exam_user').on(table.examId, table.studentUserId)]
);

export const mcqAnswers = pgTable(
  'mcq_answers',
  {
    id: serial('id').primaryKey(),
    attemptId: integer('attempt_id')
      .notNull()
      .references(() => examAttempts.id, { onDelete: 'cascade' }),
    questionId: integer('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    selectedOptionId: integer('selected_option_id').references(() => questionOptions.id),
    isCorrect: boolean('is_correct'),
    marksAwarded: numeric('marks_awarded', { precision: 6, scale: 2 }).notNull().default('0.00'),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('uq_attempt_question_ans').on(table.attemptId, table.questionId)]
);

export const writtenSubmissions = pgTable('written_submissions', {
  id: serial('id').primaryKey(),
  attemptId: integer('attempt_id')
    .notNull()
    .unique()
    .references(() => examAttempts.id, { onDelete: 'cascade' }),
  examId: integer('exam_id')
    .notNull()
    .references(() => exams.id, { onDelete: 'cascade' }),
  studentUserId: integer('student_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  studentPdfFileId: integer('student_pdf_file_id')
    .notNull()
    .references(() => storedFiles.id),
  checkedPdfFileId: integer('checked_pdf_file_id').references(() => storedFiles.id),
  compressionProfile: varchar('compression_profile', { length: 30 }).notNull().default('Balanced'),
  pageCount: integer('page_count').notNull().default(1),
  status: varchar('status', { length: 30 }).notNull().default('Submitted'), // Submitted | Evaluated
  marksObtained: numeric('marks_obtained', { precision: 7, scale: 2 }),
  maxMarks: numeric('max_marks', { precision: 7, scale: 2 }).notNull(),
  teacherFeedbackBn: text('teacher_feedback_bn'),
  teacherFeedbackEn: text('teacher_feedback_en'),
  evaluatedByUserId: integer('evaluated_by_user_id').references(() => users.id),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
});

// ============================================================================
// 7. SUBSCRIPTIONS (6 DURATIONS), COUPONS & BANGLADESH PAYMENT GATEWAYS
// ============================================================================

export const subscriptionPlans = pgTable('subscription_plans', {
  id: serial('id').primaryKey(),
  courseId: integer('course_id')
    .notNull()
    .references(() => course.id),
  planCode: varchar('plan_code', { length: 30 }).notNull().unique(), // Monthly | Quarterly | HalfYearly | Annual | TwoYear | ThreeYear
  titleBn: varchar('title_bn', { length: 120 }).notNull(),
  titleEn: varchar('title_en', { length: 120 }).notNull(),
  durationMonths: smallint('duration_months').notNull(), // 1 | 3 | 6 | 12 | 24 | 36
  priceBdt: numeric('price_bdt', { precision: 10, scale: 2 }).notNull(),
  gracePeriodDays: integer('grace_period_days').notNull().default(3),
  isActive: boolean('is_active').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const coupons = pgTable('coupons', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  discountType: varchar('discount_type', { length: 20 }).notNull(), // Percentage | Fixed
  discountValue: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
  maxRedemptions: integer('max_redemptions').notNull().default(100),
  redemptionCount: integer('redemption_count').notNull().default(0),
  validUntil: timestamp('valid_until', { withTimezone: true }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    studentUserId: integer('student_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    planId: integer('plan_id').references(() => subscriptionPlans.id),
    courseId: integer('course_id')
      .notNull()
      .references(() => course.id),
    status: varchar('status', { length: 24 }).notNull().default('Active'), // Active | GracePeriod | Expired | Refunded
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    graceEndsAt: timestamp('grace_ends_at', { withTimezone: true }).notNull(),
    isAdminGranted: boolean('is_admin_granted').notNull().default(false),
    grantedByUserId: integer('granted_by_user_id').references(() => users.id),
    renewalPolicy: varchar('renewal_policy', { length: 30 }).notNull().default('ExtendFromExpiry'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_subscriptions_user_status').on(table.studentUserId, table.status, table.expiresAt)]
);

export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  studentUserId: integer('student_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: integer('subscription_id').references(() => subscriptions.id),
  planId: integer('plan_id')
    .notNull()
    .references(() => subscriptionPlans.id),
  couponId: integer('coupon_id').references(() => coupons.id),
  gateway: varchar('gateway', { length: 30 }).notNull(), // bKash | Nagad | Rocket | Visa | Mastercard | AdminGrant
  grossAmountBdt: numeric('gross_amount_bdt', { precision: 10, scale: 2 }).notNull(),
  discountBdt: numeric('discount_bdt', { precision: 10, scale: 2 }).notNull().default('0.00'),
  netAmountBdt: numeric('net_amount_bdt', { precision: 10, scale: 2 }).notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 120 }).notNull().unique(),
  gatewayTrxId: varchar('gateway_trx_id', { length: 120 }).unique(),
  status: varchar('status', { length: 24 }).notNull().default('Initiated'), // Initiated | Verified | Failed | Refunded
  refundReason: text('refund_reason'),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============================================================================
// 8. JOB EXAM SOLUTIONS, NOTIFICATIONS, AUDIT, SECURITY & BACKUP OPS
// ============================================================================

export const jobExamSolutions = pgTable('job_exam_solutions', {
  id: serial('id').primaryKey(),
  category: varchar('category', { length: 40 }).notNull(), // BCS | Bank | Government | PrimaryTeacher | NTRCA | Other
  examName: varchar('exam_name', { length: 220 }).notNull(),
  examYear: smallint('exam_year').notNull(),
  topicId: integer('topic_id').references(() => topics.id),
  questionLatexBn: text('question_latex_bn').notNull(),
  questionLatexEn: text('question_latex_en').notNull(),
  optionsJson: jsonb('options_json').notNull(),
  correctOption: varchar('correct_option', { length: 4 }).notNull(),
  explanationLatexBn: text('explanation_latex_bn').notNull(),
  explanationLatexEn: text('explanation_latex_en').notNull(),
  calculationStepsLatex: text('calculation_steps_latex').notNull(),
  videoId: integer('video_id').references(() => videos.id),
  createdByUserId: integer('created_by_user_id').references(() => users.id),
  isPublished: boolean('is_published').notNull().default(true),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    recipientUserId: integer('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 20 }).notNull().default('Web'), // Web | Email | SMS
    category: varchar('category', { length: 50 }).notNull(),
    titleBn: varchar('title_bn', { length: 240 }).notNull(),
    titleEn: varchar('title_en', { length: 240 }).notNull(),
    bodyBn: text('body_bn').notNull(),
    bodyEn: text('body_en').notNull(),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_notifications_user').on(table.recipientUserId, table.isRead)]
);

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').references(() => users.id),
  actorRole: varchar('actor_role', { length: 30 }),
  action: varchar('action', { length: 120 }).notNull(),
  entityName: varchar('entity_name', { length: 80 }).notNull(),
  entityId: varchar('entity_id', { length: 80 }),
  detailsJson: jsonb('details_json'),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const securityEvents = pgTable('security_events', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  eventType: varchar('event_type', { length: 80 }).notNull(),
  severity: varchar('severity', { length: 20 }).notNull().default('Medium'),
  ipAddress: varchar('ip_address', { length: 64 }),
  detailsJson: jsonb('details_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const backupRecords = pgTable('backup_records', {
  id: serial('id').primaryKey(),
  backupScope: varchar('backup_scope', { length: 40 }).notNull(), // PostgreSQL | ObjectStorage
  sizeBytes: integer('size_bytes').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('Completed'), // Completed | RestoreVerified | Failed
  restoreTestedAt: timestamp('restore_tested_at', { withTimezone: true }),
  restoreTestPassed: boolean('restore_test_passed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const systemSettings = pgTable('system_settings', {
  settingKey: varchar('setting_key', { length: 100 }).primaryKey(),
  settingValueJson: jsonb('setting_value_json').notNull(),
  updatedByUserId: integer('updated_by_user_id').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
