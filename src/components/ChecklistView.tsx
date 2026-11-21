import { CheckCircle2, Circle, BookOpen, Ban, ChevronRight } from 'lucide-react';
import type { CourseTree, LessonStatus } from '@/types/course';
import { computeChapterStats } from '@/store/useProgressStore';
import type { StatusFilter } from '@/components/CourseTreeCanvas';

interface ChecklistViewProps {
  course: CourseTree;
  statuses: Record<string, LessonStatus>;
  statusFilter: StatusFilter;
  onSelectLesson: (lessonId: string) => void;
  onToggleDone: (lessonId: string) => void;
}

export function ChecklistView({
  course,
  statuses,
  statusFilter,
  onSelectLesson,
  onToggleDone,
}: ChecklistViewProps) {
  const orderedChapters = [...course.chapters].sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-12">
      {orderedChapters.map((chapter) => {
        const stats = computeChapterStats(chapter, statuses);
        const visibleLessons = chapter.lessons.filter((lesson) => {
          const st = statuses[lesson.id] ?? 'todo';
          return statusFilter === 'all' || st === statusFilter;
        });

        return (
          <div
            key={chapter.id}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-[#fdff00]/35 px-4 py-3">
              <div>
                <h2 className="font-roadmap text-lg font-bold text-gray-900">{chapter.title}</h2>
                <p className="text-xs text-gray-600">{chapter.description}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {chapter.weekRange && (
                  <span className="rounded bg-white/80 px-2 py-0.5 font-medium text-gray-700">
                    {chapter.weekRange}
                  </span>
                )}
                <span className="rounded bg-slate-900 px-2 py-0.5 font-mono font-semibold text-white">
                  {stats.done}/{stats.total}
                </span>
              </div>
            </div>

            {visibleLessons.length === 0 ? (
              <p className="px-4 py-3 text-xs text-gray-500">
                No lessons match the current filter in this chapter.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {visibleLessons.map((lesson) => {
                  const status = statuses[lesson.id] ?? 'todo';
                  return (
                    <li
                      key={lesson.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onToggleDone(lesson.id)}
                          aria-label={`Toggle done for ${lesson.title}`}
                          className="shrink-0 text-gray-400 hover:text-green-600"
                        >
                          {status === 'done' ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : status === 'learning' ? (
                            <BookOpen className="h-5 w-5 text-violet-600" />
                          ) : status === 'skipped' ? (
                            <Ban className="h-5 w-5 text-teal-700" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onSelectLesson(lesson.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div
                            className={`text-sm font-medium ${
                              status === 'done' || status === 'skipped'
                                ? 'text-gray-500 line-through'
                                : 'text-gray-900'
                            }`}
                          >
                            {lesson.title}
                          </div>
                          <div className="truncate text-xs text-gray-500">{lesson.summary}</div>
                        </button>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 sm:inline">
                          {lesson.resources.length} materials
                        </span>
                        <button
                          type="button"
                          onClick={() => onSelectLesson(lesson.id)}
                          className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:text-blue-800"
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
