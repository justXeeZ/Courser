import { useState } from 'react';
import {
  AlertCircle,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Star,
} from 'lucide-react';
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

function formatDisplayUrl(rawUrl: string): string {
  return rawUrl.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '');
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
      <p className="dashed-box rounded-lg border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
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

  const rowBaseClass =
    'group flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]';

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
            className={`${rowBaseClass} ${
              !onOpenAssessment ? 'cursor-not-allowed opacity-70' : ''
            }`}
          >
            <ResourceBadge kind={res.kind} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <span
                className={`min-w-[140px] flex-1 truncate text-sm font-medium text-[var(--text-primary)] ${
                  onOpenAssessment
                    ? 'underline decoration-[var(--border-strong)] underline-offset-2 group-hover:text-[var(--accent-purple)] group-hover:decoration-[var(--accent-purple)]'
                    : ''
                }`}
              >
                {res.title}
              </span>

              <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <span>
                  {qCount} {qCount === 1 ? 'question' : 'questions'}
                </span>
                {assessment.timeLimitMinutes && (
                  <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-warm-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                    <Clock className="h-3 w-3" />
                    {assessment.timeLimitMinutes} min
                  </span>
                )}
                {score && (
                  <span
                    className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                      score.passed
                        ? 'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]'
                        : 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]'
                    }`}
                  >
                    Best: {score.bestScorePercent}%
                  </span>
                )}
                {!onOpenAssessment && (
                  <span className="text-[11px] text-[var(--text-muted)]">
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
            className={`${rowBaseClass} disabled:opacity-60`}
          >
            <ResourceBadge kind={res.kind} />
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <span className="min-w-[140px] flex-1 truncate text-sm font-medium text-[var(--text-primary)] underline decoration-[var(--border-strong)] underline-offset-2 group-hover:text-[var(--accent-purple)] group-hover:decoration-[var(--accent-purple)]">
                {res.title}
              </span>
              <div
                data-testid="uploaded-file-details"
                className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--text-muted)]"
              >
                <span className="inline-flex items-center gap-1 rounded bg-[var(--surface-warm-muted)] px-1.5 py-0.5 font-medium text-[var(--text-secondary)]">
                  <FileText className="h-3 w-3" />
                  File
                </span>
                <span className="max-w-[120px] truncate" title={file.name}>
                  {file.name}
                </span>
                <span className="rounded bg-[var(--surface-warm-muted)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">
                  {formatBytes(file.sizeBytes)}
                </span>
              </div>
            </div>
            <Eye
              aria-hidden="true"
              data-testid="uploaded-viewer-icon"
              className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent-purple)]"
            />
          </button>
        </li>
      );
    }

    const safeUrl = isSafeHttpUrl(res.url);
    if (!safeUrl) {
      return (
        <li key={`invalid-${res.title}-${idx}`}>
          <div className="flex items-start gap-2.5 bg-[var(--status-danger-bg)] px-3 py-2.5 text-left">
            <ResourceBadge kind={res.kind} />
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-[var(--text-primary)]">
                {res.title}
              </span>
              <div className="mt-1 flex items-center gap-1 text-xs text-[var(--status-danger-text)]">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Invalid or unsupported URL</span>
              </div>
            </div>
          </div>
        </li>
      );
    }

    const displayUrl = formatDisplayUrl(safeUrl);

    if (onOpenMaterialViewer) {
      return (
        <li key={`${safeUrl}-${idx}`}>
          <button
            type="button"
            onClick={() => onOpenMaterialViewer(res)}
            className={rowBaseClass}
          >
            <ResourceBadge kind={res.kind} />
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <span className="min-w-0 w-full truncate text-sm font-medium text-[var(--text-primary)] underline decoration-[var(--border-strong)] underline-offset-2 group-hover:text-[var(--accent-purple)] group-hover:decoration-[var(--accent-purple)] sm:w-auto sm:flex-1">
                {res.title}
              </span>
              <span
                title={safeUrl}
                data-testid="external-resource-url"
                className="max-w-[140px] shrink-0 truncate font-mono text-[11px] text-[var(--text-muted)] sm:max-w-[200px]"
              >
                {displayUrl}
              </span>
            </div>
            <ExternalLink
              aria-hidden="true"
              data-testid="external-resource-icon"
              className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent-purple)]"
            />
          </button>
        </li>
      );
    }

    return (
      <li key={`${safeUrl}-${idx}`}>
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={rowBaseClass}
        >
          <ResourceBadge kind={res.kind} />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary)] underline decoration-[var(--border-strong)] underline-offset-2 group-hover:text-[var(--accent-purple)] group-hover:decoration-[var(--accent-purple)]">
              {res.title}
            </span>
            <span
              title={safeUrl}
              data-testid="external-resource-url"
              className="max-w-[140px] shrink-0 truncate font-mono text-[11px] text-[var(--text-muted)] sm:max-w-[200px]"
            >
              {displayUrl}
            </span>
          </div>
          <ExternalLink
            aria-hidden="true"
            data-testid="external-resource-icon"
            className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent-purple)]"
          />
        </a>
      </li>
    );
  };

  return (
    <div className="space-y-2.5">
      {fileError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs text-[var(--status-danger-text)]"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{fileError}</span>
        </div>
      )}

      <div
        data-testid="materials-card"
        className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)]"
      >
        {recommendedResources.length > 0 && (
          <div
            data-testid="recommended-resources-container"
            className="recommended-group-box m-2 overflow-hidden rounded-md"
          >
            <div className="flex items-center gap-1.5 border-b border-[var(--recommended-border)]/40 px-3 py-1.5">
              <Star className="h-3.5 w-3.5 shrink-0 fill-current text-[var(--recommended-accent)]" />
              <h4 className="text-xs font-semibold tracking-wide text-[var(--recommended-accent)] uppercase">
                Recommended
              </h4>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {recommendedResources.map((res, idx) => renderResourceItem(res, idx))}
            </ul>
          </div>
        )}

        {regularResources.length > 0 && (
          <ul
            className={`divide-y divide-[var(--border-subtle)] ${
              recommendedResources.length > 0
                ? 'border-t border-[var(--border-subtle)]'
                : ''
            }`}
          >
            {regularResources.map((res, idx) => renderResourceItem(res, idx))}
          </ul>
        )}
      </div>
    </div>
  );
}
