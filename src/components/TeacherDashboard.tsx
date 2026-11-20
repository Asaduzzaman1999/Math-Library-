import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  FileCheck2,
  Video,
  Download,
  PlusCircle,
  UserCircle,
  Mail,
  Phone,
  ClipboardPlus,
  Shield,
} from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { Lang, pick } from '../lib/i18n';
import { TwoFactorGate } from './TwoFactorGate';
import { MathRenderer } from './MathRenderer';

interface TeacherDashboardProps {
  lang: Lang;
  user: any;
  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
  on2FAVerified: () => void;
}

type TeacherTab = 'content' | 'exams' | 'scripts' | 'profile';

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  lang,
  user,
  twoFactorEnabled,
  twoFactorVerified,
  on2FAVerified,
}) => {
  const [workspace, setWorkspace] = useState<any>(null);
  const [tab, setTab] = useState<TeacherTab>('content');
  const [show2FA, setShow2FA] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Content Creation Form
  const [topicId, setTopicId] = useState<number>(0);
  const [contentType, setContentType] = useState<'Lesson' | 'Discussion' | 'Example'>('Example');
  const [titleBn, setTitleBn] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyEn, setBodyEn] = useState('Evaluate $$\\int_0^1 x^2\\,dx$$');
  const [solutionEn, setSolutionEn] = useState('Step 1: $$\\left[\\frac{x^3}{3}\\right]_0^1 = \\frac{1}{3}$$');
  const [videoTitleEn, setVideoTitleEn] = useState('');

  // Exam Creation Form
  const [examTitleEn, setExamTitleEn] = useState('');
  const [examType, setExamType] = useState<'MCQ' | 'Written'>('MCQ');
  const [solutionPublishAt, setSolutionPublishAt] = useState('');

  // Script Grading State
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [marksObtained, setMarksObtained] = useState('8');
  const [feedbackEn, setFeedbackEn] = useState('');
  const [checkedPdf, setCheckedPdf] = useState<File | null>(null);

  const loadWorkspace = async () => {
    setError('');
    try {
      const res = await apiFetch('/api/teacher/workspace');
      setWorkspace(res);
      if (res.assignedTopics?.[0] && !topicId) {
        setTopicId(res.assignedTopics[0].id);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (twoFactorVerified) {
      loadWorkspace();
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

  const handleAddContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicId) return;
    setError('');
    try {
      await apiFetch(`/api/teacher/topics/${topicId}/content`, {
        method: 'POST',
        body: JSON.stringify({
          contentType,
          titleBn: titleBn || titleEn,
          titleEn: titleEn || titleBn,
          bodyBn: bodyEn,
          bodyEn,
          solutionBn: solutionEn,
          solutionEn,
          videoTitleEn,
        }),
      });
      setStatusMsg(lang === 'bn' ? 'কনটেন্ট সংরক্ষিত হয়েছে' : 'Content published to assigned topic');
      setTitleBn('');
      setTitleEn('');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicId) return;
    setError('');
    try {
      await apiFetch('/api/teacher/exams', {
        method: 'POST',
        body: JSON.stringify({
          topicId,
          titleBn: examTitleEn,
          titleEn: examTitleEn,
          examType,
          durationMinutes: 20,
          totalMarks: 10,
          passMarks: 5,
          solutionPublishAt: solutionPublishAt || undefined,
        }),
      });
      setStatusMsg(lang === 'bn' ? 'পরীক্ষা তৈরি হয়েছে' : 'Exam created with solution schedule');
      setExamTitleEn('');
      loadWorkspace();
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDownloadScript = async (fileId: number) => {
    const res = await apiFetch(`/api/files/signed-url/${fileId}`, { method: 'POST' });
    if (res.signedUrl) window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingId) return;
    const fd = new FormData();
    fd.append('marksObtained', marksObtained);
    fd.append('feedbackBn', feedbackEn);
    fd.append('feedbackEn', feedbackEn);
    if (checkedPdf) fd.append('checkedPdf', checkedPdf);
    await apiFetch(`/api/teacher/written-submissions/${gradingId}/evaluate`, {
      method: 'POST',
      body: fd,
    });
    setGradingId(null);
    setCheckedPdf(null);
    loadWorkspace();
  };

  const navItems: {
    key: TeacherTab;
    bn: string;
    en: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { key: 'content', bn: 'কনটেন্ট', en: 'Content', icon: BookOpen },
    { key: 'exams', bn: 'পরীক্ষা', en: 'Exams', icon: ClipboardPlus },
    { key: 'scripts', bn: 'খাতা মূল্যায়ন', en: 'Scripts', icon: FileCheck2 },
    { key: 'profile', bn: 'তথ্য ও ভিডিও', en: 'Profile', icon: UserCircle },
  ];

  return (
    <div className="space-y-5 pb-20 lg:pb-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'শিক্ষক ড্যাশবোর্ড' : 'Teacher Dashboard'} · {user?.designation || 'Mathematics Faculty'}
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

      {/* Teacher Details Banner */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">{user?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-mono">{user?.phoneNumber || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
            <span>
              {lang === 'bn' ? 'অনুমোদিত টপিক: ' : 'Assigned Topics: '}
              <strong className="font-mono">{workspace?.assignedTopics?.length ?? 0}</strong>
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {statusMsg && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
          {statusMsg}
        </div>
      )}

      {/* Assigned Topics Scope Card */}
      {tab === 'content' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-600" />
              {lang === 'bn' ? 'আপনার অনুমোদিত টপিকসমূহ' : 'Your Authorized Topic Scope'}
            </h3>
            {!workspace?.assignedTopics?.length ? (
              <p className="text-xs text-slate-500">
                {lang === 'bn'
                  ? 'সুপার অ্যাডমিন এখনো কোনো ইউনিট বা টপিক অ্যাসাইন করেননি।'
                  : 'No Units, Sub-Units, or Topics assigned yet. Contact Super Admin to assign scope.'}
              </p>
            ) : (
              <div className="text-xs text-slate-600 dark:text-slate-300">
                {workspace.assignedTopics
                  .map((t: any) => pick(t.titleBn, t.titleEn, lang))
                  .join(' · ')}
              </div>
            )}
          </div>

          {workspace?.assignedTopics?.length > 0 && (
            <form
              onSubmit={handleAddContent}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 text-xs"
            >
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-sky-600" />
                {lang === 'bn' ? 'পাঠ, আলোচনা ও গাণিতিক উদাহরণ যোগ' : 'Publish Scoped Topic Content'}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={topicId}
                  onChange={(e) => setTopicId(Number(e.target.value))}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  {workspace.assignedTopics.map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {pick(t.titleBn, t.titleEn, lang)}
                    </option>
                  ))}
                </select>
                <select
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value as any)}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="Example">Mathematical Example</option>
                  <option value="Lesson">Lesson</option>
                  <option value="Discussion">Discussion</option>
                </select>
              </div>
              <input
                type="text"
                required
                placeholder={lang === 'bn' ? 'শিরোনাম (বাংলা/ইংরেজি)' : 'Title'}
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <textarea
                rows={2}
                value={bodyEn}
                onChange={(e) => setBodyEn(e.target.value)}
                placeholder="Problem / Body with $...$ or $$...$$ LaTeX"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
              />
              {contentType === 'Example' && (
                <textarea
                  rows={2}
                  value={solutionEn}
                  onChange={(e) => setSolutionEn(e.target.value)}
                  placeholder="Step-by-step LaTeX solution"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              )}
              <input
                type="text"
                value={videoTitleEn}
                onChange={(e) => setVideoTitleEn(e.target.value)}
                placeholder="Optional Video Solution Title (360p/480p/720p)"
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <div className="text-[11px] text-slate-500 mb-1">Live KaTeX Preview</div>
                <MathRenderer text={bodyEn} />
              </div>
              <button
                type="submit"
                className="w-full min-h-[44px] py-2 px-4 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-medium"
              >
                {lang === 'bn' ? 'প্রকাশ করুন' : 'Publish Content'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Exams Creation Tab */}
      {tab === 'exams' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 text-xs">
          <h3 className="text-sm font-semibold">
            {lang === 'bn' ? 'পরীক্ষা ও সমাধান শিডিউল তৈরি' : 'Create Exam & Solution Embargo Schedule'}
          </h3>
          {!workspace?.assignedTopics?.length ? (
            <p className="text-slate-500">
              {lang === 'bn'
                ? 'পরীক্ষা তৈরির আগে সুপার অ্যাডমিন থেকে টপিক অ্যাসাইন করা থাকতে হবে।'
                : 'Super Admin must assign a Unit or Topic to you before creating scoped exams.'}
            </p>
          ) : (
            <form onSubmit={handleCreateExam} className="space-y-3">
              <select
                value={topicId}
                onChange={(e) => setTopicId(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {workspace.assignedTopics.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {pick(t.titleBn, t.titleEn, lang)}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                value={examTitleEn}
                onChange={(e) => setExamTitleEn(e.target.value)}
                placeholder="Exam Title"
                className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as any)}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                >
                  <option value="MCQ">MCQ Exam</option>
                  <option value="Written">Written Exam</option>
                </select>
                <input
                  type="datetime-local"
                  value={solutionPublishAt}
                  onChange={(e) => setSolutionPublishAt(e.target.value)}
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[44px] py-2 px-4 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-medium"
              >
                {lang === 'bn' ? 'পরীক্ষা সংরক্ষণ করুন' : 'Create Scoped Exam'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Written Scripts Grading Tab */}
      {tab === 'scripts' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-sky-600" />
            {lang === 'bn' ? 'মূল্যায়নের জন্য লিখিত উত্তরপত্র' : 'Written Answer Scripts (Scoped Evaluation)'}
          </h3>
          {!(workspace?.writtenSubmissions || []).length ? (
            <p className="text-xs text-slate-500">
              {lang === 'bn' ? 'আপনার স্কোপে কোনো লিখিত খাতা জমা হয়নি।' : 'No written scripts awaiting evaluation in your scope.'}
            </p>
          ) : (
            <div className="space-y-3">
              {workspace.writtenSubmissions.map((ws: any) => (
                <div
                  key={ws.id}
                  className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-semibold">{ws.studentName} · {pick(ws.examTitleBn, ws.examTitleEn, lang)}</div>
                    <div className="text-slate-500 font-mono">
                      {ws.pageCount} pages · {ws.compressionProfile} · Status: {ws.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadScript(ws.studentPdfFileId)}
                      className="min-h-[40px] flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => setGradingId(ws.id)}
                      className="min-h-[40px] px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white"
                    >
                      Evaluate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {gradingId && (
            <form onSubmit={handleEvaluate} className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
              <div className="font-semibold">Evaluate Script #{gradingId}</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="number"
                  step="0.5"
                  required
                  value={marksObtained}
                  onChange={(e) => setMarksObtained(e.target.value)}
                  placeholder="Marks"
                  className="min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                />
                <input
                  type="text"
                  value={feedbackEn}
                  onChange={(e) => setFeedbackEn(e.target.value)}
                  placeholder="Evaluation feedback"
                  className="md:col-span-2 min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-500">Upload Checked Answer-Script PDF (optional)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setCheckedPdf(e.target.files?.[0] || null)}
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium">
                  Submit Evaluation
                </button>
                <button
                  type="button"
                  onClick={() => setGradingId(null)}
                  className="min-h-[44px] px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Profile, Video Pipeline & Optional 2FA */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 text-xs">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Video className="w-4 h-4 text-sky-600" />
              {lang === 'bn' ? 'ভিডিও প্রসেসিং পাইপলাইন (360p / 480p / 720p)' : 'Video Compression Queue'}
            </h3>
            {!(workspace?.videoJobs || []).length ? (
              <p className="text-slate-500">No background transcode jobs queued yet.</p>
            ) : (
              <div className="space-y-2">
                {workspace.videoJobs.map((j: any) => (
                  <div key={j.id} className="flex justify-between p-2.5 rounded border border-slate-200 dark:border-slate-800">
                    <span>{pick(j.titleBn, j.titleEn, lang)}</span>
                    <span className="font-mono">{j.targetProfiles} · {j.status} ({j.progressPercent}%)</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-600" />
                {lang === 'bn' ? 'নিরাপত্তা ও ২এফএ (টেস্টিং মোড)' : 'Account Security (2FA Testing Mode Off)'}
              </h3>
              {!twoFactorEnabled && (
                <button
                  type="button"
                  onClick={() => setShow2FA(true)}
                  className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                >
                  {lang === 'bn' ? '২এফএ চালু করুন' : 'Enable Optional 2FA'}
                </button>
              )}
            </div>
            <p className="text-slate-500">
              {lang === 'bn'
                ? 'টেস্টিং চলাকালে বাধ্যতামূলক ২এফএ বন্ধ রাখা হয়েছে। চাইলে ঐচ্ছিকভাবে চালু করতে পারেন।'
                : 'Mandatory 2FA gate is disabled for testing. You can still optionally enroll TOTP here.'}
            </p>
          </div>
        </div>
      )}

      {/* Mobile-First Bottom Navigation Bar (< lg) */}
      <nav
        aria-label="Teacher Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-16 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 grid grid-cols-4"
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

      {show2FA && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4">
          <TwoFactorGate
            lang={lang}
            twoFactorEnabled={twoFactorEnabled}
            isMandatory={false}
            onVerified={() => {
              setShow2FA(false);
              on2FAVerified();
            }}
            onClose={() => setShow2FA(false)}
          />
        </div>
      )}
    </div>
  );
};
