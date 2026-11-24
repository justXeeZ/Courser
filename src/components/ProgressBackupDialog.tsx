import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileUp, Upload, X } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useDialogFocus } from '@/hooks/useDialogFocus';
import { useProgress } from '@/store/useProgressStore';

interface ProgressBackupDialogProps {
  open: boolean;
  onClose: () => void;
  course?: {
    slug: string;
    code: string;
    title: string;
  };
}

export function ProgressBackupDialog({ open, onClose, course }: ProgressBackupDialogProps) {
  const {
    exportProgressJson,
    importProgressJson,
    exportCourseProgressJson,
    importCourseProgressJson,
  } = useProgress();

  const [scope, setScope] = useState<'course' | 'all'>(course ? 'course' : 'all');
  const [importText, setImportText] = useState('');
  const [importNotice, setImportNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (open) {
      setScope(course ? 'course' : 'all');
      setImportNotice(null);
    }
  }, [open, course]);

  useDialogFocus({
    isOpen: open && !confirmRestoreOpen,
    containerRef: dialogRef,
    onEscape: onClose,
  });

  if (!open) return null;

  const isCourseScope = Boolean(course && scope === 'course');

  const handleDownload = () => {
    const json = isCourseScope && course ? exportCourseProgressJson(course.slug) : exportProgressJson();
    const filename =
      isCourseScope && course ? `${course.slug}-progress.json` : BRAND.progressBackupFilename;
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImportText(reader.result);
        setImportNotice(null);
      }
    };
    reader.onerror = () => {
      setImportNotice({ ok: false, text: 'Could not read the selected file.' });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportSubmit = () => {
    if (!importText.trim()) return;
    setConfirmRestoreOpen(true);
  };

  const handleConfirmRestore = () => {
    setConfirmRestoreOpen(false);
    const result =
      isCourseScope && course
        ? importCourseProgressJson(course.slug, importText)
        : importProgressJson(importText);

    if (result.ok) {
      setImportNotice({
        ok: true,
        text:
          isCourseScope && course
            ? `Progress restored for ${course.code}.`
            : 'Progress restored for all courses.',
      });
      setImportText('');
    } else {
      setImportNotice({ ok: false, text: result.error });
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-modal)] p-4 backdrop-blur-[1px]"
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="w-full max-w-md rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 text-[var(--text-primary)] shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id={titleId} className="text-base font-bold text-[var(--text-primary)]">
              Backup &amp; Restore Progress
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close backup dialog"
              className="rounded-md bg-[var(--surface-2)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {course && (
            <div
              role="tablist"
              aria-label="Backup scope"
              className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'course'}
                onClick={() => {
                  setScope('course');
                  setImportNotice(null);
                }}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  scope === 'course'
                    ? 'bg-[var(--solid-bg)] text-[var(--solid-text)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                This Course ({course.code})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={scope === 'all'}
                onClick={() => {
                  setScope('all');
                  setImportNotice(null);
                }}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  scope === 'all'
                    ? 'bg-[var(--solid-bg)] text-[var(--solid-text)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                All Courses
              </button>
            </div>
          )}

          <p className="mb-4 text-xs text-[var(--text-secondary)]">
            {isCourseScope && course
              ? `Export or restore progress, bookmark, and assessment scores for ${course.code} only.`
              : 'Your progress is saved locally in this browser. Export a JSON backup to transfer across devices or keep a semester copy.'}
          </p>

          <button
            type="button"
            onClick={handleDownload}
            className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--cta-bg)] px-3 py-2 text-sm font-medium text-[var(--cta-text)] hover:bg-[var(--cta-bg-hover)]"
          >
            <Download className="h-4 w-4" />
            {isCourseScope && course
              ? `Download ${course.code} Progress JSON`
              : 'Download Progress JSON'}
          </button>

          <div className="border-t border-[var(--border-subtle)] pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <label
                htmlFor="import-progress-json"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                Restore from JSON
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload progress JSON file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
              >
                <FileUp className="h-3.5 w-3.5" />
                Upload .json
              </button>
            </div>

            <textarea
              id="import-progress-json"
              rows={4}
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportNotice(null);
              }}
              placeholder='Paste exported JSON here or upload a .json file (e.g. {"version":1,...})'
              className="mb-2 w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface-inset)] p-2 font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-focus)] focus:ring-2 focus:ring-[var(--border-focus)]/20 focus:outline-none"
            />

            {importNotice && (
              <div
                role={importNotice.ok ? 'status' : 'alert'}
                className={`mb-2 flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs ${
                  importNotice.ok
                    ? 'border-[var(--status-done-border)] bg-[var(--status-done-bg)] text-[var(--status-done-text)]'
                    : 'border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]'
                }`}
              >
                {importNotice.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                )}
                {importNotice.text}
              </div>
            )}

            <button
              type="button"
              onClick={handleImportSubmit}
              disabled={!importText.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[var(--solid-bg)] px-3 py-2 text-sm font-semibold text-[var(--solid-text)] hover:bg-[var(--solid-bg-hover)] disabled:opacity-40"
            >
              <Upload className="h-4 w-4" />
              {isCourseScope && course ? `Restore ${course.code} Progress` : 'Restore Progress'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRestoreOpen}
        title={
          isCourseScope && course
            ? `Restore ${course.code} progress from JSON?`
            : 'Restore progress from JSON?'
        }
        description={
          isCourseScope && course
            ? `This will overwrite your saved progress, bookmark, and assessment scores for ${course.code} only. Other courses will remain unchanged.`
            : 'This will overwrite your current saved progress, bookmarks, and assessment scores across all courses.'
        }
        confirmLabel="Restore Progress"
        onConfirm={handleConfirmRestore}
        onCancel={() => setConfirmRestoreOpen(false)}
      />
    </>
  );
}
