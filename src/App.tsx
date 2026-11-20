import React, { useEffect, useState } from 'react';
import { Sun, Moon, Globe, ArrowRight, Check, LogOut, UserPlus, LogIn } from 'lucide-react';

import { apiFetch, setAuthToken, setTwoFactorToken } from './lib/apiClient';
import { dict, Lang, pick } from './lib/i18n';
import { PlanItem, SubscriptionCheckoutModal } from './components/SubscriptionCheckoutModal';
import { AuthPanel } from './components/AuthPanel';
import { StudentDashboard } from './components/StudentDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { AdminDashboard } from './components/AdminDashboard';

export default function App() {
  const [lang, setLang] = useState<Lang>('bn');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [profile, setProfile] = useState<any>(null);
  const [courseData, setCourseData] = useState<{ course: any; units: any[]; plans: PlanItem[] }>({
    course: null,
    units: [],
    plans: [],
  });
  const [checkoutPlan, setCheckoutPlan] = useState<PlanItem | null>(null);
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: 'register' | 'login';
    notice?: string;
    pendingPlan?: PlanItem | null;
  }>({ open: false, mode: 'register' });

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  }, [theme]);

  // Sync HTML lang attribute
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const loadCourseStructure = () => {
    apiFetch('/api/course/structure')
      .then((res) => setCourseData(res))
      .catch(() => {});
  };

  const loadProfile = async () => {
    try {
      const me = await apiFetch('/api/auth/me');
      setProfile(me);
      if (me.user?.preferredLanguage === 'en' || me.user?.preferredLanguage === 'bn') {
        setLang(me.user.preferredLanguage);
      }
      if (me.user?.themePreference === 'dark' || me.user?.themePreference === 'light') {
        setTheme(me.user.themePreference);
      }
      return me;
    } catch {
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    loadCourseStructure();
  }, []);

  const handleAuthenticated = async () => {
    const pending = authModal.pendingPlan || null;
    setAuthModal({ open: false, mode: 'login' });
    const me = await loadProfile();
    if (pending && me?.user?.role === 'Student') {
      setCheckoutPlan(pending);
    }
  };

  const handleSignOut = () => {
    setAuthToken(null);
    setTwoFactorToken(null);
    setProfile(null);
    setCheckoutPlan(null);
  };

  const toggleLanguage = async () => {
    const next: Lang = lang === 'bn' ? 'en' : 'bn';
    setLang(next);
    if (profile?.user) {
      apiFetch('/api/auth/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ preferredLanguage: next, themePreference: theme }),
      }).catch(() => {});
    }
  };

  const toggleTheme = async () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    if (profile?.user) {
      apiFetch('/api/auth/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ preferredLanguage: lang, themePreference: next }),
      }).catch(() => {});
    }
  };

  const isLoggedIn = Boolean(profile?.user);
  const hasActiveSubscription = Boolean(profile?.courseAccess?.hasAccess);
  const role: string = profile?.user?.role || 'Student';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Minimal Header — No Navigation Menu Links */}
      <header className="sticky top-0 z-40 h-14 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-2">
          <div className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
            {lang === 'bn' ? dict.brand.bn : dict.brand.en}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleLanguage}
              className="min-h-[40px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'EN' : 'বাংলা'}</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {isLoggedIn ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? dict.signOut.bn : dict.signOut.en}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModal({ open: true, mode: 'login' })}
                className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'লগইন' : 'Login'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {isLoggedIn ? (
          /* Direct Role-Based Dashboard */
          <>
            {role === 'SuperAdmin' && (
              <AdminDashboard
                lang={lang}
                user={profile.user}
                twoFactorEnabled={Boolean(profile?.twoFactorEnabled)}
                twoFactorVerified={Boolean(profile?.twoFactorVerified)}
                on2FAVerified={loadProfile}
                onRefreshCourse={loadCourseStructure}
              />
            )}

            {role === 'Teacher' && (
              <TeacherDashboard
                lang={lang}
                user={profile.user}
                twoFactorEnabled={Boolean(profile?.twoFactorEnabled)}
                twoFactorVerified={Boolean(profile?.twoFactorVerified)}
                on2FAVerified={loadProfile}
              />
            )}

            {role === 'Student' && (
              <StudentDashboard
                lang={lang}
                user={profile.user}
                course={courseData.course}
                units={courseData.units}
                plans={courseData.plans}
                hasActiveSubscription={hasActiveSubscription}
                twoFactorEnabled={Boolean(profile?.twoFactorEnabled)}
                onRefreshProfile={loadProfile}
                onSelectPlan={(plan) => setCheckoutPlan(plan)}
              />
            )}
          </>
        ) : (
          /* Logged-Out Home Page with Registration-First CTA + 6 Subscription Plans */
          <div className="space-y-12">
            {/* Mobile-First Hero Section */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-6 space-y-5">
                <div className="text-xs font-medium text-sky-700 dark:text-sky-400">
                  {lang === 'bn'
                    ? 'ম্যাথ লাইব্রেরি · একক পূর্ণাঙ্গ গণিত প্ল্যাটফর্ম'
                    : 'Math Library · Single-Course Academic Platform'}
                </div>
                <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance leading-tight">
                  {lang === 'bn' ? dict.heroTitle.bn : dict.heroTitle.en}
                </h1>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl">
                  {lang === 'bn' ? dict.heroSub.bn : dict.heroSub.en}
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setAuthModal({ open: true, mode: 'register' })}
                    className="min-h-[46px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-sm font-semibold"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'রেজিস্ট্রেশন করুন' : 'Register Account'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthModal({ open: true, mode: 'login' })}
                    className="min-h-[46px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'ইতিমধ্যে নিবন্ধিত? লগইন' : 'Registered? Login'}</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 aspect-[16/10]">
                <img
                  src="/src/assets/images/hero_math_library_1795207962689.jpg"
                  alt="Geometric polyhedra and calculus curves"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </section>

            {/* 6 Subscription Plans on Home Page */}
            <section id="subscription-plans" className="space-y-6">
              <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="text-xs text-slate-500">
                  {lang === 'bn' ? 'একটি মূল কোর্স · ৬টি মেয়াদ' : 'One Main Course · Six Subscription Durations'}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold mt-1">
                  {lang === 'bn'
                    ? 'ম্যাথ লাইব্রেরি কোর্স সাবস্ক্রিপশন প্ল্যান'
                    : 'Math Library Course Subscription Plans'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {lang === 'bn'
                    ? 'সাবস্ক্রাইব করতে প্রথমে নাম, ইমেইল ও ফোন নম্বর দিয়ে রেজিস্ট্রেশন করুন। পেমেন্ট মাধ্যম: bKash, Nagad, Rocket, Visa ও Mastercard।'
                    : 'Register with your name, email, and phone first to subscribe via bKash, Nagad, Rocket, Visa, or Mastercard.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                {courseData.plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col justify-between gap-5"
                  >
                    <div className="space-y-2">
                      <div className="text-xs font-mono text-slate-500">
                        {plan.durationMonths} {lang === 'bn' ? 'মাস' : 'Months'} · Grace {plan.gracePeriodDays}d
                      </div>
                      <h3 className="text-lg font-semibold">{pick(plan.titleBn, plan.titleEn, lang)}</h3>
                      <div className="text-3xl font-bold font-mono text-slate-900 dark:text-slate-100">
                        ৳{Number(plan.priceBdt).toLocaleString()}
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-2">
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {lang === 'bn' ? 'সকল ইউনিট ও ভিডিও সমাধান' : 'All Course Units & Video Proofs'}
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {lang === 'bn' ? 'লাইভ এমসিকিউ ও লিখিত পরীক্ষা' : 'Live MCQ & Written Scanner Exams'}
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {lang === 'bn' ? 'জব সল্যুশন ও রুটিন ট্র্যাকার' : 'Job Exam Archive & Study Routine'}
                        </li>
                      </ul>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setAuthModal({
                          open: true,
                          mode: 'register',
                          pendingPlan: plan,
                          notice:
                            lang === 'bn'
                              ? `"${pick(plan.titleBn, plan.titleEn, lang)}" সাবস্ক্রাইব করার আগে অনুগ্রহ করে রেজিস্ট্রেশন বা লগইন করুন।`
                              : `Please register or log in first to subscribe to "${pick(plan.titleBn, plan.titleEn, lang)}".`,
                        })
                      }
                      className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-sm font-semibold"
                    >
                      {lang === 'bn' ? 'সাবস্ক্রাইব করুন' : 'Subscribe Now'}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Full-width 4-column summary strip */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 border-y border-slate-200 dark:border-slate-800 py-6">
              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">01</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {lang === 'bn' ? 'একক মূল গণিত কোর্স' : 'Single Main Course'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">06</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {lang === 'bn' ? 'সাবস্ক্রিপশন মেয়াদ (১–৩৬ মাস)' : 'Subscription Durations (1–36M)'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">KaTeX</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {lang === 'bn' ? 'সমীকরণ ও ধাপে ধাপে সমাধান' : 'Interactive Math Proofs & Video'}
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">PDF</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  {lang === 'bn' ? 'পরীক্ষার সময় মোবাইল স্ক্যানার' : 'Exam-Time Mobile PDF Scanner'}
                </div>
              </div>
            </section>

            {/* Two Visual Feature Spotlights */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                  <img
                    src="/src/assets/images/course_geometry_visual_1795207962683.jpg"
                    alt="Conic sections and geometric planes"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 sm:p-6 space-y-2">
                  <h3 className="text-lg font-semibold">
                    {lang === 'bn'
                      ? 'ইউনিট, সাব-ইউনিট ও টপিকভিত্তিক কাঠামো'
                      : 'Structured Units, Discussions & Video Solutions'}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {lang === 'bn'
                      ? 'প্রতিটি টপিকে রয়েছে গাণিতিক আলোচনা, ডায়াগ্রাম, ভিডিও সমাধান ও অনুশীলন প্রশ্ন।'
                      : 'Every topic bundles rich theory, KaTeX worked examples, optional video walkthroughs, and curated practice.'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
                <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                  <img
                    src="/src/assets/images/study_exam_desk_1795207963281.jpg"
                    alt="Handwritten mathematics notebook and compass"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 sm:p-6 space-y-2">
                  <h3 className="text-lg font-semibold">
                    {lang === 'bn'
                      ? 'লিখিত খাতা স্ক্যানিং ও পরীক্ষক মূল্যায়ন'
                      : 'Handwritten Exam Scanner & Teacher Grading'}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {lang === 'bn'
                      ? 'লিখিত পরীক্ষার PDF তৈরির সময় সরাসরি ক্যামেরায় খাতা স্ক্যান ও অপ্টিমাইজ করে জমা দিন।'
                      : 'Request camera access only when creating your written exam PDF, optimize file size, and receive teacher-checked scripts.'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer (only on logged-out landing page so mobile bottom nav isn't covered inside dashboards) */}
      {!isLoggedIn && (
        <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <div>
              © {new Date().getFullYear()} {lang === 'bn' ? 'ম্যাথ লাইব্রেরি' : 'Math Library'} ·{' '}
              {lang === 'bn' ? 'সর্বস্বত্ব সংরক্ষিত' : 'All rights reserved'}
            </div>
            <div>
              {lang === 'bn'
                ? 'সকল ব্যবহারকারীর জন্য রেজিস্ট্রেশনভিত্তিক নিরাপদ প্রবেশাধিকার'
                : 'Registration-first Academic Portal'}
            </div>
          </div>
        </footer>
      )}

      {/* Auth Modal (Register / Login) */}
      {authModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <AuthPanel
            lang={lang}
            initialMode={authModal.mode}
            contextNotice={authModal.notice}
            onAuthenticated={handleAuthenticated}
            onClose={() => setAuthModal({ open: false, mode: 'login' })}
          />
        </div>
      )}

      {checkoutPlan && (
        <SubscriptionCheckoutModal
          lang={lang}
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={async () => {
            setCheckoutPlan(null);
            await loadProfile();
          }}
        />
      )}
    </div>
  );
}
