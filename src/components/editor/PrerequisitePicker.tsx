import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatChapterPositionTag, formatLessonPositionTag } from '@/lib/courseIds';
import type { Chapter } from '@/types/course';

interface PrerequisitePickerProps {
  chapters: Chapter[];
  currentId: string;
  currentKind: 'chapter' | 'lesson';
  parentChapterId?: string;
  selectedIds: string[];
  onToggle: (prereqId: string) => void;
}

interface PrerequisiteOption {
  id: string;
  kind: 'chapter' | 'lesson';
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
                  const buttonStateClass = isChapter
                    ? active
                      ? 'border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] font-semibold text-[var(--tag-amber-text)] ring-1 ring-[var(--accent-amber)]'
                      : 'border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:border-[var(--accent-amber)]'
                    : active
                      ? 'border-[var(--tag-peach-border)] bg-[var(--tag-peach-bg)] font-semibold text-[var(--tag-peach-text)] ring-1 ring-[var(--accent-peach)]'
                      : 'border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--text-secondary)] hover:border-[var(--accent-peach)]';
                  const tagClass = isChapter
                    ? 'border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] text-[var(--tag-amber-text)]'
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
