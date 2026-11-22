import { useEffect, useRef, useState, type DragEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ClipboardList,
  Download,
  FileUp,
  Link2,
  Pin,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
import { AssessmentBuilderModal } from '@/components/assessment/AssessmentBuilderModal';
import { ResourceBadge } from '@/components/ResourceBadge';
import { buildAssessmentExport, parseAssessmentImport } from '@/lib/assessmentExchange';
import { deriveFileId, slugify } from '@/lib/courseIds';
import { putFile } from '@/lib/fileStore';
import {
  EXPECTED_EXTENSIONS_BY_KIND,
  extractExtension,
  formatBytes,
  getExpectedExtensionsHint,
  validateMaterialFile,
} from '@/lib/materialValidation';
import { RESOURCE_BADGE_STYLES } from '@/lib/theme';
import type { LessonResource, ResourceKind } from '@/types/course';

const RESOURCE_KINDS = Object.keys(RESOURCE_BADGE_STYLES) as ResourceKind[];

interface MaterialsEditorProps {
  resources: LessonResource[];
  courseCode: string;
  onChange: (nextResources: LessonResource[]) => void;
  titleLabel?: string;
  errorPrefix?: string;
  fieldErrors?: Record<string, string>;
}

interface RowFeedback {
  error?: string;
  warning?: string;
  suggestedKind?: ResourceKind;
  autoSuggested?: boolean;
}

type ResourceMode = 'link' | 'upload' | 'interactive';

async function readTextFromFile(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Response(file).text();
}

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
  errorPrefix,
  fieldErrors,
}: MaterialsEditorProps) {
  const rowIdCounterRef = useRef(0);
  const downloadTimeoutRef = useRef<number | null>(null);

  const [rowKeys, setRowKeys] = useState<string[]>(() =>
    resources.map((_, idx) => `row-init-${idx}`)
  );
  const [modes, setModes] = useState<Record<string, ResourceMode>>({});
  const [touchedKinds, setTouchedKinds] = useState<Record<string, boolean>>({});
  const [feedbackByRow, setFeedbackByRow] = useState<Record<string, RowFeedback>>({});
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [builderRowIndex, setBuilderRowIndex] = useState<number | null>(null);
  const [importOpenByRow, setImportOpenByRow] = useState<Record<string, boolean>>({});
  const [importTextByRow, setImportTextByRow] = useState<Record<string, string>>({});
  const [importErrorByRow, setImportErrorByRow] = useState<Record<string, string | null>>({});

  useEffect(() => {
    return () => {
      if (downloadTimeoutRef.current !== null) {
        window.clearTimeout(downloadTimeoutRef.current);
        downloadTimeoutRef.current = null;
      }
    };
  }, []);

  // Keep rowKeys synchronized if parent replaces resources externally (e.g., import)
  const resolvedRowKeys =
    rowKeys.length === resources.length
      ? rowKeys
      : resources.map((_, idx) => rowKeys[idx] ?? `row-sync-${idx}`);

  const getMode = (key: string, res: LessonResource): ResourceMode => {
    if (modes[key]) return modes[key];
    if (res.assessment) return 'interactive';
    if (res.file) return 'upload';
    return 'link';
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
        kind: 'document',
        url: '',
      },
    ]);
  };

  const handleRemoveMaterial = (index: number) => {
    const key = resolvedRowKeys[index];
    setRowKeys(resolvedRowKeys.filter((_, idx) => idx !== index));
    if (builderRowIndex === index) {
      setBuilderRowIndex(null);
    } else if (builderRowIndex !== null && builderRowIndex > index) {
      setBuilderRowIndex(builderRowIndex - 1);
    }
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
      setImportOpenByRow((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setImportTextByRow((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setImportErrorByRow((prev) => {
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
    setImportOpenByRow((prev) => ({ ...prev, [key]: false }));
    setImportErrorByRow((prev) => ({ ...prev, [key]: null }));

    const current = resources[index];
    if (!current) return;

    if (nextMode === 'link') {
      updateRow(index, {
        url: current.url ?? '',
        file: undefined,
        assessment: undefined,
      });
    } else if (nextMode === 'upload') {
      updateRow(index, {
        url: undefined,
        file: current.file,
        assessment: undefined,
      });
    } else {
      const nextKind: ResourceKind =
        current.kind === 'exam' || current.kind === 'assignment'
          ? current.kind
          : current.assessment?.mode ?? 'exam';
      updateRow(index, {
        kind: nextKind,
        url: undefined,
        file: undefined,
        assessment: current.assessment,
      });
    }
  };

  const handleKindChange = (index: number, key: string, nextKind: ResourceKind) => {
    setTouchedKinds((prev) => ({ ...prev, [key]: true }));
    const current = resources[index];
    if (!current) return;

    const isInteractiveEligible = nextKind === 'exam' || nextKind === 'assignment';
    if (!isInteractiveEligible && getMode(key, current) === 'interactive') {
      setModes((prev) => ({ ...prev, [key]: 'link' }));
      setImportOpenByRow((prev) => ({ ...prev, [key]: false }));
      setImportErrorByRow((prev) => ({ ...prev, [key]: null }));
      updateRow(index, {
        kind: nextKind,
        assessment: undefined,
        url: current.url ?? '',
      });
    } else {
      updateRow(index, { kind: nextKind });
    }

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
              assessment: undefined,
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

  const handleImportFileChange = async (key: string, file: File | undefined) => {
    if (!file) return;
    setImportErrorByRow((prev) => ({ ...prev, [key]: null }));
    try {
      const content = await readTextFromFile(file);
      setImportTextByRow((prev) => ({ ...prev, [key]: content }));
    } catch {
      setImportErrorByRow((prev) => ({
        ...prev,
        [key]: 'Could not read the selected assessment JSON file.',
      }));
    }
  };

  const handleApplyAssessmentImport = async (index: number, key: string) => {
    const current = resources[index];
    if (!current) return;

    const rawText = importTextByRow[key] ?? '';
    if (!rawText.trim()) {
      setImportErrorByRow((prev) => ({
        ...prev,
        [key]: 'Paste or upload assessment JSON first.',
      }));
      return;
    }

    const result = await parseAssessmentImport(rawText, courseCode);
    if (!result.ok) {
      setImportErrorByRow((prev) => ({ ...prev, [key]: result.error }));
      return;
    }

    const nextKind: ResourceKind = result.kind ?? result.assessment.mode;
    const defaultTitle =
      result.assessment.mode === 'exam' ? 'Interactive Exam' : 'Interactive Assignment';
    const nextTitle =
      current.title.trim() || result.title?.trim() || defaultTitle;

    setModes((prev) => ({ ...prev, [key]: 'interactive' }));
    setTouchedKinds((prev) => ({ ...prev, [key]: true }));
    onChange(
      resources.map((r, idx) =>
        idx === index
          ? {
              ...r,
              title: nextTitle,
              kind: nextKind,
              url: undefined,
              file: undefined,
              assessment: result.assessment,
            }
          : r
      )
    );

    setImportOpenByRow((prev) => ({ ...prev, [key]: false }));
    setImportTextByRow((prev) => ({ ...prev, [key]: '' }));
    setImportErrorByRow((prev) => ({ ...prev, [key]: null }));
    setFeedbackByRow((prev) => ({
      ...prev,
      [key]: result.warnings.length > 0 ? { warning: result.warnings.join(' ') } : {},
    }));
  };

  const handleExportAssessment = async (index: number, key: string) => {
    const current = resources[index];
    if (!current?.assessment) return;

    const warnings: string[] = [];
    try {
      const envelope = await buildAssessmentExport({
        title: current.title.trim() || undefined,
        kind:
          current.kind === 'exam' || current.kind === 'assignment'
            ? current.kind
            : current.assessment.mode,
        assessment: current.assessment,
        onWarning: (warning) => warnings.push(warning),
      });
      const json = JSON.stringify(envelope, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const baseName =
        slugify(current.title.trim() || current.assessment.mode) || 'assessment';
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${baseName}.assessment.json`;
      anchor.click();

      if (downloadTimeoutRef.current !== null) {
        window.clearTimeout(downloadTimeoutRef.current);
      }
      downloadTimeoutRef.current = window.setTimeout(() => {
        URL.revokeObjectURL(url);
        downloadTimeoutRef.current = null;
      }, 1000);

      if (warnings.length > 0) {
        setFeedbackByRow((prev) => ({
          ...prev,
          [key]: { warning: warnings.join(' ') },
        }));
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to export assessment JSON.';
      setFeedbackByRow((prev) => ({
        ...prev,
        [key]: { error: msg },
      }));
    }
  };

  const activeBuilderRes =
    builderRowIndex !== null ? resources[builderRowIndex] : undefined;

  return (
    <div className="border-t border-slate-200 pt-2.5 dark:border-slate-700/80">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300">
          <Link2 className="h-3.5 w-3.5" />
          {titleLabel} ({resources.length})
        </span>
        <button
          type="button"
          onClick={handleAddMaterial}
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
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
            const importOpen = Boolean(importOpenByRow[rowKey]);
            const importText = importTextByRow[rowKey] ?? '';
            const importError = importErrorByRow[rowKey] ?? null;
            const errorKey = errorPrefix ? `${errorPrefix}.${rIdx}` : undefined;
            const rowValidationError = errorKey ? fieldErrors?.[errorKey] : undefined;
            const showInteractiveTab = res.kind === 'exam' || res.kind === 'assignment';

            return (
              <div
                key={rowKey}
                data-error-key={errorKey}
                data-field-error={rowValidationError ? 'true' : undefined}
                className={`space-y-2 rounded-md border p-2.5 transition-colors ${
                  rowValidationError
                    ? 'border-red-500 bg-red-50/20 ring-1 ring-red-500/30 dark:border-red-500 dark:bg-red-950/20'
                    : res.recommended
                      ? 'border-amber-300 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-400/5'
                      : 'border-slate-200 bg-white dark:border-slate-700/80 dark:bg-[#121926]'
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  {/* Kind selector + badge */}
                  <div className="flex items-center gap-1.5 sm:w-44 sm:shrink-0">
                    <ResourceBadge kind={res.kind} />
                    <select
                      value={res.kind}
                      onChange={(e) =>
                        handleKindChange(rIdx, rowKey, e.target.value as ResourceKind)
                      }
                      aria-label="Resource kind"
                      className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100"
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
                    className="min-w-[140px] flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500"
                  />

                  {/* Source mode switcher + Pin + Delete */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 sm:justify-end">
                    <div
                      role="group"
                      aria-label="Material source mode"
                      className="inline-flex flex-wrap rounded border border-slate-300 bg-slate-100 p-0.5 dark:border-slate-600 dark:bg-[#0d131f]"
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitchMode(rIdx, rowKey, 'link')}
                        aria-pressed={mode === 'link'}
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          mode === 'link'
                            ? 'bg-slate-900 text-white dark:bg-slate-700'
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
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
                            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                      >
                        <Upload className="h-3 w-3" />
                        Upload
                      </button>
                      {showInteractiveTab && (
                        <button
                          type="button"
                          onClick={() => handleSwitchMode(rIdx, rowKey, 'interactive')}
                          aria-pressed={mode === 'interactive'}
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                            mode === 'interactive'
                              ? 'bg-slate-900 text-white dark:bg-slate-700'
                              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                          }`}
                        >
                          <ClipboardList className="h-3 w-3" />
                          Interactive
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateRow(rIdx, {
                            recommended: res.recommended ? undefined : true,
                          })
                        }
                        aria-pressed={Boolean(res.recommended)}
                        aria-label={
                          res.recommended
                            ? 'Unpin recommended material'
                            : 'Pin as recommended'
                        }
                        title={
                          res.recommended
                            ? 'Pinned as recommended'
                            : 'Pin as recommended'
                        }
                        className={`inline-flex items-center gap-1 rounded border px-1.5 py-1 text-[11px] font-medium transition-colors ${
                          res.recommended
                            ? 'border-amber-400 bg-amber-100 text-amber-900 dark:border-amber-500/60 dark:bg-amber-400/20 dark:text-amber-300'
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-300 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Pin className="h-3 w-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveMaterial(rIdx)}
                        aria-label="Remove material"
                        className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {mode === 'link' ? (
                  <input
                    type="url"
                    value={res.url ?? ''}
                    onChange={(e) =>
                      updateRow(rIdx, {
                        url: e.target.value,
                        file: undefined,
                        assessment: undefined,
                      })
                    }
                    placeholder="https://..."
                    aria-label="Material URL"
                    className="w-full rounded border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                ) : mode === 'upload' ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        Expected for{' '}
                        <strong className="font-medium text-slate-700 dark:text-slate-300">
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
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-600 dark:bg-[#0d131f]">
                        <div className="flex min-w-0 items-center gap-2">
                          <FileUp className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                          <span className="truncate font-medium text-slate-900 dark:text-slate-100">
                            {res.file.name}
                          </span>
                          <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
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
                          className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
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
                            : 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-[#0d131f]'
                        }`}
                      >
                        <Upload className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Drag &amp; drop a file here, or choose from your computer
                        </p>
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700">
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
                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-400/10 dark:text-amber-200"
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
                            className="shrink-0 rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-[#1b2436] dark:text-amber-200 dark:hover:bg-slate-700"
                          >
                            Use {feedback.suggestedKind}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {res.assessment ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-600 dark:bg-[#0d131f]">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-0.5 font-medium text-white dark:bg-[#1b2436] dark:text-amber-300">
                            {res.assessment.mode === 'exam' ? 'Exam' : 'Assignment'} ·{' '}
                            {res.assessment.questions.length}{' '}
                            {res.assessment.questions.length === 1 ? 'question' : 'questions'}
                          </span>
                          {res.assessment.timeLimitMinutes && (
                            <span className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:border-slate-600 dark:bg-[#121926] dark:text-slate-300">
                              {res.assessment.timeLimitMinutes} min
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setBuilderRowIndex(rIdx)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Wrench className="h-3 w-3" />
                            Build / Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImportOpenByRow((prev) => ({
                                ...prev,
                                [rowKey]: !prev[rowKey],
                              }));
                              setImportErrorByRow((prev) => ({
                                ...prev,
                                [rowKey]: null,
                              }));
                            }}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Upload className="h-3 w-3" />
                            Import JSON
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleExportAssessment(rIdx, rowKey)}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Download className="h-3 w-3" />
                            Export JSON
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs dark:border-slate-600 dark:bg-[#0d131f]">
                        <span className="text-slate-600 dark:text-slate-300">
                          No interactive exam or assignment configured yet.
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setBuilderRowIndex(rIdx)}
                            className="inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                          >
                            <Wrench className="h-3 w-3" />
                            Build / Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImportOpenByRow((prev) => ({
                                ...prev,
                                [rowKey]: !prev[rowKey],
                              }));
                              setImportErrorByRow((prev) => ({
                                ...prev,
                                [rowKey]: null,
                              }));
                            }}
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            <Upload className="h-3 w-3" />
                            Import JSON
                          </button>
                        </div>
                      </div>
                    )}

                    {importOpen && (
                      <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-600 dark:bg-[#1b2436]">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                            Import <code className="font-mono">.assessment.json</code> or bare Assessment JSON
                          </span>
                          <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800">
                            <Upload className="h-3 w-3" />
                            Choose JSON file
                            <input
                              type="file"
                              accept=".json,.assessment.json,application/json"
                              aria-label="Import assessment JSON file"
                              className="sr-only"
                              onChange={(e) => {
                                void handleImportFileChange(rowKey, e.target.files?.[0]);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>

                        <textarea
                          rows={4}
                          aria-label="Paste assessment JSON"
                          value={importText}
                          onChange={(e) => {
                            setImportTextByRow((prev) => ({
                              ...prev,
                              [rowKey]: e.target.value,
                            }));
                            setImportErrorByRow((prev) => ({
                              ...prev,
                              [rowKey]: null,
                            }));
                          }}
                          placeholder='{"format": "college-assessment", "version": 1, ...}'
                          className="w-full rounded border border-slate-300 bg-white p-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500"
                        />

                        {importError && (
                          <p
                            role="alert"
                            className="rounded border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                          >
                            {importError}
                          </p>
                        )}

                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setImportOpenByRow((prev) => ({
                                ...prev,
                                [rowKey]: false,
                              }))
                            }
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Close Import
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleApplyAssessmentImport(rIdx, rowKey)}
                            className="rounded bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                          >
                            Apply Import
                          </button>
                        </div>
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
                        className="flex items-start gap-1.5 rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-400/10 dark:text-amber-200"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{feedback.warning}</span>
                      </div>
                    )}
                  </div>
                )}

                {rowValidationError && (
                  <p
                    role="alert"
                    className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{rowValidationError}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AssessmentBuilderModal
        isOpen={builderRowIndex !== null && Boolean(activeBuilderRes)}
        initialTitle={activeBuilderRes?.title}
        initialKind={
          activeBuilderRes?.kind === 'assignment' || activeBuilderRes?.kind === 'exam'
            ? activeBuilderRes.kind
            : activeBuilderRes?.assessment?.mode
        }
        initialAssessment={activeBuilderRes?.assessment}
        courseCode={courseCode}
        onSave={(result) => {
          if (builderRowIndex === null) return;
          const rowKey = resolvedRowKeys[builderRowIndex];
          const current = resources[builderRowIndex];
          if (!current) {
            setBuilderRowIndex(null);
            return;
          }

          const nextKind: ResourceKind =
            result.suggestedKind ?? result.assessment.mode;
          const defaultTitle =
            result.assessment.mode === 'exam'
              ? 'Interactive Exam'
              : 'Interactive Assignment';
          const nextTitle =
            result.suggestedTitle?.trim() || current.title.trim() || defaultTitle;

          if (rowKey) {
            setModes((prev) => ({ ...prev, [rowKey]: 'interactive' }));
            setTouchedKinds((prev) => ({ ...prev, [rowKey]: true }));
            setFeedbackByRow((prev) => ({ ...prev, [rowKey]: {} }));
          }

          onChange(
            resources.map((r, idx) =>
              idx === builderRowIndex
                ? {
                    ...r,
                    title: nextTitle,
                    kind: nextKind,
                    url: undefined,
                    file: undefined,
                    assessment: result.assessment,
                  }
                : r
            )
          );
          setBuilderRowIndex(null);
        }}
        onClose={() => setBuilderRowIndex(null)}
      />
    </div>
  );
}
