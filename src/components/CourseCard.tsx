import { Link } from 'react-router-dom';
import { Bookmark, Pencil, Trash2 } from 'lucide-react';
import { formatCourseTerm, type CourseTree } from '@/types/course';
import type { ProgressStats } from '@/store/useProgressStore';

interface CourseCardProps {
  course: CourseTree;
  stats: ProgressStats;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onRequestDelete: () => void;
}

export function CourseCard({
  course,
  stats,
  bookmarked,
  onToggleBookmark,
  onRequestDelete,
}: CourseCardProps) {
  const hasProgress = stats.done > 0 || stats.learning > 0 || stats.skipped > 0;
  const chapterCount = course.chapters.length;
  const itemCount = stats.total;
  const termLabel = formatCourseTerm(course);

  return (
    <div className="group relative flex min-h-[92px] flex-col justify-between overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5 text-[var(--text-secondary)] shadow-xs transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]">
      <div>
        <div className="mb-1.5 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="rounded bg-[var(--solid-bg)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--solid-text)]">
              {course.code}
            </span>
            {termLabel && (
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-warm-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                {termLabel}
              </span>
            )}
          </div>

          {/* Action buttons inside the card content area on all viewports */}
          <div className="relative z-10 flex shrink-0 items-center gap-0.5">
            <Link
              to={`/course/${course.slug}/edit`}
              aria-label={`Edit ${course.title}`}
              title="Edit course"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--text-muted)] opacity-75 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] hover:!opacity-100"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={onRequestDelete}
              aria-label={`Delete ${course.title}`}
              title="Delete course"
              className="inline-flex h-7 w-7 items-center justify-center rounded text-[var(--text-muted)] opacity-75 transition-colors group-hover:opacity-100 hover:bg-[var(--status-danger-bg)] hover:text-[var(--status-danger-text)] hover:!opacity-100 focus-visible:bg-[var(--status-danger-bg)] focus-visible:text-[var(--status-danger-text)] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onToggleBookmark}
              aria-label={bookmarked ? `Remove ${course.title} bookmark` : `Bookmark ${course.title}`}
              title={bookmarked ? 'Remove bookmark' : 'Bookmark course'}
              className={`inline-flex h-7 w-7 items-center justify-center rounded transition-opacity ${
                bookmarked
                  ? 'text-[var(--accent-purple)] opacity-100'
                  : 'text-[var(--text-muted)] opacity-75 group-hover:opacity-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] hover:!opacity-100'
              }`}
            >
              <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        <Link
          to={`/course/${course.slug}`}
          className="block text-sm font-semibold text-[var(--text-primary)] after:absolute after:inset-0 dark:font-medium"
        >
          {course.title}
        </Link>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <span>
          {chapterCount} {chapterCount === 1 ? 'chapter' : 'chapters'} · {itemCount}{' '}
          {itemCount === 1 ? 'item' : 'items'}
        </span>
        {hasProgress && (
          <span
            className={`font-mono font-semibold ${
              stats.percentDone === 100
                ? 'text-[var(--accent-done)]'
                : stats.percentDone > 0
                  ? 'text-[var(--accent-purple-text)]'
                  : 'text-[var(--text-muted)]'
            }`}
          >
            {stats.percentDone}%
          </span>
        )}
      </div>

      {hasProgress && (
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              stats.percentDone === 100
                ? 'bg-[var(--accent-done)]'
                : 'bg-[var(--accent-purple)]'
            }`}
            style={{ width: `${stats.percentDone}%` }}
          />
        </div>
      )}
    </div>
  );
}
