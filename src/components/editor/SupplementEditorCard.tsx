import { useId } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { DateFieldInput } from '@/components/editor/DateFieldInput';
import { MaterialsEditor } from '@/components/editor/MaterialsEditor';
import { PrerequisitePicker } from '@/components/editor/PrerequisitePicker';
import { ReorderButtons } from '@/components/editor/ReorderButtons';
import { useStickyHeader } from '@/hooks/useStickyHeader';
import {
  deriveSpineChildSupplementId,
  formatSpineChildSupplementTag,
} from '@/lib/courseIds';
import type {
  Chapter,
  CustomField,
  CustomFieldType,
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

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'link', label: 'Link' },
  { value: 'badge', label: 'Badge' },
  { value: 'date', label: 'Date' },
];

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
  const { headerRef, isStuck } = useStickyHeader(isExpanded, isSpine ? 120 : 168);

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

  const moveField = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= customFields.length) return;
    const next = [...customFields];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateFields(next);
  };

  const stickyTopClass = isSpine
    ? 'top-[var(--editor-chapter-sticky-top,120px)] z-20'
    : 'top-[var(--editor-lesson-sticky-top,168px)] z-10';

  const headerCornerClass = isExpanded
    ? isStuck
      ? `sticky ${stickyTopClass} rounded-t-none border-b`
      : `sticky ${stickyTopClass} ${isSpine ? 'rounded-t-lg' : 'rounded-t-md'} border-b`
    : isSpine
      ? 'rounded-lg'
      : 'rounded-md';

  return (
    <div
      data-edit-supplement={node.id}
      className={`editor-entry-teal ${isSpine ? 'scroll-mt-36 rounded-lg' : 'scroll-mt-48 rounded-md'} border border-[var(--border-subtle)] bg-[var(--surface-1)]`}
    >
      <div
        ref={headerRef}
        data-sticky-header={isSpine ? 'supplement-spine' : 'supplement-child'}
        data-stuck={isStuck ? 'true' : 'false'}
        onClick={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('button, a, input, select, textarea, [data-no-row-toggle]')) {
            return;
          }
          onToggleExpand();
        }}
        className={`flex cursor-pointer flex-wrap items-center justify-between gap-2 border-[var(--border-subtle)] border-l-4 border-l-[var(--tag-teal-border)] bg-[var(--surface-2)] px-3 py-2 ${headerCornerClass}`}
      >
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} supplement ${positionTag} ${node.title || 'Untitled Supplement'}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          )}
          <span className="shrink-0 rounded border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[var(--tag-teal-text)]">
            {positionTag}
          </span>
          <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
            {node.title || 'Untitled Supplement'}
          </span>
          <span className="hidden rounded bg-[var(--surface-inset)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)] sm:inline">
            {derivedId}
          </span>
          <span className="shrink-0 rounded border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--tag-teal-text)]">
            {resources.length} {resources.length === 1 ? 'material' : 'materials'}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {onMove && (
            <ReorderButtons
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onMove={onMove}
              upLabel="Move supplement up"
              downLabel="Move supplement down"
            />
          )}
          <button
            type="button"
            onClick={onRemove}
            title="Delete supplement"
            aria-label={`Delete ${node.title}`}
            className="rounded border border-[var(--status-danger-border)] bg-[var(--surface-1)] p-1 text-[var(--status-danger-text)] transition-colors hover:border-[var(--danger-solid-bg)] hover:bg-[var(--danger-solid-bg)] hover:text-white"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 p-3.5">
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

          {/* Custom Fields Editor (styled similarly to MaterialsEditor, without a left icon) */}
          <div className="space-y-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                Custom Fields ({customFields.length})
              </span>
              <button
                type="button"
                onClick={() =>
                  updateFields([
                    ...customFields,
                    { label: '', value: '', type: 'text' },
                  ])
                }
                className="inline-flex items-center gap-1 rounded border border-[var(--tag-teal-border)] bg-[var(--tag-teal-bg)] px-2 py-0.5 text-[11px] font-semibold text-[var(--tag-teal-text)] hover:opacity-90"
              >
                <Plus className="h-3 w-3" />
                Add Field
              </button>
            </div>
            {customFields.length > 0 && (
              <div className="space-y-2">
                {customFields.map((field, fIdx) => {
                  const labelErrorKey = errorPrefix
                    ? `${errorPrefix}.customFields.${fIdx}.label`
                    : undefined;
                  const valueErrorKey = errorPrefix
                    ? `${errorPrefix}.customFields.${fIdx}.value`
                    : undefined;
                  const labelError = labelErrorKey ? fieldErrors?.[labelErrorKey] : undefined;
                  const valueError = valueErrorKey ? fieldErrors?.[valueErrorKey] : undefined;

                  return (
                    <div
                      key={fIdx}
                      className="space-y-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] p-2.5"
                    >
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-start">
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => {
                              const next = customFields.map((f, idx) =>
                                idx === fIdx ? { ...f, label: e.target.value } : f
                              );
                              updateFields(next);
                            }}
                            placeholder="Label (e.g. Weight)"
                            aria-label={`Custom field ${fIdx + 1} label`}
                            aria-invalid={Boolean(labelError)}
                            data-error-key={labelErrorKey}
                            data-field-error={labelError ? 'true' : undefined}
                            className={`w-full rounded border bg-[var(--surface-inset)] px-2 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none ${
                              labelError
                                ? 'border-[var(--status-danger-border)] ring-1 ring-[var(--status-danger-border)]/30'
                                : 'border-[var(--border-strong)]'
                            }`}
                          />
                          {labelError && (
                            <p
                              role="alert"
                              className="mt-1 text-[11px] text-[var(--status-danger-text)]"
                            >
                              {labelError}
                            </p>
                          )}
                        </div>

                        <div className="sm:col-span-2">
                          <select
                            value={field.type}
                            onChange={(e) => {
                              const nextType = e.target.value as CustomFieldType;
                              const next = customFields.map((f, idx) =>
                                idx === fIdx ? { ...f, type: nextType } : f
                              );
                              updateFields(next);
                            }}
                            aria-label={`Custom field ${fIdx + 1} type`}
                            className="w-full rounded border border-[var(--border-strong)] bg-[var(--surface-inset)] px-2 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none"
                          >
                            {FIELD_TYPES.map((ft) => (
                              <option key={ft.value} value={ft.value}>
                                {ft.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="sm:col-span-4">
                          {field.type === 'date' ? (
                            <DateFieldInput
                              value={field.value}
                              onChange={(nextValue) => {
                                const next = customFields.map((f, idx) =>
                                  idx === fIdx ? { ...f, value: nextValue } : f
                                );
                                updateFields(next);
                              }}
                              ariaLabelPrefix={`Custom field ${fIdx + 1}`}
                              hasError={Boolean(valueError)}
                              errorKey={valueErrorKey}
                            />
                          ) : (
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) => {
                                const next = customFields.map((f, idx) =>
                                  idx === fIdx ? { ...f, value: e.target.value } : f
                                );
                                updateFields(next);
                              }}
                              placeholder={field.type === 'link' ? 'https://...' : 'Value'}
                              aria-label={`Custom field ${fIdx + 1} value`}
                              aria-invalid={Boolean(valueError)}
                              data-error-key={valueErrorKey}
                              data-field-error={valueError ? 'true' : undefined}
                              className={`w-full rounded border bg-[var(--surface-inset)] px-2 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none ${
                                valueError
                                  ? 'border-[var(--status-danger-border)] ring-1 ring-[var(--status-danger-border)]/30'
                                  : 'border-[var(--border-strong)]'
                              }`}
                            />
                          )}
                          {valueError && (
                            <p
                              role="alert"
                              className="mt-1 text-[11px] text-[var(--status-danger-text)]"
                            >
                              {valueError}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-end gap-1 sm:col-span-2">
                          <ReorderButtons
                            canMoveUp={fIdx > 0}
                            canMoveDown={fIdx < customFields.length - 1}
                            onMove={(dir) => moveField(fIdx, dir)}
                            upLabel={`Move custom field ${fIdx + 1} up`}
                            downLabel={`Move custom field ${fIdx + 1} down`}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              updateFields(customFields.filter((_, idx) => idx !== fIdx))
                            }
                            aria-label={`Remove custom field ${fIdx + 1}`}
                            className="inline-flex items-center justify-center rounded border border-[var(--status-danger-border)] bg-[var(--surface-1)] p-1 text-[var(--status-danger-text)] hover:bg-[var(--danger-solid-bg)] hover:text-white"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                className="dashed-box inline-flex items-center gap-1.5 rounded-md bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--tag-teal-text)] transition-colors hover:bg-[var(--tag-teal-bg)]"
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
