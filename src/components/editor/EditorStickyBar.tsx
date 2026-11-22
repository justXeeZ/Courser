import { ChevronsUp, Plus, Save } from 'lucide-react';

export interface FocusedChapterContext {
  order: number;
  title: string;
}

export interface FocusedLessonContext {
  title: string;
}

interface EditorStickyBarProps {
  courseCode: string;
  focusedChapter: FocusedChapterContext | null;
  focusedLesson: FocusedLessonContext | null;
  hasExpandedLessons: boolean;
  onAddChapter: () => void;
  onCollapseAll: () => void;
  onSave: () => void;
}

export function EditorStickyBar({
  courseCode,
  focusedChapter,
  focusedLesson,
  hasExpandedLessons,
  onAddChapter,
  onCollapseAll,
  onSave,
}: EditorStickyBarProps) {
  const displayCode = courseCode.trim() || 'COURSE';

  return (
    <div
      data-testid="editor-sticky-bar"
      className="sticky top-0 z-30 min-h-14 border-b border-slate-200 bg-white dark:border-slate-700/80 dark:bg-[#121926]"
    >
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <nav
          aria-label="Editing context"
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto text-xs sm:text-sm"
        >
          <span className="shrink-0 rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-semibold text-white dark:bg-[#1b2436] dark:text-amber-400">
            {displayCode}
          </span>

          {focusedChapter ? (
            <>
              <span className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true">
                ›
              </span>
              <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                Ch {focusedChapter.order}: {focusedChapter.title || 'Untitled Chapter'}
              </span>

              {focusedLesson && (
                <>
                  <span className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true">
                    ›
                  </span>
                  <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                    {focusedLesson.title || 'Untitled Lesson'}
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true">
                ›
              </span>
              <span className="truncate text-slate-500 dark:text-slate-400">
                Course Overview
              </span>
            </>
          )}
        </nav>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAddChapter}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Chapter
          </button>

          <button
            type="button"
            onClick={onCollapseAll}
            disabled={!hasExpandedLessons}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ChevronsUp className="h-3.5 w-3.5" />
            Collapse all
          </button>

          <button
            type="button"
            onClick={onSave}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-yellow-400 px-3 text-xs font-semibold text-black transition-colors hover:bg-yellow-500"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
