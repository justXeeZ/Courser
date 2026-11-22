import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  ChevronLeft,
  Download,
  FileArchive,
  GitFork,
  ListChecks,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';
import { formatCourseTerm, type CourseTree } from '@/types/course';

export type CourseViewTab = 'tree' | 'checklist';

interface CourseHeaderProps {
  course: CourseTree;
  bookmarked: boolean;
  activeTab: CourseViewTab;
  onToggleBookmark: () => void;
  onDownloadSvg: () => void;
  onOpenBackup: () => void;
  onOpenExport: () => void;
  onRequestDelete: () => void;
  onChangeTab: (tab: CourseViewTab) => void;
}

const REVEAL_LABEL_CLASS =
  'max-w-0 overflow-hidden whitespace-nowrap text-xs font-medium opacity-0 transition-all duration-300 ease-out group-hover/btn:ml-1.5 group-hover/btn:max-w-[9rem] group-hover/btn:opacity-100 group-focus-visible/btn:ml-1.5 group-focus-visible/btn:max-w-[9rem] group-focus-visible/btn:opacity-100 sm:text-sm';

export function CourseHeader({
  course,
  bookmarked,
  activeTab,
  onToggleBookmark,
  onDownloadSvg,
  onOpenBackup,
  onOpenExport,
  onRequestDelete,
  onChangeTab,
}: CourseHeaderProps) {
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const termLabel = formatCourseTerm(course);

  return (
    <section className="overflow-x-clip border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#121926]">
      <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 sm:pt-7">
        {/* Top Row: Back link + Action buttons */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            All Courses
          </Link>

          <div className="flex max-w-full items-center justify-end gap-1 sm:gap-1.5">
            {/* Extra action controls: horizontally reveal to the left of mobile toggle */}
            <div
              id="course-header-extra-actions"
              className={`flex items-center justify-end gap-1 overflow-hidden transition-all duration-300 ease-out sm:pointer-events-auto sm:visible sm:max-w-none sm:gap-1.5 sm:overflow-visible sm:opacity-100 ${
                actionsExpanded
                  ? 'pointer-events-auto visible max-w-[22rem] opacity-100'
                  : 'pointer-events-none invisible max-w-0 opacity-0'
              }`}
            >
              <Link
                to={`/course/${course.slug}/edit`}
                title="Edit Course"
                aria-label="Edit Course"
                className="group/btn inline-flex h-8 shrink-0 items-center rounded-md border border-slate-300 bg-white px-2 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Pencil className="h-3.5 w-3.5 shrink-0" />
                <span className={REVEAL_LABEL_CLASS}>Edit Course</span>
              </Link>

              <button
                type="button"
                onClick={onOpenExport}
                title="Export Course"
                aria-label="Export Course"
                className="group/btn inline-flex h-8 shrink-0 items-center rounded-md border border-slate-300 bg-white px-2 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <FileArchive className="h-3.5 w-3.5 shrink-0" />
                <span className={REVEAL_LABEL_CLASS}>Export Course</span>
              </button>

              <button
                type="button"
                onClick={onOpenBackup}
                title="Backup Progress"
                aria-label="Backup Progress"
                className="group/btn inline-flex h-8 shrink-0 items-center rounded-md border border-slate-300 bg-white px-2 text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span className={REVEAL_LABEL_CLASS}>Backup Progress</span>
              </button>

              <button
                type="button"
                onClick={onDownloadSvg}
                title="Download SVG"
                aria-label="Download SVG"
                className="group/btn inline-flex h-8 shrink-0 items-center rounded-md border border-yellow-400 bg-yellow-400 px-2 text-black transition-colors hover:bg-yellow-500"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span className={REVEAL_LABEL_CLASS}>Download SVG</span>
              </button>

              <button
                type="button"
                onClick={onRequestDelete}
                title="Delete Course"
                aria-label="Delete Course"
                className="group/btn inline-flex h-8 shrink-0 items-center rounded-md border border-red-200 bg-white px-2 text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:bg-[#1b2436] dark:text-red-400 dark:hover:bg-red-950/50"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span className={REVEAL_LABEL_CLASS}>Delete Course</span>
              </button>
            </div>

            {/* Mobile / tight layout collapse/expand toggle */}
            <button
              type="button"
              onClick={() => setActionsExpanded((prev) => !prev)}
              aria-expanded={actionsExpanded}
              aria-controls="course-header-extra-actions"
              aria-label={actionsExpanded ? 'Collapse course actions' : 'Expand course actions'}
              title={actionsExpanded ? 'Collapse course actions' : 'Expand course actions'}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 sm:hidden dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <ChevronLeft
                className={`h-4 w-4 transition-transform duration-300 ease-out ${
                  actionsExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Bookmark icon button (always visible) */}
            <button
              type="button"
              onClick={onToggleBookmark}
              title={bookmarked ? 'Remove from bookmarks' : 'Bookmark course'}
              aria-label={bookmarked ? 'Remove from bookmarks' : 'Bookmark course'}
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
                bookmarked
                  ? 'border-amber-400 bg-amber-50 text-amber-600 dark:border-yellow-500/70 dark:bg-yellow-950/40 dark:text-yellow-400'
                  : 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* Course Title & Metadata */}
        <div className="mb-5">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-white dark:bg-[#1b2436] dark:text-amber-400">
              {course.code}
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
              {course.department}
            </span>
            {termLabel && (
              <>
                <span>·</span>
                <span>{termLabel}</span>
              </>
            )}
            {course.credits && (
              <>
                <span>·</span>
                <span>{course.credits} Credits</span>
              </>
            )}
          </div>
          <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-100">
            {course.title}
          </h1>
          <p className="max-w-3xl text-sm text-slate-600 sm:text-base dark:text-slate-400">
            {course.description}
          </p>
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
                ? 'border-slate-900 text-slate-900 dark:border-yellow-400 dark:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
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
                ? 'border-slate-900 text-slate-900 dark:border-yellow-400 dark:text-white'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
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
