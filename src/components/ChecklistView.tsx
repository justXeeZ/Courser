import { useState } from 'react';
import {
  Ban,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Sparkles,
} from 'lucide-react';
import {
  getOrderedSpineEntries,
  isLeafChapter,
  isSupplementTrackable,
} from '@/lib/courseItems';
import type { Chapter, CourseTree, LessonStatus, Supplement } from '@/types/course';
import { computeChapterStats, computeSpineSupplementStats } from '@/store/useProgressStore';
import type { StatusFilter } from '@/components/CourseTreeCanvas';

interface ChecklistViewProps {
  course: CourseTree;
  statuses: Record<string, LessonStatus>;
  statusFilter: StatusFilter;
  onSelectLesson: (lessonId: string) => void;
  onSelectChapter?: (chapter: Chapter) => void;
  onSelectSupplement?: (nodeId: string) => void;
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
  return `${count} ${count === 1 ? 'Material' : 'Materials'}`;
}

export function ChecklistView({
  course,
  statuses,
  statusFilter,
  onSelectLesson,
  onSelectChapter,
  onSelectSupplement,
  onToggleDone,
}: ChecklistViewProps) {
  const [collapsedIds, setCollapsedIds] = useState<Record<string, boolean>>({});
  const spineEntries = getOrderedSpineEntries(course);
  const openSupplement = onSelectSupplement ?? onSelectLesson;

  const matchesSupplement = (node: Supplement): boolean => {
    if (statusFilter === 'all') return true;
    if (!isSupplementTrackable(node)) return false;
    return (statuses[node.id] ?? 'todo') === statusFilter;
  };

  const anyCourseMatch =
    statusFilter === 'all' ||
    spineEntries.some((entry) => {
      if (entry.kind === 'supplement') {
        const children = entry.node.children ?? [];
        if (children.length === 0) {
          return matchesSupplement(entry.node);
        }
        return children.some(matchesSupplement);
      }
      const ch = entry.chapter;
      if (isLeafChapter(ch)) {
        return (statuses[ch.id] ?? 'todo') === statusFilter;
      }
      return (
        ch.lessons.some(
          (l) =>
            (statuses[l.id] ?? 'todo') === statusFilter ||
            (l.supplements ?? []).some(matchesSupplement)
        ) || (ch.supplements ?? []).some(matchesSupplement)
      );
    });

  const toggleCollapsed = (id: string) => {
    setCollapsedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const renderSupplementRow = (cn: Supplement, indented: boolean) => {
    const trackable = isSupplementTrackable(cn);
    const status: LessonStatus = trackable ? (statuses[cn.id] ?? 'todo') : 'todo';

    return (
      <li
        key={cn.id}
        className={`flex items-center justify-between gap-3 py-2.5 pr-4 transition-colors hover:bg-[var(--surface-hover)] ${
          indented ? 'bg-[var(--surface-2)]/50 pl-10' : 'pl-4'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {trackable ? (
            <button
              type="button"
              onClick={() => onToggleDone(cn.id)}
              aria-label={`Toggle done for ${cn.title}`}
              className="shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--accent-done)]"
            >
              <StatusIcon status={status} />
            </button>
          ) : (
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent-teal)]" />
          )}

          <button
            type="button"
            onClick={() => openSupplement(cn.id)}
            className="min-w-0 flex-1 text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`break-words [overflow-wrap:anywhere] text-sm font-medium ${
                  trackable && (status === 'done' || status === 'skipped')
                    ? 'text-[var(--text-muted)] line-through'
                    : 'text-[var(--text-primary)]'
                }`}
              >
                {cn.title}
              </span>
              {!trackable && (
                <span className="rounded border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--tag-teal-text)]">
                  Info
                </span>
              )}
              {trackable && status === 'learning' && (
                <span className="inline-flex items-center gap-1 rounded border border-[var(--status-learning-border)] bg-[var(--status-learning-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-learning-text)]">
                  <BookOpen className="h-3 w-3 text-[var(--status-learning-icon)]" />
                  Learning
                </span>
              )}
              {trackable && status === 'skipped' && (
                <span className="inline-flex items-center gap-1 rounded border border-[var(--status-skipped-border)] bg-[var(--status-skipped-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-skipped-text)]">
                  <Ban className="h-3 w-3" />
                  Skipped
                </span>
              )}
            </div>
            <div className="truncate text-xs text-[var(--text-muted)]">{cn.summary}</div>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden rounded border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-2 py-0.5 text-xs font-medium text-[var(--tag-teal-text)] sm:inline">
            {formatMaterialCount((cn.resources ?? []).length)}
          </span>
        </div>
      </li>
    );
  };

  return (
    <div className="w-full space-y-5 pb-12">
      {!anyCourseMatch && (
        <div
          role="status"
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3 text-center text-xs text-[var(--text-muted)]"
        >
          No chapters, lessons, or supplements match the selected status filter.
        </div>
      )}
      {spineEntries.map((entry) => {
        if (entry.kind === 'supplement') {
          const { node } = entry;
          const children = node.children ?? [];
          const isLeaf = children.length === 0;
          const isCollapsed = !isLeaf && Boolean(collapsedIds[node.id]);
          const trackable = isLeaf && isSupplementTrackable(node);
          const leafStatus: LessonStatus = trackable ? (statuses[node.id] ?? 'todo') : 'todo';
          const stats = !isLeaf ? computeSpineSupplementStats(node, statuses) : null;
          const visibleChildren = children.filter(matchesSupplement);
          const isFilteredOut =
            statusFilter !== 'all' &&
            (isLeaf ? !matchesSupplement(node) : visibleChildren.length === 0);

          return (
            <div
              key={node.id}
              data-filtered-out={isFilteredOut ? 'true' : undefined}
              className={`overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-xs transition-opacity ${
                isFilteredOut ? 'opacity-40' : ''
              }`}
            >
              <div
                className={`flex items-start justify-between gap-3 border-l-4 border-l-[var(--accent-teal)] bg-[var(--surface-chapter-header)] px-4 py-3 sm:items-center ${
                  !isLeaf && !isCollapsed ? 'border-b border-[var(--border-subtle)]' : ''
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {!isLeaf && (
                    <button
                      type="button"
                      onClick={() => toggleCollapsed(node.id)}
                      aria-expanded={!isCollapsed}
                      aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${node.title}`}
                      className="mt-1 shrink-0 rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  {isLeaf && trackable && (
                    <button
                      type="button"
                      onClick={() => onToggleDone(node.id)}
                      aria-label={`Toggle done for ${node.title}`}
                      className="mt-0.5 shrink-0 text-[var(--text-muted)] transition-colors hover:text-[var(--accent-done)]"
                    >
                      <StatusIcon status={leafStatus} />
                    </button>
                  )}
                  {isLeaf && !trackable && (
                    <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[var(--accent-teal)]" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openSupplement(node.id)}
                        className={`font-roadmap break-words [overflow-wrap:anywhere] text-left text-lg font-bold hover:underline ${
                          trackable && (leafStatus === 'done' || leafStatus === 'skipped')
                            ? 'text-[var(--text-muted)] line-through'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {node.title}
                      </button>
                      {trackable && leafStatus === 'learning' && (
                        <span className="inline-flex items-center gap-1 rounded border border-[var(--status-learning-border)] bg-[var(--status-learning-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-learning-text)]">
                          <BookOpen className="h-3 w-3 text-[var(--status-learning-icon)]" />
                          Learning
                        </span>
                      )}
                      {trackable && leafStatus === 'skipped' && (
                        <span className="inline-flex items-center gap-1 rounded border border-[var(--status-skipped-border)] bg-[var(--status-skipped-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--status-skipped-text)]">
                          <Ban className="h-3 w-3" />
                          Skipped
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">{node.summary}</p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  {node.weekRange && (
                    <span className="rounded border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-2 py-0.5 font-medium text-[var(--tag-teal-text)]">
                      {node.weekRange}
                    </span>
                  )}
                  {isLeaf ? (
                    <span className="hidden rounded border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-2 py-0.5 font-medium text-[var(--tag-teal-text)] sm:inline">
                      {formatMaterialCount((node.resources ?? []).length)}
                    </span>
                  ) : stats && stats.total > 0 ? (
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
                  ) : null}
                </div>
              </div>

              {!isLeaf &&
                !isCollapsed &&
                (visibleChildren.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    No child supplements match the current filter.
                  </p>
                ) : (
                  <ul className="divide-y divide-[var(--border-subtle)]">
                    {visibleChildren.map((child) => renderSupplementRow(child, false))}
                  </ul>
                ))}
            </div>
          );
        }

        const { chapter } = entry;
        const stats = computeChapterStats(chapter, statuses);
        const isLeaf = isLeafChapter(chapter);
        const isCollapsed = !isLeaf && Boolean(collapsedIds[chapter.id]);
        const leafStatus: LessonStatus = statuses[chapter.id] ?? 'todo';
        const leafMatchesFilter =
          statusFilter === 'all' || leafStatus === statusFilter;

        const visibleLessons = chapter.lessons.filter((lesson) => {
          const st = statuses[lesson.id] ?? 'todo';
          const lessonMatches = statusFilter === 'all' || st === statusFilter;
          const childMatches = (lesson.supplements ?? []).some(matchesSupplement);
          return lessonMatches || childMatches;
        });
        const visibleChapterSupplements = (chapter.supplements ?? []).filter(matchesSupplement);
        const isFilteredOut =
          statusFilter !== 'all' &&
          (isLeaf
            ? !leafMatchesFilter
            : visibleLessons.length === 0 && visibleChapterSupplements.length === 0);

        return (
          <div
            key={chapter.id}
            data-filtered-out={isFilteredOut ? 'true' : undefined}
            className={`overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-xs transition-opacity ${
              isFilteredOut ? 'opacity-40' : ''
            }`}
          >
            <div
              className={`flex items-start justify-between gap-3 border-l-4 border-l-[var(--accent-amber)] bg-[var(--surface-chapter-header)] px-4 py-3 sm:items-center ${
                !isLeaf && !isCollapsed ? 'border-b border-[var(--border-subtle)]' : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {!isLeaf && (
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(chapter.id)}
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
                  <span className="rounded border border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] px-2 py-0.5 font-medium text-[var(--tag-amber-text)]">
                    {chapter.weekRange}
                  </span>
                )}
                {isLeaf ? (
                  <span className="hidden rounded border border-[var(--tag-amber-border)] bg-[var(--tag-amber-bg)] px-2 py-0.5 font-medium text-[var(--tag-amber-text)] sm:inline">
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
              (visibleLessons.length === 0 && visibleChapterSupplements.length === 0 ? (
                <p className="px-4 py-3 text-xs text-[var(--text-muted)]">
                  No lessons match the current filter in this chapter.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {visibleLessons.flatMap((lesson) => {
                    const status = statuses[lesson.id] ?? 'todo';
                    const visibleChildSupplements = (lesson.supplements ?? []).filter(
                      matchesSupplement
                    );
                    const lessonRow = (
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
                          <span className="hidden rounded border border-[var(--tag-peach-border)] bg-[var(--tag-peach-bg)] px-2 py-0.5 text-xs font-medium text-[var(--tag-peach-text)] sm:inline">
                            {formatMaterialCount(lesson.resources.length)}
                          </span>
                        </div>
                      </li>
                    );
                    return [
                      lessonRow,
                      ...visibleChildSupplements.map((cn) => renderSupplementRow(cn, true)),
                    ];
                  })}
                  {visibleChapterSupplements.map((cn) => renderSupplementRow(cn, false))}
                </ul>
              ))}
          </div>
        );
      })}
    </div>
  );
}
