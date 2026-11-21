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
];

export function ProgressStrip({ stats, statusFilter, onChangeFilter }: ProgressStripProps) {
  return (
    <div className="mx-auto mb-5 max-w-5xl rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-xs text-gray-800 sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="inline-flex items-center rounded bg-yellow-400 px-2 py-0.5 font-mono text-xs font-bold text-black">
          {stats.percentDone}% DONE
        </span>
        <span className="font-medium text-gray-900">
          {stats.done} of {stats.total} Lessons Done
        </span>
        {stats.learning > 0 && (
          <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-800">
            {stats.learning} Learning
          </span>
        )}
        {stats.skipped > 0 && (
          <span className="rounded bg-teal-100 px-1.5 py-0.5 font-medium text-teal-900">
            {stats.skipped} Skipped
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 sm:mt-0">
        <div className="inline-flex items-center rounded border border-yellow-300/80 bg-white p-0.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeFilter(opt.id)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                statusFilter === opt.id
                  ? 'bg-slate-900 text-white'
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="hidden text-gray-500 lg:inline">
          Click to study · Right-click or <kbd className="rounded bg-white px-1 text-gray-700">Shift+Click</kbd> to mark
        </span>
      </div>
    </div>
  );
}
