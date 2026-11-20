import { db } from '../db/index.ts';
import {
  backupRecords,
  coupons,
  course,
  discussions,
  examQuestions,
  exams,
  jobExamSolutions,
  lessons,
  mathematicalExamples,
  questionOptions,
  questions,
  subUnits,
  subscriptionPlans,
  systemSettings,
  topics,
  units,
  videos,
} from '../db/schema.ts';
import { eq } from 'drizzle-orm';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed() {
  const existingCourse = await db.select().from(course).where(eq(course.singletonKey, 1));
  if (existingCourse.length > 0) {
    return;
  }

  // 1. Singleton Main Course
  const [mainCourse] = await db
    .insert(course)
    .values({
      singletonKey: 1,
      titleBn: 'ম্যাথ লাইব্রেরি সম্পূর্ণ গণিত কোর্স',
      titleEn: 'Math Library Mathematics Course',
      descriptionBn:
        'একটিমাত্র সমন্বিত গণিত কোর্সে ক্যালকুলাস, রৈখিক বীজগণিত, জ্যামিতি, ত্রিকোণমিতি এবং প্রতিযোগিতামূলক পরীক্ষার পূর্ণাঙ্গ প্রস্তুতি, ভিডিও সমাধান ও লিখিত-এমসিকিউ মূল্যায়ন।',
      descriptionEn:
        'One unified, complete mathematics curriculum spanning Calculus, Linear Algebra, Coordinate Geometry, Trigonometry, and competitive exam mastery with step-by-step proofs, video explanations, MCQ & written script grading.',
      isPublished: true,
    })
    .onConflictDoNothing()
    .returning();

  const courseId = mainCourse.id;

  // 2. Six Subscription Plans
  await db
    .insert(subscriptionPlans)
    .values([
      {
        courseId,
        planCode: 'Monthly',
        titleBn: 'মাসিক সাবস্ক্রিপশন (১ মাস)',
        titleEn: 'Monthly Plan (1 Month)',
        durationMonths: 1,
        priceBdt: '499.00',
        gracePeriodDays: 3,
      },
      {
        courseId,
        planCode: 'Quarterly',
        titleBn: 'ত্রৈমাসিক সাবস্ক্রিপশন (৩ মাস)',
        titleEn: 'Quarterly Plan (3 Months)',
        durationMonths: 3,
        priceBdt: '1299.00',
        gracePeriodDays: 3,
      },
      {
        courseId,
        planCode: 'HalfYearly',
        titleBn: 'অর্ধবার্ষিক সাবস্ক্রিপশন (৬ মাস)',
        titleEn: 'Half-Yearly Plan (6 Months)',
        durationMonths: 6,
        priceBdt: '2399.00',
        gracePeriodDays: 5,
      },
      {
        courseId,
        planCode: 'Annual',
        titleBn: 'বার্ষিক সাবস্ক্রিপশন (১২ মাস)',
        titleEn: 'Annual Plan (12 Months)',
        durationMonths: 12,
        priceBdt: '4200.00',
        gracePeriodDays: 7,
      },
      {
        courseId,
        planCode: 'TwoYear',
        titleBn: 'দ্বি-বার্ষিক সাবস্ক্রিপশন (২৪ মাস)',
        titleEn: 'Two-Year Plan (24 Months)',
        durationMonths: 24,
        priceBdt: '7500.00',
        gracePeriodDays: 7,
      },
      {
        courseId,
        planCode: 'ThreeYear',
        titleBn: 'ত্রি-বার্ষিক সাবস্ক্রিপশন (৩৬ মাস)',
        titleEn: 'Three-Year Plan (36 Months)',
        durationMonths: 36,
        priceBdt: '10500.00',
        gracePeriodDays: 10,
      },
    ])
    .onConflictDoNothing();

  // 3. Coupons
  const futureYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  await db
    .insert(coupons)
    .values([
      {
        code: 'MATH20',
        discountType: 'Percentage',
        discountValue: '20.00',
        maxRedemptions: 500,
        validUntil: futureYear,
        isActive: true,
      },
      {
        code: 'BCS500',
        discountType: 'Fixed',
        discountValue: '500.00',
        maxRedemptions: 200,
        validUntil: futureYear,
        isActive: true,
      },
    ])
    .onConflictDoNothing();

  // 4. Units, Sub-Units & Topics
  const [unit1] = await db
    .insert(units)
    .values({
      courseId,
      titleBn: 'ইউনিট ১: ডিফারেনশিয়াল ও ইন্টিগ্রাল ক্যালকুলাস',
      titleEn: 'Unit 1: Differential & Integral Calculus',
      summaryBn: 'সীমা, অন্তরীকরণ, পর্যায়ক্রমিক অন্তরীকরণ এবং নির্দিষ্ট যোগজীকরণ।',
      summaryEn: 'Limits, continuity, derivatives, optimization, and definite integrals.',
      sortOrder: 1,
    })
    .returning();

  const [unit2] = await db
    .insert(units)
    .values({
      courseId,
      titleBn: 'ইউনিট ২: ম্যাট্রিক্স, নির্ণায়ক ও রৈখিক বীজগণিত',
      titleEn: 'Unit 2: Matrices, Determinants & Linear Algebra',
      summaryBn: 'ম্যাট্রিক্সের বিপরীতকরণ, ক্রেমারের সূত্র এবং আইগেন মান বিশ্লেষণ।',
      summaryEn: 'Matrix inverses, Cramer’s rule, vector spaces, and eigenvalues.',
      sortOrder: 2,
    })
    .returning();

  const [unit3] = await db
    .insert(units)
    .values({
      courseId,
      titleBn: 'ইউনিট ৩: স্থানাঙ্ক জ্যামিতি ও কণিক',
      titleEn: 'Unit 3: Coordinate Geometry & Conic Sections',
      summaryBn: 'সরলরেখা, বৃত্ত, পরাবৃত্ত, উপবৃত্ত ও অধিবৃত্তের জ্যামিতিক বিশ্লেষণ।',
      summaryEn: 'Straight lines, circles, parabolas, ellipses, and hyperbolas.',
      sortOrder: 3,
    })
    .returning();

  const [su1] = await db
    .insert(subUnits)
    .values({
      unitId: unit1.id,
      titleBn: 'সাব-ইউনিট ১.১: সীমা ও অবিচ্ছিন্নতা',
      titleEn: 'Sub-unit 1.1: Limits & Continuity',
      sortOrder: 1,
    })
    .returning();

  const [su2] = await db
    .insert(subUnits)
    .values({
      unitId: unit1.id,
      titleBn: 'সাব-ইউনিট ১.২: নির্দিষ্ট যোগজ ও ক্ষেত্রফল',
      titleEn: 'Sub-unit 1.2: Definite Integrals & Area',
      sortOrder: 2,
    })
    .returning();

  const [su3] = await db
    .insert(subUnits)
    .values({
      unitId: unit2.id,
      titleBn: 'সাব-ইউনিট ২.১: নির্ণায়ক ও রৈখিক সমীকরণ জোট',
      titleEn: 'Sub-unit 2.1: Determinants & Linear Systems',
      sortOrder: 1,
    })
    .returning();

  const [su4] = await db
    .insert(subUnits)
    .values({
      unitId: unit3.id,
      titleBn: 'সাব-ইউনিট ৩.১: পরাবৃত্ত ও উপবৃত্ত',
      titleEn: 'Sub-unit 3.1: Parabola & Ellipse',
      sortOrder: 1,
    })
    .returning();

  const [topic1, topic2, topic3, topic4, topic5] = await db
    .insert(topics)
    .values([
      {
        subUnitId: su1.id,
        titleBn: 'টপিক ১: মৌলিক ত্রিকোণমিতিক সীমা ও এল-হসপিটাল বিধি',
        titleEn: 'Topic 1: Trigonometric Limits & L’Hôpital’s Rule',
        summaryBn: '০/০ অনির্ণেয় আকার নিরসনে স্যান্ডউইচ উপপাদ্য ও এল-হসপিটাল প্রয়োগ।',
        summaryEn: 'Resolving 0/0 indeterminate forms with Squeeze Theorem and L’Hôpital.',
        sortOrder: 1,
        isFreePreview: true,
      },
      {
        subUnitId: su1.id,
        titleBn: 'টপিক ২: ফাংশনের অবিচ্ছিন্নতা ও অন্তরীকরণযোগ্যতা',
        titleEn: 'Topic 2: Continuity & Differentiability',
        summaryBn: 'খণ্ডিত ফাংশনের বাম-সীমা, ডান-সীমা ও ব্যবকলনযোগ্যতা পরীক্ষা।',
        summaryEn: 'Testing one-sided limits and differentiability of piecewise functions.',
        sortOrder: 2,
        isFreePreview: false,
      },
      {
        subUnitId: su2.id,
        titleBn: 'টপিক ৩: নির্দিষ্ট যোগজের ধর্মাবলি ও কিংস প্রোপার্টি',
        titleEn: 'Topic 3: Properties of Definite Integrals',
        summaryBn: 'প্রতিসাম্য ও কিংস প্রোপার্টি ব্যবহার করে দ্রুত যোগজ নির্ণয়।',
        summaryEn: 'Fast integral evaluation via symmetry and King’s substitution rule.',
        sortOrder: 1,
        isFreePreview: false,
      },
      {
        subUnitId: su3.id,
        titleBn: 'টপিক ৪: নির্ণায়কের ধর্ম ও বিপরীত ম্যাট্রিক্স',
        titleEn: 'Topic 4: Determinant Properties & Inverse Matrix',
        summaryBn: 'সারি-স্তম্ভ অপারেশন এবং অ্যাডজয়েন্ট পদ্ধতিতে বিপরীত ম্যাট্রিক্স।',
        summaryEn: 'Row/column reduction and adjugate method for matrix inversion.',
        sortOrder: 1,
        isFreePreview: true,
      },
      {
        subUnitId: su4.id,
        titleBn: 'টপিক ৫: উপবৃত্তের উৎকেন্দ্রিকতা ও স্পর্শক সমীকরণ',
        titleEn: 'Topic 5: Ellipse Eccentricity & Tangent Equations',
        summaryBn: 'প্রমিত উপবৃত্তের উপকেন্দ্র, নিয়ামক এবং স্পর্শকের শর্ত।',
        summaryEn: 'Foci, directrices, and tangency conditions for standard ellipses.',
        sortOrder: 1,
        isFreePreview: false,
      },
    ])
    .returning();

  // 5. Sample Video metadata (processed)
  const [vid1, vid2] = await db
    .insert(videos)
    .values([
      {
        titleBn: 'ভিডিও ব্যাখ্যা: ত্রিকোণমিতিক সীমার জ্যামিতিক প্রমাণ',
        titleEn: 'Video Proof: Geometric Proof of sin(x)/x Limit',
        availableResolutions: '360p,480p,720p',
        durationSeconds: 540,
        processingStatus: 'Ready',
        isPublished: true,
      },
      {
        titleBn: 'ভিডিও সমাধান: কিংস প্রোপার্টি ভিত্তিক যোগজ',
        titleEn: 'Video Solution: King’s Property Definite Integral',
        availableResolutions: '360p,480p,720p',
        durationSeconds: 420,
        processingStatus: 'Ready',
        isPublished: true,
      },
    ])
    .returning();

  // 6. Lessons, Discussions & Mathematical Examples
  await db.insert(lessons).values([
    {
      topicId: topic1.id,
      titleBn: 'পাঠ ১.১: সীমার মূল ধারণা ও মৌলিক উপপাদ্য',
      titleEn: 'Lesson 1.1: Core Limit Theorems & Indeterminate Forms',
      contentBn:
        'যখন $x \\to 0$ হয়, তখন $\\frac{\\sin x}{x}$ ভগ্নাংশটি $\\frac{0}{0}$ আকার ধারণ করে। জ্যামিতিক স্যান্ডউইচ উপপাদ্য ব্যবহার করে প্রমাণ করা যায় যে $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$, যেখানে $x$ রেডিয়ান এককে পরিমাপ করা হয়।',
      contentEn:
        'As $x \\to 0$, the quotient $\\frac{\\sin x}{x}$ approaches the indeterminate form $\\frac{0}{0}$. Using unit-circle sector area inequalities and the Squeeze Theorem, we establish $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$ for $x$ in radians.',
      videoId: vid1.id,
      sortOrder: 1,
    },
    {
      topicId: topic3.id,
      titleBn: 'পাঠ ৩.১: প্রতিসম ব্যবধিতে নির্দিষ্ট যোগজ',
      titleEn: 'Lesson 3.1: Definite Integrals on Symmetric Intervals',
      contentBn:
        'যেকোনো অবিচ্ছিন্ন ফাংশন $f(x)$-এর জন্য $\\int_a^b f(x)\\,dx = \\int_a^b f(a+b-x)\\,dx$ সূত্রটি অত্যন্ত কার্যকর। বিশেষত $[0, \\pi/2]$ ব্যবধিতে ত্রিকোণমিতিক যোগজে এটি সরাসরি উত্তর এনে দেয়।',
      contentEn:
        'For any integrable function $f(x)$ on $[a,b]$, the reflection identity $\\int_a^b f(x)\\,dx = \\int_a^b f(a+b-x)\\,dx$ enables immediate cancellation in trigonometric integrals.',
      videoId: vid2.id,
      sortOrder: 1,
    },
    {
      topicId: topic4.id,
      titleBn: 'পাঠ ৪.১: $3 \\times 3$ নির্ণায়ক বিস্তার ও ক্রেমারের নিয়ম',
      titleEn: 'Lesson 4.1: 3x3 Determinant Expansion & Cramer’s Rule',
      contentBn:
        'একটি রৈখিক সমীকরণ জোট $AX = B$-এর অনন্য সমাধান থাকবে যদি এবং কেবল যদি $\\det(A) \\neq 0$ হয়। তখন $A^{-1} = \\frac{1}{|A|} \\operatorname{adj}(A)$।',
      contentEn:
        'A linear system $AX = B$ admits a unique solution if and only if $\\det(A) \\neq 0$, in which case $A^{-1} = \\frac{1}{|A|} \\operatorname{adj}(A)$.',
      sortOrder: 1,
    },
  ]);

  await db.insert(discussions).values([
    {
      topicId: topic1.id,
      titleBn: 'আলোচনা: কখন ডিগ্রি ও রেডিয়ান পরিবর্তন সতর্কতা প্রয়োজন?',
      titleEn: 'Discussion: Degree vs. Radian Pitfalls in Limits',
      bodyLatexBn:
        'পরীক্ষায় প্রায়ই $\\lim_{x \\to 0} \\frac{\\sin x^\\circ}{x}$ আসে। মনে রাখতে হবে $x^\\circ = \\frac{\\pi x}{180}$ রেডিয়ান। তাই $\\lim_{x \\to 0} \\frac{\\sin(\\frac{\\pi x}{180})}{x} = \\frac{\\pi}{180}$।',
      bodyLatexEn:
        'Competitive exams frequently test $\\lim_{x \\to 0} \\frac{\\sin x^\\circ}{x}$. Converting degrees to radians gives $x^\\circ = \\frac{\\pi x}{180}$, yielding $\\lim_{x \\to 0} \\frac{\\sin(\\frac{\\pi x}{180})}{x} = \\frac{\\pi}{180}$.',
    },
    {
      topicId: topic4.id,
      titleBn: 'আলোচনা: ম্যাট্রিক্সের সিঙ্গুলারিটি ও জ্যামিতিক তাৎপর্য',
      titleEn: 'Discussion: Singularity & Geometric Interpretation',
      bodyLatexBn:
        'যখন $\\det(A) = 0$, তখন রৈখিক রূপান্তরটি স্থানকে নিম্নমাত্রিক সমতলে সংকুচিত করে, ফলে বিপরীত ম্যাট্রিক্স অস্তিত্বশীল থাকে না।',
      bodyLatexEn:
        'When $\\det(A) = 0$, the linear transformation collapses volume to zero, making the transformation non-invertible.',
    },
  ]);

  await db.insert(mathematicalExamples).values([
    {
      topicId: topic1.id,
      titleBn: 'উদাহরণ ১: অ্যালজেব্রিক-ত্রিকোণমিতিক সীমা নির্ণয়',
      titleEn: 'Example 1: Evaluating Mixed Trigonometric Limit',
      problemLatexBn: 'মান নির্ণয় করো: $$\\lim_{x \\to 0} \\frac{1 - \\cos 4x}{x^2}$$',
      problemLatexEn: 'Evaluate: $$\\lim_{x \\to 0} \\frac{1 - \\cos 4x}{x^2}$$',
      solutionStepsLatexBn:
        'ধাপ ১: ত্রিকোণমিতিক অভেদ প্রয়োগ করি: $1 - \\cos 4x = 2\\sin^2(2x)$।\n\nধাপ ২: প্রতিস্থাপন করলে পাই: $$\\lim_{x \\to 0} \\frac{2\\sin^2(2x)}{x^2} = 2 \\cdot 4 \\left(\\lim_{x \\to 0} \\frac{\\sin 2x}{2x}\\right)^2 = 8 \\cdot (1)^2 = 8$$',
      solutionStepsLatexEn:
        'Step 1: Apply half-angle identity $1 - \\cos 4x = 2\\sin^2(2x)$.\n\nStep 2: Rewrite quotient: $$\\lim_{x \\to 0} \\frac{2\\sin^2(2x)}{x^2} = 8 \\left(\\lim_{x \\to 0} \\frac{\\sin 2x}{2x}\\right)^2 = 8(1)^2 = 8$$',
      videoId: vid1.id,
      sortOrder: 1,
    },
    {
      topicId: topic3.id,
      titleBn: 'উদাহরণ ২: $\\int_0^{\\pi/2} \\frac{\\sqrt{\\sin x}}{\\sqrt{\\sin x} + \\sqrt{\\cos x}}\\,dx$ নির্ণয়',
      titleEn: 'Example 2: Evaluating Symmetric Radical Trigonometric Integral',
      problemLatexBn: 'মান বের করো: $$I = \\int_0^{\\pi/2} \\frac{\\sqrt{\\sin x}}{\\sqrt{\\sin x} + \\sqrt{\\cos x}}\\,dx$$',
      problemLatexEn: 'Compute: $$I = \\int_0^{\\pi/2} \\frac{\\sqrt{\\sin x}}{\\sqrt{\\sin x} + \\sqrt{\\cos x}}\\,dx$$',
      solutionStepsLatexBn:
        'ধাপ ১: কিংস প্রোপার্টি $x \\mapsto \\frac{\\pi}{2} - x$ প্রয়োগ করে পাই:\n$$I = \\int_0^{\\pi/2} \\frac{\\sqrt{\\cos x}}{\\sqrt{\\cos x} + \\sqrt{\\sin x}}\\,dx$$\n\nধাপ ২: উভয় সমীকরণ যোগ করলে:\n$$2I = \\int_0^{\\pi/2} 1\\,dx = \\frac{\\pi}{2} \\implies I = \\frac{\\pi}{4}$$',
      solutionStepsLatexEn:
        'Step 1: Apply $x \\mapsto \\frac{\\pi}{2} - x$:\n$$I = \\int_0^{\\pi/2} \\frac{\\sqrt{\\cos x}}{\\sqrt{\\cos x} + \\sqrt{\\sin x}}\\,dx$$\n\nStep 2: Add the two expressions:\n$$2I = \\int_0^{\\pi/2} 1\\,dx = \\frac{\\pi}{2} \\implies I = \\frac{\\pi}{4}$$',
      videoId: vid2.id,
      sortOrder: 1,
    },
    {
      topicId: topic4.id,
      titleBn: 'উদাহরণ ৩: নির্ণায়কের মান ও বিপরীতযোগ্যতা যাচাই',
      titleEn: 'Example 3: Checking Matrix Invertibility via Determinant',
      problemLatexBn: 'যদি $A = \\begin{pmatrix} 3 & 1 \\\\ 2 & 4 \\end{pmatrix}$ হয়, তবে $A^{-1}$ নির্ণয় করো।',
      problemLatexEn: 'Given $A = \\begin{pmatrix} 3 & 1 \\\\ 2 & 4 \\end{pmatrix}$, compute $A^{-1}$.',
      solutionStepsLatexBn:
        'ধাপ ১: $|A| = (3)(4) - (1)(2) = 12 - 2 = 10 \\neq 0$।\n\nধাপ ২: $$A^{-1} = \\frac{1}{10} \\begin{pmatrix} 4 & -1 \\\\ -2 & 3 \\end{pmatrix}$$',
      solutionStepsLatexEn:
        'Step 1: $\\det(A) = (3)(4) - (1)(2) = 10 \\neq 0$.\n\nStep 2: $$A^{-1} = \\frac{1}{10} \\begin{pmatrix} 4 & -1 \\\\ -2 & 3 \\end{pmatrix}$$',
      sortOrder: 1,
    },
  ]);

  // 7. Question Bank & Exams
  const [q1, q2, q3, q4, wq1] = await db
    .insert(questions)
    .values([
      {
        topicId: topic1.id,
        questionType: 'MCQ',
        promptLatexBn: '$\\lim_{x \\to 0} \\frac{\\sin 5x}{x}$-এর মান কত?',
        promptLatexEn: 'What is the value of $\\lim_{x \\to 0} \\frac{\\sin 5x}{x}$?',
        marks: '2.00',
        negativeMarks: '0.50',
        difficulty: 'Easy',
        solutionLatexBn: '$\\lim_{x \\to 0} 5 \\cdot \\frac{\\sin 5x}{5x} = 5 \\times 1 = 5$।',
        solutionLatexEn: '$\\lim_{x \\to 0} 5 \\cdot \\frac{\\sin 5x}{5x} = 5 \\times 1 = 5$.',
        solutionVideoId: vid1.id,
      },
      {
        topicId: topic1.id,
        questionType: 'MCQ',
        promptLatexBn: '$\\lim_{x \\to 0} \\frac{e^{3x} - 1}{x}$-এর মান কোনটি?',
        promptLatexEn: 'Evaluate $\\lim_{x \\to 0} \\frac{e^{3x} - 1}{x}$.',
        marks: '2.00',
        negativeMarks: '0.50',
        difficulty: 'Medium',
        solutionLatexBn: 'এল-হসপিটাল বিধি প্রয়োগ করে $\\lim_{x \\to 0} \\frac{3e^{3x}}{1} = 3$।',
        solutionLatexEn: 'Applying L’Hôpital’s Rule yields $\\lim_{x \\to 0} \\frac{3e^{3x}}{1} = 3$.',
      },
      {
        topicId: topic4.id,
        questionType: 'MCQ',
        promptLatexBn: '$\\begin{vmatrix} 2 & k \\\\ 4 & 6 \\end{vmatrix} = 0$ হলে $k$-এর মান কত?',
        promptLatexEn: 'If $\\begin{vmatrix} 2 & k \\\\ 4 & 6 \\end{vmatrix} = 0$, find $k$.',
        marks: '2.00',
        negativeMarks: '0.50',
        difficulty: 'Easy',
        solutionLatexBn: '$12 - 4k = 0 \\implies k = 3$।',
        solutionLatexEn: '$12 - 4k = 0 \\implies k = 3$.',
      },
      {
        topicId: topic3.id,
        questionType: 'MCQ',
        promptLatexBn: '$\\int_0^{\\pi/2} \\sin^2 x\\,dx$-এর মান কত?',
        promptLatexEn: 'Evaluate $\\int_0^{\\pi/2} \\sin^2 x\\,dx$.',
        marks: '2.00',
        negativeMarks: '0.50',
        difficulty: 'Medium',
        solutionLatexBn: 'প্রতিসাম্য বিধি অনুসারে $I = \\int_0^{\\pi/2} \\cos^2 x\\,dx$, অতএব $2I = \\frac{\\pi}{2} \\implies I = \\frac{\\pi}{4}$।',
        solutionLatexEn: 'By King’s rule $2I = \\int_0^{\\pi/2} (\\sin^2 x + \\cos^2 x)\\,dx = \\frac{\\pi}{2} \\implies I = \\frac{\\pi}{4}$.',
        solutionVideoId: vid2.id,
      },
      {
        topicId: topic1.id,
        questionType: 'Written',
        promptLatexBn:
          'স্যান্ডউইচ উপপাদ্য ব্যবহার করে প্রমাণ করো যে $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$ এবং এর সাহায্যে $\\lim_{x \\to 0} \\frac{1 - \\cos 6x}{x^2}$ নির্ণয় করো। (নম্বর: ১০)',
        promptLatexEn:
          'Prove $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$ using the Squeeze Theorem, and deduce $\\lim_{x \\to 0} \\frac{1 - \\cos 6x}{x^2}$. (Marks: 10)',
        marks: '10.00',
        negativeMarks: '0.00',
        difficulty: 'Hard',
        solutionLatexBn: 'বৃত্তকলা ক্ষেত্রফলের অসমতা $\\cos x < \\frac{\\sin x}{x} < 1$ থেকে প্রমাণিত এবং দ্বিতীয় অংশের মান $18$।',
        solutionLatexEn: 'From sector inequalities $\\cos x < \\frac{\\sin x}{x} < 1$, the limit equals $1$, and the second part evaluates to $18$.',
      },
    ])
    .returning();

  await db.insert(questionOptions).values([
    { questionId: q1.id, optionLabel: 'A', contentLatexBn: '$1$', contentLatexEn: '$1$', isCorrect: false, sortOrder: 1 },
    { questionId: q1.id, optionLabel: 'B', contentLatexBn: '$5$', contentLatexEn: '$5$', isCorrect: true, sortOrder: 2 },
    { questionId: q1.id, optionLabel: 'C', contentLatexBn: '$0$', contentLatexEn: '$0$', isCorrect: false, sortOrder: 3 },
    { questionId: q1.id, optionLabel: 'D', contentLatexBn: '$\\frac{1}{5}$', contentLatexEn: '$\\frac{1}{5}$', isCorrect: false, sortOrder: 4 },

    { questionId: q2.id, optionLabel: 'A', contentLatexBn: '$0$', contentLatexEn: '$0$', isCorrect: false, sortOrder: 1 },
    { questionId: q2.id, optionLabel: 'B', contentLatexBn: '$1$', contentLatexEn: '$1$', isCorrect: false, sortOrder: 2 },
    { questionId: q2.id, optionLabel: 'C', contentLatexBn: '$3$', contentLatexEn: '$3$', isCorrect: true, sortOrder: 3 },
    { questionId: q2.id, optionLabel: 'D', contentLatexBn: '$e^3$', contentLatexEn: '$e^3$', isCorrect: false, sortOrder: 4 },

    { questionId: q3.id, optionLabel: 'A', contentLatexBn: '$2$', contentLatexEn: '$2$', isCorrect: false, sortOrder: 1 },
    { questionId: q3.id, optionLabel: 'B', contentLatexBn: '$3$', contentLatexEn: '$3$', isCorrect: true, sortOrder: 2 },
    { questionId: q3.id, optionLabel: 'C', contentLatexBn: '$4$', contentLatexEn: '$4$', isCorrect: false, sortOrder: 3 },
    { questionId: q3.id, optionLabel: 'D', contentLatexBn: '$6$', contentLatexEn: '$6$', isCorrect: false, sortOrder: 4 },

    { questionId: q4.id, optionLabel: 'A', contentLatexBn: '$\\frac{\\pi}{2}$', contentLatexEn: '$\\frac{\\pi}{2}$', isCorrect: false, sortOrder: 1 },
    { questionId: q4.id, optionLabel: 'B', contentLatexBn: '$\\frac{\\pi}{4}$', contentLatexEn: '$\\frac{\\pi}{4}$', isCorrect: true, sortOrder: 2 },
    { questionId: q4.id, optionLabel: 'C', contentLatexBn: '$\\pi$', contentLatexEn: '$\\pi$', isCorrect: false, sortOrder: 3 },
    { questionId: q4.id, optionLabel: 'D', contentLatexBn: '$1$', contentLatexEn: '$1$', isCorrect: false, sortOrder: 4 },
  ]);

  const now = new Date();
  const pastStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const futureEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const embargoPublish = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const [mcqExamPublished, mcqExamEmbargoed, writtenExam] = await db
    .insert(exams)
    .values([
      {
        courseId,
        unitId: unit1.id,
        topicId: topic1.id,
        titleBn: 'মডেল এমসিকিউ পরীক্ষা ১: সীমা ও নির্ণায়ক (সমাধান উন্মুক্ত)',
        titleEn: 'Model MCQ Exam 1: Limits & Determinants (Solutions Open)',
        examType: 'MCQ',
        durationMinutes: 15,
        startsAt: pastStart,
        endsAt: futureEnd,
        totalMarks: '6.00',
        passMarks: '3.00',
        negativeMarkingEnabled: true,
        randomizeQuestions: true,
        randomizeOptions: true,
        showScoreImmediately: true,
        solutionPublishAt: pastStart,
        solutionForcePublished: true,
        status: 'Published',
      },
      {
        courseId,
        unitId: unit1.id,
        topicId: topic3.id,
        titleBn: 'সাপ্তাহিক লাইভ এমসিকিউ ২: ক্যালকুলাস (সমাধান শিডিউল করা)',
        titleEn: 'Weekly Live MCQ 2: Calculus (Embargoed Solutions)',
        examType: 'MCQ',
        durationMinutes: 20,
        startsAt: pastStart,
        endsAt: futureEnd,
        totalMarks: '6.00',
        passMarks: '3.00',
        negativeMarkingEnabled: true,
        randomizeQuestions: true,
        randomizeOptions: true,
        showScoreImmediately: true,
        solutionPublishAt: embargoPublish,
        solutionForcePublished: false,
        status: 'Published',
      },
      {
        courseId,
        unitId: unit1.id,
        topicId: topic1.id,
        titleBn: 'লিখিত পরীক্ষা ১: স্যান্ডউইচ উপপাদ্য ও সীমা (ডকুমেন্ট স্ক্যানার)',
        titleEn: 'Written Exam 1: Squeeze Theorem & Limits (Scanner Upload)',
        examType: 'Written',
        durationMinutes: 45,
        startsAt: pastStart,
        endsAt: futureEnd,
        totalMarks: '10.00',
        passMarks: '5.00',
        negativeMarkingEnabled: false,
        randomizeQuestions: false,
        randomizeOptions: false,
        showScoreImmediately: false,
        solutionPublishAt: embargoPublish,
        solutionForcePublished: false,
        status: 'Published',
      },
    ])
    .returning();

  await db.insert(examQuestions).values([
    { examId: mcqExamPublished.id, questionId: q1.id, sortOrder: 1 },
    { examId: mcqExamPublished.id, questionId: q2.id, sortOrder: 2 },
    { examId: mcqExamPublished.id, questionId: q3.id, sortOrder: 3 },
    { examId: mcqExamEmbargoed.id, questionId: q1.id, sortOrder: 1 },
    { examId: mcqExamEmbargoed.id, questionId: q2.id, sortOrder: 2 },
    { examId: mcqExamEmbargoed.id, questionId: q4.id, sortOrder: 3 },
    { examId: writtenExam.id, questionId: wq1.id, sortOrder: 1 },
  ]);

  // 8. Latest Job Exam Solutions
  await db.insert(jobExamSolutions).values([
    {
      category: 'BCS',
      examName: '৪৬তম বিসিএস প্রিলিমিনারি গণিত',
      examYear: 2024,
      topicId: topic1.id,
      questionLatexBn: 'যদি $x + \\frac{1}{x} = 4$ হয়, তবে $x^3 + \\frac{1}{x^3}$-এর মান কত?',
      questionLatexEn: 'If $x + \\frac{1}{x} = 4$, find the value of $x^3 + \\frac{1}{x^3}$.',
      optionsJson: ['52', '64', '48', '76'],
      correctOption: 'A',
      explanationLatexBn: 'ঘন সূত্র $(a+b)^3 = a^3+b^3+3ab(a+b)$ ব্যবহার করে সরাসরি মান বের করা যায়।',
      explanationLatexEn: 'Apply the cubic identity $(a+b)^3 = a^3+b^3+3ab(a+b)$ directly.',
      calculationStepsLatex:
        '$$x^3 + \\frac{1}{x^3} = \\left(x + \\frac{1}{x}\\right)^3 - 3\\left(x + \\frac{1}{x}\\right) = 4^3 - 3(4) = 64 - 12 = 52$$',
      videoId: vid1.id,
    },
    {
      category: 'Bank',
      examName: 'Bangladesh Bank Assistant Director (AD)',
      examYear: 2025,
      topicId: topic4.id,
      questionLatexBn:
        'একটি ধনাত্মক সংখ্যার বর্গের সাথে ১৬ যোগ করলে সংখ্যাটির ১০ গুণের সমান হয়। সংখ্যাটি কত?',
      questionLatexEn:
        'Adding 16 to the square of a positive number equals 10 times the number. What is the number?',
      optionsJson: ['2 or 8', '4 or 6', '3 or 5', '1 or 16'],
      correctOption: 'A',
      explanationLatexBn: 'দ্বিঘাত সমীকরণ গঠন করে উৎপাদকে বিশ্লেষণ করি।',
      explanationLatexEn: 'Form a quadratic equation and factorize.',
      calculationStepsLatex: '$$x^2 + 16 = 10x \\implies x^2 - 10x + 16 = 0 \\implies (x-2)(x-8) = 0 \\implies x \\in \\{2, 8\\}$$',
    },
    {
      category: 'NTRCA',
      examName: '১৮তম শিক্ষক নিবন্ধন (NTRCA) কলেজ পর্যায়',
      examYear: 2024,
      topicId: topic3.id,
      questionLatexBn: '$\\int_0^1 x e^{x^2}\\,dx$-এর মান কত?',
      questionLatexEn: 'Evaluate $\\int_0^1 x e^{x^2}\\,dx$.',
      optionsJson: ['(e - 1)/2', 'e - 1', '2(e - 1)', 'e/2'],
      correctOption: 'A',
      explanationLatexBn: '$u = x^2$ প্রতিস্থাপন করলে $du = 2x\\,dx$ পাওয়া যায়।',
      explanationLatexEn: 'Substitute $u = x^2$, giving $du = 2x\\,dx$.',
      calculationStepsLatex:
        '$$u = x^2 \\implies \\frac{1}{2} \\int_0^1 e^u\\,du = \\frac{e^1 - e^0}{2} = \\frac{e - 1}{2}$$',
      videoId: vid2.id,
    },
    {
      category: 'PrimaryTeacher',
      examName: 'সরকারি প্রাথমিক বিদ্যালয় সহকারী শিক্ষক নিয়োগ',
      examYear: 2025,
      topicId: topic4.id,
      questionLatexBn: 'একটি সমবাহু ত্রিভুজের বাহুর দৈর্ঘ্য $4\\text{ cm}$ হলে ক্ষেত্রফল কত বর্গ সে.মি.?',
      questionLatexEn: 'If the side of an equilateral triangle is $4\\text{ cm}$, what is its area?',
      optionsJson: ['4√3', '8√3', '2√3', '16√3'],
      correctOption: 'A',
      explanationLatexBn: 'সমবাহু ত্রিভুজের ক্ষেত্রফল $= \\frac{\\sqrt{3}}{4} a^2$।',
      explanationLatexEn: 'Area of an equilateral triangle is $\\frac{\\sqrt{3}}{4} a^2$.',
      calculationStepsLatex: '$$A = \\frac{\\sqrt{3}}{4} (4)^2 = 4\\sqrt{3}\\text{ cm}^2$$',
    },
  ]);

  // 9. System Settings & Initial Backup Record
  await db
    .insert(systemSettings)
    .values([
      {
        settingKey: 'default_pdf_compression_profile',
        settingValueJson: { profile: 'Balanced' },
      },
      {
        settingKey: 'subscription_policy',
        settingValueJson: { defaultGraceDays: 3, renewalPolicy: 'ExtendFromExpiry' },
      },
      {
        settingKey: 'video_retention_policy',
        settingValueJson: { sourceDeleteAfterHours: 24, targetResolutions: ['360p', '480p', '720p'] },
      },
    ])
    .onConflictDoNothing();

  await db.insert(backupRecords).values({
    backupScope: 'PostgreSQL',
    sizeBytes: 1843200,
    status: 'RestoreVerified',
    restoreTestedAt: new Date(),
    restoreTestPassed: true,
  });
}
