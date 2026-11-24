import { Ban, BookOpen, CheckCircle2 } from 'lucide-react';
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
    <div className="mx-auto mb-5 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2.5 text-xs text-[var(--text-secondary)] shadow-xs sm:flex sm:items-center sm:justify-between sm:gap-4">
      <div className="flex flex-wrap items-center justify-center gap-2.5 sm:justify-start">
        <span className="inline-flex items-center gap-1 rounded border border-[var(--status-done-border)] bg-[var(--status-done-bg)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--status-done-text)]">
          <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-done)]" />
          {stats.percentDone}% DONE
        </span>
        <span className="font-medium text-[var(--text-primary)]">
          {stats.done} of {stats.required} Required Items Done
        </span>
        {stats.learning > 0 && (
          <span className="inline-flex items-center gap-1 rounded border border-[var(--status-learning-border)] bg-[var(--status-learning-bg)] px-1.5 py-0.5 font-medium text-[var(--status-learning-text)]">
            <BookOpen className="h-3 w-3 text-[var(--status-learning-icon)]" />
            {stats.learning} Learning
          </span>
        )}
        {stats.skipped > 0 && (
          <span className="inline-flex items-center gap-1 rounded border border-[var(--status-skipped-border)] bg-[var(--status-skipped-bg)] px-1.5 py-0.5 font-medium text-[var(--status-skipped-text)]">
            <Ban className="h-3 w-3" />
            {stats.skipped} Skipped
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 sm:mt-0 sm:justify-end">
        <div className="inline-flex items-center rounded border border-[var(--border-strong)] bg-[var(--surface-inset)] p-0.5">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={statusFilter === opt.id}
              onClick={() => onChangeFilter(opt.id)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                statusFilter === opt.id
                  ? 'bg-[var(--solid-bg)] font-semibold text-[var(--solid-text)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <span className="text-[var(--text-muted)] lg:hidden">
          Tap any node to study &amp; mark progress
        </span>
        <span className="hidden text-[var(--text-muted)] lg:inline">
          Click to study · Right-click or{' '}
          <kbd className="rounded border border-[var(--border-subtle)] bg-[var(--surface-warm-muted)] px-1 text-[var(--text-secondary)]">
            Shift+Click
          </kbd>{' '}
          to mark
        </span>
      </div>
    </div>
  );
}
