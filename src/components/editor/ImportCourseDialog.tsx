import { useEffect, useRef, useState } from 'react';
import { AlertCircle, FileUp, Upload, X } from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { parseCourseImport } from '@/lib/courseExchange';
import type { CourseTree } from '@/types/course';

interface ImportCourseDialogProps {
  open: boolean;
  existingSlugs: string[];
  onImported: (course: CourseTree, warnings: string[]) => void;
  onClose: () => void;
}

async function readTextFromFile(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Response(file).text();
}

export function ImportCourseDialog({
  open,
  existingSlugs,
  onImported,
  onClose,
}: ImportCourseDialogProps) {
  const [jsonText, setJsonText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus({
    isOpen: open,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const content = await readTextFromFile(file);
      setJsonText(content);
      setFileName(file.name);
    } catch {
      setError('Could not read the selected file.');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setImporting(true);
    try {
      const result = await parseCourseImport(jsonText, existingSlugs);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJsonText('');
      setFileName(null);
      onImported(result.course, result.warnings);
      onClose();
    } catch {
      setError('Failed to import course data. Please check browser storage availability.');
    } finally {
      setImporting(false);
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
        aria-label="Import Course"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 text-[var(--text-primary)] shadow-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]">
              <Upload className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Import Course JSON
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Upload a <code className="font-mono">.course.json</code> export or paste course JSON.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close import dialog"
            className="rounded-md bg-[var(--surface-2)] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="dashed-box flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--surface-inset)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <FileUp className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <span>{fileName ? `Loaded: ${fileName}` : 'Choose a .course.json or .json file'}</span>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-[var(--border-strong)] bg-[var(--surface-1)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)]">
              <span>Browse File</span>
              <input
                type="file"
                accept=".json,.course.json,application/json"
                aria-label="Upload course JSON file"
                className="sr-only"
                onChange={(e) => {
                  void handleFileChange(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <div>
            <label
              htmlFor="import-course-json"
              className="mb-1 block text-xs font-medium text-[var(--text-secondary)]"
            >
              Course JSON
            </label>
            <textarea
              id="import-course-json"
              rows={7}
              value={jsonText}
              onChange={(e) => {
                setJsonText(e.target.value);
                setError(null);
              }}
              placeholder='Paste .course.json envelope or bare course object here...'
              className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] p-2.5 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] px-3 py-2 text-xs text-[var(--status-danger-text)]"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3.5 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!jsonText.trim() || importing}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--cta-bg)] px-3.5 py-1.5 text-sm font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {importing ? 'Importing...' : 'Import Course'}
          </button>
        </div>
      </div>
    </div>
  );
}
