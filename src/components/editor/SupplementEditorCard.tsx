import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Plus } from 'lucide-react';
import { CustomFieldsEditor } from '@/components/editor/CustomFieldsEditor';
import { EditorCardHeader } from '@/components/editor/EditorCardHeader';
import { MaterialsEditor } from '@/components/editor/MaterialsEditor';
import { PrerequisitePicker } from '@/components/editor/PrerequisitePicker';
import { useStickyHeader } from '@/hooks/useStickyHeader';
import {
  deriveSpineChildSupplementId,
  formatSpineChildSupplementTag,
} from '@/lib/courseIds';
import type {
  Chapter,
  CustomField,
  SpineSupplement,
  Supplement,
  SupplementSide,
} from '@/types/course';

interface SupplementEditorCardProps {
  node: Supplement | SpineSupplement;
  placement: 'spine' | 'spine-child' | 'chapter' | 'lesson';
  positionTag: string;
  derivedId: string;
  courseCode: string;
  allChapters: Chapter[];
  allSpineSupplements?: SpineSupplement[];
  isExpanded: boolean;
  allowUpDown?: boolean;
  disabledHorizontalSide?: 'left' | 'right';
  spineOrder?: number;
  derivedChildIds?: string[];
  expandedChildIds?: Record<string, boolean>;
  onToggleChildExpand?: (childId: string) => void;
  errorPrefix?: string;
  fieldErrors?: Record<string, string>;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onToggleExpand: () => void;
  onUpdate: (updater: (node: Supplement | SpineSupplement) => Supplement | SpineSupplement) => void;
  onMove?: (direction: -1 | 1) => void;
  onRemove: () => void;
  onAddChild?: () => void;
  onUpdateChild?: (childIdx: number, updater: (child: Supplement) => Supplement) => void;
  onMoveChild?: (childIdx: number, direction: -1 | 1) => void;
  onRemoveChild?: (childIdx: number) => void;
}

export function SupplementEditorCard({
  node,
  placement,
  positionTag,
  derivedId,
  courseCode,
  allChapters,
  allSpineSupplements = [],
  isExpanded,
  allowUpDown = false,
  disabledHorizontalSide,
  spineOrder,
  derivedChildIds = [],
  expandedChildIds = {},
  onToggleChildExpand,
  errorPrefix,
  fieldErrors,
  canMoveUp = false,
  canMoveDown = false,
  onToggleExpand,
  onUpdate,
  onMove,
  onRemove,
  onAddChild,
  onUpdateChild,
  onMoveChild,
  onRemoveChild,
}: SupplementEditorCardProps) {
  const titleId = useId();
  const sideId = useId();
  const afterId = useId();
  const summaryId = useId();
  const notesId = useId();
  const trackableId = useId();

  const isSpine = placement === 'spine';
  const [headerHeight, setHeaderHeight] = useState<number>(48);
  const { headerRef, isStuck } = useStickyHeader(
    isExpanded,
    isSpine ? 120 : placement === 'lesson' ? 210 : 168
  );

  useEffect(() => {
    if (!isSpine) return;
    const el = headerRef.current;
    if (!el) return;

    const measureHeader = () => {
      const rectHeight = el.getBoundingClientRect().height;
      const h = rectHeight > 0 ? rectHeight : el.offsetHeight;
      if (h > 0) {
        setHeaderHeight(h);
      }
    };

    measureHeader();

    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(measureHeader);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [isSpine, isExpanded, node.title, derivedId, node.resources?.length, headerRef]);

  const titleErrorKey = errorPrefix ? `${errorPrefix}.title` : undefined;
  const summaryErrorKey = errorPrefix ? `${errorPrefix}.summary` : undefined;
  const titleError = titleErrorKey ? fieldErrors?.[titleErrorKey] : undefined;
  const summaryError = summaryErrorKey ? fieldErrors?.[summaryErrorKey] : undefined;

  const spineNode = isSpine ? (node as SpineSupplement) : null;
  const children = spineNode?.children ?? [];
  const resources = node.resources ?? [];
  const customFields = node.customFields ?? [];
  const trackable = node.trackable !== false;

  const updateFields = (nextFields: CustomField[]) => {
    onUpdate((prev) => ({
      ...prev,
      customFields: nextFields.length > 0 ? nextFields : undefined,
    }));
  };

  const stickyTopClass = isSpine
    ? 'top-[var(--editor-chapter-sticky-top,120px)] z-20'
    : placement === 'lesson'
      ? 'top-[var(--editor-lesson-supplement-sticky-top,210px)] z-[5]'
      : 'top-[var(--editor-lesson-sticky-top,168px)] z-10';

  return (
    <div
      data-edit-supplement={node.id}
      style={
        isSpine
          ? ({
              '--editor-supplement-header-height': `${headerHeight}px`,
              '--editor-lesson-sticky-top':
                'calc(var(--editor-chapter-sticky-top, 120px) + var(--editor-supplement-header-height, 48px))',
            } as CSSProperties)
          : undefined
      }
      className={`editor-entry-teal ${
        isSpine
          ? 'scroll-mt-[var(--editor-chapter-sticky-top,120px)] rounded-lg border border-slate-200 bg-white shadow-xs dark:border-slate-700/80 dark:bg-[#121926]'
          : placement === 'lesson'
            ? 'scroll-mt-[var(--editor-lesson-supplement-sticky-top,210px)]'
            : 'scroll-mt-[var(--editor-lesson-sticky-top,168px)]'
      }`}
    >
      <EditorCardHeader
        ref={headerRef}
        level={isSpine ? 'primary' : 'nested'}
        accent="teal"
        dataStickyHeader={isSpine ? 'supplement-spine' : 'supplement-child'}
        isExpanded={isExpanded}
        isStuck={isStuck}
        stickyClassName={stickyTopClass}
        positionTag={positionTag}
        title={node.title || 'Untitled Supplement'}
        derivedId={derivedId}
        ariaLabel={`${isExpanded ? 'Collapse' : 'Expand'} supplement ${positionTag} ${node.title || 'Untitled Supplement'}`}
        onToggleExpand={onToggleExpand}
        extraTags={
          <span className="shrink-0 rounded border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--tag-teal-text)]">
            {resources.length} {resources.length === 1 ? 'material' : 'materials'}
          </span>
        }
        reorderProps={
          onMove
            ? {
                canMoveUp,
                canMoveDown,
                onMove,
                upLabel: 'Move supplement up',
                downLabel: 'Move supplement down',
              }
            : undefined
        }
        deleteProps={{
          onDelete: onRemove,
          title: 'Delete supplement',
          ariaLabel: `Delete ${node.title}`,
        }}
      />

      {isExpanded && (
        <div
          className={
            isSpine
              ? 'space-y-4 rounded-b-lg p-4'
              : 'space-y-3 rounded-b-md border border-t-0 border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5'
          }
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor={titleId}
                className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
              >
                Supplement Title *
              </label>
              <input
                id={titleId}
                type="text"
                value={node.title}
                onChange={(e) =>
                  onUpdate((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                placeholder="e.g. Midterm Checkpoint"
                aria-label="Supplement Title"
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

            {isSpine && spineNode ? (
              <div>
                <label
                  htmlFor={afterId}
                  className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
                >
                  Spine Position
                </label>
                <select
                  id={afterId}
                  value={spineNode.afterChapterOrder}
                  onChange={(e) =>
                    onUpdate((prev) => ({
                      ...prev,
                      afterChapterOrder: Number(e.target.value),
                    }))
                  }
                  aria-label="Spine Position"
                  className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none"
                >
                  <option value={0}>Before Chapter 1</option>
                  {allChapters
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((ch) => (
                      <option key={ch.id} value={ch.order}>
                        After Ch{ch.order}: {ch.title || 'Untitled'}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div>
                <label
                  htmlFor={sideId}
                  className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
                >
                  Branch Side
                </label>
                <select
                  id={sideId}
                  value={(node.side ?? 'auto') as SupplementSide | 'auto'}
                  onChange={(e) => {
                    const val = e.target.value as SupplementSide | 'auto';
                    onUpdate((prev) => ({
                      ...prev,
                      side: val === 'auto' ? undefined : val,
                    }));
                  }}
                  aria-label="Branch Side"
                  className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none"
                >
                  <option value="auto">Auto</option>
                  <option
                    value="left"
                    disabled={disabledHorizontalSide === 'left'}
                    title={
                      disabledHorizontalSide === 'left'
                        ? 'Disabled: left branch collides with the central chapter spine'
                        : undefined
                    }
                  >
                    Left{disabledHorizontalSide === 'left' ? ' (Collides with spine)' : ''}
                  </option>
                  <option
                    value="right"
                    disabled={disabledHorizontalSide === 'right'}
                    title={
                      disabledHorizontalSide === 'right'
                        ? 'Disabled: right branch collides with the central chapter spine'
                        : undefined
                    }
                  >
                    Right{disabledHorizontalSide === 'right' ? ' (Collides with spine)' : ''}
                  </option>
                  {allowUpDown && <option value="up">Up</option>}
                  {allowUpDown && <option value="down">Down</option>}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label
              htmlFor={trackableId}
              className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[var(--text-secondary)]"
            >
              <input
                id={trackableId}
                type="checkbox"
                checked={trackable}
                onChange={(e) =>
                  onUpdate((prev) => ({
                    ...prev,
                    trackable: e.target.checked ? undefined : false,
                  }))
                }
                className="h-3.5 w-3.5 rounded border-[var(--border-strong)] accent-[var(--accent-teal)]"
              />
              Trackable in course progress
            </label>
          </div>

          <div>
            <label
              htmlFor={summaryId}
              className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
            >
              Summary *
            </label>
            <textarea
              id={summaryId}
              rows={2}
              value={node.summary}
              onChange={(e) =>
                onUpdate((prev) => ({
                  ...prev,
                  summary: e.target.value,
                }))
              }
              placeholder="Brief summary of this supplement..."
              aria-label="Supplement Summary"
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
            <label
              htmlFor={notesId}
              className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
            >
              Study Notes (optional)
            </label>
            <textarea
              id={notesId}
              rows={2}
              value={node.notes ?? ''}
              onChange={(e) =>
                onUpdate((prev) => ({
                  ...prev,
                  notes: e.target.value || undefined,
                }))
              }
              placeholder="Optional notes, rubric details, or reminders..."
              aria-label="Supplement Notes"
              className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none"
            />
          </div>

          <PrerequisitePicker
            chapters={allChapters}
            spineSupplements={allSpineSupplements}
            currentId={node.id}
            currentKind="supplement"
            selectedIds={node.prerequisites ?? []}
            onToggle={(prereqId) => {
              onUpdate((prev) => {
                const current = prev.prerequisites ?? [];
                const exists = current.includes(prereqId);
                const next = exists
                  ? current.filter((id) => id !== prereqId)
                  : [...current, prereqId];
                return { ...prev, prerequisites: next.length > 0 ? next : undefined };
              });
            }}
          />

          <CustomFieldsEditor
            customFields={customFields}
            onChange={updateFields}
            errorPrefix={errorPrefix}
            fieldErrors={fieldErrors}
          />

          <MaterialsEditor
            resources={resources}
            courseCode={courseCode}
            errorPrefix={errorPrefix ? `${errorPrefix}.resources` : undefined}
            fieldErrors={fieldErrors}
            onChange={(nextResources) =>
              onUpdate((prev) => ({
                ...prev,
                resources: nextResources,
              }))
            }
          />

          {/* Nested Child Supplements for Spine Supplements */}
          {isSpine && onAddChild && (
            <div className="border-t border-[var(--border-subtle)] pt-3">
              {children.length > 0 && (
                <div className="mb-3 space-y-2">
                  {children.map((child, childIdx) => (
                    <SupplementEditorCard
                      key={child.id}
                      node={child}
                      placement="spine-child"
                      positionTag={formatSpineChildSupplementTag(
                        spineOrder ?? 1,
                        childIdx + 1
                      )}
                      derivedId={
                        derivedChildIds[childIdx] ??
                        deriveSpineChildSupplementId(
                          courseCode,
                          spineOrder ?? 1,
                          childIdx + 1,
                          child.title || `Child Supplement ${childIdx + 1}`
                        )
                      }
                      courseCode={courseCode}
                      allChapters={allChapters}
                      allSpineSupplements={allSpineSupplements}
                      isExpanded={Boolean(expandedChildIds[child.id])}
                      errorPrefix={errorPrefix ? `${errorPrefix}.children.${childIdx}` : undefined}
                      fieldErrors={fieldErrors}
                      canMoveUp={childIdx > 0}
                      canMoveDown={childIdx < children.length - 1}
                      onToggleExpand={() => onToggleChildExpand?.(child.id)}
                      onUpdate={(updater) =>
                        onUpdateChild?.(childIdx, (c) => updater(c) as Supplement)
                      }
                      onMove={
                        onMoveChild ? (dir) => onMoveChild(childIdx, dir) : undefined
                      }
                      onRemove={() => onRemoveChild?.(childIdx)}
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={onAddChild}
                className="dashed-box inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--tag-teal-text)] transition-colors hover:border-[var(--tag-teal-border)] hover:bg-[var(--tag-teal-bg)]"
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
