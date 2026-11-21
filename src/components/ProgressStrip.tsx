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
    <div className="mx-auto mb-5 max-w-5xl rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-xs text-gray-800 sm:flex sm:items-center sm:justify-between sm:gap-4 dark:border-yellow-900/60 dark:bg-yellow-950/30 dark:text-slate-200">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center rounded bg-yellow-400 px-2 py-0.5 font-mono text-xs font-bold text-black">
          {stats.percentDone}% DONE
        </span>
        <span className="font-medium text-gray-900 dark:text-slate-100">
          {stats.done} of {stats.required} Required Items Done
        </span>
        {stats.learning > 0 && (
          <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
            {stats.learning} Learning
          </span>
        )}
        {stats.skipped > 0 && (
          <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {stats.skipped} Skipped
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 sm:mt-0">
        <div className="inline-flex items-center rounded border border-yellow-300/80 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeFilter(opt.id)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                statusFilter === opt.id
                  ? 'bg-slate-900 text-white dark:bg-slate-700 dark:text-white'
                  : 'text-gray-600 hover:text-black dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="hidden text-gray-500 lg:inline dark:text-slate-400">
          Click to study · Right-click or{' '}
          <kbd className="rounded bg-white px-1 text-gray-700 dark:bg-slate-800 dark:text-slate-300">
            Shift+Click
          </kbd>{' '}
          to mark
        </span>
      </div>
    </div>
  );
}
