import { Link } from 'react-router-dom';
import { Bookmark, Pencil, Trash2 } from 'lucide-react';
import type { CourseTree } from '@/types/course';
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
  const hasProgress = stats.done > 0 || stats.learning > 0;

  return (
    <div className="group relative">
      <Link
        to={`/course/${course.slug}`}
        className="flex min-h-[78px] flex-col justify-between rounded-lg border border-slate-800 bg-slate-900 p-3.5 pr-20 text-slate-300 transition-colors hover:border-slate-600 hover:text-slate-100"
      >
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-yellow-400">
              {course.code}
            </span>
            {course.semester && (
              <span className="text-[11px] text-slate-500">{course.semester}</span>
            )}
          </div>
          <div className="text-sm font-medium text-slate-200 group-hover:text-white">
            {course.title}
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>
            {course.chapters.length} chapters · {stats.total} lessons
          </span>
          {hasProgress && (
            <span className="font-mono font-semibold text-green-400">
              {stats.percentDone}%
            </span>
          )}
        </div>

        {hasProgress && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-yellow-400 transition-all duration-300"
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
          className="rounded p-1 text-slate-400 opacity-30 transition-opacity group-hover:opacity-75 hover:bg-slate-800 hover:text-white hover:!opacity-100"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Link>
        <button
          type="button"
          onClick={onRequestDelete}
          aria-label={`Delete ${course.title}`}
          title="Delete course"
          className="rounded p-1 text-slate-400 opacity-30 transition-opacity group-hover:opacity-75 hover:bg-slate-800 hover:text-red-400 hover:!opacity-100"
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
              ? 'text-yellow-400 opacity-100'
              : 'text-slate-400 opacity-30 group-hover:opacity-75 hover:text-white hover:!opacity-100'
          }`}
        >
          <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  );
}
