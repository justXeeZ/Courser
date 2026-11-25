import { ArrowDown, ArrowUp } from 'lucide-react';

interface ReorderButtonsProps {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  upLabel: string;
  downLabel: string;
}

export function ReorderButtons({
  canMoveUp,
  canMoveDown,
  onMove,
  upLabel,
  downLabel,
}: ReorderButtonsProps) {
  return (
    <>
      <button
        type="button"
        disabled={!canMoveUp}
        onClick={() => onMove(-1)}
        title={upLabel}
        aria-label={upLabel}
        className="rounded border border-[var(--border-strong)] bg-[var(--surface-1)] p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-30"
      >
        <ArrowUp className="h-3 w-3" />
      </button>
      <button
        type="button"
        disabled={!canMoveDown}
        onClick={() => onMove(1)}
        title={downLabel}
        aria-label={downLabel}
        className="rounded border border-[var(--border-strong)] bg-[var(--surface-1)] p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] disabled:opacity-30"
      >
        <ArrowDown className="h-3 w-3" />
      </button>
    </>
  );
}
