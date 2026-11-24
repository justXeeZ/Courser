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
    <div className="group relative">
      <Link
        to={`/course/${course.slug}`}
        className="flex min-h-[78px] flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5 pr-32 text-[var(--text-secondary)] shadow-xs transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] sm:pr-20"
      >
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--tag-amber-text)]">
              {course.code}
            </span>
            {termLabel && (
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-warm-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                {termLabel}
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-[var(--text-primary)] dark:font-medium">
            {course.title}
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
          <span>
            {chapterCount} {chapterCount === 1 ? 'chapter' : 'chapters'} · {itemCount}{' '}
            {itemCount === 1 ? 'item' : 'items'}
          </span>
          {hasProgress && (
            <span className="font-mono font-semibold text-[var(--accent-done)]">
              {stats.percentDone}%
            </span>
          )}
        </div>

        {hasProgress && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full bg-[var(--accent-amber)] transition-all duration-300"
              style={{ width: `${stats.percentDone}%` }}
            />
          </div>
        )}
      </Link>

      {/* Top-right sibling action buttons (never trigger card navigation) */}
      <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1.5 sm:top-2 sm:right-2 sm:gap-1">
        <Link
          to={`/course/${course.slug}/edit`}
          aria-label={`Edit ${course.title}`}
          title="Edit course"
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded p-1 text-[var(--text-muted)] opacity-75 transition-opacity group-hover:opacity-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] hover:!opacity-100 sm:min-h-0 sm:min-w-0"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={onRequestDelete}
          aria-label={`Delete ${course.title}`}
          title="Delete course"
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded border border-[var(--status-danger-border)] bg-[var(--surface-1)] p-1 text-[var(--status-danger-text)] opacity-80 transition-colors group-hover:opacity-100 hover:border-[var(--danger-solid-bg)] hover:bg-[var(--danger-solid-bg)] hover:text-white hover:!opacity-100 focus-visible:border-[var(--danger-solid-bg)] focus-visible:bg-[var(--danger-solid-bg)] focus-visible:text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 sm:min-h-0 sm:min-w-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleBookmark}
          aria-label={bookmarked ? `Remove ${course.title} bookmark` : `Bookmark ${course.title}`}
          title={bookmarked ? 'Remove bookmark' : 'Bookmark course'}
          className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded p-1 transition-opacity sm:min-h-0 sm:min-w-0 ${
            bookmarked
              ? 'text-[var(--accent-amber)] opacity-100'
              : 'text-[var(--text-muted)] opacity-75 group-hover:opacity-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] hover:!opacity-100'
          }`}
        >
          <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}
