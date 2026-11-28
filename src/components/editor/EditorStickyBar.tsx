import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronsUp, Layers, Plus, Save, Sparkles, X } from 'lucide-react';

export type EditorBreadcrumbAccent = 'amber' | 'peach' | 'teal';

export interface EditorBreadcrumbSegment {
  accent: EditorBreadcrumbAccent;
  tag: string;
  title: string;
}

const BREADCRUMB_TAG_CLASSES: Record<EditorBreadcrumbAccent, string> = {
  amber: 'border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] text-[var(--tag-amber-text)]',
  peach: 'border-[var(--tag-peach-border)] bg-[var(--tag-peach-bg)] text-[var(--tag-peach-text)]',
  teal: 'border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] text-[var(--tag-teal-text)]',
};

interface EditorStickyBarProps {
  courseCode: string;
  breadcrumbs: EditorBreadcrumbSegment[];
  hasExpandedLessons: boolean;
  errorMsg?: string | null;
  onDismissError?: () => void;
  onHeightChange?: (heightPx: number) => void;
  onAddChapter: () => void;
  onAddSpineSupplement?: () => void;
  onCollapseAll: () => void;
  onSave: () => void;
}

export function EditorStickyBar({
  courseCode,
  breadcrumbs,
  hasExpandedLessons,
  errorMsg,
  onDismissError,
  onHeightChange,
  onAddChapter,
  onAddSpineSupplement,
  onCollapseAll,
  onSave,
}: EditorStickyBarProps) {
  const displayCode = courseCode.trim() || 'COURSE';
  const barRef = useRef<HTMLDivElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

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
  }, [errorMsg, breadcrumbs, onHeightChange]);

  useEffect(() => {
    if (!addMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [addMenuOpen]);

  return (
    <div
      ref={barRef}
      data-testid="editor-sticky-bar"
      className="sticky top-16 z-30 min-h-14 border-b border-[var(--border-subtle)] bg-[var(--surface-1)]"
    >
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-2 px-3 pt-2.5 pb-2 sm:gap-3 sm:px-6 sm:py-2">
        <nav
          aria-label="Editing context"
          className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-0.5 text-xs sm:text-sm"
        >
          <span className="shrink-0 rounded bg-[var(--solid-bg)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--solid-text)]">
            {displayCode}
          </span>

          {breadcrumbs.length > 0 ? (
            breadcrumbs.map((segment, idx) => (
              <span key={`${segment.tag}-${idx}`} className="contents">
                <span className="shrink-0 text-[var(--text-muted)]" aria-hidden="true">
                  ›
                </span>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold ${BREADCRUMB_TAG_CLASSES[segment.accent]}`}
                >
                  {segment.tag}
                </span>
                <span
                  className={`truncate text-[var(--text-primary)] ${
                    idx === breadcrumbs.length - 1 ? 'font-semibold' : 'font-medium'
                  }`}
                >
                  {segment.title}
                </span>
              </span>
            ))
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

        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:gap-2">
          <div ref={addMenuRef} className="relative">
            {onAddSpineSupplement ? (
              <>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={addMenuOpen}
                  onClick={() => setAddMenuOpen((prev) => !prev)}
                  className="inline-flex h-8 items-center gap-1 rounded-md bg-[var(--solid-bg)] px-2.5 text-xs font-semibold text-[var(--solid-text)] transition-colors hover:bg-[var(--solid-bg-hover)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add</span>
                  <ChevronDown className="h-3 w-3 opacity-80" />
                </button>
                {addMenuOpen && (
                  <div
                    role="menu"
                    aria-label="Add course item"
                    className="absolute left-1/2 z-40 mt-1.5 w-44 -translate-x-1/2 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] py-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAddMenuOpen(false);
                        onAddChapter();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <Layers className="h-3.5 w-3.5 shrink-0 text-[var(--accent-amber)]" />
                      <span>Add Chapter</span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAddMenuOpen(false);
                        onAddSpineSupplement();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent-teal)]" />
                      <span>Add Supplement</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onAddChapter}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--solid-bg)] px-2.5 text-xs font-semibold text-[var(--solid-text)] transition-colors hover:bg-[var(--solid-bg-hover)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Chapter
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onCollapseAll}
            disabled={!hasExpandedLessons}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-2 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-45 sm:gap-1.5 sm:px-2.5"
          >
            <ChevronsUp className="h-3.5 w-3.5" />
            Collapse all
          </button>

          <button
            type="button"
            onClick={onSave}
            className="inline-flex h-8 items-center gap-1 rounded-md bg-[var(--cta-bg)] px-2.5 text-xs font-semibold text-[var(--cta-text)] transition-colors hover:bg-[var(--cta-bg-hover)] sm:gap-1.5 sm:px-3"
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
