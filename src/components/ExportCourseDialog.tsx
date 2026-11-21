import { useEffect, useState } from 'react';
import { AlertCircle, Download, FileArchive, X } from 'lucide-react';
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

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 dark:bg-black/70"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export Course"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300">
              <FileArchive className="h-4 w-4" />
            </span>
            <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
              Export Course
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="rounded-md bg-gray-100 p-1.5 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs text-gray-600 dark:text-slate-300">
          Download <span className="font-semibold">{course.code}: {course.title}</span> as a
          portable <code className="font-mono">.course.json</code> file that can be shared or
          re-imported from the New Course page.
        </p>

        <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-950">
          <input
            type="checkbox"
            checked={includeFiles}
            onChange={(e) => setIncludeFiles(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 dark:border-slate-600 dark:bg-slate-900"
          />
          <div className="text-xs">
            <div className="font-medium text-gray-900 dark:text-slate-100">
              Include uploaded files
            </div>
            <div className="mt-0.5 text-gray-500 dark:text-slate-400">
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
            className="mb-3 flex items-center gap-1.5 rounded bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-1.5 rounded-md bg-yellow-400 px-3.5 py-1.5 text-sm font-medium text-black hover:bg-yellow-500 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : `Export ${course.slug}.course.json`}
          </button>
        </div>
      </div>
    </div>
  );
}
