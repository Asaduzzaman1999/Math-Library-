import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Users,
  CreditCard,
  ShieldAlert,
  Database,
  Settings,
  UserPlus,
  Mail,
  Phone,
  ShieldCheck,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { Lang, pick } from '../lib/i18n';
import { TwoFactorGate } from './TwoFactorGate';

interface AdminDashboardProps {
  lang: Lang;
  user: any;
  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
  on2FAVerified: () => void;
  onRefreshCourse: () => void;
}

type AdminTab = 'analytics' | 'course' | 'teachers' | 'billing' | 'security';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  lang,
  user,
  twoFactorEnabled,
  twoFactorVerified,
  on2FAVerified,
  onRefreshCourse,
}) => {
  const [overview, setOverview] = useState<any>(null);
  const [tab, setTab] = useState<AdminTab>('analytics');
  const [msg, setMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Create Teacher / Student form
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'Teacher' | 'Student'>('Teacher');
  const [newDesignation, setNewDesignation] = useState('');

  // Teacher assignment form
  const [assignTeacherId, setAssignTeacherId] = useState<number>(0);
  const [assignScopeType, setAssignScopeType] = useState<'Unit' | 'SubUnit' | 'Topic'>('Unit');
  const [assignTargetId, setAssignTargetId] = useState<number>(0);

  // New Unit / Topic forms
  const [unitTitleEn, setUnitTitleEn] = useState('');
  const [topicSubUnitId, setTopicSubUnitId] = useState<number>(0);
  const [topicTitleEn, setTopicTitleEn] = useState('');

  // Grant subscription form
  const [grantStudentId, setGrantStudentId] = useState<number>(0);
  const [grantPlanId, setGrantPlanId] = useState<number>(0);

  // Admin password reset code & database explorer
  const [issuedResetInfo, setIssuedResetInfo] = useState<{
    email: string;
    code: string;
    expiresAt: string;
  } | null>(null);
  const [dbView, setDbView] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState('users');

  const loadOverview = async () => {
    const res = await apiFetch('/api/admin/overview');
    setOverview(res);
    const teachers = (res.users || []).filter((u: any) => u.role === 'Teacher');
    const students = (res.users || []).filter((u: any) => u.role === 'Student');
    if (teachers[0] && !assignTeacherId) setAssignTeacherId(teachers[0].id);
    if (students[0] && !grantStudentId) setGrantStudentId(students[0].id);
    if (res.plans?.[0] && !grantPlanId) setGrantPlanId(res.plans[0].id);
    if (res.courseHierarchy?.units?.[0] && !assignTargetId) {
      setAssignTargetId(res.courseHierarchy.units[0].id);
    }
    if (res.courseHierarchy?.subUnits?.[0] && !topicSubUnitId) {
      setTopicSubUnitId(res.courseHierarchy.subUnits[0].id);
    }
  };

  const loadDatabaseTables = async (tableName = selectedTable) => {
    const res = await apiFetch(`/api/admin/database/tables?table=${encodeURIComponent(tableName)}`);
    setDbView(res);
    setSelectedTable(res.selectedTable);
  };

  useEffect(() => {
    if (twoFactorVerified) {
      loadOverview().catch(() => {});
      loadDatabaseTables('users').catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twoFactorVerified]);

  if (!twoFactorVerified) {
    return (
      <div className="py-6">
        <TwoFactorGate
          lang={lang}
          twoFactorEnabled={twoFactorEnabled}
          isMandatory={true}
          onVerified={on2FAVerified}
        />
      </div>
    );
  }

  const notify = (text: string) => {
    setErrorMsg('');
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  };

  const m = overview?.metrics;

  const navItems: {
    key: AdminTab;
    bn: string;
    en: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { key: 'analytics', bn: 'রিপোর্ট', en: 'Analytics', icon: BarChart3 },
    { key: 'course', bn: 'কোর্স', en: 'Course', icon: BookOpen },
    { key: 'teachers', bn: 'ব্যবহারকারী', en: 'Users', icon: Users },
    { key: 'billing', bn: 'প্ল্যান', en: 'Billing', icon: CreditCard },
    { key: 'security', bn: 'নিরাপত্তা', en: 'Security', icon: ShieldAlert },
  ];

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const created = await apiFetch('/api/admin/users/create', {
        method: 'POST',
        body: JSON.stringify({
          fullName: newFullName,
          email: newEmail,
          phoneNumber: newPhone,
          password: newPassword,
          role: newRole,
          designation: newDesignation,
        }),
      });
      setNewFullName('');
      setNewEmail('');
      setNewPhone('');
      setNewPassword('');
      setNewDesignation('');
      await loadOverview();
      if (created.user?.role === 'Teacher') {
        setAssignTeacherId(created.user.id);
      }
      notify(lang === 'bn' ? 'নতুন অ্যাকাউন্ট তৈরি হয়েছে' : `${newRole} account created`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create user');
    }
  };

  return (
    <div className="space-y-5 pb-20 lg:pb-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'সুপার অ্যাডমিন ড্যাশবোর্ড' : 'Super Admin Control Center'}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
            {user?.fullName}
          </h1>
        </div>

        <div className="hidden lg:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          {navItems.map(({ key, bn, en, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`min-h-[40px] flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg whitespace-nowrap ${
                tab === key
                  ? 'bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{lang === 'bn' ? bn : en}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Super Admin Details Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">{user?.role}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">{user?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-mono">{user?.phoneNumber || '-'}</span>
          </div>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
          {msg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-xs text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {/* Analytics Tab */}
      {tab === 'analytics' && m && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="text-xs text-slate-500">Total Students</div>
            <div className="text-2xl font-bold font-mono mt-1">{m.totalStudents}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="text-xs text-slate-500">Total Teachers</div>
            <div className="text-2xl font-bold font-mono mt-1">{m.totalTeachers}</div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="text-xs text-slate-500">Active Subscriptions</div>
            <div className="text-2xl font-bold font-mono mt-1 text-emerald-600">
              {m.activeSubscriptions}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <div className="text-xs text-slate-500">Verified Revenue (BDT)</div>
            <div className="text-2xl font-bold font-mono mt-1 text-sky-700 dark:text-sky-400">
              ৳{Number(m.totalRevenueBdt).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Course & Exam Solution Overrides */}
      {tab === 'course' && overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold">Single Main Course Structure Manager</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/admin/course/units', {
                  method: 'POST',
                  body: JSON.stringify({ titleBn: unitTitleEn, titleEn: unitTitleEn }),
                });
                setUnitTitleEn('');
                loadOverview();
                onRefreshCourse();
                notify('Unit added');
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                required
                value={unitTitleEn}
                onChange={(e) => setUnitTitleEn(e.target.value)}
                placeholder="New Unit Title"
                className="flex-1 min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <button type="submit" className="min-h-[44px] px-4 py-2 rounded-lg bg-sky-700 text-white font-medium">
                Add Unit
              </button>
            </form>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/admin/course/topics', {
                  method: 'POST',
                  body: JSON.stringify({
                    subUnitId: topicSubUnitId,
                    titleBn: topicTitleEn,
                    titleEn: topicTitleEn,
                  }),
                });
                setTopicTitleEn('');
                loadOverview();
                onRefreshCourse();
                notify('Topic added');
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <select
                value={topicSubUnitId}
                onChange={(e) => setTopicSubUnitId(Number(e.target.value))}
                className="min-h-[44px] px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 sm:max-w-[160px]"
              >
                {(overview.courseHierarchy?.subUnits || []).map((su: any) => (
                  <option key={su.id} value={su.id}>
                    {pick(su.titleBn, su.titleEn, lang)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                value={topicTitleEn}
                onChange={(e) => setTopicTitleEn(e.target.value)}
                placeholder="New Topic Title"
                className="flex-1 min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <button type="submit" className="min-h-[44px] px-4 py-2 rounded-lg bg-sky-700 text-white font-medium">
                Add Topic
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 text-xs">
            <h3 className="text-sm font-semibold">Exam Solution Schedule Overrides</h3>
            {(overview.exams || []).map((ex: any) => (
              <div
                key={ex.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-800"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{pick(ex.titleBn, ex.titleEn, lang)}</div>
                  <div className="text-slate-500 font-mono">
                    {ex.solutionForcePublished ? 'Force Published' : `Scheduled: ${new Date(ex.solutionPublishAt).toLocaleString()}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/admin/exams/${ex.id}/override-solution`, {
                      method: 'POST',
                      body: JSON.stringify({ forcePublish: !ex.solutionForcePublished }),
                    });
                    loadOverview();
                    notify('Solution visibility updated');
                  }}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 shrink-0"
                >
                  {ex.solutionForcePublished ? 'Revert Embargo' : 'Force Publish'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Users, Account Creation & Teacher Assignments */}
      {tab === 'teachers' && overview && (
        <div className="space-y-6 text-xs">
          {/* Create Teacher / Student Account */}
          <form
            onSubmit={handleCreateUser}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
          >
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-sky-600" />
              {lang === 'bn' ? 'নতুন শিক্ষক / শিক্ষার্থী তৈরি করুন' : 'Create Teacher or Student Account'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              <input
                type="text"
                required
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder={lang === 'bn' ? 'পূর্ণ নাম *' : 'Full Name *'}
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email *"
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <input
                type="tel"
                required
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Phone (017...) *"
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
              />
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password (min 6 chars) *"
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'Teacher' | 'Student')}
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="Teacher">Teacher</option>
                <option value="Student">Student</option>
              </select>
              <input
                type="text"
                value={newDesignation}
                onChange={(e) => setNewDesignation(e.target.value)}
                placeholder="Designation (e.g. Senior Lecturer)"
                className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-semibold"
            >
              {lang === 'bn' ? 'অ্যাকাউন্ট তৈরি করুন' : 'Create User Account'}
            </button>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-600" />
                User Role Management & Password Recovery
              </h3>
              {issuedResetInfo && (
                <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1">
                  <div className="font-semibold text-amber-900 dark:text-amber-200">
                    {lang === 'bn' ? 'এককালীন পাসওয়ার্ড রিসেট কোড তৈরি হয়েছে' : 'One-Time Password Reset Code Issued'}
                  </div>
                  <div className="font-mono">
                    {issuedResetInfo.email} · Code: <strong className="text-sm">{issuedResetInfo.code}</strong>
                  </div>
                  <div className="text-[11px] text-amber-800 dark:text-amber-300">
                    {lang === 'bn'
                      ? 'এই কোডটি ১৫ মিনিটের জন্য সক্রিয় থাকবে। ব্যবহারকারী Forgot Password -> 6-Digit Reset Code ব্যবহার করে পাসওয়ার্ড পরিবর্তন করতে পারবেন।'
                      : 'Valid for 15 minutes. User can enter it under Forgot Password -> 6-Digit Reset Code.'}
                  </div>
                </div>
              )}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {overview.users.map((u: any) => (
                  <div
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{u.fullName}</div>
                      <div className="text-slate-500 truncate">
                        {u.email} {u.phoneNumber ? `· ${u.phoneNumber}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const issued = await apiFetch(`/api/admin/users/${u.id}/issue-reset-code`, {
                            method: 'POST',
                          });
                          setIssuedResetInfo(issued);
                        }}
                        title="Issue 15-min password reset code"
                        className="min-h-[36px] flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-medium"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Reset Code</span>
                      </button>
                      <select
                        value={u.role}
                        onChange={async (e) => {
                          await apiFetch(`/api/admin/users/${u.id}/role`, {
                            method: 'PATCH',
                            body: JSON.stringify({ role: e.target.value }),
                          });
                          loadOverview();
                          notify('User role updated');
                        }}
                        className="min-h-[40px] px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                      >
                        <option value="Student">Student</option>
                        <option value="Teacher">Teacher</option>
                        <option value="SuperAdmin">SuperAdmin</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <h3 className="text-sm font-semibold">Assign Teacher Course Scope</h3>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiFetch('/api/admin/teacher-assignments', {
                    method: 'POST',
                    body: JSON.stringify({
                      teacherUserId: assignTeacherId,
                      scopeType: assignScopeType,
                      unitId: assignScopeType === 'Unit' ? assignTargetId : null,
                      subUnitId: assignScopeType === 'SubUnit' ? assignTargetId : null,
                      topicId: assignScopeType === 'Topic' ? assignTargetId : null,
                    }),
                  });
                  loadOverview();
                  notify('Teacher scope assigned');
                }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2"
              >
                <select
                  value={assignTeacherId}
                  onChange={(e) => setAssignTeacherId(Number(e.target.value))}
                  className="min-h-[44px] px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {overview.users
                    .filter((u: any) => u.role === 'Teacher')
                    .map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                </select>
                <select
                  value={assignScopeType}
                  onChange={(e) => setAssignScopeType(e.target.value as any)}
                  className="min-h-[44px] px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="Unit">Unit</option>
                  <option value="SubUnit">Sub-Unit</option>
                  <option value="Topic">Topic</option>
                </select>
                <select
                  value={assignTargetId}
                  onChange={(e) => setAssignTargetId(Number(e.target.value))}
                  className="min-h-[44px] px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {(assignScopeType === 'Unit'
                    ? overview.courseHierarchy.units
                    : assignScopeType === 'SubUnit'
                    ? overview.courseHierarchy.subUnits
                    : overview.courseHierarchy.topics
                  ).map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {pick(item.titleBn, item.titleEn, lang)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="sm:col-span-3 min-h-[44px] py-2 rounded-lg bg-sky-700 text-white font-medium"
                >
                  Assign Scope
                </button>
              </form>

              <div className="space-y-2">
                {overview.assignments.map((a: any) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-2 rounded border border-slate-200 dark:border-slate-800"
                  >
                    <span className="font-mono">
                      Teacher #{a.teacherUserId} → {a.scopeType} #{a.unitId || a.subUnitId || a.topicId}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/teacher-assignments/${a.id}`, { method: 'DELETE' });
                        loadOverview();
                      }}
                      className="text-red-600 hover:underline min-h-[36px]"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans, Admin Grants & Refunds */}
      {tab === 'billing' && overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-sky-600" />
              6 Subscription Durations Pricing
            </h3>
            {overview.plans.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800"
              >
                <div>
                  <div className="font-semibold">{pick(p.titleBn, p.titleEn, lang)}</div>
                  <div className="text-slate-500 font-mono">
                    {p.durationMonths}M · Grace: {p.gracePeriodDays}d
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">৳{p.priceBdt}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const nextPrice = Number(p.priceBdt) + 50;
                      await apiFetch(`/api/admin/plans/${p.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          priceBdt: nextPrice,
                          gracePeriodDays: p.gracePeriodDays,
                        }),
                      });
                      loadOverview();
                      onRefreshCourse();
                      notify('Plan price updated');
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700"
                  >
                    +৳50
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="text-sm font-semibold">Grant Complimentary Course Access</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={grantStudentId}
                  onChange={(e) => setGrantStudentId(Number(e.target.value))}
                  className="flex-1 min-h-[44px] px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {overview.users.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
                <select
                  value={grantPlanId}
                  onChange={(e) => setGrantPlanId(Number(e.target.value))}
                  className="min-h-[44px] px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {overview.plans.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.planCode}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch('/api/admin/subscriptions/grant', {
                      method: 'POST',
                      body: JSON.stringify({ studentUserId: grantStudentId, planId: grantPlanId }),
                    });
                    loadOverview();
                    notify('Complimentary access granted');
                  }}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium"
                >
                  Grant
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
              <h3 className="text-sm font-semibold">Recent Payments & Refunds</h3>
              {overview.payments.slice(0, 6).map((pay: any) => (
                <div
                  key={pay.id}
                  className="flex items-center justify-between p-2 rounded border border-slate-200 dark:border-slate-800"
                >
                  <span className="font-mono">
                    {pay.gateway} · ৳{pay.netAmountBdt} · {pay.status}
                  </span>
                  {pay.status === 'Verified' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/admin/payments/${pay.id}/refund`, {
                          method: 'POST',
                          body: JSON.stringify({ reason: 'Admin refund' }),
                        });
                        loadOverview();
                        notify('Refund recorded');
                      }}
                      className="text-red-600 hover:underline min-h-[36px]"
                    >
                      Refund
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Security Logs, Active Sessions, Backups & Cloud SQL Database Explorer */}
      {tab === 'security' && overview && (
        <div className="space-y-6 text-xs">
          {/* Cloud SQL Direct Console Link & Live Table Viewer */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Database className="w-4 h-4 text-sky-600" />
                  {lang === 'bn'
                    ? 'ডাটাবেস এক্সপ্লোরার ও Google Cloud SQL লিংক'
                    : 'Database Explorer & Google Cloud SQL Console'}
                </h3>
                <p className="text-slate-500 mt-0.5">
                  {lang === 'bn'
                    ? 'আপনার PostgreSQL ডাটাবেস সরাসরি ব্রাউজারে দেখতে নিচের টেবিল বা Cloud SQL Studio লিংক ব্যবহার করুন।'
                    : 'Browse safe table records below or open Google Cloud SQL Studio directly.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={
                    dbView?.cloudSqlConsoleUrl ||
                    'https://console.cloud.google.com/sql/instances/ai-studio-fc5a37c6/studio?project=fluid-ceremony-z91ww'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-medium"
                >
                  <span>Cloud SQL Studio</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={
                    dbView?.cloudSqlOverviewUrl ||
                    'https://console.cloud.google.com/sql/instances/ai-studio-fc5a37c6/overview?project=fluid-ceremony-z91ww'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                >
                  <span>Instance Overview</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {dbView?.tableSummaries && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {dbView.tableSummaries.map((t: any) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => loadDatabaseTables(t.name)}
                      className={`min-h-[36px] px-3 py-1.5 rounded-lg border font-mono text-[11px] ${
                        selectedTable === t.name
                          ? 'bg-sky-700 text-white border-sky-700'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {t.name} ({t.rowCount})
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-72">
                  {!dbView.rows?.length ? (
                    <div className="p-4 text-slate-500">No rows in {selectedTable}</div>
                  ) : (
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/70 sticky top-0">
                        <tr>
                          {Object.keys(dbView.rows[0]).map((col) => (
                            <th key={col} className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dbView.rows.map((row: any, idx: number) => (
                          <tr key={row.id || idx}>
                            {Object.keys(dbView.rows[0]).map((col) => {
                              const val = row[col];
                              const display =
                                val === null || val === undefined
                                  ? '-'
                                  : typeof val === 'object'
                                  ? JSON.stringify(val)
                                  : String(val);
                              return (
                                <td key={col} className="px-3 py-2 max-w-[220px] truncate font-mono">
                                  {display}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Security Events & Audit Trail
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {overview.securityEvents.map((ev: any) => (
                  <div key={ev.id} className="p-2 rounded border border-slate-200 dark:border-slate-800">
                    <div className="font-mono font-semibold">
                      [{ev.severity}] {ev.eventType} · {ev.ipAddress}
                    </div>
                    <div className="text-slate-500">
                      {new Date(ev.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {overview.auditLogs.map((al: any) => (
                  <div key={`al-${al.id}`} className="p-2 rounded border border-slate-100 dark:border-slate-800">
                    <div className="font-mono">{al.action} ({al.entityName})</div>
                    <div className="text-slate-500">{new Date(al.createdAt).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Database className="w-4 h-4 text-sky-600" />
                    Encrypted Backups & Restore Verification
                  </h3>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch('/api/admin/backups/verify-restore', { method: 'POST' });
                      loadOverview();
                      notify('Backup restore verification recorded');
                    }}
                    className="min-h-[40px] px-3 py-1.5 rounded-lg bg-sky-700 text-white font-medium"
                  >
                    Run Restore Test
                  </button>
                </div>
                {overview.backupRecords.map((b: any) => (
                  <div key={b.id} className="flex justify-between p-2 rounded border border-slate-200 dark:border-slate-800 font-mono">
                    <span>{b.backupScope} · {(b.sizeBytes / 1024).toFixed(0)} KB</span>
                    <span className="text-emerald-600">{b.status}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Settings className="w-4 h-4 text-sky-600" />
                  Active Sessions (Admin Revocation)
                </h3>
                {overview.activeSessions.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded border border-slate-200 dark:border-slate-800">
                    <span className="font-mono">User #{s.userId} · {s.ipAddress}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await apiFetch(`/api/auth/sessions/${s.id}/revoke`, { method: 'POST' });
                        loadOverview();
                        notify('Session revoked');
                      }}
                      className="text-red-600 hover:underline min-h-[36px]"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-First Bottom Navigation Bar (< lg) */}
      <nav
        aria-label="Admin Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 grid grid-cols-5"
      >
        {navItems.map(({ key, bn, en, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active ? 'text-sky-700 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full px-1">{lang === 'bn' ? bn : en}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
