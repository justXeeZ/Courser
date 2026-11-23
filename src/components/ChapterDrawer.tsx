import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  GitBranch,
} from 'lucide-react';
import {
  findCourseItem,
  getTrackableItems,
  isLeafChapter,
} from '@/lib/courseItems';
import { formatChapterPositionTag } from '@/lib/courseIds';
import { computeChapterStats } from '@/store/useProgressStore';
import type { Chapter, CourseTree, LessonResource, LessonStatus } from '@/types/course';
import { DrawerShell } from '@/components/DrawerShell';
import { MaterialList } from '@/components/MaterialList';
import { StatusSegmentedControl } from '@/components/StatusSegmentedControl';

interface ChapterDrawerProps {
  course: CourseTree;
  chapter: Chapter;
  status: LessonStatus;
  statuses: Record<string, LessonStatus>;
  courseSlug?: string;
  onChangeStatus: (status: LessonStatus) => void;
  onSelectItem: (itemId: string) => void;
  onToggleLessonDone?: (lessonId: string) => void;
  onOpenMaterialViewer?: (resource: LessonResource) => void;
  onOpenAssessment?: (resource: LessonResource) => void;
  onClose: () => void;
}

export function ChapterDrawer({
  course,
  chapter,
  status,
  statuses,
  courseSlug,
  onChangeStatus,
  onSelectItem,
  onToggleLessonDone,
  onOpenMaterialViewer,
  onOpenAssessment,
  onClose,
}: ChapterDrawerProps) {
  const [activeTab, setActiveTab] = useState<'materials' | 'notes'>('materials');
  const isLeaf = isLeafChapter(chapter);
  const stats = computeChapterStats(chapter, statuses);
  const resources = chapter.resources ?? [];
  const hasNotes = Boolean(chapter.notes && chapter.notes.trim().length > 0);

  useEffect(() => {
    setActiveTab('materials');
  }, [chapter.id]);

  useEffect(() => {
    if (!hasNotes && activeTab === 'notes') {
      setActiveTab('materials');
    }
  }, [hasNotes, activeTab]);

  const { prevTarget, nextTarget } = useMemo(() => {
    if (isLeaf) {
      const trackable = getTrackableItems(course);
      const idx = trackable.findIndex((item) => item.id === chapter.id);
      const prev = idx > 0 ? trackable[idx - 1] : undefined;
      const next = idx >= 0 && idx < trackable.length - 1 ? trackable[idx + 1] : undefined;
      return {
        prevTarget: prev
          ? {
              id: prev.id,
              label: prev.kind === 'lesson' ? prev.lesson.title : prev.chapter.title,
            }
          : undefined,
        nextTarget: next
          ? {
              id: next.id,
              label: next.kind === 'lesson' ? next.lesson.title : next.chapter.title,
            }
          : undefined,
      };
    }

    const orderedChapters = [...course.chapters].sort((a, b) => a.order - b.order);
    const idx = orderedChapters.findIndex((c) => c.id === chapter.id);
    const prev = idx > 0 ? orderedChapters[idx - 1] : undefined;
    const next =
      idx >= 0 && idx < orderedChapters.length - 1 ? orderedChapters[idx + 1] : undefined;
    return {
      prevTarget: prev ? { id: prev.id, label: prev.title } : undefined,
      nextTarget: next ? { id: next.id, label: next.title } : undefined,
    };
  }, [course, chapter.id, isLeaf]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (isLeaf && (e.key === 'l' || e.key === 'L')) {
        onChangeStatus(status === 'learning' ? 'todo' : 'learning');
      } else if (isLeaf && (e.key === 'd' || e.key === 'D')) {
        onChangeStatus(status === 'done' ? 'todo' : 'done');
      } else if (isLeaf && (e.key === 's' || e.key === 'S')) {
        onChangeStatus(status === 'skipped' ? 'todo' : 'skipped');
      } else if (e.key === 'ArrowLeft' && prevTarget) {
        onSelectItem(prevTarget.id);
      } else if (e.key === 'ArrowRight' && nextTarget) {
        onSelectItem(nextTarget.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLeaf, status, prevTarget, nextTarget, onChangeStatus, onSelectItem]);

  const prereqItems = (chapter.prerequisites ?? [])
    .map((id) => findCourseItem(course, id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const headerLeft = (
    <div className="flex items-center gap-1.5" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'materials'}
        onClick={() => setActiveTab('materials')}
        className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors ${
          activeTab === 'materials'
            ? 'border-slate-900 bg-slate-900 text-white dark:border-yellow-400 dark:bg-yellow-400 dark:text-black'
            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        {isLeaf ? 'Materials' : 'Overview'}
      </button>
      {hasNotes && (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'notes'}
          onClick={() => setActiveTab('notes')}
          className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors ${
            activeTab === 'notes'
              ? 'border-slate-900 bg-slate-900 text-white dark:border-yellow-400 dark:bg-yellow-400 dark:text-black'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          Notes
        </button>
      )}
    </div>
  );

  const headerRight = isLeaf ? (
    <StatusSegmentedControl status={status} onChange={onChangeStatus} />
  ) : null;

  const footer = (
    <>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!prevTarget}
          onClick={() => prevTarget && onSelectItem(prevTarget.id)}
          className="inline-flex min-w-0 items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{prevTarget ? prevTarget.label : 'Start of course'}</span>
        </button>
        <button
          type="button"
          disabled={!nextTarget}
          onClick={() => nextTarget && onSelectItem(nextTarget.id)}
          className="inline-flex min-w-0 items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <span className="truncate">{nextTarget ? nextTarget.label : 'End of course'}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        </button>
      </div>
      <p className="mt-2.5 text-center text-xs text-slate-500 dark:text-slate-400">
        {isLeaf ? (
          <>
            Shortcuts:{' '}
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1 text-slate-700 dark:border-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
              L
            </kbd>{' '}
            Learning ·{' '}
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1 text-slate-700 dark:border-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
              D
            </kbd>{' '}
            Done ·{' '}
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1 text-slate-700 dark:border-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
              S
            </kbd>{' '}
            Skip ·{' '}
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1 text-slate-700 dark:border-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
              ←/→
            </kbd>{' '}
            Prev/Next ·{' '}
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1 text-slate-700 dark:border-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
              Esc
            </kbd>{' '}
            Close
          </>
        ) : (
          <>
            Shortcuts:{' '}
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1 text-slate-700 dark:border-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
              ←/→
            </kbd>{' '}
            Prev/Next chapter ·{' '}
            <kbd className="rounded border border-slate-200 bg-slate-100 px-1 text-slate-700 dark:border-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
              Esc
            </kbd>{' '}
            Close
          </>
        )}
      </p>
    </>
  );

  return (
    <DrawerShell
      title={chapter.title}
      closeLabel="Close chapter drawer"
      onClose={onClose}
      headerLeft={headerLeft}
      headerRight={headerRight}
      footer={footer}
    >
      {/* Chapter Badges — Course code & schedule on left, Chapter position tag on top right */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-700 dark:text-slate-200">{course.code}</span>
          {chapter.weekRange && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-slate-800 dark:text-slate-300">
              {chapter.weekRange}
            </span>
          )}
        </div>
        <span
          data-testid="chapter-position-tag"
          className="ml-auto shrink-0 rounded border border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] px-2 py-0.5 font-mono font-bold text-[var(--tag-amber-text)]"
        >
          {formatChapterPositionTag(chapter.order)}
        </span>
      </div>

      <h2 className="mb-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-slate-100">
        {chapter.title}
      </h2>

      <p className="mb-5 text-sm leading-relaxed text-gray-700 sm:text-base dark:text-slate-300">
        {chapter.description}
      </p>

      {/* Progress Bar */}
      <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/80 dark:bg-[#1b2436]">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            Chapter Progress
          </span>
          <div className="flex items-center gap-2">
            {stats.skipped > 0 && (
              <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-300">
                {stats.skipped} skipped
              </span>
            )}
            <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
              {stats.done}/{stats.required}
            </span>
            <span className="text-slate-500 dark:text-slate-400">({stats.percentDone}%)</span>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-[#0d131f]">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-200 dark:bg-emerald-400"
            style={{ width: `${stats.percentDone}%` }}
          />
        </div>
      </div>

      {/* Prerequisites */}
      {prereqItems.length > 0 && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700/80 dark:bg-[#1b2436]">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-300">
            <GitBranch className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            Recommended Prerequisites
          </div>
          <div className="flex flex-wrap gap-1.5">
            {prereqItems.map((item) => {
              const title = item.kind === 'chapter' ? item.chapter.title : item.lesson.title;
              const isLeafChapterItem =
                item.kind === 'chapter' && isLeafChapter(item.chapter);
              const chapterStats =
                item.kind === 'chapter' && !isLeafChapterItem
                  ? computeChapterStats(item.chapter, statuses)
                  : null;
              const isSkipped =
                item.kind === 'lesson' || isLeafChapterItem
                  ? statuses[item.id] === 'skipped'
                  : Boolean(
                      chapterStats &&
                        chapterStats.total > 0 &&
                        chapterStats.skipped === chapterStats.total
                    );
              const isDone =
                item.kind === 'lesson' || isLeafChapterItem
                  ? statuses[item.id] === 'done'
                  : Boolean(
                      chapterStats &&
                        chapterStats.required > 0 &&
                        chapterStats.percentDone === 100
                    );

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item.id)}
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:border-blue-500 ${
                    isDone
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : isSkipped
                        ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-300'
                        : 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-[#121926] dark:text-slate-200'
                  }`}
                >
                  {isDone && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {isSkipped && <Ban className="h-3 w-3 text-slate-500 dark:text-slate-400" />}
                  {title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Panel: Materials / Notes */}
      {activeTab === 'materials' ? (
        (isLeaf || resources.length > 0) && (
          <div className="mb-6">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
              Chapter Materials
            </h3>
            <MaterialList
              resources={resources}
              emptyText="No materials attached to this chapter yet."
              courseSlug={courseSlug ?? course.slug}
              itemId={chapter.id}
              onOpenMaterialViewer={onOpenMaterialViewer}
              onOpenAssessment={onOpenAssessment}
            />
          </div>
        )
      ) : (
        <div className="mb-6 rounded-lg border border-slate-200 border-l-4 border-l-amber-400 bg-slate-50 p-4 dark:border-slate-700/80 dark:border-l-amber-400 dark:bg-[#1b2436]">
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-300">
            Chapter Notes
          </h3>
          {chapter.notes ? (
            <div className="whitespace-pre-line text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {chapter.notes}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No study notes added for this chapter yet.
            </p>
          )}
        </div>
      )}

      {/* Sub-lessons List (for chapters with sub-lessons) */}
      {!isLeaf && (
        <div>
          <h3 className="mb-2.5 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Sub-Lessons ({chapter.lessons.length})
          </h3>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white dark:divide-slate-700/80 dark:border-slate-700/80 dark:bg-[#1b2436]">
            {chapter.lessons.map((sub) => {
              const subStatus = statuses[sub.id] ?? 'todo';
              return (
                <li
                  key={sub.id}
                  className="flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/60"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLessonDone?.(sub.id);
                    }}
                    aria-label={`Toggle done for ${sub.title}`}
                    className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400"
                  >
                    {subStatus === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : subStatus === 'learning' ? (
                      <BookOpen className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    ) : subStatus === 'skipped' ? (
                      <Ban className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-400 dark:text-slate-500" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectItem(sub.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-medium ${
                          subStatus === 'done' || subStatus === 'skipped'
                            ? 'text-gray-500 line-through dark:text-slate-400'
                            : 'text-gray-900 dark:text-slate-100'
                        }`}
                      >
                        {sub.title}
                      </div>
                      <div className="truncate text-xs text-gray-500 dark:text-slate-400">
                        {sub.summary}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 dark:text-slate-500" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </DrawerShell>
  );
}
