import { useEffect, useRef } from 'react';
import { AlertCircle, ChevronsUp, Plus, Save, X } from 'lucide-react';
import { formatChapterPositionTag, formatLessonPositionTag } from '@/lib/courseIds';

export interface FocusedChapterContext {
  order: number;
  title: string;
}

export interface FocusedLessonContext {
  order?: number;
  title: string;
}

interface EditorStickyBarProps {
  courseCode: string;
  focusedChapter: FocusedChapterContext | null;
  focusedLesson: FocusedLessonContext | null;
  hasExpandedLessons: boolean;
  errorMsg?: string | null;
  onDismissError?: () => void;
  onHeightChange?: (heightPx: number) => void;
  onAddChapter: () => void;
  onCollapseAll: () => void;
  onSave: () => void;
}

export function EditorStickyBar({
  courseCode,
  focusedChapter,
  focusedLesson,
  hasExpandedLessons,
  errorMsg,
  onDismissError,
  onHeightChange,
  onAddChapter,
  onCollapseAll,
  onSave,
}: EditorStickyBarProps) {
  const displayCode = courseCode.trim() || 'COURSE';
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el || !onHeightChange) return;

    const reportHeight = () => {
      const measured = el.offsetHeight;
      onHeightChange(measured > 0 ? measured : errorMsg ? 92 : 56);
    };

    reportHeight();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(reportHeight);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [errorMsg, focusedChapter, focusedLesson, onHeightChange]);

  return (
    <div
      ref={barRef}
      data-testid="editor-sticky-bar"
      className="sticky top-16 z-30 min-h-14 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]"
    >
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <nav
          aria-label="Editing context"
          className="flex w-full min-w-0 items-center gap-1.5 overflow-x-auto text-xs sm:w-auto sm:flex-1 sm:text-sm"
        >
          <span className="shrink-0 rounded bg-[var(--solid-bg)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--solid-text)]">
            {displayCode}
          </span>

          {focusedChapter ? (
            <>
              <span className="shrink-0 text-[var(--text-muted)]" aria-hidden="true">
                ›
              </span>
              <span className="shrink-0 rounded border border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--tag-amber-text)]">
                {formatChapterPositionTag(focusedChapter.order)}
              </span>
              <span className="truncate font-medium text-[var(--text-primary)]">
                {focusedChapter.title || 'Untitled Chapter'}
              </span>

              {focusedLesson && (
                <>
                  <span className="shrink-0 text-[var(--text-muted)]" aria-hidden="true">
                    ›
                  </span>
                  {focusedLesson.order !== undefined && (
                    <span className="shrink-0 rounded border border-[var(--tag-peach-border)] bg-[var(--tag-peach-bg)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--tag-peach-text)]">
                      {formatLessonPositionTag(focusedChapter.order, focusedLesson.order)}
                    </span>
                  )}
                  <span className="truncate font-semibold text-[var(--text-primary)]">
                    {focusedLesson.title || 'Untitled Lesson'}
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="shrink-0 text-[var(--text-muted)]" aria-hidden="true">
                ›
              </span>
              <span className="truncate text-[var(--text-muted)]">
                Course Overview
              </span>
            </>
          )}
        </nav>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onAddChapter}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--solid-bg)] px-2.5 text-xs font-semibold text-[var(--solid-text)] transition-colors hover:bg-[var(--solid-bg-hover)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Chapter
          </button>

          <button
            type="button"
            onClick={onCollapseAll}
            disabled={!hasExpandedLessons}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ChevronsUp className="h-3.5 w-3.5" />
            Collapse all
          </button>

          <button
            type="button"
            onClick={onSave}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--cta-bg)] px-3 text-xs font-semibold text-[var(--cta-text)] transition-colors hover:bg-[var(--cta-bg-hover)]"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="border-t border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-4 py-2 text-xs text-[var(--status-danger-text)] sm:px-6"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            {onDismissError && (
              <button
                type="button"
                onClick={onDismissError}
                aria-label="Dismiss validation error"
                className="rounded p-0.5 hover:bg-red-200/60 dark:hover:bg-red-900/40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
