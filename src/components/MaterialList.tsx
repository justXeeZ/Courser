import { useState } from 'react';
import {
  AlertCircle,
  ClipboardCheck,
  Clock,
  ExternalLink,
  Eye,
  FileText,
} from 'lucide-react';
import { resolveEmbedUrl } from '@/lib/embedResolver';
import { openStoredFile } from '@/lib/fileStore';
import { formatBytes } from '@/lib/materialValidation';
import type { AssessmentScoreRecord } from '@/lib/storage/types';
import { useProgress } from '@/store/useProgressStore';
import type { LessonResource, StoredFileRef } from '@/types/course';
import { ResourceBadge } from '@/components/ResourceBadge';

interface MaterialListProps {
  resources: LessonResource[];
  emptyText?: string;
  courseSlug?: string;
  itemId?: string;
  onOpenMaterialViewer?: (resource: LessonResource) => void;
  onOpenAssessment?: (resource: LessonResource) => void;
  getAssessmentScore?: (resource: LessonResource) => AssessmentScoreRecord | undefined;
}

function useOptionalProgress() {
  try {
    return useProgress();
  } catch {
    return null;
  }
}

function isSafeHttpUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

export function MaterialList({
  resources,
  emptyText = 'No materials linked yet.',
  courseSlug,
  itemId,
  onOpenMaterialViewer,
  onOpenAssessment,
  getAssessmentScore: getAssessmentScoreProp,
}: MaterialListProps) {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const progress = useOptionalProgress();

  const handleOpenFile = async (file: StoredFileRef) => {
    setFileError(null);
    setOpeningId(file.id);
    try {
      const opened = await openStoredFile(file.id);
      if (!opened) {
        setFileError(`"${file.name}" could not be found in local browser storage.`);
      }
    } catch {
      setFileError(`Unable to open "${file.name}" from local browser storage.`);
    } finally {
      setOpeningId((current) => (current === file.id ? null : current));
    }
  };

  if (resources.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
        {emptyText}
      </p>
    );
  }

  const recommendedResources = resources.filter((r) => Boolean(r.recommended));
  const regularResources = resources.filter((r) => !r.recommended);

  const resolveScore = (res: LessonResource): AssessmentScoreRecord | undefined => {
    if (getAssessmentScoreProp) return getAssessmentScoreProp(res);
    if (progress && courseSlug && itemId) {
      return progress.getAssessmentScore(courseSlug, itemId, res.title);
    }
    return undefined;
  };

  const rowHoverClass =
    'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-[#1b2436]/80';

  const renderResourceItem = (res: LessonResource, idx: number) => {
    if (res.assessment) {
      const assessment = res.assessment;
      const score = resolveScore(res);
      const qCount = assessment.questions.length;
      const modeLabel = assessment.mode === 'exam' ? 'Exam' : 'Assignment';

      return (
        <li key={`assessment-${res.title}-${idx}`}>
          <button
            type="button"
            disabled={!onOpenAssessment}
            onClick={() => onOpenAssessment?.(res)}
            title={
              onOpenAssessment
                ? `Start ${modeLabel}: ${res.title}`
                : 'Open from course view to launch interactive assessment'
            }
            className={`group flex w-full items-start gap-2.5 rounded-md border p-2 text-left transition-colors ${rowHoverClass} ${
              !onOpenAssessment ? 'cursor-not-allowed opacity-70' : ''
            }`}
          >
            <ResourceBadge kind={res.kind} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`text-sm font-medium text-slate-900 dark:text-slate-100 ${
                    onOpenAssessment
                      ? 'underline decoration-slate-300 underline-offset-2 group-hover:text-blue-700 group-hover:decoration-blue-500 dark:decoration-slate-600 dark:group-hover:text-blue-400 dark:group-hover:decoration-blue-400'
                      : ''
                  }`}
                >
                  {res.title}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700 dark:bg-[#1b2436] dark:text-slate-200">
                  <ClipboardCheck className="h-3 w-3" />
                  {modeLabel}
                </span>
                <span>
                  {qCount} {qCount === 1 ? 'question' : 'questions'}
                </span>
                {assessment.timeLimitMinutes && (
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-[#1b2436] dark:text-slate-300">
                    <Clock className="h-3 w-3" />
                    {assessment.timeLimitMinutes} min
                  </span>
                )}
                {score && (
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                      score.passed
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300'
                    }`}
                  >
                    Best: {score.bestScorePercent}%
                  </span>
                )}
                {!onOpenAssessment && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Available in course view
                  </span>
                )}
              </div>
            </div>
          </button>
        </li>
      );
    }

    if (res.file) {
      const file = res.file;
      const isOpening = openingId === file.id;

      return (
        <li key={`${file.id}-${idx}`}>
          <button
            type="button"
            disabled={!onOpenMaterialViewer && isOpening}
            onClick={() => {
              if (onOpenMaterialViewer) {
                onOpenMaterialViewer(res);
              } else {
                void handleOpenFile(file);
              }
            }}
            className={`group flex w-full items-start gap-2.5 rounded-md border p-2 text-left transition-colors disabled:opacity-60 ${rowHoverClass}`}
          >
            <ResourceBadge kind={res.kind} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 group-hover:text-blue-700 group-hover:decoration-blue-500 dark:text-slate-100 dark:decoration-slate-600 dark:group-hover:text-blue-400 dark:group-hover:decoration-blue-400">
                  {res.title}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700 dark:bg-[#1b2436] dark:text-slate-300">
                  <FileText className="h-3 w-3" />
                  File
                </span>
                <span className="truncate">{file.name}</span>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-[#1b2436] dark:text-slate-300">
                  {formatBytes(file.sizeBytes)}
                </span>
                {onOpenMaterialViewer && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                    <Eye className="h-3 w-3" />
                    Viewer
                  </span>
                )}
              </div>
            </div>
          </button>
        </li>
      );
    }

    const safeUrl = isSafeHttpUrl(res.url);
    if (!safeUrl) {
      return (
        <li key={`invalid-${res.title}-${idx}`}>
          <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50/60 p-2 text-left dark:border-red-900/60 dark:bg-red-950/30">
            <ResourceBadge kind={res.kind} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {res.title}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-red-700 dark:text-red-300">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Invalid or unsupported URL</span>
              </div>
            </div>
          </div>
        </li>
      );
    }

    const resolved = resolveEmbedUrl(safeUrl);
    if (onOpenMaterialViewer && resolved.kind !== 'external') {
      return (
        <li key={`${safeUrl}-${idx}`}>
          <div
            className={`flex items-start gap-2 rounded-md border p-2 transition-colors ${rowHoverClass}`}
          >
            <button
              type="button"
              onClick={() => onOpenMaterialViewer(res)}
              className="group flex min-w-0 flex-1 items-start gap-2.5 text-left"
            >
              <ResourceBadge kind={res.kind} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 group-hover:text-blue-700 group-hover:decoration-blue-500 dark:text-slate-100 dark:decoration-slate-600 dark:group-hover:text-blue-400 dark:group-hover:decoration-blue-400">
                    {res.title}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700 dark:bg-[#1b2436] dark:text-slate-200">
                    <Eye className="h-3 w-3" />
                    {resolved.providerLabel}
                  </span>
                </div>
              </div>
            </button>
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${res.title} in new tab`}
              title="Open in new tab"
              className="mt-0.5 shrink-0 rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-blue-400"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </li>
      );
    }

    return (
      <li key={`${safeUrl}-${idx}`}>
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`group flex items-start gap-2.5 rounded-md border p-2 transition-colors ${rowHoverClass}`}
        >
          <ResourceBadge kind={res.kind} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 group-hover:text-blue-700 group-hover:decoration-blue-500 dark:text-slate-100 dark:decoration-slate-600 dark:group-hover:text-blue-400 dark:group-hover:decoration-blue-400">
                {res.title}
              </span>
            </div>
          </div>
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-blue-600 dark:text-slate-500 dark:group-hover:text-blue-400" />
        </a>
      </li>
    );
  };

  return (
    <div className="space-y-2.5">
      {fileError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{fileError}</span>
        </div>
      )}

      {recommendedResources.length > 0 && (
        <div
          data-testid="recommended-resources-container"
          className="rounded-lg border-2 border-dotted border-[var(--recommended-border)] bg-[var(--recommended-bg)] p-3"
        >
          <h4 className="mb-2 text-xs font-semibold tracking-wide text-[var(--recommended-accent)] uppercase">
            Recommended
          </h4>
          <ul className="space-y-1.5">
            {recommendedResources.map((res, idx) => renderResourceItem(res, idx))}
          </ul>
        </div>
      )}

      {regularResources.length > 0 && (
        <ul className="space-y-2">
          {regularResources.map((res, idx) => renderResourceItem(res, idx))}
        </ul>
      )}
    </div>
  );
}
