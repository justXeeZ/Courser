import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const desktopRowRef = useRef<HTMLDivElement>(null);
  // 0 = full "X of Y Required Items Done"; 1 = shorten to "X/Y Done"
  const [compactLevel, setCompactLevel] = useState<0 | 1>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const el = desktopRowRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth((prev) => {
        if (Math.abs(prev - w) >= 2) {
          setCompactLevel(0);
          return w;
        }
        return prev;
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setCompactLevel(0);
  }, [stats.done, stats.required, stats.learning, stats.skipped]);

  useLayoutEffect(() => {
    const el = desktopRowRef.current;
    if (!el || el.clientWidth <= 0) return;
    if (el.scrollWidth > el.clientWidth + 1 && compactLevel < 1) {
      setCompactLevel(1);
    }
  }, [compactLevel, containerWidth, stats.done, stats.required, stats.learning, stats.skipped]);

  const doneBadgeClass =
    stats.percentDone === 100
      ? 'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]'
      : stats.percentDone > 0
        ? 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
        : 'border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)]';

  const doneIconClass =
    stats.percentDone === 100
      ? 'text-[var(--accent-done)]'
      : stats.percentDone > 0
        ? 'text-[var(--status-warning-text)]'
        : 'text-[var(--text-muted)]';

  const fullRequiredText = `${stats.done} of ${stats.required} Required Items Done`;
  const shortRequiredText = `${stats.done}/${stats.required} Done`;

  return (
    <div className="mx-auto mb-5 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-secondary)] shadow-xs">
      {/* Mobile (< sm): compact 2-row max */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex flex-nowrap items-center justify-center gap-1.5 overflow-x-auto whitespace-nowrap">
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 font-mono text-xs font-bold ${doneBadgeClass}`}
          >
            <CheckCircle2 className={`h-3.5 w-3.5 ${doneIconClass}`} />
            {stats.percentDone}% Done
          </span>
          <span className="shrink-0 font-medium text-[var(--text-primary)]" title={fullRequiredText}>
            {stats.done}/{stats.required}
          </span>
          {stats.learning > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--status-learning-border)] bg-[var(--status-learning-bg)] px-1.5 py-0.5 font-medium text-[var(--status-learning-text)]">
              <BookOpen className="h-3 w-3 text-[var(--status-learning-icon)]" />
              {stats.learning} Learning
            </span>
          )}
          {stats.skipped > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--status-skipped-border)] bg-[var(--status-skipped-bg)] px-1.5 py-0.5 font-medium text-[var(--status-skipped-text)]">
              <Ban className="h-3 w-3" />
              {stats.skipped} Skipped
            </span>
          )}
        </div>

        <div className="flex justify-center">
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
        </div>
      </div>

      {/* Desktop (sm+): adaptive single-line strip */}
      <div
        ref={desktopRowRef}
        className="hidden flex-nowrap items-center justify-between gap-3 overflow-hidden whitespace-nowrap sm:flex"
      >
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-xs font-bold ${doneBadgeClass}`}
          >
            <CheckCircle2 className={`h-3.5 w-3.5 ${doneIconClass}`} />
            {stats.percentDone}% Done
          </span>
          <span className="font-medium text-[var(--text-primary)]" title={fullRequiredText}>
            {compactLevel >= 1 ? shortRequiredText : fullRequiredText}
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

        <div className="flex shrink-0 items-center gap-2.5">
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
        </div>
      </div>
    </div>
  );
}
