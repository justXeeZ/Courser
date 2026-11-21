import { useState } from 'react';
import { AlertCircle, ExternalLink, FileText } from 'lucide-react';
import { openStoredFile } from '@/lib/fileStore';
import { formatBytes } from '@/lib/materialValidation';
import type { LessonResource, StoredFileRef } from '@/types/course';
import { ResourceBadge } from '@/components/ResourceBadge';

interface MaterialListProps {
  resources: LessonResource[];
  emptyText?: string;
}

export function MaterialList({
  resources,
  emptyText = 'No materials linked yet.',
}: MaterialListProps) {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

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
      <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-slate-700 dark:text-slate-400">
        {emptyText}
      </p>
    );
  }

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

      <ul className="space-y-2">
        {resources.map((res, idx) => {
          if (res.file) {
            const file = res.file;
            const isOpening = openingId === file.id;

            return (
              <li key={`${file.id}-${idx}`}>
                <button
                  type="button"
                  disabled={isOpening}
                  onClick={() => void handleOpenFile(file)}
                  className="group flex w-full items-start gap-2.5 rounded-md border border-transparent p-1.5 text-left transition-colors hover:border-gray-200 hover:bg-gray-50 disabled:opacity-60 dark:hover:border-slate-700 dark:hover:bg-slate-800/70"
                >
                  <ResourceBadge kind={res.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 group-hover:text-blue-700 group-hover:decoration-blue-500 dark:text-slate-100 dark:decoration-slate-600 dark:group-hover:text-blue-400 dark:group-hover:decoration-blue-400">
                      {res.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        <FileText className="h-3 w-3" />
                        File
                      </span>
                      <span className="truncate">{file.name}</span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                        {formatBytes(file.sizeBytes)}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          }

          return (
            <li key={`${res.url ?? res.title}-${idx}`}>
              <a
                href={res.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-2.5 rounded-md border border-transparent p-1.5 transition-colors hover:border-gray-200 hover:bg-gray-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/70"
              >
                <ResourceBadge kind={res.kind} />
                <span className="flex-1 text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 group-hover:text-blue-700 group-hover:decoration-blue-500 dark:text-slate-100 dark:decoration-slate-600 dark:group-hover:text-blue-400 dark:group-hover:decoration-blue-400">
                  {res.title}
                </span>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400 group-hover:text-blue-600 dark:text-slate-500 dark:group-hover:text-blue-400" />
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
