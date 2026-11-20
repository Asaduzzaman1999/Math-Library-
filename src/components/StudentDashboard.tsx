import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Briefcase,
  UserCircle,
  Calendar,
  Bell,
  FileText,
  Download,
  Trash2,
  Shield,
  CreditCard,
  Award,
  Check,
  Mail,
  Phone,
  GraduationCap,
} from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { Lang, pick } from '../lib/i18n';
import { TwoFactorGate } from './TwoFactorGate';
import { CourseExplorer } from './CourseExplorer';
import { ExamPortal } from './ExamPortal';
import { JobSolutionsSection } from './JobSolutionsSection';
import { PlanItem } from './SubscriptionCheckoutModal';

interface StudentDashboardProps {
  lang: Lang;
  user: any;
  course: any;
  units: any[];
  plans: PlanItem[];
  hasActiveSubscription: boolean;
  twoFactorEnabled: boolean;
  onRefreshProfile: () => void;
  onSelectPlan: (plan: PlanItem) => void;
}

type StudentTab = 'overview' | 'course' | 'exams' | 'jobs' | 'account';

const DAYS = [
  { bn: 'রবিবার', en: 'Sun' },
  { bn: 'সোমবার', en: 'Mon' },
  { bn: 'মঙ্গলবার', en: 'Tue' },
  { bn: 'বুধবার', en: 'Wed' },
  { bn: 'বৃহস্পতিবার', en: 'Thu' },
  { bn: 'শুক্রবার', en: 'Fri' },
  { bn: 'শনিবার', en: 'Sat' },
];

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  lang,
  user,
  course,
  units,
  plans,
  hasActiveSubscription,
  twoFactorEnabled,
  onRefreshProfile,
  onSelectPlan,
}) => {
  const [data, setData] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [tab, setTab] = useState<StudentTab>('overview');
  const [accountSection, setAccountSection] = useState<'routine' | 'billing' | 'profile'>('billing');
  const [show2FA, setShow2FA] = useState(false);

  // Routine form
  const allTopics = units.flatMap((u) =>
    (u.subUnits || []).flatMap((su: any) => su.topics || [])
  );
  const [routineTopicId, setRoutineTopicId] = useState<number>(allTopics[0]?.id || 1);
  const [routineDay, setRoutineDay] = useState(0);
  const [routineTime, setRoutineTime] = useState('19:00');
  const [routineDuration, setRoutineDuration] = useState(45);

  // Profile form
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [institution, setInstitution] = useState(user?.institution || '');
  const [targetTrack, setTargetTrack] = useState(user?.targetTrack || '');
  const [savedMsg, setSavedMsg] = useState('');

  // Recovery PIN form
  const [pinCurrentPwd, setPinCurrentPwd] = useState('');
  const [newRecoveryPin, setNewRecoveryPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinErr, setPinErr] = useState('');

  useEffect(() => {
    setFullName(user?.fullName || '');
    setPhoneNumber(user?.phoneNumber || '');
    setInstitution(user?.institution || '');
    setTargetTrack(user?.targetTrack || '');
  }, [user]);

  const loadDashboard = async () => {
    const [dash, sess] = await Promise.all([
      apiFetch('/api/student/dashboard'),
      apiFetch('/api/auth/sessions'),
    ]);
    setData(dash);
    setSessions(sess.sessions || []);
  };

  useEffect(() => {
    loadDashboard().catch(() => {});
  }, []);

  const handleAddRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/student/routines', {
      method: 'POST',
      body: JSON.stringify({
        topicId: routineTopicId,
        dayOfWeek: routineDay,
        startTime: routineTime,
        durationMinutes: routineDuration,
      }),
    });
    loadDashboard();
  };

  const handleDeleteRoutine = async (id: number) => {
    await apiFetch(`/api/student/routines/${id}`, { method: 'DELETE' });
    loadDashboard();
  };

  const handleOpenSignedFile = async (fileId: number) => {
    const res = await apiFetch(`/api/files/signed-url/${fileId}`, { method: 'POST' });
    if (res.signedUrl) {
      window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify({
        preferredLanguage: lang,
        themePreference: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        fullName,
        phoneNumber,
        institution,
        targetTrack,
      }),
    });
    setSavedMsg(lang === 'bn' ? 'প্রোফাইল সংরক্ষিত হয়েছে' : 'Profile updated');
    onRefreshProfile();
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const handleSaveRecoveryPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg('');
    setPinErr('');
    try {
      await apiFetch('/api/auth/recovery-pin', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: pinCurrentPwd,
          newRecoveryPin,
        }),
      });
      setPinCurrentPwd('');
      setNewRecoveryPin('');
      setPinMsg(lang === 'bn' ? 'রিকভারি পিন সংরক্ষিত হয়েছে' : 'Recovery PIN updated');
      onRefreshProfile();
      setTimeout(() => setPinMsg(''), 3000);
    } catch (err: any) {
      setPinErr(err.message || 'Failed to save Recovery PIN');
    }
  };

  const analytics = data?.analytics;
  const sub = data?.courseAccess?.subscription;

  const navItems: {
    key: StudentTab;
    bn: string;
    en: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { key: 'overview', bn: 'হোম', en: 'Overview', icon: LayoutDashboard },
    { key: 'course', bn: 'কোর্স', en: 'Course', icon: BookOpen },
    { key: 'exams', bn: 'পরীক্ষা', en: 'Exams', icon: ClipboardCheck },
    { key: 'jobs', bn: 'জব সল্যুশন', en: 'Jobs', icon: Briefcase },
    { key: 'account', bn: 'অ্যাকাউন্ট', en: 'Account', icon: UserCircle },
  ];

  const openPlansTab = () => {
    setTab('account');
    setAccountSection('billing');
  };

  return (
    <div className="space-y-5 pb-20 lg:pb-4">
      {/* Desktop Header + Tab Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="min-w-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'শিক্ষার্থী ড্যাশবোর্ড' : 'Student Dashboard'} · {user?.role}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
            {user?.fullName}
          </h1>
        </div>

        {/* Desktop horizontal tabs */}
        <div className="hidden lg:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {navItems.map(({ key, bn, en, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`min-h-[40px] flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                tab === key
                  ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{lang === 'bn' ? bn : en}</span>
            </button>
          ))}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Student Registered Details Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                  {lang === 'bn' ? 'নিবন্ধিত শিক্ষার্থীর তথ্য' : 'Student Account Details'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <UserCircle className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-900 dark:text-slate-100">{user?.fullName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-mono">{user?.phoneNumber || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      {[user?.institution, user?.targetTrack].filter(Boolean).join(' · ') ||
                        (lang === 'bn' ? 'সাধারণ গণিত ট্র্যাক' : 'General Mathematics Track')}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={openPlansTab}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-medium shrink-0"
              >
                {sub
                  ? lang === 'bn'
                    ? 'সাবস্ক্রিপশন দেখুন'
                    : 'Manage Subscription'
                  : lang === 'bn'
                  ? 'কোর্স সাবস্ক্রাইব করুন'
                  : 'Activate Subscription'}
              </button>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500">{lang === 'bn' ? 'সম্পন্ন পাঠ' : 'Completed Lessons'}</div>
              <div className="text-2xl font-bold font-mono mt-1">
                {analytics?.completedLessons ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500">{lang === 'bn' ? 'বাকি পাঠ' : 'Remaining Lessons'}</div>
              <div className="text-2xl font-bold font-mono mt-1">
                {analytics?.remainingLessons ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500">{lang === 'bn' ? 'মোট পরীক্ষা' : 'Exams Taken'}</div>
              <div className="text-2xl font-bold font-mono mt-1">
                {analytics?.totalExamsTaken ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <div className="text-xs text-slate-500">{lang === 'bn' ? 'গড় স্কোর' : 'Average Score'}</div>
              <div className="text-2xl font-bold font-mono mt-1 text-sky-700 dark:text-sky-400">
                {analytics?.averageScorePercent ?? 0}%
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 col-span-2 lg:col-span-1">
              <div className="text-xs text-slate-500">{lang === 'bn' ? 'সাবস্ক্রিপশন মেয়াদ' : 'Subscription Expiry'}</div>
              <div className="text-sm font-mono font-semibold mt-2">
                {sub ? (
                  new Date(sub.expiresAt).toLocaleDateString()
                ) : (
                  <button type="button" onClick={openPlansTab} className="text-sky-600 underline">
                    {lang === 'bn' ? 'সক্রিয় নয় · প্ল্যান দেখুন' : 'Inactive · View Plans'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Tiles (Mobile friendly) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setTab('course')}
              className="min-h-[56px] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500 text-left flex items-center gap-3"
            >
              <BookOpen className="w-5 h-5 text-sky-600 shrink-0" />
              <div>
                <div className="text-sm font-semibold">{lang === 'bn' ? 'মূল গণিত কোর্স' : 'Main Course Explorer'}</div>
                <div className="text-xs text-slate-500">{lang === 'bn' ? 'ইউনিট, উদাহরণ ও ভিডিও' : 'Units, proofs & videos'}</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setTab('exams')}
              className="min-h-[56px] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500 text-left flex items-center gap-3"
            >
              <ClipboardCheck className="w-5 h-5 text-sky-600 shrink-0" />
              <div>
                <div className="text-sm font-semibold">{lang === 'bn' ? 'পরীক্ষা ও PDF স্ক্যানার' : 'Exams & PDF Scanner'}</div>
                <div className="text-xs text-slate-500">{lang === 'bn' ? 'এমসিকিউ ও লিখিত খাতা জমা' : 'MCQ & written scripts'}</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setTab('jobs')}
              className="min-h-[56px] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-sky-500 text-left flex items-center gap-3"
            >
              <Briefcase className="w-5 h-5 text-sky-600 shrink-0" />
              <div>
                <div className="text-sm font-semibold">{lang === 'bn' ? 'জব সল্যুশন আর্কাইভ' : 'Job Exam Solutions'}</div>
                <div className="text-xs text-slate-500">{lang === 'bn' ? 'BCS, ব্যাংক ও NTRCA' : 'BCS, Bank & Govt'}</div>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Topic-wise Strong & Weak */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Award className="w-4 h-4 text-sky-600" />
                {lang === 'bn' ? 'টপিকভিত্তিক পারফরম্যান্স ও দুর্বলতা' : 'Topic Performance (Strong & Weak Areas)'}
              </h3>
              {!analytics?.topicPerformance?.length ? (
                <p className="text-xs text-slate-500">
                  {lang === 'bn'
                    ? 'এমসিকিউ পরীক্ষায় অংশগ্রহণ করলে টপিকভিত্তিক বিশ্লেষণ দেখা যাবে।'
                    : 'Complete an exam to see your strong and weak topic breakdown.'}
                </p>
              ) : (
                <div className="space-y-3">
                  {analytics.topicPerformance.map((tp: any) => (
                    <div key={tp.topicId} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{pick(tp.titleBn, tp.titleEn, lang)}</span>
                        <span className="font-mono font-semibold">
                          {tp.percentage}% ({tp.percentage >= 70 ? 'Strong' : 'Needs Review'})
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${tp.percentage >= 70 ? 'bg-emerald-600' : 'bg-amber-500'}`}
                          style={{ width: `${tp.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notifications */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Bell className="w-4 h-4 text-sky-600" />
                  {lang === 'bn' ? 'বিজ্ঞপ্তি' : 'Notifications'}
                </h3>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch('/api/notifications/read-all', { method: 'POST' });
                    loadDashboard();
                  }}
                  className="text-xs text-sky-600 hover:underline min-h-[36px]"
                >
                  {lang === 'bn' ? 'সব পঠিত চিহ্নিত করুন' : 'Mark all read'}
                </button>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {(data?.notifications || []).length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {lang === 'bn' ? 'কোনো নতুন বিজ্ঞপ্তি নেই।' : 'No notifications yet.'}
                  </p>
                ) : (
                  data.notifications.map((n: any) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-lg border text-xs ${
                        n.isRead
                          ? 'border-slate-100 dark:border-slate-800 opacity-75'
                          : 'border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/30'
                      }`}
                    >
                      <div className="font-semibold">{pick(n.titleBn, n.titleEn, lang)}</div>
                      <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                        {pick(n.bodyBn, n.bodyEn, lang)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Written Answer Scripts quick summary */}
          {(data?.writtenSubmissions || []).length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                {lang === 'bn' ? 'জমাকৃত লিখিত উত্তরপত্র ও মূল্যায়ন' : 'Written Submissions & Checked PDFs'}
              </h3>
              <div className="space-y-2">
                {data.writtenSubmissions.map((ws: any) => (
                  <div
                    key={ws.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                  >
                    <div>
                      <div className="font-medium">{pick(ws.examTitleBn, ws.examTitleEn, lang)}</div>
                      <div className="text-slate-500 font-mono">
                        {ws.status} ·{' '}
                        {ws.marksObtained !== null ? `${ws.marksObtained}/${ws.maxMarks}` : 'Pending'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleOpenSignedFile(ws.studentPdfFileId)}
                        className="inline-flex items-center gap-1 text-sky-600 hover:underline min-h-[36px]"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Submitted PDF
                      </button>
                      {ws.checkedPdfFileId && (
                        <button
                          type="button"
                          onClick={() => handleOpenSignedFile(ws.checkedPdfFileId)}
                          className="inline-flex items-center gap-1 text-emerald-600 hover:underline min-h-[36px]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Checked PDF
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* COURSE TAB */}
      {tab === 'course' && (
        <CourseExplorer
          lang={lang}
          course={course}
          units={units}
          hasActiveSubscription={hasActiveSubscription}
          isAuthenticated={true}
          onOpenPlans={openPlansTab}
          onSignIn={() => {}}
        />
      )}

      {/* EXAMS TAB (with Written Scanner & PDF creator) */}
      {tab === 'exams' && (
        <ExamPortal
          lang={lang}
          isAuthenticated={true}
          onSignIn={() => {}}
          onOpenPlans={openPlansTab}
        />
      )}

      {/* JOB SOLUTIONS TAB */}
      {tab === 'jobs' && <JobSolutionsSection lang={lang} />}

      {/* ACCOUNT TAB (Billing & 6 Plans, Routine & Favs, Profile & Settings) */}
      {tab === 'account' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['billing', 'সাবস্ক্রিপশন ও পেমেন্ট', 'Plans & Billing'],
                ['routine', 'রুটিন ও পছন্দ', 'Routine & Favourites'],
                ['profile', 'প্রোফাইল ও নিরাপত্তা', 'Profile & Security'],
              ] as const
            ).map(([k, bn, en]) => (
              <button
                key={k}
                type="button"
                onClick={() => setAccountSection(k)}
                className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-medium border ${
                  accountSection === k
                    ? 'bg-sky-700 text-white border-sky-700'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                {lang === 'bn' ? bn : en}
              </button>
            ))}
          </div>

          {accountSection === 'billing' && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">
                  {lang === 'bn'
                    ? 'ম্যাথ লাইব্রেরি কোর্সের ৬টি সাবস্ক্রিপশন প্ল্যান'
                    : 'Choose a Subscription Duration for Math Library Course'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="text-xs font-mono text-slate-500">
                          {plan.durationMonths} {lang === 'bn' ? 'মাস' : 'Months'} · Grace {plan.gracePeriodDays}d
                        </div>
                        <h4 className="text-base font-semibold">{pick(plan.titleBn, plan.titleEn, lang)}</h4>
                        <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                          ৳{Number(plan.priceBdt).toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 pt-1">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{lang === 'bn' ? 'সম্পূর্ণ কোর্স, পরীক্ষা ও জব সল্যুশন' : 'Full Course, Exams & Job Archive'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectPlan(plan)}
                        className="w-full min-h-[44px] py-2 px-4 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold"
                      >
                        {lang === 'bn' ? 'সাবস্ক্রাইব / রিনিউ করুন' : 'Subscribe / Renew'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-sky-600" />
                  {lang === 'bn' ? 'পেমেন্ট ইতিহাস' : 'Payment History'}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                        <th className="py-2 text-left">Gateway</th>
                        <th className="py-2 text-left">TrxID</th>
                        <th className="py-2 text-right">Net (BDT)</th>
                        <th className="py-2 text-left">Status</th>
                        <th className="py-2 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.payments || []).map((p: any) => (
                        <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60">
                          <td className="py-2">{p.gateway}</td>
                          <td className="py-2 font-mono">{p.gatewayTrxId || '-'}</td>
                          <td className="py-2 text-right font-mono">৳{p.netAmountBdt}</td>
                          <td className="py-2">{p.status}</td>
                          <td className="py-2 text-right font-mono">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {accountSection === 'routine' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-600" />
                  {lang === 'bn' ? 'ব্যক্তিগত পড়াশোনার রুটিন' : 'Personal Study Routine'}
                </h3>
                <form onSubmit={handleAddRoutine} className="grid grid-cols-2 gap-2 text-xs">
                  <select
                    value={routineTopicId}
                    onChange={(e) => setRoutineTopicId(Number(e.target.value))}
                    className="col-span-2 min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    {allTopics.map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {pick(t.titleBn, t.titleEn, lang)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={routineDay}
                    onChange={(e) => setRoutineDay(Number(e.target.value))}
                    className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    {DAYS.map((d, i) => (
                      <option key={i} value={i}>
                        {lang === 'bn' ? d.bn : d.en}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={routineTime}
                    onChange={(e) => setRoutineTime(e.target.value)}
                    className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                  />
                  <input
                    type="number"
                    min={15}
                    max={240}
                    value={routineDuration}
                    onChange={(e) => setRoutineDuration(Number(e.target.value))}
                    className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-3 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-medium"
                  >
                    {lang === 'bn' ? 'রুটিনে যোগ করুন' : 'Add Slot'}
                  </button>
                </form>

                <div className="space-y-2">
                  {(data?.routines || []).map((r: any) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs"
                    >
                      <div>
                        <div className="font-semibold">{pick(r.topicTitleBn, r.topicTitleEn, lang)}</div>
                        <div className="text-slate-500 font-mono">
                          {lang === 'bn' ? DAYS[r.dayOfWeek]?.bn : DAYS[r.dayOfWeek]?.en} · {r.startTime} ·{' '}
                          {r.durationMinutes} min
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoutine(r.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <h3 className="text-sm font-semibold">
                  {lang === 'bn' ? 'পছন্দের টপিকসমূহ' : 'Favourite Topics'}
                </h3>
                {(data?.favourites || []).length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {lang === 'bn'
                      ? 'কোর্স ট্যাব থেকে যেকোনো টপিকে হার্ট আইকনে ক্লিক করে সংরক্ষণ করুন।'
                      : 'Bookmark topics from the Course tab to quick-access them here.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    {data.favourites.map((f: any) => (
                      <li key={f.topicId} className="py-2.5">
                        {pick(f.titleBn, f.titleEn, lang)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {accountSection === 'profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form
                onSubmit={handleSaveProfile}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 text-xs"
              >
                <h3 className="text-sm font-semibold">{lang === 'bn' ? 'প্রোফাইল তথ্য' : 'Profile Settings'}</h3>
                {savedMsg && <div className="text-emerald-600">{savedMsg}</div>}
                <div>
                  <label className="block mb-1 text-slate-500">{lang === 'bn' ? 'পূর্ণ নাম' : 'Full Name'}</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-500">{lang === 'bn' ? 'ফোন নম্বর' : 'Phone Number'}</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-500">{lang === 'bn' ? 'প্রতিষ্ঠান' : 'Institution'}</label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-500">{lang === 'bn' ? 'লক্ষ্য (যেমন: HSC / BCS)' : 'Target Track'}</label>
                  <input
                    type="text"
                    value={targetTrack}
                    onChange={(e) => setTargetTrack(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-[44px] py-2 px-4 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-medium"
                >
                  {lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Profile'}
                </button>
              </form>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4 text-sky-600" />
                    {lang === 'bn' ? 'অ্যাকাউন্ট নিরাপত্তা ও ঐচ্ছিক ২এফএ' : 'Security & Optional 2FA'}
                  </h3>
                  {!twoFactorEnabled && (
                    <button
                      type="button"
                      onClick={() => setShow2FA(true)}
                      className="min-h-[40px] py-1.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium"
                    >
                      {lang === 'bn' ? '২এফএ চালু করুন' : 'Enable TOTP 2FA'}
                    </button>
                  )}
                </div>
                {twoFactorEnabled && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    {lang === 'bn' ? 'TOTP ২এফএ সক্রিয় আছে।' : 'TOTP Two-Factor Authentication is enabled.'}
                  </p>
                )}
                <div className="space-y-2 text-xs">
                  <div className="text-slate-500">{lang === 'bn' ? 'সক্রিয় সেশনসমূহ' : 'Active Sessions'}</div>
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800"
                    >
                      <div className="truncate pr-2">
                        <div className="font-mono">{s.ipAddress}</div>
                        <div className="text-[11px] text-slate-500 truncate">{s.userAgent}</div>
                      </div>
                      {!s.isRevoked && (
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/auth/sessions/${s.id}/revoke`, { method: 'POST' });
                            loadDashboard();
                          }}
                          className="text-red-600 hover:underline shrink-0 min-h-[36px]"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Password Recovery PIN setup */}
                <form
                  onSubmit={handleSaveRecoveryPin}
                  className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                >
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {lang === 'bn'
                      ? `পাসওয়ার্ড রিকভারি পিন (${user?.hasRecoveryPin ? 'সেট করা আছে' : 'সেট করা নেই'})`
                      : `Password Recovery PIN (${user?.hasRecoveryPin ? 'Configured' : 'Not Set'})`}
                  </div>
                  {pinMsg && <div className="text-emerald-600">{pinMsg}</div>}
                  {pinErr && <div className="text-red-600">{pinErr}</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="password"
                      required
                      value={pinCurrentPwd}
                      onChange={(e) => setPinCurrentPwd(e.target.value)}
                      placeholder={lang === 'bn' ? 'বর্তমান পাসওয়ার্ড' : 'Current Password'}
                      className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                    <input
                      type="password"
                      required
                      minLength={4}
                      maxLength={24}
                      value={newRecoveryPin}
                      onChange={(e) => setNewRecoveryPin(e.target.value)}
                      placeholder={lang === 'bn' ? 'নতুন রিকভারি পিন (৪+ অক্ষর)' : 'New Recovery PIN (4+ chars)'}
                      className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  >
                    {lang === 'bn' ? 'রিকভারি পিন সংরক্ষণ' : 'Save Recovery PIN'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile-First Bottom Navigation Bar (< lg) */}
      <nav
        aria-label="Student Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 grid grid-cols-5"
      >
        {navItems.map(({ key, bn, en, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'text-sky-700 dark:text-sky-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full px-1">{lang === 'bn' ? bn : en}</span>
            </button>
          );
        })}
      </nav>

      {show2FA && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <TwoFactorGate
            lang={lang}
            twoFactorEnabled={twoFactorEnabled}
            isMandatory={false}
            onVerified={() => {
              setShow2FA(false);
              onRefreshProfile();
            }}
            onClose={() => setShow2FA(false)}
          />
        </div>
      )}
    </div>
  );
};
