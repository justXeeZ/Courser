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
        <div className="mb-1 text-xs font-medium text-slate-700 dark:text-slate-300">
          Prerequisites
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
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
        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700/80 dark:bg-[#0d131f] dark:text-slate-300 dark:hover:bg-[#1b2436]"
      >
        <span className="flex items-center gap-1.5">
          {isOpen ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
          )}
          <span>Prerequisites (click to toggle)</span>
        </span>
        {selectedIds.length > 0 && (
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 dark:bg-slate-700 dark:text-slate-100">
            {selectedIds.length} selected
          </span>
        )}
      </button>
      {isOpen && (
        <div className="mt-1.5 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700/80 dark:bg-[#0d131f]">
          {groups.map((group) => (
            <div key={group.chapterId}>
              <div className="mb-1 text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                {group.groupTitle}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {group.options.map((opt) => {
                  const active = selectedIds.includes(opt.id);
                  const isChapter = opt.kind === 'chapter';
                  const buttonStateClass = isChapter
                    ? active
                      ? 'border-amber-500 bg-amber-400 text-slate-950 dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-amber-500 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:border-amber-400'
                    : active
                      ? 'border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-600 dark:text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-blue-500 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:border-blue-500';
                  const tagClass = isChapter
                    ? active
                      ? 'border-transparent bg-amber-950/15 text-slate-950'
                      : 'border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] text-[var(--tag-amber-text)]'
                    : active
                      ? 'border-transparent bg-blue-700 text-blue-50'
                      : 'border-[var(--tag-blue-border)] bg-[var(--tag-blue-bg)] text-[var(--tag-blue-text)]';

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
