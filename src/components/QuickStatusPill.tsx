import { useEffect, useRef } from 'react';
import type { LessonStatus } from '@/types/course';
import type { NodeAnchorRect } from '@/components/CourseTreeCanvas';
import { StatusSegmentedControl } from '@/components/StatusSegmentedControl';

interface QuickStatusPillProps {
  anchor: NodeAnchorRect;
  currentStatus: LessonStatus;
  onSelectStatus: (status: LessonStatus) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function QuickStatusPill({
  anchor,
  currentStatus,
  onSelectStatus,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: QuickStatusPillProps) {
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const rightEdge = anchor.left + anchor.width;
  const maxRight = typeof window !== 'undefined' ? window.innerWidth - 12 : rightEdge;
  const clampedRight = Math.max(12, Math.min(rightEdge, maxRight));
  const top = Math.max(40, anchor.top + 1);

  return (
    <div
      ref={pillRef}
      data-testid="quick-status-pill"
      style={{
        left: `${clampedRight}px`,
        top: `${top}px`,
        transform: 'translate(-100%, -100%)',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-50"
    >
      <div className="rounded-t-md shadow-md">
        <StatusSegmentedControl
          status={currentStatus}
          onChange={(next) => {
            onSelectStatus(next);
            onClose();
          }}
          showReset
          attachedToNode
          itemRole="menuitem"
          ariaLabel="Quick status menu"
        />
      </div>
    </div>
  );
}
