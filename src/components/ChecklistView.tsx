import { Ban, BookOpen, CheckCircle2, ChevronRight, Circle } from 'lucide-react';
import { isLeafChapter } from '@/lib/courseItems';
import type { Chapter, CourseTree, LessonStatus } from '@/types/course';
import { computeChapterStats } from '@/store/useProgressStore';
import type { StatusFilter } from '@/components/CourseTreeCanvas';

interface ChecklistViewProps {
  course: CourseTree;
  statuses: Record<string, LessonStatus>;
  statusFilter: StatusFilter;
  onSelectLesson: (lessonId: string) => void;
  onSelectChapter?: (chapter: Chapter) => void;
  onToggleDone: (itemId: string) => void;
}

function StatusIcon({ status }: { status: LessonStatus }) {
  if (status === 'done') {
    return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
  }
  if (status === 'learning') {
    return <BookOpen className="h-5 w-5 text-violet-600 dark:text-violet-400" />;
  }
  if (status === 'skipped') {
    return <Ban className="h-5 w-5 text-slate-500 dark:text-slate-400" />;
  }
  return <Circle className="h-5 w-5" />;
}

function formatMaterialCount(count: number): string {
  return `${count} ${count === 1 ? 'material' : 'materials'}`;
}

export function ChecklistView({
  course,
  statuses,
  statusFilter,
  onSelectLesson,
  onSelectChapter,
  onToggleDone,
}: ChecklistViewProps) {
  const orderedChapters = [...course.chapters].sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12">
      {orderedChapters.map((chapter) => {
        const stats = computeChapterStats(chapter, statuses);
        const isLeaf = isLeafChapter(chapter);
        const leafStatus: LessonStatus = statuses[chapter.id] ?? 'todo';
        const leafMatchesFilter =
          statusFilter === 'all' || leafStatus === statusFilter;

        const visibleLessons = chapter.lessons.filter((lesson) => {
          const st = statuses[lesson.id] ?? 'todo';
          return statusFilter === 'all' || st === statusFilter;
        });

        return (
          <div
            key={chapter.id}
            data-filtered-out={isLeaf && !leafMatchesFilter ? 'true' : undefined}
            className={`overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs transition-opacity dark:border-slate-700/80 dark:bg-[#121926] ${
              isLeaf && !leafMatchesFilter ? 'opacity-40' : ''
            }`}
          >
            <div
              className={`flex flex-wrap items-center justify-between gap-3 border-l-4 border-l-amber-400 bg-slate-50 px-4 py-3 dark:border-l-amber-400 dark:bg-[#1b2436] ${
                !isLeaf ? 'border-b border-slate-200 dark:border-slate-700/80' : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {isLeaf && (
                  <button
                    type="button"
                    onClick={() => onToggleDone(chapter.id)}
                    aria-label={`Toggle done for ${chapter.title}`}
                    className="mt-0.5 shrink-0 text-slate-400 transition-colors hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400"
                  >
                    <StatusIcon status={leafStatus} />
                  </button>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {onSelectChapter ? (
                      <button
                        type="button"
                        onClick={() => onSelectChapter(chapter)}
                        className={`font-roadmap text-left text-lg font-bold hover:underline ${
                          isLeaf &&
                          (leafStatus === 'done' || leafStatus === 'skipped')
                            ? 'text-slate-500 line-through dark:text-slate-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {chapter.title}
                      </button>
                    ) : (
                      <h2
                        className={`font-roadmap text-lg font-bold ${
                          isLeaf &&
                          (leafStatus === 'done' || leafStatus === 'skipped')
                            ? 'text-slate-500 line-through dark:text-slate-400'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {chapter.title}
                      </h2>
                    )}

                    {isLeaf && leafStatus === 'learning' && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                        Learning
                      </span>
                    )}
                    {isLeaf && leafStatus === 'skipped' && (
                      <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-300">
                        Skipped
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {chapter.description}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                {chapter.weekRange && (
                  <span className="rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700 dark:border-slate-700 dark:bg-[#121926] dark:text-slate-200">
                    {chapter.weekRange}
                  </span>
                )}
                {isLeaf ? (
                  <>
                    <span className="hidden rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-600 sm:inline dark:border-slate-700 dark:bg-[#121926] dark:text-slate-300">
                      {formatMaterialCount((chapter.resources ?? []).length)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectChapter?.(chapter)}
                      aria-label={`Open ${chapter.title}`}
                      className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Open
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    {stats.skipped > 0 && (
                      <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:border-slate-600 dark:bg-[#121926] dark:text-slate-300">
                        {stats.skipped} skipped
                      </span>
                    )}
                    <span className="rounded bg-slate-900 px-2 py-0.5 font-mono font-semibold text-white dark:bg-[#0d131f] dark:text-slate-100">
                      {stats.done}/{stats.required}
                    </span>
                  </>
                )}
              </div>
            </div>

            {!isLeaf &&
              (visibleLessons.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                  No lessons match the current filter in this chapter.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleLessons.map((lesson) => {
                    const status = statuses[lesson.id] ?? 'todo';
                    return (
                      <li
                        key={lesson.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-[#1b2436]/70"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onToggleDone(lesson.id)}
                            aria-label={`Toggle done for ${lesson.title}`}
                            className="shrink-0 text-slate-400 transition-colors hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400"
                          >
                            <StatusIcon status={status} />
                          </button>

                          <button
                            type="button"
                            onClick={() => onSelectLesson(lesson.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`text-sm font-medium ${
                                  status === 'done' || status === 'skipped'
                                    ? 'text-slate-500 line-through dark:text-slate-400'
                                    : 'text-slate-900 dark:text-slate-100'
                                }`}
                              >
                                {lesson.title}
                              </span>
                              {status === 'learning' && (
                                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                                  Learning
                                </span>
                              )}
                              {status === 'skipped' && (
                                <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-300">
                                  Skipped
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                              {lesson.summary}
                            </div>
                          </button>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="hidden rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 sm:inline dark:bg-[#1b2436] dark:text-slate-300">
                            {formatMaterialCount(lesson.resources.length)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onSelectLesson(lesson.id)}
                            className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Open
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ))}
          </div>
        );
      })}
    </div>
  );
}
