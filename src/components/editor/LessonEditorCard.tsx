import { useId } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { PrerequisitePicker } from '@/components/editor/PrerequisitePicker';
import { MaterialsEditor } from '@/components/editor/MaterialsEditor';
import { ReorderButtons } from '@/components/editor/ReorderButtons';
import { SupplementEditorCard } from '@/components/editor/SupplementEditorCard';
import { useStickyHeader } from '@/hooks/useStickyHeader';
import {
  deriveLessonSupplementId,
  formatLessonPositionTag,
  formatLessonSupplementTag,
} from '@/lib/courseIds';
import type { Chapter, SpineSupplement, SubLesson, Supplement } from '@/types/course';

interface LessonEditorCardProps {
  lesson: SubLesson;
  lessonIndex: number;
  totalLessons: number;
  chapterOrder: number;
  chapterId: string;
  derivedLessonId: string;
  derivedSupplementIds?: string[];
  courseCode: string;
  allChapters: Chapter[];
  allSpineSupplements?: SpineSupplement[];
  isExpanded: boolean;
  expandedSupplements?: Record<string, boolean>;
  errorPrefix?: string;
  fieldErrors?: Record<string, string>;
  onToggleExpand: () => void;
  onToggleSupplementExpand?: (nodeId: string) => void;
  onUpdate: (updater: (lesson: SubLesson) => SubLesson) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onTogglePrerequisite: (prereqId: string) => void;
  onAddSupplement?: () => void;
  onUpdateSupplement?: (cnIdx: number, updater: (cn: Supplement) => Supplement) => void;
  onRemoveSupplement?: (cnIdx: number) => void;
}

export function LessonEditorCard({
  lesson,
  lessonIndex,
  totalLessons,
  chapterOrder,
  chapterId,
  derivedLessonId,
  derivedSupplementIds = [],
  courseCode,
  allChapters,
  allSpineSupplements = [],
  isExpanded,
  expandedSupplements = {},
  errorPrefix,
  fieldErrors,
  onToggleExpand,
  onToggleSupplementExpand,
  onUpdate,
  onMove,
  onRemove,
  onTogglePrerequisite,
  onAddSupplement,
  onUpdateSupplement,
  onRemoveSupplement,
}: LessonEditorCardProps) {
  const titleErrorKey = errorPrefix ? `${errorPrefix}.title` : undefined;
  const summaryErrorKey = errorPrefix ? `${errorPrefix}.summary` : undefined;
  const titleError = titleErrorKey ? fieldErrors?.[titleErrorKey] : undefined;
  const summaryError = summaryErrorKey ? fieldErrors?.[summaryErrorKey] : undefined;
  const { headerRef, isStuck } = useStickyHeader(isExpanded, 168);
  const titleId = useId();
  const sideId = useId();
  const summaryId = useId();
  const notesId = useId();

  const headerCornerClass = isExpanded
    ? isStuck
      ? 'sticky top-[var(--editor-lesson-sticky-top,168px)] z-10 rounded-t-none'
      : 'sticky top-[var(--editor-lesson-sticky-top,168px)] z-10 rounded-t-md'
    : 'rounded-md';

  return (
    <div data-edit-lesson={lesson.id} className="editor-entry-peach scroll-mt-48">
      {/* Lesson Header Row — sticky below chapter header when expanded; identical colors in collapsed & expanded states */}
      <div
        ref={headerRef}
        data-sticky-header="lesson"
        data-stuck={isStuck ? 'true' : 'false'}
        onClick={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('button, a, input, select, textarea, [data-no-row-toggle]')) {
            return;
          }
          onToggleExpand();
        }}
        className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 border border-[var(--border-subtle)] border-l-4 border-l-[var(--tag-peach-border)] bg-[var(--surface-2)] px-3 py-2 ${headerCornerClass}`}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} lesson ${formatLessonPositionTag(chapterOrder, lessonIndex + 1)} ${lesson.title || 'Untitled Lesson'}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          )}
          <span className="shrink-0 rounded border border-[var(--tag-peach-border)] bg-[var(--tag-peach-bg)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--tag-peach-text)]">
            {formatLessonPositionTag(chapterOrder, lessonIndex + 1)}
          </span>
          <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {lesson.title || 'Untitled Lesson'}
          </span>
          <span className="hidden rounded bg-[var(--surface-inset)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)] sm:inline">
            {derivedLessonId}
          </span>
          <span
            data-testid="lesson-resource-count-tag"
            className="shrink-0 rounded border border-[var(--tag-peach-border)] bg-[var(--tag-peach-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--tag-peach-text)]"
          >
            {lesson.resources.length} {lesson.resources.length === 1 ? 'material' : 'materials'}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <ReorderButtons
            canMoveUp={lessonIndex > 0}
            canMoveDown={lessonIndex < totalLessons - 1}
            onMove={onMove}
            upLabel="Move lesson up"
            downLabel="Move lesson down"
          />
          <button
            type="button"
            onClick={onRemove}
            title="Delete sub-lesson"
            aria-label={`Delete ${lesson.title}`}
            className="rounded border border-[var(--status-danger-border)] bg-[var(--surface-1)] p-1 text-[var(--status-danger-text)] transition-colors hover:border-[var(--danger-solid-bg)] hover:bg-[var(--danger-solid-bg)] hover:text-white focus-visible:border-[var(--danger-solid-bg)] focus-visible:bg-[var(--danger-solid-bg)] focus-visible:text-white focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Expanded Lesson Body */}
      {isExpanded && (
        <div className="space-y-3 rounded-b-md border border-t-0 border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor={titleId} className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                Sub-Lesson Title *
              </label>
              <input
                id={titleId}
                type="text"
                value={lesson.title}
                onChange={(e) =>
                  onUpdate((l) => ({
                    ...l,
                    title: e.target.value,
                  }))
                }
                placeholder="e.g. Course Introduction"
                aria-label="Sub-Lesson Title"
                aria-invalid={Boolean(titleError)}
                data-error-key={titleErrorKey}
                data-field-error={titleError ? 'true' : undefined}
                className={`w-full rounded-md border bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none ${
                  titleError
                    ? 'border-[var(--status-danger-border)] ring-1 ring-[var(--status-danger-border)]/30'
                    : 'border-[var(--border-strong)]'
                }`}
              />
              {titleError && (
                <p role="alert" className="mt-1 text-[11px] text-[var(--status-danger-text)]">
                  {titleError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={sideId} className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                Branch Side
              </label>
              <select
                id={sideId}
                value={lesson.side ?? ''}
                onChange={(e) =>
                  onUpdate((l) => ({
                    ...l,
                    side:
                      e.target.value === 'left' || e.target.value === 'right'
                        ? e.target.value
                        : undefined,
                  }))
                }
                aria-label="Branch Side"
                className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none"
              >
                <option value="">Auto</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor={summaryId} className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Summary *
            </label>
            <textarea
              id={summaryId}
              rows={2}
              value={lesson.summary}
              onChange={(e) =>
                onUpdate((l) => ({
                  ...l,
                  summary: e.target.value,
                }))
              }
              placeholder="Brief summary of what students will learn..."
              aria-label="Lesson Summary"
              aria-invalid={Boolean(summaryError)}
              data-error-key={summaryErrorKey}
              data-field-error={summaryError ? 'true' : undefined}
              className={`w-full rounded-md border bg-[var(--surface-inset)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none ${
                summaryError
                  ? 'border-[var(--status-danger-border)] ring-1 ring-[var(--status-danger-border)]/30'
                  : 'border-[var(--border-strong)]'
              }`}
            />
            {summaryError && (
              <p role="alert" className="mt-1 text-[11px] text-[var(--status-danger-text)]">
                {summaryError}
              </p>
            )}
          </div>

          <div>
            <label htmlFor={notesId} className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
              Study Notes (optional)
            </label>
            <textarea
              id={notesId}
              rows={2}
              value={lesson.notes ?? ''}
              onChange={(e) =>
                onUpdate((l) => ({
                  ...l,
                  notes: e.target.value || undefined,
                }))
              }
              placeholder="Key takeaways, formulas, or exam tips..."
              aria-label="Lesson Notes"
              className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none"
            />
          </div>

          <PrerequisitePicker
            chapters={allChapters}
            spineSupplements={allSpineSupplements}
            currentId={lesson.id}
            currentKind="lesson"
            parentChapterId={chapterId}
            selectedIds={lesson.prerequisites ?? []}
            onToggle={onTogglePrerequisite}
          />

          <MaterialsEditor
            resources={lesson.resources}
            courseCode={courseCode}
            errorPrefix={errorPrefix ? `${errorPrefix}.resources` : undefined}
            fieldErrors={fieldErrors}
            onChange={(nextResources) =>
              onUpdate((l) => ({
                ...l,
                resources: nextResources,
              }))
            }
          />

          {/* Lesson Child Supplements */}
          {onAddSupplement && (
            <div className="border-t border-[var(--border-subtle)] pt-3">
              {(lesson.supplements?.length ?? 0) > 0 && (
                <div className="mb-2.5 space-y-2">
                  {lesson.supplements!.map((cn, cnIdx) => {
                    const effectiveLessonSide =
                      lesson.side ?? (lessonIndex % 2 === 0 ? 'left' : 'right');
                    const disabledHorizontalSide =
                      effectiveLessonSide === 'left' ? 'right' : 'left';
                    return (
                      <SupplementEditorCard
                        key={cn.id}
                        node={cn}
                        placement="lesson"
                        positionTag={formatLessonSupplementTag(
                          chapterOrder,
                          lessonIndex + 1,
                          cnIdx + 1
                        )}
                        derivedId={
                          derivedSupplementIds[cnIdx] ??
                          deriveLessonSupplementId(
                            courseCode,
                            chapterOrder,
                            lessonIndex + 1,
                            cnIdx + 1,
                            cn.title || `Child Supplement ${cnIdx + 1}`
                          )
                        }
                        courseCode={courseCode}
                        allChapters={allChapters}
                        allSpineSupplements={allSpineSupplements}
                        isExpanded={Boolean(expandedSupplements[cn.id])}
                        allowUpDown={true}
                        disabledHorizontalSide={disabledHorizontalSide}
                        errorPrefix={
                          errorPrefix ? `${errorPrefix}.supplements.${cnIdx}` : undefined
                        }
                        fieldErrors={fieldErrors}
                        onToggleExpand={() => onToggleSupplementExpand?.(cn.id)}
                        onUpdate={(updater) =>
                          onUpdateSupplement?.(cnIdx, (prev) => updater(prev) as Supplement)
                        }
                        onRemove={() => onRemoveSupplement?.(cnIdx)}
                      />
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={onAddSupplement}
                className="dashed-box inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--tag-teal-text)] transition-colors hover:bg-[var(--tag-teal-bg)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Child Supplement
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
