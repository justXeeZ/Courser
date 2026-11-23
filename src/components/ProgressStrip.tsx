import type { ProgressStats } from '@/store/useProgressStore';
import type { StatusFilter } from '@/components/CourseTreeCanvas';

interface ProgressStripProps {
  stats: ProgressStats;
  statusFilter: StatusFilter;
  onChangeFilter: (filter: StatusFilter) => void;
}

const FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'todo', label: 'Todo' },
  { id: 'learning', label: 'Learning' },
  { id: 'done', label: 'Done' },
  { id: 'skipped', label: 'Skipped' },
];

export function ProgressStrip({ stats, statusFilter, onChangeFilter }: ProgressStripProps) {
  return (
    <div className="mx-auto mb-5 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 shadow-xs sm:flex sm:items-center sm:justify-between sm:gap-4 dark:border-slate-700/80 dark:bg-[#121926] dark:text-slate-200">
      <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
        <span className="inline-flex items-center rounded bg-yellow-400 px-2 py-0.5 font-mono text-xs font-bold text-black">
          {stats.percentDone}% DONE
        </span>
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {stats.done} of {stats.required} Required Items Done
        </span>
        {stats.learning > 0 && (
          <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
            {stats.learning} Learning
          </span>
        )}
        {stats.skipped > 0 && (
          <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-300">
            {stats.skipped} Skipped
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 sm:mt-0 sm:justify-end">
        <div className="inline-flex items-center rounded border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-[#0d131f]">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeFilter(opt.id)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                statusFilter === opt.id
                  ? 'bg-[var(--solid-bg)] font-semibold text-[var(--solid-text)]'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="hidden text-slate-500 lg:inline dark:text-slate-400">
          Click to study · Right-click or{' '}
          <kbd className="rounded border border-slate-200 bg-slate-100 px-1 text-slate-700 dark:border-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
            Shift+Click
          </kbd>{' '}
          to mark
        </span>
      </div>
    </div>
  );
}
