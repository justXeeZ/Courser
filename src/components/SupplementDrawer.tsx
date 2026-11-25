import { useEffect, useMemo, useState } from 'react';
import {
  AlignLeft,
  Ban,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ExternalLink,
  GitBranch,
  Layers,
  Link2,
  Sparkles,
  Tag,
} from 'lucide-react';
import {
  findCourseItem,
  getTrackableItems,
  isLeafChapter,
  isSupplementTrackable,
  type CourseItem,
} from '@/lib/courseItems';
import { computeChapterStats, computeSpineSupplementStats } from '@/store/useProgressStore';
import type { CourseTree, LessonResource, LessonStatus, SpineSupplement } from '@/types/course';
import { DrawerShell } from '@/components/DrawerShell';
import { MaterialList } from '@/components/MaterialList';
import { StatusSegmentedControl } from '@/components/StatusSegmentedControl';

type SupplementCourseItem = Extract<CourseItem, { kind: 'supplement' }>;

interface SupplementDrawerProps {
  course: CourseTree;
  entry: SupplementCourseItem;
  status: LessonStatus;
  statuses: Record<string, LessonStatus>;
  courseSlug?: string;
  onChangeStatus: (status: LessonStatus) => void;
  onSelectItem: (itemId: string) => void;
  onToggleItemDone?: (itemId: string) => void;
  onOpenMaterialViewer?: (resource: LessonResource) => void;
  onOpenAssessment?: (resource: LessonResource) => void;
  onClose: () => void;
}

function getCourseItemTitle(item: CourseItem): string {
  if (item.kind === 'chapter') return item.chapter.title;
  if (item.kind === 'lesson') return item.lesson.title;
  return item.node.title;
}

function getSafeExternalUrl(raw: string): string | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function SupplementDrawer({
  course,
  entry,
  status,
  statuses,
  courseSlug,
  onChangeStatus,
  onSelectItem,
  onToggleItemDone,
  onOpenMaterialViewer,
  onOpenAssessment,
  onClose,
}: SupplementDrawerProps) {
  const [activeTab, setActiveTab] = useState<'materials' | 'notes'>('materials');
  const { node } = entry;
  const spineChildren =
    entry.placement === 'spine' && 'children' in node ? (node.children ?? []) : [];
  const isSpineParent = spineChildren.length > 0;
  const trackable = !isSpineParent && isSupplementTrackable(node);
  const resources = node.resources ?? [];
  const customFields = node.customFields ?? [];
  const hasNotes = Boolean(node.notes && node.notes.trim().length > 0);
  const spineStats = isSpineParent
    ? computeSpineSupplementStats(node as SpineSupplement, statuses)
    : null;

  useEffect(() => {
    setActiveTab('materials');
  }, [node.id]);

  useEffect(() => {
    if (!hasNotes && activeTab === 'notes') {
      setActiveTab('materials');
    }
  }, [hasNotes, activeTab]);

  const { prevItem, nextItem } = useMemo(() => {
    const trackableItems = getTrackableItems(course);
    const currentIndex = trackableItems.findIndex((item) => item.id === node.id);
    return {
      prevItem: currentIndex > 0 ? trackableItems[currentIndex - 1] : undefined,
      nextItem:
        currentIndex >= 0 && currentIndex < trackableItems.length - 1
          ? trackableItems[currentIndex + 1]
          : undefined,
    };
  }, [course, node.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelectorAll('[role="dialog"]').length > 1) return;
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

      if (trackable && (e.key === 'l' || e.key === 'L')) {
        onChangeStatus(status === 'learning' ? 'todo' : 'learning');
      } else if (trackable && (e.key === 'd' || e.key === 'D')) {
        onChangeStatus(status === 'done' ? 'todo' : 'done');
      } else if (trackable && (e.key === 's' || e.key === 'S')) {
        onChangeStatus(status === 'skipped' ? 'todo' : 'skipped');
      } else if (e.key === 'ArrowLeft' && prevItem) {
        onSelectItem(prevItem.id);
      } else if (e.key === 'ArrowRight' && nextItem) {
        onSelectItem(nextItem.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [trackable, status, prevItem, nextItem, onChangeStatus, onSelectItem]);

  const prereqItems = (node.prerequisites ?? [])
    .map((id) => findCourseItem(course, id))
    .filter((item): item is CourseItem => Boolean(item));

  const headerLeft = (
    <div className="flex items-center gap-1.5" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'materials'}
        onClick={() => setActiveTab('materials')}
        className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors ${
          activeTab === 'materials'
            ? 'border-[var(--solid-bg)] bg-[var(--solid-bg)] text-[var(--solid-text)]'
            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        {!isSpineParent || resources.length > 0 ? 'Materials' : 'Overview'}
      </button>
      {hasNotes && (
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'notes'}
          onClick={() => setActiveTab('notes')}
          className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors ${
            activeTab === 'notes'
              ? 'border-[var(--solid-bg)] bg-[var(--solid-bg)] text-[var(--solid-text)]'
              : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          Notes
        </button>
      )}
    </div>
  );

  const headerRight = trackable ? (
    <StatusSegmentedControl status={status} onChange={onChangeStatus} />
  ) : !isSpineParent ? (
    <span className="inline-flex items-center gap-1 rounded-md border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--tag-teal-text)]">
      <Sparkles className="h-3 w-3" />
      Informational
    </span>
  ) : null;

  const prevTitle = prevItem ? getCourseItemTitle(prevItem) : 'Start of course';
  const nextTitle = nextItem ? getCourseItemTitle(nextItem) : 'End of course';

  const footer = (
    <>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!prevItem}
          onClick={() => prevItem && onSelectItem(prevItem.id)}
          className="inline-flex min-w-0 items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{prevTitle}</span>
        </button>
        <button
          type="button"
          disabled={!nextItem}
          onClick={() => nextItem && onSelectItem(nextItem.id)}
          className="inline-flex min-w-0 items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <span className="truncate">{nextTitle}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        </button>
      </div>
      <p className="mt-2.5 text-center text-xs text-slate-500 dark:text-slate-400">
        {trackable ? (
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
            Prev/Next ·{' '}
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
      title={node.title}
      closeLabel="Close supplement drawer"
      onClose={onClose}
      headerLeft={headerLeft}
      headerRight={headerRight}
      footer={footer}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[var(--text-secondary)]">{course.code}</span>
          {entry.chapter && (
            <>
              <span>/</span>
              <button
                type="button"
                onClick={() => onSelectItem(entry.chapter!.id)}
                className="hover:text-[var(--accent-teal)] hover:underline"
              >
                {entry.chapter.title}
              </button>
            </>
          )}
          {entry.lesson && (
            <>
              <span>/</span>
              <button
                type="button"
                onClick={() => onSelectItem(entry.lesson!.id)}
                className="hover:text-[var(--accent-teal)] hover:underline"
              >
                {entry.lesson.title}
              </button>
            </>
          )}
          {entry.parentSupplement && (
            <>
              <span>/</span>
              <button
                type="button"
                onClick={() => onSelectItem(entry.parentSupplement!.id)}
                className="hover:text-[var(--accent-teal)] hover:underline"
              >
                {entry.parentSupplement.title}
              </button>
            </>
          )}
          {node.weekRange && (
            <span className="rounded bg-[var(--surface-warm-muted)] px-1.5 py-0.5 text-[var(--text-secondary)]">
              {node.weekRange}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="rounded border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-2 py-0.5 font-medium text-[var(--tag-teal-text)]">
            Supplement
          </span>
          <span
            data-testid="supplement-position-tag"
            className="shrink-0 rounded border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-2 py-0.5 font-mono font-bold text-[var(--tag-teal-text)]"
          >
            {entry.positionTag}
          </span>
        </div>
      </div>

      <h2 className="mb-3 break-words [overflow-wrap:anywhere] text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
        {node.title}
      </h2>

      <p className="mb-5 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
        {node.summary}
      </p>

      {/* Progress Bar for Spine Supplements with trackable children */}
      {isSpineParent && spineStats && spineStats.total > 0 && (
        <div className="mb-5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[var(--text-primary)]">
              Section Progress
            </span>
            <div className="flex items-center gap-2">
              {spineStats.skipped > 0 && (
                <span className="rounded border border-[var(--status-skipped-border)] bg-[var(--status-skipped-bg)] px-1.5 py-0.5 font-medium text-[var(--status-skipped-text)]">
                  {spineStats.skipped} skipped
                </span>
              )}
              <span className="font-mono font-semibold text-[var(--text-primary)]">
                {spineStats.done}/{spineStats.required}
              </span>
              <span className="text-[var(--text-muted)]">({spineStats.percentDone}%)</span>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-inset)]">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                spineStats.percentDone === 100
                  ? 'bg-[var(--accent-done)]'
                  : 'bg-[var(--accent-teal)]'
              }`}
              style={{ width: `${spineStats.percentDone}%` }}
            />
          </div>
        </div>
      )}

      {/* Custom Fields (styled like MaterialList rows) */}
      {customFields.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent-teal)]" />
            Custom Fields
          </h3>
          <ul className="space-y-2">
            {customFields.map((field, idx) => {
              const safeUrl = field.type === 'link' ? getSafeExternalUrl(field.value) : null;
              const FieldIcon =
                field.type === 'link'
                  ? ExternalLink
                  : field.type === 'date'
                    ? Calendar
                    : field.type === 'badge'
                      ? Tag
                      : AlignLeft;

              const rowContent = (
                <>
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <FieldIcon className="h-4 w-4 shrink-0 text-[var(--accent-teal)]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[var(--text-secondary)]">
                        {field.label}
                      </div>
                      {field.type === 'link' && safeUrl ? (
                        <div className="truncate text-xs text-[var(--accent-teal)]">
                          {field.value}
                        </div>
                      ) : field.type !== 'badge' ? (
                        <div className="break-words text-sm font-medium text-[var(--text-primary)]">
                          {field.value}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {field.type === 'badge' && (
                    <span className="shrink-0 rounded border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--tag-teal-text)]">
                      {field.value}
                    </span>
                  )}
                </>
              );

              return (
                <li key={`${field.label}-${idx}`}>
                  {field.type === 'link' && safeUrl ? (
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2.5 transition-colors hover:border-[var(--accent-teal)] hover:bg-[var(--surface-hover)]"
                    >
                      {rowContent}
                    </a>
                  ) : (
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2.5">
                      {rowContent}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Prerequisites */}
      {prereqItems.length > 0 && (
        <div className="mb-6 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
            <GitBranch className="h-3.5 w-3.5 text-[var(--accent-teal)]" />
            Recommended Prerequisites
          </div>
          <div className="flex flex-wrap gap-1.5">
            {prereqItems.map((item) => {
              const title = getCourseItemTitle(item);
              const isLeafChapterItem =
                item.kind === 'chapter' && isLeafChapter(item.chapter);
              const isTrackableSupplement =
                item.kind === 'supplement' &&
                isSupplementTrackable(item.node) &&
                !(
                  item.placement === 'spine' &&
                  'children' in item.node &&
                  (item.node.children?.length ?? 0) > 0
                );
              const chapterStats =
                item.kind === 'chapter' && !isLeafChapterItem
                  ? computeChapterStats(item.chapter, statuses)
                  : null;
              const isSkipped =
                item.kind === 'lesson' || isLeafChapterItem || isTrackableSupplement
                  ? statuses[item.id] === 'skipped'
                  : Boolean(
                      chapterStats &&
                        chapterStats.total > 0 &&
                        chapterStats.skipped === chapterStats.total
                    );
              const isDone =
                item.kind === 'lesson' || isLeafChapterItem || isTrackableSupplement
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
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:border-[var(--accent-teal)] ${
                    isDone
                      ? 'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]'
                      : isSkipped
                        ? 'border-[var(--status-skipped-border)] bg-[var(--status-skipped-bg)] text-[var(--status-skipped-text)]'
                        : 'border-[var(--border-strong)] bg-[var(--surface-1)] text-[var(--text-primary)]'
                  }`}
                >
                  {isDone && (
                    <CheckCircle2 className="h-3 w-3 text-[var(--accent-done)]" />
                  )}
                  {isSkipped && <Ban className="h-3 w-3 text-[var(--status-skipped-text)]" />}
                  {title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Panel: Materials / Notes */}
      {activeTab === 'materials' ? (
        (!isSpineParent || resources.length > 0) && (
          <div className="mb-6">
            <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-[var(--accent-teal)]" />
              Supplement Materials &amp; Resources
            </h3>
            <MaterialList
              resources={resources}
              emptyText="No materials attached to this supplement yet."
              courseSlug={courseSlug ?? course.slug}
              itemId={node.id}
              onOpenMaterialViewer={onOpenMaterialViewer}
              onOpenAssessment={onOpenAssessment}
            />
          </div>
        )
      ) : (
        <div className="mb-6 rounded-lg border border-[var(--border-subtle)] border-l-4 border-l-[var(--accent-teal)] bg-[var(--surface-2)] p-4">
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-[var(--text-secondary)] uppercase">
            Supplement Notes
          </h3>
          {node.notes ? (
            <div className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-primary)]">
              {node.notes}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              No study notes added for this supplement yet.
            </p>
          )}
        </div>
      )}

      {/* Child Supplements (for spine supplements) */}
      {isSpineParent && (
        <div>
          <h3 className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
            <Layers className="h-3.5 w-3.5 shrink-0 text-[var(--accent-teal)]" />
            Child Supplements ({spineChildren.length})
          </h3>
          <ul className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]">
            {spineChildren.map((child) => {
              const childTrackable = isSupplementTrackable(child);
              const childStatus = childTrackable ? (statuses[child.id] ?? 'todo') : 'todo';
              return (
                <li
                  key={child.id}
                  className="flex items-center gap-2 px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
                >
                  {childTrackable ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleItemDone?.(child.id);
                      }}
                      aria-label={`Toggle done for ${child.title}`}
                      className="shrink-0 rounded p-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--accent-done)]"
                    >
                      {childStatus === 'done' ? (
                        <CheckCircle2 className="h-4 w-4 text-[var(--accent-done)]" />
                      ) : childStatus === 'learning' ? (
                        <BookOpen className="h-4 w-4 text-[var(--status-learning-icon)]" />
                      ) : childStatus === 'skipped' ? (
                        <Ban className="h-4 w-4 text-[var(--status-skipped-text)]" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <Sparkles className="h-4 w-4 shrink-0 text-[var(--accent-teal)]" />
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectItem(child.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-medium ${
                          childTrackable &&
                          (childStatus === 'done' || childStatus === 'skipped')
                            ? 'text-[var(--text-muted)] line-through'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {child.title}
                      </div>
                      <div className="truncate text-xs text-[var(--text-muted)]">
                        {child.summary}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
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
