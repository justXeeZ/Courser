import { Ban, BookOpen, CheckCircle2, ChevronRight, Circle } from 'lucide-react';
import { isStandaloneChapter } from '@/lib/courseItems';
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
        const standalone = isStandaloneChapter(chapter);
        const standaloneStatus: LessonStatus = statuses[chapter.id] ?? 'todo';
        const standaloneMatchesFilter =
          statusFilter === 'all' || standaloneStatus === statusFilter;

        const visibleLessons = chapter.lessons.filter((lesson) => {
          const st = statuses[lesson.id] ?? 'todo';
          return statusFilter === 'all' || st === statusFilter;
        });

        return (
          <div
            key={chapter.id}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-[#fdff00]/35 px-4 py-3 dark:border-slate-700 dark:bg-yellow-400/15">
              <div className="min-w-0 flex-1">
                {onSelectChapter ? (
                  <button
                    type="button"
                    onClick={() => onSelectChapter(chapter)}
                    className="font-roadmap text-left text-lg font-bold text-gray-900 hover:underline dark:text-slate-100"
                  >
                    {chapter.title}
                  </button>
                ) : (
                  <h2 className="font-roadmap text-lg font-bold text-gray-900 dark:text-slate-100">
                    {chapter.title}
                  </h2>
                )}
                <p className="text-xs text-gray-600 dark:text-slate-300">{chapter.description}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {chapter.weekRange && (
                  <span className="rounded bg-white/80 px-2 py-0.5 font-medium text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                    {chapter.weekRange}
                  </span>
                )}
                {stats.skipped > 0 && (
                  <span className="rounded border border-slate-300 bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {stats.skipped} skipped
                  </span>
                )}
                <span className="rounded bg-slate-900 px-2 py-0.5 font-mono font-semibold text-white dark:bg-slate-700">
                  {stats.done}/{stats.required}
                </span>
              </div>
            </div>

            {standalone ? (
              !standaloneMatchesFilter ? (
                <p className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                  No items match the current filter in this chapter.
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onToggleDone(chapter.id)}
                      aria-label={`Toggle done for ${chapter.title}`}
                      className="shrink-0 text-gray-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400"
                    >
                      <StatusIcon status={standaloneStatus} />
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectChapter?.(chapter)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-medium ${
                            standaloneStatus === 'done' || standaloneStatus === 'skipped'
                              ? 'text-gray-500 line-through dark:text-slate-400'
                              : 'text-gray-900 dark:text-slate-100'
                          }`}
                        >
                          {chapter.title}
                        </span>
                        <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                          Standalone
                        </span>
                        {standaloneStatus === 'learning' && (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                            Learning
                          </span>
                        )}
                        {standaloneStatus === 'skipped' && (
                          <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            Skipped
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-gray-500 dark:text-slate-400">
                        {chapter.description}
                      </div>
                    </button>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 sm:inline dark:bg-slate-800 dark:text-slate-300">
                      {(chapter.resources ?? []).length} materials
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
                  </div>
                </div>
              )
            ) : visibleLessons.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-500 dark:text-slate-400">
                No lessons match the current filter in this chapter.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                {visibleLessons.map((lesson) => {
                  const status = statuses[lesson.id] ?? 'todo';
                  return (
                    <li
                      key={lesson.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-slate-800/60"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onToggleDone(lesson.id)}
                          aria-label={`Toggle done for ${lesson.title}`}
                          className="shrink-0 text-gray-400 hover:text-emerald-600 dark:text-slate-500 dark:hover:text-emerald-400"
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
                                  ? 'text-gray-500 line-through dark:text-slate-400'
                                  : 'text-gray-900 dark:text-slate-100'
                              }`}
                            >
                              {lesson.title}
                            </span>
                            {status === 'skipped' && (
                              <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                Skipped
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-gray-500 dark:text-slate-400">
                            {lesson.summary}
                          </div>
                        </button>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 sm:inline dark:bg-slate-800 dark:text-slate-300">
                          {lesson.resources.length} materials
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
            )}
          </div>
        );
      })}
    </div>
  );
}
