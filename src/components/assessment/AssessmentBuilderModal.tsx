import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ResourceBadge } from '@/components/ResourceBadge';
import { RichMathText } from '@/components/RichMathText';
import {
  buildAssessmentExport,
  parseAssessmentImport,
} from '@/lib/assessmentExchange';
import { deriveFileId, slugify } from '@/lib/courseIds';
import { getFile, putFile } from '@/lib/fileStore';
import { extractExtension, formatBytes, validateMaterialFile } from '@/lib/materialValidation';
import {
  AssessmentSchema,
  type AssessmentData,
  type AssessmentQuestion,
  type AssessmentQuestionType,
  type StoredFileRef,
} from '@/types/course';

export interface AssessmentBuilderSaveResult {
  assessment: AssessmentData;
  suggestedTitle?: string;
  suggestedKind?: 'exam' | 'assignment';
}

export interface AssessmentBuilderModalProps {
  isOpen: boolean;
  initialTitle?: string;
  initialKind?: 'exam' | 'assignment';
  initialAssessment?: AssessmentData;
  courseCode: string;
  onSave: (result: AssessmentBuilderSaveResult) => void;
  onClose: () => void;
}

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.avif',
]);

const QUESTION_TYPE_LABELS: Record<AssessmentQuestionType, string> = {
  mcq: 'MCQ',
  'multi-select': 'Multi',
  'true-false': 'T/F',
  'short-answer': 'Short',
};

function isSafeHttpUrl(raw?: string): boolean {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function generateQuestionId(existingQuestions: AssessmentQuestion[]): string {
  const used = new Set(existingQuestions.map((q) => q.id));
  let counter = existingQuestions.length + 1;
  while (used.has(`q-${counter}`)) {
    counter += 1;
  }
  return `q-${counter}`;
}

function createDefaultQuestion(existingQuestions: AssessmentQuestion[]): AssessmentQuestion {
  return {
    id: generateQuestionId(existingQuestions),
    type: 'mcq',
    header: { text: '' },
    options: ['Option A', 'Option B'],
    correctIndices: [0],
  };
}

function createInitialDraft(
  initialAssessment: AssessmentData | undefined,
  initialKind: 'exam' | 'assignment' | undefined
): AssessmentData {
  if (initialAssessment) {
    return {
      ...initialAssessment,
      questions: initialAssessment.questions.map((q) => ({
        ...q,
        header: { ...q.header },
        ...(q.options ? { options: [...q.options] } : {}),
        ...(q.correctIndices ? { correctIndices: [...q.correctIndices] } : {}),
        ...(q.acceptedAnswers ? { acceptedAnswers: [...q.acceptedAnswers] } : {}),
      })),
    };
  }

  return {
    mode: initialKind ?? 'exam',
    questions: [createDefaultQuestion([])],
  };
}

function normalizeAssessmentDraft(draft: AssessmentData): AssessmentData {
  const trimmedInstructions = draft.instructions?.trim();
  const timeLimitMinutes =
    typeof draft.timeLimitMinutes === 'number' && Number.isFinite(draft.timeLimitMinutes)
      ? Math.round(draft.timeLimitMinutes)
      : undefined;
  const passingScorePercent =
    typeof draft.passingScorePercent === 'number' &&
    Number.isFinite(draft.passingScorePercent)
      ? draft.passingScorePercent
      : undefined;

  const questions: AssessmentQuestion[] = draft.questions.map((q) => {
    const trimmedText = q.header.text?.trim();
    const trimmedImageUrl = q.header.imageUrl?.trim();
    const header: AssessmentQuestion['header'] = {
      ...(trimmedText ? { text: trimmedText } : {}),
      ...(trimmedImageUrl ? { imageUrl: trimmedImageUrl } : {}),
      ...(q.header.imageFile ? { imageFile: q.header.imageFile } : {}),
    };

    const trimmedHint = q.hint?.trim();
    const trimmedExplanation = q.explanation?.trim();
    const points =
      typeof q.points === 'number' && Number.isFinite(q.points) ? q.points : undefined;

    const base = {
      id: q.id.trim() || 'q-1',
      type: q.type,
      header,
      ...(points !== undefined ? { points } : {}),
      ...(trimmedHint ? { hint: trimmedHint } : {}),
      ...(trimmedExplanation ? { explanation: trimmedExplanation } : {}),
    };

    if (q.type === 'mcq' || q.type === 'multi-select') {
      return {
        ...base,
        options: (q.options ?? []).map((opt) => opt.trim()),
        correctIndices: [...(q.correctIndices ?? [])].sort((a, b) => a - b),
      };
    }

    if (q.type === 'true-false') {
      const tfOptions =
        q.options && q.options.length === 2
          ? q.options.map((opt) => opt.trim())
          : ['True', 'False'];
      return {
        ...base,
        options: tfOptions,
        correctIndices: [q.correctIndices?.[0] === 1 ? 1 : 0],
      };
    }

    return {
      ...base,
      acceptedAnswers: (q.acceptedAnswers ?? []).map((ans) => ans.trim()),
      ...(q.caseSensitive ? { caseSensitive: true } : {}),
    };
  });

  return {
    mode: draft.mode,
    ...(trimmedInstructions ? { instructions: trimmedInstructions } : {}),
    ...(timeLimitMinutes !== undefined ? { timeLimitMinutes } : {}),
    ...(passingScorePercent !== undefined ? { passingScorePercent } : {}),
    ...(draft.shuffleQuestions ? { shuffleQuestions: true } : {}),
    questions,
  };
}

function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file.'));
    reader.readAsText(file, 'utf-8');
  });
}

function QuestionHeaderImage({
  imageFile,
  imageUrl,
}: {
  imageFile?: StoredFileRef;
  imageUrl?: string;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;

    if (!imageFile?.id) {
      setObjectUrl(null);
      setMissing(false);
      return;
    }

    setObjectUrl(null);
    setMissing(false);

    getFile(imageFile.id)
      .then((record) => {
        if (cancelled) return;
        if (!record) {
          setMissing(true);
          return;
        }
        createdUrl = URL.createObjectURL(record.blob);
        if (cancelled) {
          URL.revokeObjectURL(createdUrl);
          createdUrl = null;
          return;
        }
        setObjectUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setMissing(true);
        }
      });

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
        createdUrl = null;
      }
    };
  }, [imageFile?.id]);

  if (imageFile) {
    if (missing) {
      return (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Image &ldquo;{imageFile.name}&rdquo; unavailable in local storage.
        </p>
      );
    }
    if (!objectUrl) {
      return (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Loading image preview...
        </p>
      );
    }
    return (
      <img
        src={objectUrl}
        alt={imageFile.name}
        className="max-h-48 rounded-md border border-slate-200 object-contain dark:border-slate-700"
      />
    );
  }

  if (imageUrl && isSafeHttpUrl(imageUrl)) {
    return (
      <img
        src={imageUrl.trim()}
        alt="Question header"
        className="max-h-48 rounded-md border border-slate-200 object-contain dark:border-slate-700"
      />
    );
  }

  return null;
}

export function AssessmentBuilderModal({
  isOpen,
  initialTitle,
  initialKind,
  initialAssessment,
  courseCode,
  onSave,
  onClose,
}: AssessmentBuilderModalProps) {
  const titleId = useId();
  const [draft, setDraft] = useState<AssessmentData>(() =>
    createInitialDraft(initialAssessment, initialKind)
  );
  const [draftTitle, setDraftTitle] = useState<string>(initialTitle ?? '');
  const [importedKind, setImportedKind] = useState<'exam' | 'assignment' | undefined>(
    initialKind
  );
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const downloadTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(createInitialDraft(initialAssessment, initialKind));
    setDraftTitle(initialTitle ?? '');
    setImportedKind(initialKind);
    setSelectedIndex(0);
    setValidationError(null);
    setImageError(null);
    setImportOpen(false);
    setImportText('');
    setImportError(null);
    setStatusBanner(null);
  }, [isOpen, initialAssessment, initialTitle, initialKind]);

  useEffect(() => {
    return () => {
      if (downloadTimeoutRef.current !== null) {
        window.clearTimeout(downloadTimeoutRef.current);
        downloadTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (importOpen) {
        setImportOpen(false);
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, importOpen, onClose]);

  const activeIndex = Math.min(selectedIndex, Math.max(0, draft.questions.length - 1));
  const activeQuestion = draft.questions[activeIndex];

  const inlineImageUrlError = useMemo(() => {
    const raw = activeQuestion?.header.imageUrl?.trim();
    if (!raw) return null;
    return isSafeHttpUrl(raw) ? null : 'Image URL must use http:// or https://';
  }, [activeQuestion?.header.imageUrl]);

  if (!isOpen || !activeQuestion) return null;

  const updateQuestionAt = (
    idx: number,
    updater: (prev: AssessmentQuestion) => AssessmentQuestion
  ) => {
    setValidationError(null);
    setDraft((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === idx ? updater(q) : q)),
    }));
  };

  const handleAddQuestion = () => {
    setValidationError(null);
    setImageError(null);
    setDraft((prev) => {
      const next = [...prev.questions, createDefaultQuestion(prev.questions)];
      setSelectedIndex(next.length - 1);
      return { ...prev, questions: next };
    });
  };

  const handleDuplicateQuestion = (idx: number) => {
    setValidationError(null);
    setImageError(null);
    setDraft((prev) => {
      const source = prev.questions[idx];
      if (!source) return prev;
      const clone: AssessmentQuestion = {
        ...source,
        id: generateQuestionId(prev.questions),
        header: { ...source.header },
        ...(source.options ? { options: [...source.options] } : {}),
        ...(source.correctIndices ? { correctIndices: [...source.correctIndices] } : {}),
        ...(source.acceptedAnswers ? { acceptedAnswers: [...source.acceptedAnswers] } : {}),
      };
      const next = [
        ...prev.questions.slice(0, idx + 1),
        clone,
        ...prev.questions.slice(idx + 1),
      ];
      setSelectedIndex(idx + 1);
      return { ...prev, questions: next };
    });
  };

  const handleMoveQuestion = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= draft.questions.length) return;
    setDraft((prev) => {
      const next = [...prev.questions];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return { ...prev, questions: next };
    });
    if (activeIndex === idx) {
      setSelectedIndex(target);
    } else if (activeIndex === target) {
      setSelectedIndex(idx);
    }
  };

  const handleDeleteQuestion = (idx: number) => {
    if (draft.questions.length <= 1) return;
    setValidationError(null);
    setImageError(null);
    setDraft((prev) => {
      const next = prev.questions.filter((_, i) => i !== idx);
      setSelectedIndex((curr) => Math.min(curr, next.length - 1));
      return { ...prev, questions: next };
    });
  };

  const handleTypeChange = (nextType: AssessmentQuestionType) => {
    updateQuestionAt(activeIndex, (prev) => {
      if (prev.type === nextType) return prev;
      const base: AssessmentQuestion = {
        id: prev.id,
        type: nextType,
        header: prev.header,
        ...(prev.points !== undefined ? { points: prev.points } : {}),
        ...(prev.hint !== undefined ? { hint: prev.hint } : {}),
        ...(prev.explanation !== undefined ? { explanation: prev.explanation } : {}),
      };

      if (nextType === 'mcq') {
        const opts = prev.options && prev.options.length >= 2 ? prev.options : ['Option A', 'Option B'];
        const firstValid = prev.correctIndices?.find((i) => i >= 0 && i < opts.length) ?? 0;
        return { ...base, options: opts, correctIndices: [firstValid] };
      }

      if (nextType === 'multi-select') {
        const opts = prev.options && prev.options.length >= 2 ? prev.options : ['Option A', 'Option B'];
        const valid = (prev.correctIndices ?? []).filter((i) => i >= 0 && i < opts.length);
        return {
          ...base,
          options: opts,
          correctIndices: valid.length > 0 ? Array.from(new Set(valid)) : [0],
        };
      }

      if (nextType === 'true-false') {
        const tfIdx = prev.correctIndices?.[0] === 1 ? 1 : 0;
        return {
          ...base,
          options: ['True', 'False'],
          correctIndices: [tfIdx],
        };
      }

      return {
        ...base,
        acceptedAnswers:
          prev.acceptedAnswers && prev.acceptedAnswers.length > 0
            ? prev.acceptedAnswers
            : [''],
        caseSensitive: prev.caseSensitive ?? false,
      };
    });
  };

  const handleUploadImage = async (file: File | undefined) => {
    if (!file) return;
    setImageError(null);

    const validation = validateMaterialFile(file);
    if (!validation.ok) {
      setImageError(validation.error);
      return;
    }

    const normalizedMime = (file.type || '').split(';')[0].trim().toLowerCase();
    const ext = extractExtension(file.name);
    const isRasterImage =
      (normalizedMime.startsWith('image/') && normalizedMime !== 'image/svg+xml') ||
      IMAGE_EXTENSIONS.has(ext);

    if (!isRasterImage) {
      setImageError(
        'Header images must be raster image files (.png, .jpg, .jpeg, .webp, .gif, .bmp, .avif).'
      );
      return;
    }

    const resolvedMime =
      normalizedMime || (ext ? `image/${ext.slice(1).replace('jpg', 'jpeg')}` : 'image/png');
    const fileId = deriveFileId(courseCode || 'COURSE');

    try {
      await putFile(fileId, file, file.name, resolvedMime);
      const ref: StoredFileRef = {
        id: fileId,
        name: file.name,
        mimeType: resolvedMime,
        sizeBytes: file.size,
      };
      updateQuestionAt(activeIndex, (prev) => ({
        ...prev,
        header: {
          ...(prev.header.text !== undefined ? { text: prev.header.text } : {}),
          imageFile: ref,
        },
      }));
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : 'Could not store uploaded image.'
      );
    }
  };

  const validateNormalized = (): AssessmentData | null => {
    const normalized = normalizeAssessmentDraft(draft);
    const parsed = AssessmentSchema.safeParse(normalized);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      if (issue?.path[0] === 'questions' && typeof issue.path[1] === 'number') {
        setSelectedIndex(issue.path[1]);
      }
      const pathStr = issue?.path?.length ? issue.path.join('.') : 'assessment';
      setValidationError(`${pathStr}: ${issue?.message ?? 'Invalid assessment data.'}`);
      return null;
    }
    setValidationError(null);
    return parsed.data;
  };

  const handleSave = () => {
    const valid = validateNormalized();
    if (!valid) return;
    onSave({
      assessment: valid,
      suggestedTitle: draftTitle.trim() || undefined,
      suggestedKind: importedKind ?? valid.mode,
    });
    onClose();
  };

  const handleExportJson = async () => {
    const valid = validateNormalized();
    if (!valid) return;

    const warnings: string[] = [];
    const envelope = await buildAssessmentExport({
      title: draftTitle.trim() || undefined,
      kind: valid.mode,
      assessment: valid,
      onWarning: (msg) => warnings.push(msg),
    });
    if (warnings.length > 0) {
      setStatusBanner(warnings.join(' '));
    }

    const json = JSON.stringify(envelope, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const baseName = slugify(draftTitle || valid.mode) || 'assessment';
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${baseName}.assessment.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    downloadTimeoutRef.current = window.setTimeout(() => {
      URL.revokeObjectURL(url);
      downloadTimeoutRef.current = null;
    }, 1000);
  };

  const handleApplyImport = async () => {
    setImportError(null);
    const result = await parseAssessmentImport(importText, courseCode);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }

    setDraft(createInitialDraft(result.assessment, result.kind));
    if (result.title) {
      setDraftTitle(result.title);
    }
    if (result.kind) {
      setImportedKind(result.kind);
    }
    setSelectedIndex(0);
    setValidationError(null);
    setImageError(null);
    setImportOpen(false);
    setImportText('');
    setStatusBanner(
      result.warnings.length > 0
        ? `Imported with warnings: ${result.warnings.join(' ')}`
        : 'Assessment JSON imported.'
    );
  };

  const handleImportFileChange = async (file: File | undefined) => {
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      setImportText(content);
      setImportError(null);
    } catch {
      setImportError('Could not read the selected JSON file.');
    }
  };

  const inputClass =
    'w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 dark:bg-black/75"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-[#121926] dark:text-slate-50"
      >
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-4 py-3 dark:border-slate-700 dark:bg-[#1b2436]">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <ResourceBadge kind={draft.mode} />
            <h2 id={titleId} className="shrink-0 text-sm font-bold sm:text-base">
              Assessment Builder
            </h2>
            <input
              type="text"
              aria-label="Assessment title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="Optional title (e.g. Midterm 1)"
              className="min-w-[140px] max-w-xs flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setImportOpen((prev) => !prev);
                setImportError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Upload className="h-3.5 w-3.5" />
              Import JSON
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-yellow-400 px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-yellow-500"
            >
              Save
            </button>
          </div>
        </div>

        {/* Inline Import Panel */}
        {importOpen && (
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-[#1b2436]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Import `.assessment.json` or bare Assessment JSON
              </p>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200">
                <Upload className="h-3.5 w-3.5" />
                Choose JSON file
                <input
                  type="file"
                  accept=".json,.assessment.json,application/json"
                  aria-label="Import assessment JSON file"
                  className="sr-only"
                  onChange={(e) => {
                    void handleImportFileChange(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <textarea
              rows={4}
              aria-label="Paste assessment JSON"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{"format": "college-assessment", "version": 1, ...}'
              className={`${inputClass} mt-2 font-mono text-xs`}
            />
            {importError && (
              <p
                role="alert"
                className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              >
                {importError}
              </p>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-600 dark:bg-[#0d131f] dark:text-slate-200"
              >
                Close Import
              </button>
              <button
                type="button"
                onClick={() => void handleApplyImport()}
                className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Apply Import
              </button>
            </div>
          </div>
        )}

        {/* Settings Bar */}
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-[#1b2436]/70">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Mode
              <select
                aria-label="Assessment mode"
                value={draft.mode}
                onChange={(e) => {
                  const nextMode = e.target.value as 'exam' | 'assignment';
                  setDraft((prev) => ({ ...prev, mode: nextMode }));
                  setImportedKind(nextMode);
                }}
                className={`${inputClass} mt-1`}
              >
                <option value="exam">Exam</option>
                <option value="assignment">Assignment</option>
              </select>
            </label>

            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Time Limit (min)
              <input
                type="number"
                min={1}
                step={1}
                aria-label="Time limit (minutes)"
                placeholder="No limit"
                value={draft.timeLimitMinutes ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDraft((prev) => ({
                    ...prev,
                    timeLimitMinutes: raw === '' ? undefined : Number(raw),
                  }));
                }}
                className={`${inputClass} mt-1`}
              />
            </label>

            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Passing Score (%)
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                aria-label="Passing score (%)"
                placeholder="70"
                value={draft.passingScorePercent ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDraft((prev) => ({
                    ...prev,
                    passingScorePercent: raw === '' ? undefined : Number(raw),
                  }));
                }}
                className={`${inputClass} mt-1`}
              />
            </label>

            <div className="flex items-end pb-1.5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  aria-label="Shuffle questions"
                  checked={Boolean(draft.shuffleQuestions)}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, shuffleQuestions: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600"
                />
                Shuffle Questions
              </label>
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Instructions (LaTeX supported)
              <textarea
                rows={2}
                aria-label="Instructions"
                value={draft.instructions ?? ''}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, instructions: e.target.value }))
                }
                placeholder="Optional instructions shown before starting (supports $LaTeX$)"
                className={`${inputClass} mt-1`}
              />
            </label>
            {draft.instructions?.trim() ? (
              <div className="rounded-md border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-600 dark:bg-[#0d131f]">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Instructions Preview
                </div>
                <RichMathText text={draft.instructions} as="div" />
              </div>
            ) : (
              <div className="hidden items-center rounded-md border border-dashed border-slate-200 px-3 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500 lg:flex">
                Live LaTeX instructions preview appears here when entered.
              </div>
            )}
          </div>
        </div>

        {/* Status / Validation Banners */}
        {statusBanner && (
          <div className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            <span>{statusBanner}</span>
            <button
              type="button"
              onClick={() => setStatusBanner(null)}
              aria-label="Dismiss notice"
              className="ml-2 rounded p-0.5 hover:bg-amber-200/60 dark:hover:bg-amber-900/40"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {validationError && (
          <div
            role="alert"
            className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {validationError}
          </div>
        )}

        {/* Main Split Body */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[260px_1fr]">
          {/* Left Pane: Question List */}
          <aside className="flex min-h-0 flex-col border-b border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#1b2436]/50 md:border-b-0 md:border-r">
            <button
              type="button"
              onClick={handleAddQuestion}
              className="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Question
            </button>

            <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
              {draft.questions.map((q, idx) => {
                const isSelected = idx === activeIndex;
                const preview =
                  q.header.text?.trim() ||
                  (q.header.imageFile || q.header.imageUrl
                    ? '[Image question]'
                    : 'Untitled question');
                return (
                  <div
                    key={q.id}
                    onClick={() => setSelectedIndex(idx)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedIndex(idx);
                      }
                    }}
                    className={`cursor-pointer rounded-lg border p-2.5 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-white shadow-xs dark:border-blue-400 dark:bg-[#121926]'
                        : 'border-slate-200 bg-white/70 hover:bg-white dark:border-slate-700 dark:bg-[#121926]/60 dark:hover:bg-[#121926]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                          #{idx + 1}
                        </span>
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          {QUESTION_TYPE_LABELS[q.type]}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {q.points ?? 1} pt
                      </span>
                    </div>

                    <p className="mt-1 truncate text-xs text-slate-700 dark:text-slate-200">
                      {preview}
                    </p>

                    <div className="mt-2 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label={`Move question ${idx + 1} up`}
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveQuestion(idx, -1);
                        }}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-35 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move question ${idx + 1} down`}
                        disabled={idx === draft.questions.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveQuestion(idx, 1);
                        }}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-35 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Duplicate question ${idx + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateQuestion(idx);
                        }}
                        className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete question ${idx + 1}`}
                        disabled={draft.questions.length <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteQuestion(idx);
                        }}
                        className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-35 dark:text-red-400 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {draft.questions.length === 1 && (
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                At least 1 question is required.
              </p>
            )}
          </aside>

          {/* Right Pane: Active Question Editor */}
          <div className="min-h-0 space-y-4 overflow-y-auto bg-white p-4 sm:p-5 dark:bg-[#121926]">
            {/* Row 1: Type, Points, ID */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Question Type
                <select
                  aria-label="Question type"
                  value={activeQuestion.type}
                  onChange={(e) =>
                    handleTypeChange(e.target.value as AssessmentQuestionType)
                  }
                  className={`${inputClass} mt-1`}
                >
                  <option value="mcq">Multiple Choice (MCQ)</option>
                  <option value="multi-select">Multi-Select</option>
                  <option value="true-false">True / False</option>
                  <option value="short-answer">Short Answer</option>
                </select>
              </label>

              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Points
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  aria-label="Question points"
                  placeholder="1"
                  value={activeQuestion.points ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateQuestionAt(activeIndex, (prev) => ({
                      ...prev,
                      points: raw === '' ? undefined : Number(raw),
                    }));
                  }}
                  className={`${inputClass} mt-1`}
                />
              </label>

              <div className="flex flex-col justify-end">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Question ID
                </span>
                <span className="mt-1 inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-600 dark:border-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
                  {activeQuestion.id}
                </span>
              </div>
            </div>

            {/* Question Header Text + Live KaTeX Preview */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Prompt Text (LaTeX supported)
                <textarea
                  rows={3}
                  aria-label="Question text"
                  value={activeQuestion.header.text ?? ''}
                  onChange={(e) => {
                    const text = e.target.value;
                    updateQuestionAt(activeIndex, (prev) => ({
                      ...prev,
                      header: { ...prev.header, text },
                    }));
                  }}
                  placeholder="Enter question prompt (e.g. Solve $x^2 - 4 = 0$)"
                  className={`${inputClass} mt-1`}
                />
              </label>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-sm dark:border-slate-600 dark:bg-[#0d131f]">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Prompt Preview
                </div>
                {activeQuestion.header.text?.trim() ? (
                  <RichMathText text={activeQuestion.header.text} as="div" />
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    LaTeX math and text preview appears here.
                  </span>
                )}
              </div>
            </div>

            {/* Header Image */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#1b2436]/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Header Image (optional)
                </div>

                {(activeQuestion.header.imageFile || activeQuestion.header.imageUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageError(null);
                      updateQuestionAt(activeIndex, (prev) => ({
                        ...prev,
                        header: {
                          ...(prev.header.text !== undefined ? { text: prev.header.text } : {}),
                        },
                      }));
                    }}
                    className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-3 w-3" />
                    Remove Image
                  </button>
                )}
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Upload Raster Image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/avif"
                      aria-label="Upload question image"
                      onChange={(e) => {
                        void handleUploadImage(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                      className="mt-1 block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-200 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-300 dark:text-slate-300 dark:file:bg-slate-700 dark:file:text-slate-100"
                    />
                  </label>
                  {activeQuestion.header.imageFile && (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Stored: {activeQuestion.header.imageFile.name} (
                      {formatBytes(activeQuestion.header.imageFile.sizeBytes)})
                    </p>
                  )}
                </div>

                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Or Image URL (https://)
                  <input
                    type="url"
                    aria-label="Question image URL"
                    placeholder="https://example.com/diagram.png"
                    value={activeQuestion.header.imageUrl ?? ''}
                    onChange={(e) => {
                      const nextUrl = e.target.value;
                      setImageError(null);
                      updateQuestionAt(activeIndex, (prev) => ({
                        ...prev,
                        header: {
                          ...(prev.header.text !== undefined ? { text: prev.header.text } : {}),
                          ...(nextUrl ? { imageUrl: nextUrl } : {}),
                        },
                      }));
                    }}
                    className={`${inputClass} mt-1`}
                  />
                </label>
              </div>

              {(imageError || inlineImageUrlError) && (
                <p
                  role="alert"
                  className="mt-2 rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                >
                  {imageError ?? inlineImageUrlError}
                </p>
              )}

              {(activeQuestion.header.imageFile ||
                (activeQuestion.header.imageUrl &&
                  isSafeHttpUrl(activeQuestion.header.imageUrl))) && (
                <div className="mt-3">
                  <QuestionHeaderImage
                    imageFile={activeQuestion.header.imageFile}
                    imageUrl={activeQuestion.header.imageUrl}
                  />
                </div>
              )}
            </div>

            {/* Answer Editor */}
            {(activeQuestion.type === 'mcq' || activeQuestion.type === 'multi-select') && (
              <div className="space-y-2.5 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {activeQuestion.type === 'mcq'
                      ? 'Options (select 1 correct answer)'
                      : 'Options (select all correct answers)'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateQuestionAt(activeIndex, (prev) => ({
                        ...prev,
                        options: [...(prev.options ?? []), `Option ${(prev.options?.length ?? 0) + 1}`],
                      }))
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Plus className="h-3 w-3" />
                    Add Option
                  </button>
                </div>

                {(activeQuestion.options ?? []).map((opt, optIdx) => {
                  const isChecked = (activeQuestion.correctIndices ?? []).includes(optIdx);
                  const hasMath = /\$|\\\(|\\\[/.test(opt);
                  return (
                    <div key={optIdx} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input
                          type={activeQuestion.type === 'mcq' ? 'radio' : 'checkbox'}
                          name={`correct-${activeQuestion.id}`}
                          checked={isChecked}
                          aria-label={`Mark option ${optIdx + 1} as correct`}
                          onChange={() =>
                            updateQuestionAt(activeIndex, (prev) => {
                              if (prev.type === 'mcq') {
                                return { ...prev, correctIndices: [optIdx] };
                              }
                              const current = new Set(prev.correctIndices ?? []);
                              if (current.has(optIdx)) {
                                current.delete(optIdx);
                              } else {
                                current.add(optIdx);
                              }
                              return {
                                ...prev,
                                correctIndices: Array.from(current).sort((a, b) => a - b),
                              };
                            })
                          }
                          className="h-4 w-4 shrink-0"
                        />
                        <input
                          type="text"
                          aria-label={`Option ${optIdx + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const val = e.target.value;
                            updateQuestionAt(activeIndex, (prev) => ({
                              ...prev,
                              options: (prev.options ?? []).map((o, i) =>
                                i === optIdx ? val : o
                              ),
                            }));
                          }}
                          className={inputClass}
                        />
                        <button
                          type="button"
                          aria-label={`Remove option ${optIdx + 1}`}
                          disabled={(activeQuestion.options?.length ?? 0) <= 2}
                          onClick={() =>
                            updateQuestionAt(activeIndex, (prev) => {
                              const nextOpts = (prev.options ?? []).filter(
                                (_, i) => i !== optIdx
                              );
                              const nextIndices = (prev.correctIndices ?? [])
                                .filter((i) => i !== optIdx)
                                .map((i) => (i > optIdx ? i - 1 : i));
                              return {
                                ...prev,
                                options: nextOpts,
                                correctIndices:
                                  prev.type === 'mcq' && nextIndices.length === 0
                                    ? [0]
                                    : nextIndices,
                              };
                            })
                          }
                          className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-35 dark:text-red-400 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {hasMath && (
                        <div className="ml-6 rounded bg-slate-50 px-2 py-1 text-xs dark:bg-[#0d131f]">
                          <RichMathText text={opt} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeQuestion.type === 'true-false' && (
              <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                  True / False Answer
                </span>
                {[0, 1].map((idx) => {
                  const label =
                    activeQuestion.options?.[idx] ?? (idx === 0 ? 'True' : 'False');
                  const checked = (activeQuestion.correctIndices?.[0] ?? 0) === idx;
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`tf-correct-${activeQuestion.id}`}
                        checked={checked}
                        aria-label={`Mark option ${idx + 1} as correct`}
                        onChange={() =>
                          updateQuestionAt(activeIndex, (prev) => ({
                            ...prev,
                            correctIndices: [idx],
                          }))
                        }
                        className="h-4 w-4 shrink-0"
                      />
                      <input
                        type="text"
                        aria-label={`Option ${idx + 1}`}
                        value={label}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateQuestionAt(activeIndex, (prev) => {
                            const current =
                              prev.options && prev.options.length === 2
                                ? [...prev.options]
                                : ['True', 'False'];
                            current[idx] = val;
                            return { ...prev, options: current };
                          });
                        }}
                        className={inputClass}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {activeQuestion.type === 'short-answer' && (
              <div className="space-y-2.5 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Accepted Answers
                  </span>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        aria-label="Case-sensitive"
                        checked={Boolean(activeQuestion.caseSensitive)}
                        onChange={(e) =>
                          updateQuestionAt(activeIndex, (prev) => ({
                            ...prev,
                            caseSensitive: e.target.checked,
                          }))
                        }
                        className="h-3.5 w-3.5 rounded"
                      />
                      Case-sensitive
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateQuestionAt(activeIndex, (prev) => ({
                          ...prev,
                          acceptedAnswers: [...(prev.acceptedAnswers ?? []), ''],
                        }))
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Plus className="h-3 w-3" />
                      Add Accepted Answer
                    </button>
                  </div>
                </div>

                {(activeQuestion.acceptedAnswers ?? []).map((ans, ansIdx) => (
                  <div key={ansIdx} className="flex items-center gap-2">
                    <input
                      type="text"
                      aria-label={`Accepted answer ${ansIdx + 1}`}
                      value={ans}
                      placeholder="Accepted answer text"
                      onChange={(e) => {
                        const val = e.target.value;
                        updateQuestionAt(activeIndex, (prev) => ({
                          ...prev,
                          acceptedAnswers: (prev.acceptedAnswers ?? []).map((a, i) =>
                            i === ansIdx ? val : a
                          ),
                        }));
                      }}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      aria-label={`Remove accepted answer ${ansIdx + 1}`}
                      disabled={(activeQuestion.acceptedAnswers?.length ?? 0) <= 1}
                      onClick={() =>
                        updateQuestionAt(activeIndex, (prev) => ({
                          ...prev,
                          acceptedAnswers: (prev.acceptedAnswers ?? []).filter(
                            (_, i) => i !== ansIdx
                          ),
                        }))
                      }
                      className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-35 dark:text-red-400 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hint & Explanation */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Hint (optional)
                  <input
                    type="text"
                    aria-label="Hint"
                    value={activeQuestion.hint ?? ''}
                    placeholder="Optional hint shown on request in Assignment mode"
                    onChange={(e) =>
                      updateQuestionAt(activeIndex, (prev) => ({
                        ...prev,
                        hint: e.target.value,
                      }))
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
                {activeQuestion.hint?.trim() && (
                  <div className="mt-1.5 rounded bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-[#0d131f]">
                    <RichMathText text={activeQuestion.hint} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Explanation (optional)
                  <textarea
                    rows={2}
                    aria-label="Explanation"
                    value={activeQuestion.explanation ?? ''}
                    placeholder="Shown after checking or submitting"
                    onChange={(e) =>
                      updateQuestionAt(activeIndex, (prev) => ({
                        ...prev,
                        explanation: e.target.value,
                      }))
                    }
                    className={`${inputClass} mt-1`}
                  />
                </label>
                {activeQuestion.explanation?.trim() && (
                  <div className="mt-1.5 rounded bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-[#0d131f]">
                    <RichMathText text={activeQuestion.explanation} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
