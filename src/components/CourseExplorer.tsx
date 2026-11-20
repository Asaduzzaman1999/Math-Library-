import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Heart,
  Lock,
  PlayCircle,
  Search,
  ChevronRight,
} from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { Lang, pick } from '../lib/i18n';
import { MathRenderer } from './MathRenderer';

interface CourseExplorerProps {
  lang: Lang;
  course: any;
  units: any[];
  hasActiveSubscription: boolean;
  isAuthenticated: boolean;
  onOpenPlans: () => void;
  onSignIn: () => void;
}

export const CourseExplorer: React.FC<CourseExplorerProps> = ({
  lang,
  course,
  units,
  hasActiveSubscription,
  isAuthenticated,
  onOpenPlans,
  onSignIn,
}) => {
  const firstTopicId = units?.[0]?.subUnits?.[0]?.topics?.[0]?.id ?? null;
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(firstTopicId);
  const [searchQuery, setSearchQuery] = useState('');
  const [topicData, setTopicData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [favSet, setFavSet] = useState<Set<number>>(new Set());
  const [completedLessons, setCompletedLessons] = useState<Set<number>>(new Set());
  const [activeVideoTitle, setActiveVideoTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTopicId && firstTopicId) {
      setSelectedTopicId(firstTopicId);
    }
  }, [firstTopicId, selectedTopicId]);

  useEffect(() => {
    if (!selectedTopicId) return;
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/topics/${selectedTopicId}/content`)
      .then((data) => {
        if (!cancelled) setTopicData(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTopicId, hasActiveSubscription, isAuthenticated]);

  const handleToggleFav = async (topicId: number) => {
    if (!isAuthenticated) {
      onSignIn();
      return;
    }
    const res = await apiFetch(`/api/favourites/${topicId}/toggle`, { method: 'POST' });
    setFavSet((prev) => {
      const next = new Set(prev);
      if (res.isFavourite) next.add(topicId);
      else next.delete(topicId);
      return next;
    });
  };

  const handleCompleteLesson = async (lessonId: number) => {
    if (!isAuthenticated) {
      onSignIn();
      return;
    }
    await apiFetch(`/api/lessons/${lessonId}/complete`, { method: 'POST' });
    setCompletedLessons((prev) => new Set(prev).add(lessonId));
  };

  const q = searchQuery.trim().toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'একক সমন্বিত গণিত কারিকুলাম' : 'Single Unified Course Curriculum'}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {course ? pick(course.titleBn, course.titleEn, lang) : 'Math Library'}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl mt-1">
            {course ? pick(course.descriptionBn, course.descriptionEn, lang) : ''}
          </p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'bn' ? 'টপিক খুঁজুন...' : 'Search topics...'}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Curriculum Sidebar Tree */}
        <aside className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-5">
          {units.map((unit) => {
            const matchingSubUnits = (unit.subUnits || [])
              .map((su: any) => ({
                ...su,
                topics: (su.topics || []).filter(
                  (t: any) =>
                    !q ||
                    t.titleBn.toLowerCase().includes(q) ||
                    t.titleEn.toLowerCase().includes(q)
                ),
              }))
              .filter((su: any) => su.topics.length > 0);

            if (matchingSubUnits.length === 0) return null;

            return (
              <div key={unit.id} className="space-y-2">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {pick(unit.titleBn, unit.titleEn, lang)}
                </div>
                <div className="space-y-3 pl-2">
                  {matchingSubUnits.map((su: any) => (
                    <div key={su.id} className="space-y-1">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {pick(su.titleBn, su.titleEn, lang)}
                      </div>
                      <div className="space-y-1">
                        {su.topics.map((t: any) => {
                          const isSelected = selectedTopicId === t.id;
                          const canAccess = t.isFreePreview || hasActiveSubscription;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setSelectedTopicId(t.id)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between gap-2 ${
                                isSelected
                                  ? 'bg-sky-700 text-white'
                                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <span className="truncate">{pick(t.titleBn, t.titleEn, lang)}</span>
                              {!canAccess ? (
                                <Lock className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </aside>

        {/* Topic Content Workspace */}
        <div className="lg:col-span-8 space-y-6">
          {loading ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-sm text-slate-500">
              {lang === 'bn' ? 'টপিক লোড হচ্ছে...' : 'Loading topic materials...'}
            </div>
          ) : topicData?.topic ? (
            <>
              {/* Topic Header */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {topicData.topic.isFreePreview
                        ? lang === 'bn'
                          ? 'ফ্রি প্রিভিউ টপিক'
                          : 'Free Preview Topic'
                        : lang === 'bn'
                        ? 'প্রিমিয়াম কোর্স টপিক'
                        : 'Subscribed Course Topic'}
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {pick(topicData.topic.titleBn, topicData.topic.titleEn, lang)}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      {pick(topicData.topic.summaryBn, topicData.topic.summaryEn, lang)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleFav(topicData.topic.id)}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
                    title={lang === 'bn' ? 'পছন্দের তালিকায় রাখুন' : 'Save to favourites'}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        favSet.has(topicData.topic.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-slate-500'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {topicData.locked ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
                  <Lock className="w-8 h-8 text-sky-600 mx-auto" />
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'bn' ? 'প্রিমিয়াম কনটেন্ট লক করা' : 'Subscription Required'}
                  </h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                    {lang === 'bn'
                      ? 'এই টপিকের পাঠ, গাণিতিক উদাহরণ, ভিডিও সমাধান ও অনুশীলন প্রশ্ন দেখতে ৬টি মেয়াদের যেকোনো একটি সাবস্ক্রিপশন সক্রিয় করুন।'
                      : 'Activate any of the six subscription durations to unlock full lessons, KaTeX proofs, video explanations, and practice sets.'}
                  </p>
                  <button
                    type="button"
                    onClick={onOpenPlans}
                    className="py-2.5 px-5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-sm font-medium"
                  >
                    {lang === 'bn' ? 'সাবস্ক্রিপশন প্ল্যান দেখুন' : 'View Subscription Plans'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Lessons */}
                  {topicData.lessons?.length > 0 && (
                    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
                      <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-sky-600" />
                        {lang === 'bn' ? 'পাঠ ও তাত্ত্বিক আলোচনা' : 'Lessons & Theory'}
                      </h4>
                      <div className="divide-y divide-slate-200 dark:divide-slate-800">
                        {topicData.lessons.map((lesson: any) => {
                          const isDone = completedLessons.has(lesson.id);
                          return (
                            <div key={lesson.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h5 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                                  {pick(lesson.titleBn, lesson.titleEn, lang)}
                                </h5>
                                <div className="flex items-center gap-2">
                                  {lesson.video && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveVideoTitle(
                                          pick(lesson.video.titleBn, lesson.video.titleEn, lang)
                                        )
                                      }
                                      className="flex items-center gap-1.5 text-xs text-sky-700 dark:text-sky-400 font-medium hover:underline"
                                    >
                                      <PlayCircle className="w-4 h-4" />
                                      {lang === 'bn' ? 'ভিডিও ব্যাখ্যা (720p HLS)' : 'Video Lecture (720p HLS)'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleCompleteLesson(lesson.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${
                                      isDone
                                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                                        : 'border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {isDone
                                      ? lang === 'bn'
                                        ? 'সম্পন্ন'
                                        : 'Completed'
                                      : lang === 'bn'
                                      ? 'সম্পন্ন চিহ্নিত করুন'
                                      : 'Mark Complete'}
                                  </button>
                                </div>
                              </div>
                              <MathRenderer
                                text={pick(lesson.contentBn, lesson.contentEn, lang)}
                                className="text-sm text-slate-700 dark:text-slate-300"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {/* Discussions */}
                  {topicData.discussions?.length > 0 && (
                    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
                      <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {lang === 'bn' ? 'গাণিতিক আলোচনা ও সতর্কতা' : 'Conceptual Discussions'}
                      </h4>
                      <div className="space-y-4">
                        {topicData.discussions.map((d: any) => (
                          <div
                            key={d.id}
                            className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-2"
                          >
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {pick(d.titleBn, d.titleEn, lang)}
                            </div>
                            <MathRenderer
                              text={pick(d.bodyLatexBn, d.bodyLatexEn, lang)}
                              className="text-sm text-slate-700 dark:text-slate-300"
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Mathematical Examples (with optional Video Solutions) */}
                  {topicData.examples?.length > 0 && (
                    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
                      <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {lang === 'bn' ? 'ধাপে ধাপে গাণিতিক উদাহরণ' : 'Step-by-Step Mathematical Examples'}
                      </h4>
                      <div className="space-y-5">
                        {topicData.examples.map((ex: any) => (
                          <div
                            key={ex.id}
                            className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {pick(ex.titleBn, ex.titleEn, lang)}
                              </div>
                              {ex.video && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveVideoTitle(
                                      pick(ex.video.titleBn, ex.video.titleEn, lang)
                                    )
                                  }
                                  className="flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline"
                                >
                                  <PlayCircle className="w-4 h-4" />
                                  {lang === 'bn' ? 'ভিডিও সমাধান দেখুন' : 'Watch Video Solution'}
                                </button>
                              )}
                            </div>
                            <MathRenderer
                              text={pick(ex.problemLatexBn, ex.problemLatexEn, lang)}
                              className="text-sm font-medium text-slate-900 dark:text-slate-100"
                            />
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                              <div className="text-xs text-slate-500 mb-1">
                                {lang === 'bn' ? 'সমাধান প্রক্রিয়া' : 'Step-by-step Derivation'}
                              </div>
                              <MathRenderer
                                text={pick(ex.solutionStepsLatexBn, ex.solutionStepsLatexEn, lang)}
                                className="text-sm text-slate-700 dark:text-slate-300"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Signed HLS Video Stream Preview Modal */}
      {activeVideoTitle && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 text-slate-100 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-sm">{activeVideoTitle}</h4>
                <div className="text-xs text-slate-400 font-mono">
                  H.264 / AAC Adaptive Stream · Profiles: 360p · 480p · 720p · Signed Expiring URL
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveVideoTitle(null)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700"
              >
                {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
              </button>
            </div>
            <div className="aspect-video rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-2">
              <PlayCircle className="w-12 h-12 text-sky-400" />
              <div className="text-sm font-medium">{activeVideoTitle}</div>
              <p className="text-xs text-slate-400 max-w-md">
                {lang === 'bn'
                  ? 'প্রিমিয়াম ভিডিও স্ট্রিমটি অ্যাডাপ্টিভ ৩৬০পি/৪৮০পি/৭২০পি প্রোফাইলে এবং স্বাক্ষরিত অস্থায়ী URL-এর মাধ্যমে সুরক্ষিতভাবে সরবরাহের জন্য প্রস্তুত।'
                  : 'Authorized adaptive HLS stream ready across 360p, 480p, and 720p profiles via short-lived signed access.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
