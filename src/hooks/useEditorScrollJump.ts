import { useCallback, useEffect, useRef, type DependencyList } from 'react';

export type EditorJumpKind = 'chapter' | 'lesson' | 'supplement';

export interface EditorJumpTarget {
  kind: EditorJumpKind;
  id: string;
}

const JUMP_SELECTORS: Record<
  EditorJumpKind,
  { attr: string; inputSelector: string }
> = {
  chapter: {
    attr: 'data-edit-chapter',
    inputSelector: 'input[aria-label^="Chapter "][aria-label$=" title"], input, textarea',
  },
  lesson: {
    attr: 'data-edit-lesson',
    inputSelector: 'input[aria-label="Sub-Lesson Title"], input, textarea',
  },
  supplement: {
    attr: 'data-edit-supplement',
    inputSelector: 'input[aria-label="Supplement Title"], input, textarea',
  },
};

/**
 * Shared scroll-and-focus jump coordinator for editor entries (chapters,
 * sub-lessons, and supplements) when adding items or jumping from Live Tree Preview.
 */
export function useEditorScrollJump(isActive: boolean, deps: DependencyList) {
  const pendingJumpRef = useRef<EditorJumpTarget | null>(null);

  const scheduleJump = useCallback((target: EditorJumpTarget) => {
    pendingJumpRef.current = target;
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const jump = pendingJumpRef.current;
    if (!jump) return;

    const { attr, inputSelector } = JUMP_SELECTORS[jump.kind];
    const targetEl = Array.from(document.querySelectorAll(`[${attr}]`)).find(
      (node) => node.getAttribute(attr) === jump.id
    );
    if (!targetEl) return;

    pendingJumpRef.current = null;

    if (typeof targetEl.scrollIntoView === 'function') {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    const firstInput = targetEl.querySelector<HTMLElement>(inputSelector);
    if (firstInput && typeof firstInput.focus === 'function') {
      try {
        firstInput.focus({ preventScroll: true });
      } catch {
        firstInput.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, ...deps]);

  return { scheduleJump };
}
