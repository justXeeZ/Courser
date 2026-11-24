import { useEffect, useId, useRef, type RefObject } from 'react';
import { isTopmostDialog, pushDialog, removeDialog } from '@/lib/dialogStack';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    if (el.hasAttribute('disabled') || el.getAttribute('aria-hidden') === 'true') {
      return false;
    }
    return true;
  });
}

interface UseDialogFocusOptions {
  isOpen: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape?: () => void;
}

export function useDialogFocus({
  isOpen,
  containerRef,
  initialFocusRef,
  onEscape,
}: UseDialogFocusOptions): void {
  const dialogId = useId();
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pushDialog(dialogId);

    const container = containerRef.current;
    if (container) {
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      const preferred = initialFocusRef?.current;
      if (preferred && container.contains(preferred)) {
        preferred.focus();
      } else if (!container.contains(document.activeElement)) {
        const focusables = getFocusableElements(container);
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          container.focus();
        }
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isTopmostDialog(dialogId)) return;

      if (e.key === 'Escape' && onEscapeRef.current) {
        e.preventDefault();
        e.stopPropagation();
        onEscapeRef.current();
        return;
      }

      if (e.key === 'Tab' && containerRef.current) {
        const focusables = getFocusableElements(containerRef.current);
        if (focusables.length === 0) {
          e.preventDefault();
          containerRef.current.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !containerRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !containerRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      removeDialog(dialogId);
      const prev = previousFocusRef.current;
      previousFocusRef.current = null;
      if (prev && document.contains(prev) && typeof prev.focus === 'function') {
        prev.focus();
      }
    };
  }, [isOpen, dialogId, containerRef, initialFocusRef]);
}
