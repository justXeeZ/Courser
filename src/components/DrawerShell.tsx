import { useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useDialogFocus } from '@/hooks/useDialogFocus';

interface DrawerShellProps {
  title: string;
  closeLabel?: string;
  onClose: () => void;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

export function DrawerShell({
  title,
  closeLabel = 'Close drawer',
  onClose,
  headerLeft,
  headerRight,
  footer,
  children,
}: DrawerShellProps) {
  const drawerRef = useRef<HTMLElement>(null);

  useDialogFocus({
    isOpen: true,
    containerRef: drawerRef,
    onEscape: onClose,
  });

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-[var(--backdrop-drawer)] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed top-0 right-0 z-40 flex h-dvh w-full flex-col overflow-y-auto border-l border-[var(--border-subtle)] bg-[var(--surface-1)] p-4 text-[var(--text-primary)] shadow-2xl focus:outline-0 sm:max-w-[600px] sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-1.5">{headerLeft}</div>

          <div className="flex items-center gap-2">
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 py-5">{children}</div>

        {footer && (
          <div className="mt-auto border-t border-[var(--border-subtle)] pt-4">
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
