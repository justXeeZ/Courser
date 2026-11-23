import { Ban, BookOpen, CheckCircle2, RotateCcw } from 'lucide-react';
import type { LessonStatus } from '@/types/course';

interface StatusSegmentedControlProps {
  status: LessonStatus;
  onChange: (next: LessonStatus) => void;
  showReset?: boolean;
  itemRole?: 'button' | 'menuitem';
  ariaLabel?: string;
  attachedToNode?: boolean;
}

export function StatusSegmentedControl({
  status,
  onChange,
  showReset = false,
  itemRole = 'button',
  ariaLabel = 'Item progress status',
  attachedToNode = false,
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
      className={`inline-flex h-8 items-center overflow-hidden border border-gray-300 bg-white dark:border-slate-700 dark:bg-slate-900 ${
        attachedToNode ? 'rounded-t-md rounded-b-none border-b-0' : 'rounded-md'
      }`}
    >
      <button
        type="button"
        title="Learning (L)"
        onClick={() => toggleStatus('learning')}
        className={`inline-flex h-full items-center gap-1 px-2.5 text-xs font-medium transition-colors hover:bg-gray-100 dark:hover:bg-slate-800 ${
          status === 'learning'
            ? 'bg-violet-100 text-violet-900 dark:bg-violet-950/70 dark:text-violet-200'
            : 'text-gray-700 dark:text-slate-300'
        }`}
        {...buttonRoleProps('learning')}
      >
        <BookOpen className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
        Learning
      </button>

      <button
        type="button"
        title="Done (D)"
        onClick={() => toggleStatus('done')}
        className={`inline-flex h-full items-center gap-1 border-l border-gray-300 px-2.5 text-xs font-medium transition-colors hover:bg-gray-100 dark:border-slate-700 dark:hover:bg-slate-800 ${
          status === 'done'
            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-200'
            : 'text-gray-700 dark:text-slate-300'
        }`}
        {...buttonRoleProps('done')}
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        Done
      </button>

      <button
        type="button"
        title="Skip (S)"
        onClick={() => toggleStatus('skipped')}
        className={`inline-flex h-full items-center gap-1 border-l border-gray-300 px-2.5 text-xs font-medium transition-colors hover:bg-gray-100 dark:border-slate-700 dark:hover:bg-slate-800 ${
          status === 'skipped'
            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
            : 'text-gray-600 dark:text-slate-400'
        }`}
        {...buttonRoleProps('skipped')}
      >
        <Ban className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
        Skip
      </button>

      {showReset && status !== 'todo' && (
        <button
          type="button"
          title="Reset to Todo"
          aria-label="Reset to Todo"
          onClick={() => onChange('todo')}
          className="inline-flex h-full items-center gap-1 border-l border-gray-300 px-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          {...(itemRole === 'menuitem' ? { role: 'menuitem' as const } : {})}
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
