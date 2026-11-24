import { useState } from 'react';
import { Ban, BookOpen, CheckCircle2, ChevronDown, ChevronRight, Circle } from 'lucide-react';
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
    return <CheckCircle2 className="h-5 w-5 text-[var(--accent-done)]" />;
  }
  if (status === 'learning') {
    return <BookOpen className="h-5 w-5 text-[var(--status-learning-icon)]" />;
  }
  if (status === 'skipped') {
    return <Ban className="h-5 w-5 text-[var(--status-skipped-text)]" />;
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
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const orderedChapters = [...course.chapters].sort((a, b) => a.order - b.order);

  const anyCourseMatch =
    statusFilter === 'all' ||
    orderedChapters.some((ch) => {
      if (isLeafChapter(ch)) {
        return (statuses[ch.id] ?? 'todo') === statusFilter;
      }
      return ch.lessons.some((l) => (statuses[l.id] ?? 'todo') === statusFilter);
    });

  const toggleChapterCollapsed = (chapterId: string) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  return (
    <div className="w-full space-y-5 pb-12">
      {!anyCourseMatch && (
        <div
          role="status"
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3 text-center text-xs text-[var(--text-muted)]"
        >
          No chapters or lessons match the selected status filter.
        </div>
      )}
      {orderedChapters.map((chapter) => {
        const stats = computeChapterStats(chapter, statuses);
        const isLeaf = isLeafChapter(chapter);
        const isCollapsed = !isLeaf && Boolean(collapsedChapters[chapter.id]);
        const leafStatus: LessonStatus = statuses[chapter.id] ?? 'todo';
        const leafMatchesFilter =
          statusFilter === 'all' || leafStatus === statusFilter;

        const visibleLessons = chapter.lessons.filter((lesson) => {
          const st = statuses[lesson.id] ?? 'todo';
          return statusFilter === 'all' || st === statusFilter;
        });
        const isFilteredOut =
          statusFilter !== 'all' &&
          (isLeaf ? !leafMatchesFilter : visibleLessons.length === 0);

        return (
          <div
            key={chapter.id}
            data-filtered-out={isFilteredOut ? 'true' : undefined}
            className={`overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-xs transition-opacity ${
              isFilteredOut ? 'opacity-40' : ''
            }`}
          >
            <div
              className={`flex items-start justify-between gap-3 border-l-4 border-l-[var(--accent-amber)] bg-[var(--surface-hover)] px-4 py-3 sm:items-center dark:bg-[var(--surface-2)] ${
                !isLeaf && !isCollapsed ? 'border-b border-[var(--border-subtle)]' : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {!isLeaf && (
                  <button
                    type="button"
                    onClick={() => toggleChapterCollapsed(chapter.id)}
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${chapter.title}`}
                    className="mt-1 shrink-0 rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                )}
                {isLeaf && (
                  <button
                    type="button"
                    onClick={() => onToggleDone(chapter.id)}
                    aria-label={`Toggle done for ${chapter.title}`}
                    className="mt-0.5 shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--accent-done)]"
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
                        className={`font-roadmap break-words [overflow-wrap:anywhere] text-left text-lg font-bold hover:underline ${
                          isLeaf &&
                          (leafStatus === 'done' || leafStatus === 'skipped')
                            ? 'text-[var(--text-muted)] line-through'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {chapter.title}
                      </button>
                    ) : (
                      <h2
                        className={`font-roadmap break-words [overflow-wrap:anywhere] text-lg font-bold ${
                          isLeaf &&
                          (leafStatus === 'done' || leafStatus === 'skipped')
                            ? 'text-[var(--text-muted)] line-through'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {chapter.title}
                      </h2>
                    )}

                    {isLeaf && leafStatus === 'learning' && (
                      <span className="inline-flex items-center gap-1 rounded border border-[var(--status-learning-border)] bg-[var(--status-learning-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-learning-text)]">
                        <BookOpen className="h-3 w-3 text-[var(--status-learning-icon)]" />
                        Learning
                      </span>
                    )}
                    {isLeaf && leafStatus === 'skipped' && (
                      <span className="inline-flex items-center gap-1 rounded border border-[var(--status-skipped-border)] bg-[var(--status-skipped-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-skipped-text)]">
                        <Ban className="h-3 w-3" />
                        Skipped
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {chapter.description}
                  </p>
                </div>
              </div>

              <div
                data-testid="checklist-chapter-tags"
                className="flex shrink-0 flex-col items-end gap-1.5 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
              >
                {chapter.weekRange && (
                  <span className="rounded border border-[var(--border-subtle)] bg-[var(--surface-warm-muted)] px-2 py-0.5 font-medium text-[var(--text-secondary)]">
                    {chapter.weekRange}
                  </span>
                )}
                {isLeaf ? (
                  <span className="hidden rounded border border-[var(--border-subtle)] bg-[var(--surface-warm-muted)] px-2 py-0.5 text-[var(--text-secondary)] sm:inline">
                    {formatMaterialCount((chapter.resources ?? []).length)}
                  </span>
                ) : (
                  <>
                    {stats.skipped > 0 && (
                      <span className="rounded border border-[var(--status-skipped-border)] bg-[var(--status-skipped-bg)] px-2 py-0.5 font-medium text-[var(--status-skipped-text)]">
                        {stats.skipped} skipped
                      </span>
                    )}
                    <span className="rounded bg-[var(--solid-bg)] px-2 py-0.5 font-mono font-semibold text-[var(--solid-text)]">
                      {stats.done}/{stats.required}
                    </span>
                  </>
                )}
              </div>
            </div>

            {!isLeaf &&
              !isCollapsed &&
              (visibleLessons.length === 0 ? (
                <p className="px-4 py-3 text-xs text-[var(--text-muted)]">
                  No lessons match the current filter in this chapter.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {visibleLessons.map((lesson) => {
                    const status = statuses[lesson.id] ?? 'todo';
                    return (
                      <li
                        key={lesson.id}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <button
                            type="button"
                            onClick={() => onToggleDone(lesson.id)}
                            aria-label={`Toggle done for ${lesson.title}`}
                            className="shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--accent-done)]"
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
                                className={`break-words [overflow-wrap:anywhere] text-sm font-medium ${
                                  status === 'done' || status === 'skipped'
                                    ? 'text-[var(--text-muted)] line-through'
                                    : 'text-[var(--text-primary)]'
                                }`}
                              >
                                {lesson.title}
                              </span>
                              {status === 'learning' && (
                                <span className="inline-flex items-center gap-1 rounded border border-[var(--status-learning-border)] bg-[var(--status-learning-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-learning-text)]">
                                  <BookOpen className="h-3 w-3 text-[var(--status-learning-icon)]" />
                                  Learning
                                </span>
                              )}
                              {status === 'skipped' && (
                                <span className="inline-flex items-center gap-1 rounded border border-[var(--status-skipped-border)] bg-[var(--status-skipped-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-skipped-text)]">
                                  <Ban className="h-3 w-3" />
                                  Skipped
                                </span>
                              )}
                            </div>
                            <div className="truncate text-xs text-[var(--text-muted)]">
                              {lesson.summary}
                            </div>
                          </button>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <span className="hidden rounded bg-[var(--surface-warm-muted)] px-2 py-0.5 text-xs text-[var(--text-secondary)] sm:inline">
                            {formatMaterialCount(lesson.resources.length)}
                          </span>
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
