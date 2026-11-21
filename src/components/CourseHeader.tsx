import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  Download,
  Upload,
  GitFork,
  ListChecks,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { CourseTree } from '@/types/course';

export type CourseViewTab = 'tree' | 'checklist';

interface CourseHeaderProps {
  course: CourseTree;
  bookmarked: boolean;
  activeTab: CourseViewTab;
  onToggleBookmark: () => void;
  onDownloadSvg: () => void;
  onOpenBackup: () => void;
  onRequestDelete: () => void;
  onChangeTab: (tab: CourseViewTab) => void;
}

export function CourseHeader({
  course,
  bookmarked,
  activeTab,
  onToggleBookmark,
  onDownloadSvg,
  onOpenBackup,
  onRequestDelete,
  onChangeTab,
}: CourseHeaderProps) {
  return (
    <section className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 sm:pt-7">
        {/* Top Row: Back link + Action buttons */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-black"
          >
            <ArrowLeft className="h-4 w-4" />
            All Courses
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleBookmark}
              title={bookmarked ? 'Remove from bookmarks' : 'Bookmark course'}
              aria-label={bookmarked ? 'Remove from bookmarks' : 'Bookmark course'}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                bookmarked
                  ? 'border-yellow-400 bg-yellow-50 text-yellow-600'
                  : 'border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'
              }`}
            >
              <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} />
            </button>

            <Link
              to={`/course/${course.slug}/edit`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit Course
            </Link>

            <button
              type="button"
              onClick={onRequestDelete}
              title="Delete course"
              aria-label="Delete course"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onOpenBackup}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:text-sm"
            >
              <Upload className="h-3.5 w-3.5" />
              Backup
            </button>

            <button
              type="button"
              onClick={onDownloadSvg}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-yellow-400 px-3 text-xs font-medium text-black transition-colors hover:bg-yellow-500 sm:text-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Download SVG
            </button>
          </div>
        </div>

        {/* Course Title & Metadata */}
        <div className="mb-5">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-white">
              {course.code}
            </span>
            <span>{course.department}</span>
            {course.semester && (
              <>
                <span>·</span>
                <span>{course.semester}</span>
              </>
            )}
            {course.credits && (
              <>
                <span>·</span>
                <span>{course.credits} Credits</span>
              </>
            )}
          </div>
          <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            {course.title}
          </h1>
          <p className="max-w-3xl text-sm text-gray-500 sm:text-base">{course.description}</p>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="flex items-center gap-6" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tree'}
            onClick={() => onChangeTab('tree')}
            className={`inline-flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'tree'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <GitFork className="h-4 w-4" />
            Course Tree
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'checklist'}
            onClick={() => onChangeTab('checklist')}
            className={`inline-flex items-center gap-1.5 border-b-2 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'checklist'
                ? 'border-black text-black'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <ListChecks className="h-4 w-4" />
            Syllabus Checklist
          </button>
        </div>
      </div>
    </section>
  );
}
