import { useEffect, useRef, useState } from 'react';
import type { LessonStatus } from '@/types/course';
import type { NodeAnchorRect } from '@/components/CourseTreeCanvas';
import { StatusSegmentedControl } from '@/components/StatusSegmentedControl';

interface QuickStatusPillProps {
  itemId?: string;
  anchor: NodeAnchorRect;
  currentStatus: LessonStatus;
  onSelectStatus: (status: LessonStatus) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function QuickStatusPill({
  itemId,
  anchor,
  currentStatus,
  onSelectStatus,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: QuickStatusPillProps) {
  const pillRef = useRef<HTMLDivElement>(null);
  const [liveAnchor, setLiveAnchor] = useState<NodeAnchorRect>(anchor);

  useEffect(() => {
    setLiveAnchor(anchor);
  }, [anchor]);

  useEffect(() => {
    if (!itemId) return;

    const syncAnchor = () => {
      const escaped =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(itemId)
          : itemId.replace(/"/g, '\\"');
      const nodeEl = document.querySelector(`g[data-node-id="${escaped}"]`);
      if (!nodeEl) return;
      const rect = nodeEl.getBoundingClientRect();
      setLiveAnchor({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    window.addEventListener('scroll', syncAnchor, { capture: true, passive: true });
    window.addEventListener('resize', syncAnchor, { passive: true });
    return () => {
      window.removeEventListener('scroll', syncAnchor, { capture: true });
      window.removeEventListener('resize', syncAnchor);
    };
  }, [itemId]);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (pillRef.current && !pillRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleFocusIn = (e: FocusEvent) => {
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
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const centerX = liveAnchor.left + liveAnchor.width / 2;
  const maxCenterX = typeof window !== 'undefined' ? window.innerWidth - 12 : centerX;
  const clampedCenterX = Math.max(12, Math.min(centerX, maxCenterX));
  const top = Math.max(12, liveAnchor.top - 46);

  return (
    <div
      ref={pillRef}
      data-testid="quick-status-pill"
      style={{
        left: `${clampedCenterX}px`,
        top: `${top}px`,
        transform: 'translateX(-50%)',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="fixed z-50 pb-3"
    >
      <div className="rounded-md shadow-lg">
        <StatusSegmentedControl
          status={currentStatus}
          onChange={(next) => {
            onSelectStatus(next);
          }}
          showReset
          itemRole="menuitem"
          ariaLabel="Quick status menu"
        />
      </div>
    </div>
  );
}
