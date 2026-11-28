import { Plus, Trash2 } from 'lucide-react';
import { DateFieldInput } from '@/components/editor/DateFieldInput';
import { ReorderButtons } from '@/components/editor/ReorderButtons';
import type { CustomField, CustomFieldType } from '@/types/course';

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'link', label: 'Link' },
  { value: 'badge', label: 'Badge' },
  { value: 'date', label: 'Date' },
];

interface CustomFieldsEditorProps {
  customFields: CustomField[];
  onChange: (nextFields: CustomField[]) => void;
  errorPrefix?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Editable list of typed supplement custom fields matching MaterialsEditor's
 * borderless section header, neutral add button, and grouped row container.
 */
export function CustomFieldsEditor({
  customFields,
  onChange,
  errorPrefix,
  fieldErrors,
}: CustomFieldsEditorProps) {
  const moveField = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= customFields.length) return;
    const next = [...customFields];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div
      data-testid="custom-fields-section"
      className="border-t border-slate-200 pt-2.5 dark:border-slate-700/80"
    >
      <div
        className={`flex items-center justify-between gap-2 ${
          customFields.length > 0 ? 'mb-2' : ''
        }`}
      >
        <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300">
          Custom Fields ({customFields.length})
        </h3>
        <button
          type="button"
          onClick={() =>
            onChange([...customFields, { label: '', value: '', type: 'text' }])
          }
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <Plus className="h-3 w-3" />
          Add Field
        </button>
      </div>

      {customFields.length > 0 && (
        <div
          data-testid="editor-custom-fields-container"
          className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700/80 dark:bg-[#121926]"
        >
          <div className="divide-y divide-slate-200 dark:divide-slate-700/80">
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
                <div key={fIdx} className="space-y-1.5 p-2.5">
                  <div className="grid grid-cols-12 items-start gap-2">
                    {/* Mobile Row 1: Category dropdown spans remaining space beside Toolbar; Desktop: sm:contents */}
                    <div className="order-1 col-span-12 flex items-center gap-2 sm:contents">
                      {/* Category dropdown: 1st on both mobile and desktop */}
                      <div className="min-w-0 flex-1 sm:order-1 sm:col-span-2">
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const nextType = e.target.value as CustomFieldType;
                            const next = customFields.map((f, idx) =>
                              idx === fIdx ? { ...f, type: nextType } : f
                            );
                            onChange(next);
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

                      {/* Toolbar: beside category on mobile, end on desktop */}
                      <div className="flex shrink-0 items-center justify-end gap-1 sm:order-4 sm:col-span-2">
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
                            onChange(customFields.filter((_, idx) => idx !== fIdx))
                          }
                          aria-label={`Remove custom field ${fIdx + 1}`}
                          className="inline-flex items-center justify-center rounded border border-[var(--status-danger-border)] bg-[var(--surface-1)] p-1 text-[var(--status-danger-text)] transition-colors hover:border-[var(--danger-solid-bg)] hover:bg-[var(--danger-solid-bg)] hover:text-white"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Label: beside Value on mobile, 2nd on desktop */}
                    <div className="order-3 col-span-6 sm:order-2 sm:col-span-4">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => {
                          const next = customFields.map((f, idx) =>
                            idx === fIdx ? { ...f, label: e.target.value } : f
                          );
                          onChange(next);
                        }}
                        placeholder="Label"
                        aria-label={`Custom field ${fIdx + 1} label`}
                        aria-invalid={Boolean(labelError)}
                        data-error-key={labelErrorKey}
                        data-field-error={labelError ? 'true' : undefined}
                        className={`w-full rounded border bg-[var(--surface-inset)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none ${
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

                    {/* Value: beside Label on mobile, 3rd on desktop */}
                    <div className="order-4 col-span-6 sm:order-3 sm:col-span-4">
                      {field.type === 'date' ? (
                        <DateFieldInput
                          value={field.value}
                          onChange={(nextValue) => {
                            const next = customFields.map((f, idx) =>
                              idx === fIdx ? { ...f, value: nextValue } : f
                            );
                            onChange(next);
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
                            onChange(next);
                          }}
                          placeholder={field.type === 'link' ? 'https://...' : 'Value'}
                          aria-label={`Custom field ${fIdx + 1} value`}
                          aria-invalid={Boolean(valueError)}
                          data-error-key={valueErrorKey}
                          data-field-error={valueError ? 'true' : undefined}
                          className={`w-full rounded border bg-[var(--surface-inset)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none ${
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
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
