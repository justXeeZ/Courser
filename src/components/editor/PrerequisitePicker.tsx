import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  formatChapterPositionTag,
  formatChapterSupplementTag,
  formatLessonPositionTag,
  formatLessonSupplementTag,
  formatSpineChildSupplementTag,
  formatSpineSupplementTag,
} from '@/lib/courseIds';
import type { Chapter, SpineSupplement } from '@/types/course';

interface PrerequisitePickerProps {
  chapters: Chapter[];
  spineSupplements?: SpineSupplement[];
  currentId: string;
  currentKind: 'chapter' | 'lesson' | 'supplement';
  parentChapterId?: string;
  selectedIds: string[];
  onToggle: (prereqId: string) => void;
}

interface PrerequisiteOption {
  id: string;
  kind: 'chapter' | 'lesson' | 'supplement';
  tag: string;
  title: string;
}

interface PrerequisiteGroup {
  chapterId: string;
  groupTitle: string;
  options: PrerequisiteOption[];
}

export function PrerequisitePicker({
  chapters,
  spineSupplements = [],
  currentId,
  currentKind,
  parentChapterId,
  selectedIds,
  onToggle,
}: PrerequisitePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const orderedChapters = [...chapters].sort((a, b) => a.order - b.order);

  const groups: PrerequisiteGroup[] = [];

  for (const chapter of orderedChapters) {
    const options: PrerequisiteOption[] = [];
    const chapterTag = formatChapterPositionTag(chapter.order);
    const chapterTitle = chapter.title || 'Untitled Chapter';
    const isOwnParentChapter =
      currentKind === 'lesson' &&
      (chapter.id === parentChapterId || chapter.lessons.some((l) => l.id === currentId));

    // Include chapter itself unless it's self or the lesson's own parent chapter
    if (
      !(currentKind === 'chapter' && chapter.id === currentId) &&
      !isOwnParentChapter
    ) {
      options.push({
        id: chapter.id,
        kind: 'chapter',
        tag: chapterTag,
        title: chapterTitle,
      });
    }

    // Include chapter's lessons unless editing that chapter itself
    if (!(currentKind === 'chapter' && chapter.id === currentId)) {
      for (let lIdx = 0; lIdx < chapter.lessons.length; lIdx++) {
        const lesson = chapter.lessons[lIdx];
        if (currentKind === 'lesson' && lesson.id === currentId) {
          continue;
        }
        options.push({
          id: lesson.id,
          kind: 'lesson',
          tag: formatLessonPositionTag(chapter.order, lIdx + 1),
          title: lesson.title || 'Untitled Lesson',
        });
        for (let cnIdx = 0; cnIdx < (lesson.supplements ?? []).length; cnIdx++) {
          const cn = lesson.supplements![cnIdx];
          if (cn.id === currentId) continue;
          options.push({
            id: cn.id,
            kind: 'supplement',
            tag: formatLessonSupplementTag(chapter.order, lIdx + 1, cnIdx + 1),
            title: cn.title || 'Untitled Supplement',
          });
        }
      }
      for (let cnIdx = 0; cnIdx < (chapter.supplements ?? []).length; cnIdx++) {
        const cn = chapter.supplements![cnIdx];
        if (cn.id === currentId) continue;
        options.push({
          id: cn.id,
          kind: 'supplement',
          tag: formatChapterSupplementTag(chapter.order, cnIdx + 1),
          title: cn.title || 'Untitled Supplement',
        });
      }
    }

    if (options.length > 0) {
      groups.push({
        chapterId: chapter.id,
        groupTitle: `${chapterTag}: ${chapterTitle}`,
        options,
      });
    }
  }

  spineSupplements.forEach((scn, sIdx) => {
    const options: PrerequisiteOption[] = [];
    const sTag = formatSpineSupplementTag(sIdx + 1);
    if (scn.id !== currentId) {
      options.push({
        id: scn.id,
        kind: 'supplement',
        tag: sTag,
        title: scn.title || 'Untitled Supplement',
      });
    }
    (scn.children ?? []).forEach((child, cIdx) => {
      if (child.id === currentId) return;
      options.push({
        id: child.id,
        kind: 'supplement',
        tag: formatSpineChildSupplementTag(sIdx + 1, cIdx + 1),
        title: child.title || 'Untitled Supplement',
      });
    });
    if (options.length > 0) {
      groups.push({
        chapterId: scn.id,
        groupTitle: `${sTag}: ${scn.title || 'Untitled Supplement'}`,
        options,
      });
    }
  });

  if (groups.length === 0) {
    return (
      <div>
        <div className="mb-1 text-xs font-medium text-[var(--text-secondary)]">
          Prerequisites
        </div>
        <p className="text-xs text-[var(--text-muted)]">
          No other chapters or lessons available to link as prerequisites yet.
        </p>
      </div>
    );
  }

  return (
    <div data-prereq-for={currentId}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)]"
      >
        <span className="flex items-center gap-1.5">
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          )}
          <span>Prerequisites (click to toggle)</span>
        </span>
        {selectedIds.length > 0 && (
          <span className="rounded bg-[var(--surface-warm-muted)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--text-primary)]">
            {selectedIds.length} selected
          </span>
        )}
      </button>
      {isOpen && (
        <div className="mt-1.5 space-y-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-2.5">
          {groups.map((group) => (
            <div key={group.chapterId}>
              <div className="mb-1 text-[11px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                {group.groupTitle}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((opt) => {
                  const active = selectedIds.includes(opt.id);
                  const isChapter = opt.kind === 'chapter';
                  const isSupplement = opt.kind === 'supplement';
                  const buttonStateClass = isChapter
                    ? active
                      ? 'border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] font-semibold text-[var(--tag-amber-text)] ring-1 ring-[var(--accent-amber)]'
                      : 'border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:border-[var(--accent-amber)]'
                    : isSupplement
                      ? active
                        ? 'border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] font-semibold text-[var(--tag-teal-text)] ring-1 ring-[var(--accent-teal)]'
                        : 'border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:border-[var(--accent-teal)]'
                      : active
                        ? 'border-[var(--tag-peach-border)] bg-[var(--tag-peach-bg)] font-semibold text-[var(--tag-peach-text)] ring-1 ring-[var(--accent-peach)]'
                        : 'border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:border-[var(--accent-peach)]';
                  const tagClass = isChapter
                    ? 'border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] text-[var(--tag-amber-text)]'
                    : isSupplement
                      ? 'border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] text-[var(--tag-teal-text)]'
                      : 'border-[var(--tag-peach-border)] bg-[var(--tag-peach-bg)] text-[var(--tag-peach-text)]';

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onToggle(opt.id)}
                      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs transition-colors ${buttonStateClass}`}
                    >
                      <span
                        data-testid={`prereq-tag-${opt.kind}`}
                        className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold ${tagClass}`}
                      >
                        {opt.tag}
                      </span>
                      <span>{opt.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
