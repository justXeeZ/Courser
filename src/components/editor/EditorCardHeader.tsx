import { forwardRef, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { ReorderButtons } from '@/components/editor/ReorderButtons';

export type EditorCardAccent = 'amber' | 'peach' | 'teal';
export type EditorCardLevel = 'primary' | 'nested';

interface EditorCardHeaderProps {
  level: EditorCardLevel;
  accent: EditorCardAccent;
  dataStickyHeader: string;
  isExpanded: boolean;
  isStuck: boolean;
  stickyClassName: string;
  positionTag: string;
  title: string;
  derivedId: string;
  derivedIdTitle?: string;
  ariaLabel: string;
  onToggleExpand: () => void;
  extraTags?: ReactNode;
  reorderProps?: {
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMove: (direction: -1 | 1) => void;
    upLabel: string;
    downLabel: string;
  };
  deleteProps: {
    onDelete: () => void;
    disabled?: boolean;
    title: string;
    ariaLabel: string;
  };
}

const ACCENT_CLASSES: Record<EditorCardAccent, { borderLeft: string; tag: string }> = {
  amber: {
    borderLeft: 'border-l-[var(--accent-amber)]',
    tag: 'border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] text-[var(--tag-amber-text)]',
  },
  peach: {
    borderLeft: 'border-l-[var(--tag-peach-border)]',
    tag: 'border-[var(--tag-peach-border)] bg-[var(--tag-peach-bg)] text-[var(--tag-peach-text)]',
  },
  teal: {
    borderLeft: 'border-l-[var(--tag-teal-border)]',
    tag: 'border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] text-[var(--tag-teal-text)]',
  },
};

export const EditorCardHeader = forwardRef<HTMLDivElement, EditorCardHeaderProps>(
  function EditorCardHeader(
    {
      level,
      accent,
      dataStickyHeader,
      isExpanded,
      isStuck,
      stickyClassName,
      positionTag,
      title,
      derivedId,
      derivedIdTitle,
      ariaLabel,
      onToggleExpand,
      extraTags,
      reorderProps,
      deleteProps,
    },
    ref
  ) {
    const isPrimary = level === 'primary';
    const accentStyle = ACCENT_CLASSES[accent];

    const cornerClass = isPrimary
      ? isExpanded
        ? isStuck
          ? 'rounded-t-none border-b'
          : 'rounded-t-lg border-b'
        : isStuck
          ? 'rounded-t-none rounded-b-lg'
          : 'rounded-lg'
      : isExpanded
        ? isStuck
          ? 'rounded-t-none'
          : 'rounded-t-md'
        : 'rounded-md';

    const stickyPart = isPrimary || isExpanded ? `sticky ${stickyClassName}` : '';
    const containerPadding = isPrimary ? 'min-h-12 px-4 py-2' : 'border px-3 py-2';

    return (
      <div
        ref={ref}
        data-sticky-header={dataStickyHeader}
        data-stuck={isStuck ? 'true' : 'false'}
        onClick={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('button, a, input, select, textarea, [data-no-row-toggle]')) {
            return;
          }
          onToggleExpand();
        }}
        className={`${stickyPart} flex cursor-pointer flex-wrap items-center justify-between gap-2 border-[var(--border-subtle)] border-l-4 ${accentStyle.borderLeft} bg-[var(--surface-editor-header)] ${containerPadding} ${cornerClass}`.trim()}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-label={ariaLabel}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          )}
          <span
            className={`shrink-0 rounded border font-mono font-bold ${accentStyle.tag} ${
              isPrimary ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[11px]'
            }`}
          >
            {positionTag}
          </span>
          <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </span>
          <span
            title={derivedIdTitle}
            className={`hidden max-w-[18rem] shrink-0 truncate whitespace-nowrap rounded border border-[var(--border-subtle)] bg-[var(--surface-inset)] font-mono text-[11px] text-[var(--text-secondary)] sm:inline-block ${
              isPrimary ? 'px-2 py-0.5' : 'px-1.5 py-0.5'
            }`}
          >
            {derivedId}
          </span>
          {extraTags}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {reorderProps && (
            <ReorderButtons
              canMoveUp={reorderProps.canMoveUp}
              canMoveDown={reorderProps.canMoveDown}
              onMove={reorderProps.onMove}
              upLabel={reorderProps.upLabel}
              downLabel={reorderProps.downLabel}
            />
          )}
          <button
            type="button"
            disabled={deleteProps.disabled}
            onClick={deleteProps.onDelete}
            title={deleteProps.title}
            aria-label={deleteProps.ariaLabel}
            className="rounded border border-[var(--status-danger-border)] bg-[var(--surface-1)] p-1 text-[var(--status-danger-text)] transition-colors hover:border-[var(--danger-solid-bg)] hover:bg-[var(--danger-solid-bg)] hover:text-white focus-visible:border-[var(--danger-solid-bg)] focus-visible:bg-[var(--danger-solid-bg)] focus-visible:text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Trash2 className={isPrimary ? 'h-3.5 w-3.5' : 'h-3 w-3'} />
          </button>
        </div>
      </div>
    );
  }
);
