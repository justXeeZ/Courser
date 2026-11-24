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
  Save,
  Trash2,
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
    <section className="overflow-x-clip border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
      <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6 sm:pt-7">
        {/* Top Row: Back link + Action buttons */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
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
                className="group/btn inline-flex h-8 shrink-0 items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                <Pencil className="h-3.5 w-3.5 shrink-0" />
                {actionsExpanded && <span className="ml-1 text-xs font-medium sm:hidden">Edit</span>}
                <span className={`hidden sm:inline ${REVEAL_LABEL_CLASS}`}>Edit Course</span>
              </Link>

              <button
                type="button"
                onClick={onOpenExport}
                title="Export Course"
                aria-label="Export Course"
                className="group/btn inline-flex h-8 shrink-0 items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                <FileArchive className="h-3.5 w-3.5 shrink-0" />
                {actionsExpanded && <span className="ml-1 text-xs font-medium sm:hidden">Export</span>}
                <span className={`hidden sm:inline ${REVEAL_LABEL_CLASS}`}>Export Course</span>
              </button>

              <button
                type="button"
                onClick={onOpenBackup}
                title="Backup Progress"
                aria-label="Backup Progress"
                className="group/btn inline-flex h-8 shrink-0 items-center rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                <Save className="h-3.5 w-3.5 shrink-0" />
                {actionsExpanded && <span className="ml-1 text-xs font-medium sm:hidden">Backup</span>}
                <span className={`hidden sm:inline ${REVEAL_LABEL_CLASS}`}>Backup Progress</span>
              </button>

              <button
                type="button"
                onClick={onDownloadSvg}
                title="Download SVG"
                aria-label="Download SVG"
                className="group/btn inline-flex h-8 shrink-0 items-center rounded-md border border-[var(--cta-border)] bg-[var(--cta-bg)] px-2 text-[var(--cta-text)] transition-colors hover:bg-[var(--cta-bg-hover)]"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                {actionsExpanded && <span className="ml-1 text-xs font-medium sm:hidden">SVG</span>}
                <span className={`hidden sm:inline ${REVEAL_LABEL_CLASS}`}>Download SVG</span>
              </button>

              <button
                type="button"
                onClick={onRequestDelete}
                title="Delete Course"
                aria-label="Delete Course"
                className="group/btn inline-flex h-8 shrink-0 items-center rounded-md border border-[var(--status-danger-border)] bg-[var(--surface-1)] px-2 text-[var(--status-danger-text)] transition-colors hover:border-[var(--danger-solid-bg)] hover:bg-[var(--danger-solid-bg)] hover:text-white focus-visible:border-[var(--danger-solid-bg)] focus-visible:bg-[var(--danger-solid-bg)] focus-visible:text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                {actionsExpanded && <span className="ml-1 text-xs font-medium sm:hidden">Delete</span>}
                <span className={`hidden sm:inline ${REVEAL_LABEL_CLASS}`}>Delete Course</span>
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
                  ? 'border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] text-[var(--accent-amber)]'
                  : 'border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Bookmark className="h-4 w-4" fill={bookmarked ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        {/* Course Title & Metadata */}
        <div className="mb-5">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
            <span className="rounded bg-[var(--solid-bg)] px-2 py-0.5 font-mono font-semibold text-[var(--solid-text)]">
              {course.code}
            </span>
            <span className="rounded bg-[var(--surface-warm-muted)] px-2 py-0.5 text-[var(--text-secondary)]">
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
                <span>
                  {course.credits} {course.credits === 1 ? 'Credit' : 'Credits'}
                </span>
              </>
            )}
          </div>
          <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-5xl">
            {course.title}
          </h1>
          <p className="max-w-3xl text-sm text-[var(--text-secondary)] sm:text-base">
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
                ? 'border-[var(--accent-purple)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
                ? 'border-[var(--accent-purple)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
