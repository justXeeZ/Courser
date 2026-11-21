import { useEffect, useRef } from 'react';
import { BookOpen, CheckCircle2, Ban, RotateCcw } from 'lucide-react';
import type { LessonStatus } from '@/types/course';
import type { NodeAnchorRect } from '@/components/CourseTreeCanvas';

interface QuickStatusPillProps {
  anchor: NodeAnchorRect;
  currentStatus: LessonStatus;
  onSelectStatus: (status: LessonStatus) => void;
  onClose: () => void;
}

export function QuickStatusPill({
  anchor,
  currentStatus,
  onSelectStatus,
  onClose,
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

  const pick = (next: LessonStatus) => {
    onSelectStatus(next === currentStatus ? 'todo' : next);
    onClose();
  };

  return (
    <div
      ref={pillRef}
      role="menu"
      aria-label="Quick lesson status"
      style={{ left: `${left}px`, top: `${top}px` }}
      className="fixed z-50 inline-flex items-center overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => pick('learning')}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100 ${
          currentStatus === 'learning' ? 'bg-violet-50 text-violet-700' : 'text-gray-700'
        }`}
      >
        <BookOpen className="h-3.5 w-3.5 text-violet-600" />
        Learning
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => pick('done')}
        className={`inline-flex items-center gap-1.5 border-l border-gray-300 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100 ${
          currentStatus === 'done' ? 'bg-green-50 text-green-700' : 'text-gray-700'
        }`}
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        Done
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => pick('skipped')}
        className={`inline-flex items-center gap-1.5 border-l border-gray-300 px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100 ${
          currentStatus === 'skipped' ? 'bg-teal-50 text-teal-800' : 'text-gray-700'
        }`}
      >
        <Ban className="h-3.5 w-3.5 text-teal-700" />
        Skip
      </button>
      {currentStatus !== 'todo' && (
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            onSelectStatus('todo');
            onClose();
          }}
          className="inline-flex items-center gap-1 border-l border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          title="Reset to Todo"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
