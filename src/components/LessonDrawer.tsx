import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GitBranch,
} from 'lucide-react';
import { findCourseItem, getTrackableItems, isLeafChapter } from '@/lib/courseItems';
import { formatLessonPositionTag } from '@/lib/courseIds';
import { computeChapterStats } from '@/store/useProgressStore';
import type { Chapter, CourseTree, LessonResource, LessonStatus, SubLesson } from '@/types/course';
import { DrawerShell } from '@/components/DrawerShell';
import { MaterialList } from '@/components/MaterialList';
import { StatusSegmentedControl } from '@/components/StatusSegmentedControl';

function isRedundantWeekRange(weekRange: string | undefined, chapterOrder: number): boolean {
  if (!weekRange) return true;
  const trimmed = weekRange.trim();
  if (!trimmed) return true;
  return new RegExp(`^(?:ch(?:apter)?|part|unit|module|section)\\s*0*${chapterOrder}$`, 'i').test(
    trimmed
  );
}

interface LessonDrawerProps {
  course: CourseTree;
  chapter: Chapter;
  lesson: SubLesson;
  status: LessonStatus;
  statuses: Record<string, LessonStatus>;
  courseSlug?: string;
  onChangeStatus: (status: LessonStatus) => void;
  onNavigateLesson?: (lessonId: string) => void;
  onSelectItem?: (itemId: string) => void;
  onOpenMaterialViewer?: (resource: LessonResource) => void;
  onOpenAssessment?: (resource: LessonResource) => void;
  onClose: () => void;
}

export function LessonDrawer({
  course,
  chapter,
  lesson,
  status,
  statuses,
  courseSlug,
  onChangeStatus,
  onNavigateLesson,
  onSelectItem,
  onOpenMaterialViewer,
  onOpenAssessment,
  onClose,
}: LessonDrawerProps) {
  const [activeTab, setActiveTab] = useState<'resources' | 'notes'>('resources');
  const hasNotes = Boolean(lesson.notes && lesson.notes.trim().length > 0);

  const navigateToItem = onSelectItem ?? onNavigateLesson;

  const { prevItem, nextItem } = useMemo(() => {
    const trackable = getTrackableItems(course);
    const currentIndex = trackable.findIndex((item) => item.id === lesson.id);
    return {
      prevItem: currentIndex > 0 ? trackable[currentIndex - 1] : undefined,
      nextItem:
        currentIndex >= 0 && currentIndex < trackable.length - 1
          ? trackable[currentIndex + 1]
          : undefined,
    };
  }, [course, lesson.id]);

  useEffect(() => {
    setActiveTab('resources');
  }, [lesson.id]);

  useEffect(() => {
    if (!hasNotes && activeTab === 'notes') {
      setActiveTab('resources');
    }
  }, [hasNotes, activeTab]);

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

      if (e.key === 'l' || e.key === 'L') {
        onChangeStatus(status === 'learning' ? 'todo' : 'learning');
      } else if (e.key === 'd' || e.key === 'D') {
        onChangeStatus(status === 'done' ? 'todo' : 'done');
      } else if (e.key === 's' || e.key === 'S') {
        onChangeStatus(status === 'skipped' ? 'todo' : 'skipped');
      } else if (e.key === 'ArrowLeft' && prevItem && navigateToItem) {
        navigateToItem(prevItem.id);
      } else if (e.key === 'ArrowRight' && nextItem && navigateToItem) {
        navigateToItem(nextItem.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, prevItem, nextItem, onChangeStatus, navigateToItem]);

  const prereqItems = (lesson.prerequisites ?? [])
    .map((id) => findCourseItem(course, id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const headerLeft = (
    <div className="flex items-center gap-1.5" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'resources'}
        onClick={() => setActiveTab('resources')}
        className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors ${
          activeTab === 'resources'
            ? 'border-slate-900 bg-slate-900 text-white dark:border-yellow-400 dark:bg-yellow-400 dark:text-black'
            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        Resources
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
          Study Notes
        </button>
      )}
    </div>
  );

  const headerRight = <StatusSegmentedControl status={status} onChange={onChangeStatus} />;

  const prevTitle = prevItem
    ? prevItem.kind === 'lesson'
      ? prevItem.lesson.title
      : prevItem.chapter.title
    : 'Start of course';

  const nextTitle = nextItem
    ? nextItem.kind === 'lesson'
      ? nextItem.lesson.title
      : nextItem.chapter.title
    : 'End of course';

  const footer = (
    <>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!prevItem}
          onClick={() => prevItem && navigateToItem?.(prevItem.id)}
          className="inline-flex min-w-0 items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{prevTitle}</span>
        </button>
        <button
          type="button"
          disabled={!nextItem}
          onClick={() => nextItem && navigateToItem?.(nextItem.id)}
          className="inline-flex min-w-0 items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <span className="truncate">{nextTitle}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        </button>
      </div>
      <p className="mt-2.5 text-center text-xs text-slate-500 dark:text-slate-400">
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
      </p>
    </>
  );

  const lessonIndex = chapter.lessons.findIndex((l) => l.id === lesson.id);
  const lessonOrder = lessonIndex >= 0 ? lessonIndex + 1 : 1;

  return (
    <DrawerShell
      title={lesson.title}
      closeLabel="Close lesson drawer"
      onClose={onClose}
      headerLeft={headerLeft}
      headerRight={headerRight}
      footer={footer}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-gray-700 dark:text-slate-200">{course.code}</span>
          <span>/</span>
          <button
            type="button"
            onClick={() => navigateToItem?.(chapter.id)}
            className="hover:text-blue-600 hover:underline dark:hover:text-blue-400"
          >
            {chapter.title}
          </button>
          {chapter.weekRange && !isRedundantWeekRange(chapter.weekRange, chapter.order) && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 dark:bg-slate-800 dark:text-slate-300">
              {chapter.weekRange}
            </span>
          )}
        </div>
        <span
          data-testid="lesson-position-tag"
          className="ml-auto shrink-0 rounded bg-slate-900 px-2 py-0.5 font-mono font-semibold text-white dark:bg-[#1b2436] dark:text-amber-400"
        >
          {formatLessonPositionTag(chapter.order, lessonOrder)}
        </span>
      </div>

      <h2 className="mb-3 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-slate-100">
        {lesson.title}
      </h2>

      <p className="mb-5 text-sm leading-relaxed text-gray-700 sm:text-base dark:text-slate-300">
        {lesson.summary}
      </p>

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
                  onClick={() => navigateToItem?.(item.id)}
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

      {activeTab === 'resources' ? (
        <div>
          <h3 className="mb-3 text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Course Materials &amp; Resources
          </h3>
          <MaterialList
            resources={lesson.resources}
            emptyText="No resources linked for this sub-lesson yet."
            courseSlug={courseSlug ?? course.slug}
            itemId={lesson.id}
            onOpenMaterialViewer={onOpenMaterialViewer}
            onOpenAssessment={onOpenAssessment}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 border-l-4 border-l-amber-400 bg-slate-50 p-4 dark:border-slate-700/80 dark:border-l-amber-400 dark:bg-[#1b2436]">
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-300">
              Key Study Notes
            </h3>
            {lesson.notes ? (
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                {lesson.notes}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Review the linked lecture slides and textbook chapters for detailed proofs and worked
                examples.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700/80 dark:bg-[#1b2436]">
            <h3 className="mb-1 text-xs font-semibold tracking-wider text-slate-600 uppercase dark:text-slate-300">
              About {chapter.title}
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">{chapter.description}</p>
          </div>
        </div>
      )}
    </DrawerShell>
  );
}
