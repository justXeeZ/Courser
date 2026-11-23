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

  const pillWidth = 276;
  const centerX = anchor.left + anchor.width / 2;
  const maxLeft = typeof window !== 'undefined' ? window.innerWidth - pillWidth - 12 : centerX;
  const left = Math.max(12, Math.min(centerX - pillWidth / 2, maxLeft));
  const top = Math.max(12, anchor.top - 46);

  return (
    <div
      ref={pillRef}
      style={{ left: `${left}px`, top: `${top}px` }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-50 pb-3"
    >
      <div className="rounded-md shadow-lg">
        <StatusSegmentedControl
          status={currentStatus}
          onChange={(next) => {
            onSelectStatus(next);
            onClose();
          }}
          showReset
          itemRole="menuitem"
          ariaLabel="Quick status menu"
        />
      </div>
    </div>
  );
}
