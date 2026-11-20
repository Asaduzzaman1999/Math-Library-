import React, { useEffect, useState } from 'react';
import { Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '../lib/apiClient';
import { Lang, pick } from '../lib/i18n';
import { MathRenderer } from './MathRenderer';

interface JobSolutionsSectionProps {
  lang: Lang;
}

const CATEGORIES = [
  { key: 'ALL', bn: 'সবগুলো', en: 'All' },
  { key: 'BCS', bn: 'বিসিএস', en: 'BCS' },
  { key: 'Bank', bn: 'ব্যাংক নিয়োগ', en: 'Bank' },
  { key: 'NTRCA', bn: 'NTRCA', en: 'NTRCA' },
  { key: 'PrimaryTeacher', bn: 'প্রাথমিক শিক্ষক', en: 'Primary Teacher' },
  { key: 'Government', bn: 'সরকারি চাকরি', en: 'Govt Jobs' },
];

export const JobSolutionsSection: React.FC<JobSolutionsSectionProps> = ({ lang }) => {
  const [category, setCategory] = useState('ALL');
  const [items, setItems] = useState<any[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    apiFetch(`/api/job-solutions?category=${encodeURIComponent(category)}`)
      .then((res) => setItems(res.items || []))
      .catch(() => {});
  }, [category]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'প্রতিযোগিতামূলক চাকরির গণিত সমাধান' : 'Competitive Recruitment Archive'}
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-sky-600" />
            {lang === 'bn' ? 'সাম্প্রতিক চাকরির পরীক্ষার গণিত সমাধান' : 'Latest Job Exam Math Solutions'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                category === c.key
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {lang === 'bn' ? c.bn : c.en}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => {
          const isOpen = openId === item.id;
          const opts: string[] = Array.isArray(item.optionsJson) ? item.optionsJson : [];
          return (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">
                <span>{item.category}</span>
                <span aria-hidden="true"> · </span>
                <span>{item.examName}</span>
                <span aria-hidden="true"> · </span>
                <span className="font-mono">{item.examYear}</span>
              </div>

              <MathRenderer
                text={pick(item.questionLatexBn, item.questionLatexEn, lang)}
                className="text-sm font-medium text-slate-900 dark:text-slate-100"
              />

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400">
                {opts.map((o, idx) => (
                  <div
                    key={idx}
                    className="px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-800 font-mono"
                  >
                    {['A', 'B', 'C', 'D'][idx]}. {o}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : item.id)}
                className="flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-400 pt-1"
              >
                {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {isOpen
                  ? lang === 'bn'
                    ? 'সমাধান লুকান'
                    : 'Hide Calculation'
                  : lang === 'bn'
                  ? `বিস্তারিত সমাধান দেখুন (সঠিক উত্তর: ${item.correctOption})`
                  : `View Calculation (Answer: ${item.correctOption})`}
              </button>

              {isOpen && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <MathRenderer
                    text={pick(item.explanationLatexBn, item.explanationLatexEn, lang)}
                    className="text-slate-700 dark:text-slate-300"
                  />
                  <MathRenderer text={item.calculationStepsLatex} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
