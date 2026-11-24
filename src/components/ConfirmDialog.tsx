import { useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogFocus({
    isOpen: open,
    containerRef: dialogRef,
    onEscape: onCancel,
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--backdrop-modal)] p-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-5 text-[var(--text-primary)] shadow-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel"
            className="rounded-md bg-[var(--surface-2)] p-1 text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-5 text-sm text-[var(--text-secondary)]">{description}</p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--border-strong)] bg-[var(--surface-1)] px-3.5 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-[var(--danger-solid-bg)] px-3.5 py-1.5 text-sm font-medium text-white hover:bg-[var(--danger-solid-hover)]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
