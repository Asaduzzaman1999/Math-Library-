export type Lang = 'bn' | 'en';

export function pick(bn: string | null | undefined, en: string | null | undefined, lang: Lang): string {
  if (lang === 'bn') return bn || en || '';
  return en || bn || '';
}

export const dict = {
  brand: { bn: 'ম্যাথ লাইব্রেরি', en: 'Math Library' },
  navCourse: { bn: 'কোর্স', en: 'Course' },
  navExams: { bn: 'পরীক্ষা', en: 'Exams' },
  navJobs: { bn: 'জব সল্যুশন', en: 'Job Solutions' },
  navPlans: { bn: 'সাবস্ক্রিপশন', en: 'Plans' },
  navDashboard: { bn: 'ড্যাশবোর্ড', en: 'Dashboard' },
  signIn: { bn: 'সাইন ইন', en: 'Sign In' },
  signOut: { bn: 'সাইন আউট', en: 'Sign Out' },
  heroTitle: {
    bn: 'একটিমাত্র পূর্ণাঙ্গ গণিত কোর্সে একাডেমিক ও প্রতিযোগিতামূলক প্রস্তুতি',
    en: 'One Unified Mathematics Course for Academic & Competitive Mastery',
  },
  heroSub: {
    bn: 'ক্যালকুলাস, বীজগণিত ও জ্যামিতির প্রতিটি টপিকে ধাপে ধাপে গাণিতিক উদাহরণ, ভিডিও ব্যাখ্যা, এমসিকিউ এবং মোবাইল স্ক্যানারভিত্তিক লিখিত পরীক্ষা।',
    en: 'Structured units, step-by-step KaTeX proofs, video explanations, randomized MCQ exams, and built-in mobile document scanner for written evaluation.',
  },
  exploreCourse: { bn: 'কোর্স সূচি দেখুন', en: 'Explore Curriculum' },
  viewPlans: { bn: 'সাবস্ক্রিপশন প্ল্যান', en: 'View 6 Plans' },
  freePreview: { bn: 'ফ্রি প্রিভিউ', en: 'Free Preview' },
  premiumLocked: {
    bn: 'এই টপিকটি সম্পূর্ণ আনলক করতে একটি সাবস্ক্রিপশন নির্বাচন করুন।',
    en: 'Activate one of the six course subscription plans to unlock this topic.',
  },
  loading: { bn: 'লোড হচ্ছে...', en: 'Loading...' },
} as const;
