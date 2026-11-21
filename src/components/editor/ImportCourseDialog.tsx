import { useEffect, useState } from 'react';
import { AlertCircle, FileUp, Upload, X } from 'lucide-react';
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
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import Course"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300">
              <Upload className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                Import Course JSON
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                Upload a <code className="font-mono">.course.json</code> export or paste course JSON.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close import dialog"
            className="rounded-md bg-gray-100 p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-950">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300">
              <FileUp className="h-4 w-4 shrink-0 text-gray-500 dark:text-slate-400" />
              <span>{fileName ? `Loaded: ${fileName}` : 'Choose a .course.json or .json file'}</span>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
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
              className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300"
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
              className="w-full rounded-md border border-gray-300 bg-white p-2.5 font-mono text-xs text-gray-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
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
            className="rounded-md border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!jsonText.trim() || importing}
            className="inline-flex items-center gap-1.5 rounded-md bg-yellow-400 px-3.5 py-1.5 text-sm font-semibold text-black hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {importing ? 'Importing...' : 'Import Course'}
          </button>
        </div>
      </div>
    </div>
  );
}
