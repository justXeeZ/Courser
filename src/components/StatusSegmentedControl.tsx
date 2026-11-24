import { Ban, BookOpen, CheckCircle2, RotateCcw } from 'lucide-react';
import type { LessonStatus } from '@/types/course';

interface StatusSegmentedControlProps {
  status: LessonStatus;
  onChange: (next: LessonStatus) => void;
  showReset?: boolean;
  itemRole?: 'button' | 'menuitem';
  ariaLabel?: string;
}

export function StatusSegmentedControl({
  status,
  onChange,
  showReset = false,
  itemRole = 'button',
  ariaLabel = 'Item progress status',
}: StatusSegmentedControlProps) {
  const toggleStatus = (target: Exclude<LessonStatus, 'todo'>) => {
    onChange(status === target ? 'todo' : target);
  };

  const buttonRoleProps = (target: LessonStatus) =>
    itemRole === 'menuitem'
      ? { role: 'menuitem' as const }
      : { 'aria-pressed': status === target };

  return (
    <div
      role={itemRole === 'menuitem' ? 'menu' : 'group'}
      aria-label={ariaLabel}
      className="inline-flex h-8 items-center overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)]"
    >
      <button
        type="button"
        title="Learning (L)"
        onClick={() => toggleStatus('learning')}
        className={`inline-flex h-full items-center gap-1 px-2.5 text-xs font-medium transition-colors hover:bg-[var(--surface-hover)] ${
          status === 'learning'
            ? 'bg-[var(--status-learning-bg)] text-[var(--status-learning-text)]'
            : 'text-[var(--text-secondary)]'
        }`}
        {...buttonRoleProps('learning')}
      >
        <BookOpen className="h-3.5 w-3.5 text-[var(--status-learning-icon)]" />
        Learning
      </button>

      <button
        type="button"
        title="Done (D)"
        onClick={() => toggleStatus('done')}
        className={`inline-flex h-full items-center gap-1 border-l border-[var(--border-strong)] px-2.5 text-xs font-medium transition-colors hover:bg-[var(--surface-hover)] ${
          status === 'done'
            ? 'bg-[var(--status-done-bg)] text-[var(--status-done-text)]'
            : 'text-[var(--text-secondary)]'
        }`}
        {...buttonRoleProps('done')}
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-done)]" />
        Done
      </button>

      <button
        type="button"
        title="Skip (S)"
        onClick={() => toggleStatus('skipped')}
        className={`inline-flex h-full items-center gap-1 border-l border-[var(--border-strong)] px-2.5 text-xs font-medium transition-colors hover:bg-[var(--surface-hover)] ${
          status === 'skipped'
            ? 'bg-[var(--status-skipped-bg)] text-[var(--status-skipped-text)]'
            : 'text-[var(--text-secondary)]'
        }`}
        {...buttonRoleProps('skipped')}
      >
        <Ban className="h-3.5 w-3.5 text-[var(--status-skipped-text)]" />
        Skip
      </button>

      {showReset && status !== 'todo' && (
        <button
          type="button"
          title="Reset to Todo"
          aria-label="Reset to Todo"
          onClick={() => onChange('todo')}
          className="inline-flex h-full items-center gap-1 border-l border-[var(--border-strong)] px-2 text-xs font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          {...(itemRole === 'menuitem' ? { role: 'menuitem' as const } : {})}
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
