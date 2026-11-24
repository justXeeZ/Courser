import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, FileArchive, X } from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { buildCourseExport } from '@/lib/courseExchange';
import { collectReferencedFileIds, getFile } from '@/lib/fileStore';
import { formatBytes } from '@/lib/materialValidation';
import type { CourseTree } from '@/types/course';

interface ExportCourseDialogProps {
  open: boolean;
  course: CourseTree;
  onClose: () => void;
}

export function ExportCourseDialog({ open, course, onClose }: ExportCourseDialogProps) {
  const [includeFiles, setIncludeFiles] = useState(true);
  const [fileSummary, setFileSummary] = useState<{ count: number; totalBytes: number } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setIncludeFiles(true);
    setError(null);

    let cancelled = false;
    const referencedIds = Array.from(collectReferencedFileIds([course]));

    if (referencedIds.length === 0) {
      setFileSummary({ count: 0, totalBytes: 0 });
      return;
    }

    (async () => {
      try {
        let count = 0;
        let totalBytes = 0;
        for (const id of referencedIds) {
          const record = await getFile(id);
          if (record) {
            count += 1;
            totalBytes += record.sizeBytes;
          }
        }
        if (!cancelled) {
          setFileSummary({ count, totalBytes });
        }
      } catch {
        if (!cancelled) {
          setFileSummary({ count: referencedIds.length, totalBytes: 0 });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, course]);

  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus({
    isOpen: open,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  if (!open) return null;

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const json = await buildCourseExport(course, { includeFiles });
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${course.slug}.course.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export course.';
      setError(message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-modal)] p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Export Course"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 text-[var(--text-primary)] shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]">
              <FileArchive className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Export Course
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="rounded-md bg-[var(--surface-2)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs text-[var(--text-secondary)]">
          Download <span className="font-semibold">{course.code}: {course.title}</span> as a
          portable <code className="font-mono">.course.json</code> file that can be shared or
          re-imported from the New Course page.
        </p>

        <label
          htmlFor="export-include-files"
          className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] p-3"
        >
          <input
            id="export-include-files"
            type="checkbox"
            aria-label="Include uploaded files"
            checked={includeFiles}
            onChange={(e) => setIncludeFiles(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--accent-purple)]"
          />
          <div className="text-xs">
            <div className="font-medium text-[var(--text-primary)]">
              Include uploaded files
            </div>
            <div className="mt-0.5 text-[var(--text-muted)]">
              {fileSummary === null
                ? 'Calculating attached file size...'
                : fileSummary.count === 0
                  ? 'No uploaded file attachments in this course (URL links only).'
                  : `Embed ${fileSummary.count} uploaded file${fileSummary.count === 1 ? '' : 's'} (${formatBytes(fileSummary.totalBytes)}) as base64. Uncheck for a lightweight export.`}
            </div>
          </div>
        </label>

        {error && (
          <div
            role="alert"
            className="mb-3 flex items-center gap-1.5 rounded border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-2.5 py-2 text-xs text-[var(--status-danger-text)]"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3.5 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--cta-bg)] px-3.5 py-1.5 text-sm font-medium text-[var(--cta-text)] hover:bg-[var(--cta-bg-hover)] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : `Export ${course.slug}.course.json`}
          </button>
        </div>
      </div>
    </div>
  );
}
