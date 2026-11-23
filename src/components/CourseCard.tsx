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
        className="flex min-h-[78px] flex-col justify-between rounded-lg border border-slate-200 bg-white p-3.5 pr-20 text-slate-700 shadow-xs transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700/80 dark:bg-[#121926] dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-[#1b2436]/70 dark:hover:text-slate-100"
      >
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--tag-amber-text)]">
              {course.code}
            </span>
            {termLabel && (
              <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-300">
                {termLabel}
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-slate-900 group-hover:text-black dark:font-medium dark:text-slate-100 dark:group-hover:text-white">
            {course.title}
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span>
            {chapterCount} {chapterCount === 1 ? 'chapter' : 'chapters'} · {itemCount}{' '}
            {itemCount === 1 ? 'item' : 'items'}
          </span>
          {hasProgress && (
            <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
              {stats.percentDone}%
            </span>
          )}
        </div>

        {hasProgress && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#1b2436]">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300 dark:bg-yellow-400"
              style={{ width: `${stats.percentDone}%` }}
            />
          </div>
        )}
      </Link>

      {/* Top-right sibling action buttons (never trigger card navigation) */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5">
        <Link
          to={`/course/${course.slug}/edit`}
          aria-label={`Edit ${course.title}`}
          title="Edit course"
          className="rounded p-1 text-slate-500 opacity-60 transition-opacity group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-900 hover:!opacity-100 dark:text-slate-400 dark:opacity-50 dark:hover:bg-[#1b2436] dark:hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={onRequestDelete}
          aria-label={`Delete ${course.title}`}
          title="Delete course"
          className="rounded p-1 text-slate-500 opacity-60 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 hover:!opacity-100 dark:text-slate-400 dark:opacity-50 dark:hover:bg-[#1b2436] dark:hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onToggleBookmark}
          aria-label={bookmarked ? `Remove ${course.title} bookmark` : `Bookmark ${course.title}`}
          title={bookmarked ? 'Remove bookmark' : 'Bookmark course'}
          className={`rounded p-1 transition-opacity ${
            bookmarked
              ? 'text-amber-500 opacity-100 dark:text-yellow-400'
              : 'text-slate-500 opacity-60 group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-900 hover:!opacity-100 dark:text-slate-400 dark:opacity-50 dark:hover:bg-[#1b2436] dark:hover:text-white'
          }`}
        >
          <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}
