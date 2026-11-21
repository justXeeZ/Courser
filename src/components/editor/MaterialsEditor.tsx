import { useRef, useState, type DragEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  FileUp,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { deriveFileId } from '@/lib/courseIds';
import { putFile } from '@/lib/fileStore';
import {
  EXPECTED_EXTENSIONS_BY_KIND,
  extractExtension,
  formatBytes,
  getExpectedExtensionsHint,
  validateMaterialFile,
} from '@/lib/materialValidation';
import { RESOURCE_BADGE_STYLES } from '@/lib/theme';
import { ResourceBadge } from '@/components/ResourceBadge';
import type { LessonResource, ResourceKind } from '@/types/course';

const RESOURCE_KINDS = Object.keys(RESOURCE_BADGE_STYLES) as ResourceKind[];

interface MaterialsEditorProps {
  resources: LessonResource[];
  courseCode: string;
  onChange: (nextResources: LessonResource[]) => void;
  titleLabel?: string;
}

interface RowFeedback {
  error?: string;
  warning?: string;
  suggestedKind?: ResourceKind;
  autoSuggested?: boolean;
}

type ResourceMode = 'link' | 'upload';

function getWarningForExistingFile(
  fileName: string,
  kind: ResourceKind
): { warning?: string; suggestedKind?: ResourceKind } {
  const ext = extractExtension(fileName);
  const expected = EXPECTED_EXTENSIONS_BY_KIND[kind];
  if (!ext || !expected.includes(ext)) {
    const result = validateMaterialFile(
      { name: fileName, size: 1, type: '' },
      kind
    );
    if (result.ok) {
      return {
        warning: result.warning,
        suggestedKind: result.suggestedKind,
      };
    }
  }
  return {};
}

export function MaterialsEditor({
  resources,
  courseCode,
  onChange,
  titleLabel = 'Course Materials',
}: MaterialsEditorProps) {
  const rowIdCounterRef = useRef(0);
  const [rowKeys, setRowKeys] = useState<string[]>(() =>
    resources.map((_, idx) => `row-init-${idx}`)
  );
  const [modes, setModes] = useState<Record<string, ResourceMode>>({});
  const [touchedKinds, setTouchedKinds] = useState<Record<string, boolean>>({});
  const [feedbackByRow, setFeedbackByRow] = useState<Record<string, RowFeedback>>({});
  const [draggingKey, setDraggingKey] = useState<string | null>(null);

  // Keep rowKeys synchronized if parent replaces resources externally (e.g., import)
  const resolvedRowKeys =
    rowKeys.length === resources.length
      ? rowKeys
      : resources.map((_, idx) => rowKeys[idx] ?? `row-sync-${idx}`);

  const getMode = (key: string, res: LessonResource): ResourceMode => {
    if (modes[key]) return modes[key];
    return res.file ? 'upload' : 'link';
  };

  const handleAddMaterial = () => {
    rowIdCounterRef.current += 1;
    const newKey = `row-${rowIdCounterRef.current}`;
    setRowKeys([...resolvedRowKeys, newKey]);
    setModes((prev) => ({ ...prev, [newKey]: 'link' }));
    onChange([
      ...resources,
      {
        title: '',
        kind: 'slides',
        url: '',
      },
    ]);
  };

  const handleRemoveMaterial = (index: number) => {
    const key = resolvedRowKeys[index];
    setRowKeys(resolvedRowKeys.filter((_, idx) => idx !== index));
    if (key) {
      setModes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setTouchedKinds((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setFeedbackByRow((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    onChange(resources.filter((_, idx) => idx !== index));
  };

  const updateRow = (index: number, patch: Partial<LessonResource>) => {
    onChange(resources.map((r, idx) => (idx === index ? { ...r, ...patch } : r)));
  };

  const handleSwitchMode = (index: number, key: string, nextMode: ResourceMode) => {
    setModes((prev) => ({ ...prev, [key]: nextMode }));
    setFeedbackByRow((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    const current = resources[index];
    if (!current) return;

    if (nextMode === 'link') {
      updateRow(index, {
        file: undefined,
        url: current.url ?? '',
      });
    } else {
      updateRow(index, {
        url: undefined,
        file: current.file,
      });
    }
  };

  const handleKindChange = (index: number, key: string, nextKind: ResourceKind) => {
    setTouchedKinds((prev) => ({ ...prev, [key]: true }));
    const current = resources[index];
    if (!current) return;

    updateRow(index, { kind: nextKind });

    if (current.file) {
      const check = getWarningForExistingFile(current.file.name, nextKind);
      setFeedbackByRow((prev) => ({
        ...prev,
        [key]: check.warning
          ? { warning: check.warning, suggestedKind: check.suggestedKind }
          : {},
      }));
    } else {
      setFeedbackByRow((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          autoSuggested: false,
        },
      }));
    }
  };

  const processFileUpload = async (index: number, key: string, file: File) => {
    const current = resources[index];
    if (!current) return;

    const kindWasTouched = Boolean(touchedKinds[key]);
    const validation = validateMaterialFile(file, current.kind);

    if (!validation.ok) {
      setFeedbackByRow((prev) => ({
        ...prev,
        [key]: { error: validation.error },
      }));
      return;
    }

    const mimeType = file.type || 'application/octet-stream';
    const fileId = deriveFileId(courseCode);

    try {
      await putFile(fileId, file, file.name, mimeType);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to store uploaded file in IndexedDB.';
      setFeedbackByRow((prev) => ({
        ...prev,
        [key]: { error: msg },
      }));
      return;
    }

    const nextKind = kindWasTouched ? current.kind : validation.suggestedKind;
    const nextTitle = current.title.trim() ? current.title : file.name;

    setModes((prev) => ({ ...prev, [key]: 'upload' }));
    onChange(
      resources.map((r, idx) =>
        idx === index
          ? {
              ...r,
              title: nextTitle,
              kind: nextKind,
              url: undefined,
              file: {
                id: fileId,
                name: file.name,
                mimeType,
                sizeBytes: file.size,
              },
            }
          : r
      )
    );

    if (!kindWasTouched) {
      setFeedbackByRow((prev) => ({
        ...prev,
        [key]: {
          autoSuggested: true,
          suggestedKind: validation.suggestedKind,
        },
      }));
    } else {
      setFeedbackByRow((prev) => ({
        ...prev,
        [key]: validation.warning
          ? {
              warning: validation.warning,
              suggestedKind: validation.suggestedKind,
            }
          : {},
      }));
    }
  };

  const handleDrop = (
    e: DragEvent<HTMLDivElement>,
    index: number,
    key: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingKey(null);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      void processFileUpload(index, key, droppedFile);
    }
  };

  return (
    <div className="border-t border-gray-200 pt-2.5 dark:border-slate-700">
      <div className="mb-2 flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-slate-300">
          <Link2 className="h-3.5 w-3.5" />
          {titleLabel} ({resources.length})
        </span>
        <button
          type="button"
          onClick={handleAddMaterial}
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-3 w-3" />
          Add Material
        </button>
      </div>

      {resources.length > 0 && (
        <div className="space-y-2.5">
          {resources.map((res, rIdx) => {
            const rowKey = resolvedRowKeys[rIdx] ?? `row-fallback-${rIdx}`;
            const mode = getMode(rowKey, res);
            const feedback = feedbackByRow[rowKey] ?? {};
            const expectedHint = getExpectedExtensionsHint(res.kind);

            return (
              <div
                key={rowKey}
                className="space-y-2 rounded-md border border-gray-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-12">
                  {/* Kind selector + badge */}
                  <div className="flex items-center gap-1.5 sm:col-span-3">
                    <ResourceBadge kind={res.kind} />
                    <select
                      value={res.kind}
                      onChange={(e) =>
                        handleKindChange(rIdx, rowKey, e.target.value as ResourceKind)
                      }
                      aria-label="Resource kind"
                      className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs text-gray-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      {RESOURCE_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {RESOURCE_BADGE_STYLES[k].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Material title */}
                  <input
                    type="text"
                    value={res.title}
                    onChange={(e) => updateRow(rIdx, { title: e.target.value })}
                    placeholder="Material title"
                    aria-label="Material title"
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 sm:col-span-5 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />

                  {/* Link / Upload toggle + Delete */}
                  <div className="flex items-center justify-between gap-2 sm:col-span-4 sm:justify-end">
                    <div
                      role="group"
                      aria-label="Material source mode"
                      className="inline-flex rounded border border-gray-300 bg-gray-50 p-0.5 dark:border-slate-700 dark:bg-slate-950"
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitchMode(rIdx, rowKey, 'link')}
                        aria-pressed={mode === 'link'}
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          mode === 'link'
                            ? 'bg-slate-900 text-white dark:bg-slate-700'
                            : 'text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        <Link2 className="h-3 w-3" />
                        Link
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchMode(rIdx, rowKey, 'upload')}
                        aria-pressed={mode === 'upload'}
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          mode === 'upload'
                            ? 'bg-slate-900 text-white dark:bg-slate-700'
                            : 'text-gray-600 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        <Upload className="h-3 w-3" />
                        Upload
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(rIdx)}
                      aria-label="Remove material"
                      className="rounded p-1 text-red-500 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {mode === 'link' ? (
                  <input
                    type="url"
                    value={res.url ?? ''}
                    onChange={(e) => updateRow(rIdx, { url: e.target.value, file: undefined })}
                    placeholder="https://..."
                    aria-label="Material URL"
                    className="w-full rounded border border-gray-300 bg-white px-2.5 py-1 font-mono text-xs text-gray-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-slate-400">
                      <span>
                        Expected for{' '}
                        <strong className="font-medium text-gray-700 dark:text-slate-300">
                          {res.kind}
                        </strong>
                        : <code className="font-mono">{expectedHint}</code>
                      </span>

                      {feedback.autoSuggested && feedback.suggestedKind && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          <Sparkles className="h-3 w-3" />
                          Auto-suggested kind: {RESOURCE_BADGE_STYLES[feedback.suggestedKind].label}
                        </span>
                      )}
                    </div>

                    {res.file ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileUp className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                          <span className="truncate font-medium text-gray-900 dark:text-slate-100">
                            {res.file.name}
                          </span>
                          <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-slate-800 dark:text-slate-300">
                            {formatBytes(res.file.sizeBytes)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            updateRow(rIdx, { file: undefined });
                            setFeedbackByRow((prev) => {
                              const next = { ...prev };
                              delete next[rowKey];
                              return next;
                            });
                          }}
                          className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDraggingKey(rowKey);
                        }}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          setDraggingKey(rowKey);
                        }}
                        onDragLeave={() => setDraggingKey(null)}
                        onDrop={(e) => handleDrop(e, rIdx, rowKey)}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-3 text-center transition-colors ${
                          draggingKey === rowKey
                            ? 'border-blue-500 bg-blue-50/70 dark:border-blue-400 dark:bg-blue-950/30'
                            : 'border-gray-300 bg-gray-50/60 dark:border-slate-700 dark:bg-slate-950/60'
                        }`}
                      >
                        <Upload className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                        <p className="text-xs text-gray-600 dark:text-slate-300">
                          Drag &amp; drop a file here, or choose from your computer
                        </p>
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                          <span>Choose File</span>
                          <input
                            type="file"
                            aria-label="Upload material file"
                            className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                void processFileUpload(rIdx, rowKey, file);
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {feedback.error && (
                      <div
                        role="alert"
                        className="flex items-start gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                      >
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{feedback.error}</span>
                      </div>
                    )}

                    {feedback.warning && (
                      <div
                        role="status"
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                      >
                        <span className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span>{feedback.warning}</span>
                        </span>

                        {feedback.suggestedKind && feedback.suggestedKind !== res.kind && (
                          <button
                            type="button"
                            onClick={() => {
                              const nextKind = feedback.suggestedKind!;
                              setTouchedKinds((prev) => ({ ...prev, [rowKey]: true }));
                              updateRow(rIdx, { kind: nextKind });
                              setFeedbackByRow((prev) => ({ ...prev, [rowKey]: {} }));
                            }}
                            className="shrink-0 rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200 dark:hover:bg-amber-900/70"
                          >
                            Use {feedback.suggestedKind}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
