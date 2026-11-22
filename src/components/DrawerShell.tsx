import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div
        className="fixed inset-0 z-30 bg-black/40 transition-opacity dark:bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed top-0 right-0 z-40 flex h-dvh w-full flex-col overflow-y-auto bg-white p-4 text-slate-900 shadow-2xl focus:outline-0 sm:max-w-[600px] sm:p-6 dark:border-l dark:border-slate-700/80 dark:bg-[#121926] dark:text-slate-100"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4 dark:border-slate-700/80">
          <div className="flex items-center gap-1.5">{headerLeft}</div>

          <div className="flex items-center gap-2">
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-900 transition-colors hover:bg-slate-200 dark:bg-[#1b2436] dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 py-5">{children}</div>

        {footer && (
          <div className="mt-auto border-t border-slate-200 pt-4 dark:border-slate-700/80">
            {footer}
          </div>
        )}
      </aside>
    </>
  );
}
