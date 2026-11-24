import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type RefObject,
  type SyntheticEvent,
  type TouchEvent,
} from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import { isLeafChapter } from '@/lib/courseItems';
import { ROADMAP_COLORS } from '@/lib/theme';
import { NODE_LINE_HEIGHT, type TreeLayout } from '@/lib/layoutTree';
import type { Chapter, LessonStatus } from '@/types/course';
import { computeChapterStats } from '@/store/useProgressStore';

export type StatusFilter = 'all' | 'todo' | 'learning' | 'done' | 'skipped';

export interface NodeAnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface CourseTreeCanvasProps {
  layout: TreeLayout;
  statuses: Record<string, LessonStatus>;
  activeLessonId?: string | null;
  activeChapterId?: string | null;
  statusFilter?: StatusFilter;
  framed?: boolean;
  svgRef?: RefObject<SVGSVGElement | null>;
  onSelectLesson: (lessonId: string) => void;
  onSelectChapter?: (chapter: Chapter) => void;
  onQuickToggleDone: (lessonId: string) => void;
  onContextMenuLesson: (lessonId: string, anchor: NodeAnchorRect) => void;
  onHoverLesson?: (lessonId: string, anchor: NodeAnchorRect) => void;
  onLeaveLesson?: (lessonId: string) => void;
}

function getStatusClass(status: LessonStatus): string {
  if (status === 'done') return 'node-done';
  if (status === 'learning') return 'node-learning';
  if (status === 'skipped') return 'node-skipped';
  return '';
}

function renderStatusCornerBadge(status: LessonStatus, x: number, y: number) {
  if (status === 'todo') return null;

  if (status === 'done') {
    return (
      <g data-status-badge="done" transform={`translate(${x}, ${y})`}>
        <circle
          cx={8}
          cy={8}
          r={9}
          fill={ROADMAP_COLORS.statusDoneBadgeFill}
          stroke="#ffffff"
          strokeWidth={1.5}
        />
        <path
          d="M 4.5 8.2 L 7 10.6 L 11.6 5.6"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
  }

  if (status === 'learning') {
    return (
      <g data-status-badge="learning" transform={`translate(${x}, ${y})`}>
        <circle
          cx={8}
          cy={8}
          r={8}
          fill={ROADMAP_COLORS.statusLearningBadgeFill}
          stroke="#ffffff"
          strokeWidth={1.5}
        />
        <circle cx={8} cy={8} r={3} fill="#ffffff" />
      </g>
    );
  }

  return (
    <g data-status-badge="skipped" transform={`translate(${x}, ${y})`}>
      <circle
        cx={8}
        cy={8}
        r={8}
        fill={ROADMAP_COLORS.statusSkippedFill}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
      <line
        x1={4.5}
        y1={8}
        x2={11.5}
        y2={8}
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </g>
  );
}

export function CourseTreeCanvas({
  layout,
  statuses,
  activeLessonId,
  activeChapterId,
  statusFilter = 'all',
  framed = true,
  svgRef,
  onSelectLesson,
  onSelectChapter,
  onQuickToggleDone,
  onContextMenuLesson,
  onHoverLesson,
  onLeaveLesson,
}: CourseTreeCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const zoomWrapperRef = useRef<HTMLDivElement | null>(null);
  const pinchStateRef = useRef<{
    active: boolean;
    startDist: number;
    startZoom: number;
  }>({
    active: false,
    startDist: 0,
    startZoom: 1,
  });

  const getCenteredPanX = (targetZoom = 1) => {
    const cw = scrollContainerRef.current?.clientWidth ?? 0;
    const sw =
      zoomWrapperRef.current?.offsetWidth ||
      Math.round(Math.min(layout.width, 640) * targetZoom);
    if (cw > 0 && sw > cw) {
      return -Math.round((sw - cw) / 2);
    }
    return 0;
  };

  const getFitZoom = () => {
    const cw = scrollContainerRef.current?.clientWidth ?? 0;
    if (cw > 0 && cw < layout.width) {
      return Math.max(0.5, Math.min(1, Number(((cw - 16) / layout.width).toFixed(2))));
    }
    return 1;
  };

  useEffect(() => {
    const isNarrowMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const initialZoom = isNarrowMobile ? getFitZoom() : 1;
    setZoom(initialZoom);
    setPan({ x: getCenteredPanX(initialZoom), y: 0 });
  }, [layout.width]);

  const clampPan = (rawX: number, rawY: number, targetZoom = zoom) => {
    const container = scrollContainerRef.current;
    const content = zoomWrapperRef.current;
    const cw = container?.clientWidth ?? 0;
    const ch = container?.clientHeight ?? 0;

    if (cw <= 0 || ch <= 0) {
      const boundX = Math.round(layout.width * targetZoom);
      const boundY = Math.round(layout.height * targetZoom);
      return {
        x: Math.max(-boundX, Math.min(boundX, rawX)),
        y: Math.max(-boundY, Math.min(boundY, rawY)),
      };
    }

    const sw = content?.offsetWidth || Math.round(layout.width * targetZoom);
    const sh = content?.offsetHeight || Math.round(layout.height * targetZoom);
    const slack = 64;

    const minX = sw > cw ? -(sw - cw) - slack : -Math.round((cw - sw) / 2) - slack;
    const maxX = sw > cw ? slack : Math.round((cw - sw) / 2) + slack;

    const minY = sh > ch ? -(sh - ch) - slack : -slack;
    const maxY = sh > ch ? slack : (ch - sh) + slack;

    return {
      x: Math.max(minX, Math.min(maxX, rawX)),
      y: Math.max(minY, Math.min(maxY, rawY)),
    };
  };

  const applyZoom = (nextZoom: number) => {
    setZoom(nextZoom);
    setPan((prev) => clampPan(prev.x, prev.y, nextZoom));
  };
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    moved: boolean;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    moved: false,
  });

  const startPanDrag = (clientX: number, clientY: number) => {
    dragStateRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      moved: false,
    };
    setIsDragging(true);
  };

  const movePanDrag = (clientX: number, clientY: number, preventDefault?: () => void) => {
    const state = dragStateRef.current;
    if (!state.active) return;
    const dx = clientX - state.startX;
    const dy = clientY - state.startY;
    if (!state.moved && Math.hypot(dx, dy) > 5) {
      state.moved = true;
    }
    if (state.moved) {
      preventDefault?.();
      setPan(clampPan(state.startPanX + dx, state.startPanY + dy));
    }
  };

  const endContainerDrag = () => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    setIsDragging(false);
    if (dragStateRef.current.moved) {
      window.setTimeout(() => {
        dragStateRef.current.moved = false;
      }, 50);
    }
  };

  const handleContainerMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    startPanDrag(e.clientX, e.clientY);
  };

  const handleContainerMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    movePanDrag(e.clientX, e.clientY, () => e.preventDefault());
  };

  const handleContainerTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      dragStateRef.current.active = false;
      setIsDragging(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (dist > 0) {
        pinchStateRef.current = {
          active: true,
          startDist: dist,
          startZoom: zoom,
        };
        setIsPinching(true);
      }
      return;
    }
    if (e.touches.length !== 1) return;
    pinchStateRef.current.active = false;
    const touch = e.touches[0];
    startPanDrag(touch.clientX, touch.clientY);
  };

  const handleContainerTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStateRef.current.active) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      if (pinchStateRef.current.startDist > 0 && dist > 0) {
        const ratio = dist / pinchStateRef.current.startDist;
        const nextZoom = Math.max(
          0.5,
          Math.min(2.5, Number((pinchStateRef.current.startZoom * ratio).toFixed(2)))
        );
        applyZoom(nextZoom);
      }
      return;
    }
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    movePanDrag(touch.clientX, touch.clientY);
  };

  const handleContainerTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      pinchStateRef.current.active = false;
      setIsPinching(false);
    }
    if (e.touches.length === 0) {
      endContainerDrag();
    }
  };

  const handleContainerClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (dragStateRef.current.moved) {
      dragStateRef.current.moved = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const hoveredPrereqs = (() => {
    if (!hoveredItemId) return new Set<string>();
    const lessonMatch = layout.lessonNodes.find((n) => n.id === hoveredItemId)?.lesson;
    if (lessonMatch) return new Set(lessonMatch.prerequisites ?? []);
    const chapterMatch = layout.chapterNodes.find((n) => n.id === hoveredItemId)?.chapter;
    if (chapterMatch) return new Set(chapterMatch.prerequisites ?? []);
    return new Set<string>();
  })();

  const handleLessonClick = (e: MouseEvent<SVGGElement>, lessonId: string) => {
    if (e.shiftKey) {
      e.preventDefault();
      onQuickToggleDone(lessonId);
      return;
    }
    onSelectLesson(lessonId);
  };

  const handleChapterClick = (
    e: MouseEvent<SVGGElement>,
    chapter: Chapter,
    isLeaf: boolean
  ) => {
    if (isLeaf && e.shiftKey) {
      e.preventDefault();
      onQuickToggleDone(chapter.id);
      return;
    }
    onSelectChapter?.(chapter);
  };

  const openNodeContextMenu = (e: SyntheticEvent<SVGGElement>, itemId: string) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    onContextMenuLesson(itemId, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  };

  return (
    <div className="relative w-full">
      {/* Compact zoom controls */}
      <div className="mb-2 flex items-center justify-end gap-1">
        <button
          type="button"
          disabled={zoom <= 0.5}
          onClick={() => applyZoom(Math.max(0.5, Number((zoom - 0.1).toFixed(2))))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-[#121926] dark:text-slate-200 dark:hover:bg-[#1b2436]"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            const fit = getFitZoom();
            setZoom(fit);
            setPan({ x: getCenteredPanX(fit), y: 0 });
          }}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:hidden dark:border-slate-700 dark:bg-[#121926] dark:text-slate-200 dark:hover:bg-[#1b2436]"
          title="Fit tree to screen"
          aria-label="Fit tree to screen"
        >
          <Maximize2 className="h-3 w-3" />
          Fit
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setPan({ x: getCenteredPanX(1), y: 0 });
          }}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-[#121926] dark:text-slate-200 dark:hover:bg-[#1b2436]"
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          <RotateCcw className="h-3 w-3" />
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          disabled={zoom >= 2.5}
          onClick={() => applyZoom(Math.min(2.5, Number((zoom + 0.1).toFixed(2))))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-[#121926] dark:text-slate-200 dark:hover:bg-[#1b2436]"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        ref={scrollContainerRef}
        data-testid="tree-scroll-container"
        onMouseDown={handleContainerMouseDown}
        onMouseMove={handleContainerMouseMove}
        onMouseUp={endContainerDrag}
        onMouseLeave={endContainerDrag}
        onTouchStart={handleContainerTouchStart}
        onTouchMove={handleContainerTouchMove}
        onTouchEnd={handleContainerTouchEnd}
        onTouchCancel={handleContainerTouchEnd}
        onClickCapture={handleContainerClickCapture}
        className={`w-full touch-none overflow-hidden pb-8 ${
          isDragging ? 'cursor-grabbing select-none' : 'cursor-grab'
        } ${framed ? 'roadmap-canvas-frame p-2 sm:p-4' : ''}`}
      >
        <div
          ref={zoomWrapperRef}
          className={`mx-auto ${isPinching ? '' : 'transition-[width,max-width,min-width] duration-200 ease-out'}`}
          style={{
            width: `${Math.round(zoom * 100)}%`,
            minWidth: `${Math.round(Math.min(layout.width, 640) * zoom)}px`,
            maxWidth: `${Math.round(layout.width * zoom)}px`,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          <svg
            ref={svgRef}
            viewBox={layout.viewBox}
            className="roadmap-svg font-roadmap block h-auto w-full select-none"
            role="img"
            aria-label="Interactive course tree"
          >
            {/* Edges: solid blue spine + dotted blue curved branches */}
            <g fill="none">
              {layout.edges.map((edge) => (
                <path
                  key={edge.id}
                  d={edge.d}
                  stroke={ROADMAP_COLORS.edgeBlue}
                  strokeWidth={3.5}
                  strokeDasharray={edge.kind === 'branch' ? '0.8 8' : undefined}
                  strokeLinecap="round"
                />
              ))}
            </g>

            {/* Primary Spine Chapter Nodes (#fdff00) */}
            <g>
              {layout.chapterNodes.map((node) => {
                const isLeaf = isLeafChapter(node.chapter);
                const stats = computeChapterStats(node.chapter, statuses);
                const chapterStatus: LessonStatus = isLeaf
                  ? (statuses[node.id] ?? 'todo')
                  : 'todo';
                const statusClass = isLeaf ? getStatusClass(chapterStatus) : '';
                const isSelected = activeChapterId === node.id;
                const isPrereqHighlighted = hoveredPrereqs.has(node.id);
                const hasMatchingLesson = node.chapter.lessons.some(
                  (lesson) => (statuses[lesson.id] ?? 'todo') === statusFilter
                );
                const isDimmed =
                  statusFilter !== 'all' &&
                  (isLeaf ? chapterStatus !== statusFilter : !hasMatchingLesson);

                const allSkipped = stats.required === 0 && stats.skipped > 0;
                const allDone = !allSkipped && stats.required > 0 && stats.done === stats.required;
                const badgeText = `${stats.done}/${stats.required}`;
                const badgeFill = allSkipped
                  ? ROADMAP_COLORS.statusSkippedFill
                  : allDone
                    ? ROADMAP_COLORS.statusDoneBadgeFill
                    : ROADMAP_COLORS.statusDefaultBadgeFill;
                const badgeWidth = Math.max(36, badgeText.length * 8 + 14);

                return (
                  <g
                    key={node.id}
                    data-node-id={node.id}
                    data-node-kind="chapter"
                    data-leaf-chapter={isLeaf ? 'true' : undefined}
                    data-status={isLeaf ? chapterStatus : undefined}
                    className={[
                      statusClass,
                      isSelected || isPrereqHighlighted ? 'node-highlighted' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ opacity: isDimmed ? 0.3 : 1 }}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      isLeaf
                        ? `Chapter ${node.chapter.title}, status ${chapterStatus}`
                        : `Chapter ${node.chapter.title}, ${stats.done} of ${stats.required} required lessons done`
                    }
                    onClick={(e) => handleChapterClick(e, node.chapter, isLeaf)}
                    onContextMenu={(e) => {
                      if (isLeaf) {
                        openNodeContextMenu(e, node.id);
                      }
                    }}
                    onMouseEnter={() => setHoveredItemId(node.id)}
                    onMouseLeave={() =>
                      setHoveredItemId((prev) => (prev === node.id ? null : prev))
                    }
                    onKeyDown={(e) => {
                      if (isLeaf && e.shiftKey && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onQuickToggleDone(node.id);
                      } else if (
                        isLeaf &&
                        (e.key === 'm' || e.key === 'M' || (e.shiftKey && e.key === 'F10'))
                      ) {
                        openNodeContextMenu(e, node.id);
                      } else if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectChapter?.(node.chapter);
                      }
                    }}
                  >
                    <rect
                      className="node-rect transition-colors duration-100"
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      rx={5}
                      fill={ROADMAP_COLORS.chapterFill}
                      stroke={ROADMAP_COLORS.nodeStroke}
                      strokeWidth={2.7}
                    />
                    <text
                      className="node-label"
                      x={node.x + node.width / 2}
                      y={
                        node.y +
                        node.height / 2 +
                        6 -
                        ((node.lines.length - 1) * NODE_LINE_HEIGHT) / 2
                      }
                      textAnchor="middle"
                      fill={ROADMAP_COLORS.nodeText}
                      fontSize={17}
                      fontWeight={700}
                    >
                      {node.lines.map((line, idx) => (
                        <tspan
                          key={idx}
                          x={node.x + node.width / 2}
                          dy={idx === 0 ? 0 : NODE_LINE_HEIGHT}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>

                    {/* Leaf circular status badge (hidden for 'todo') or multi-lesson completion pill */}
                    {isLeaf ? (
                      renderStatusCornerBadge(
                        chapterStatus,
                        node.x + node.width - 10,
                        node.y - 8
                      )
                    ) : (
                      <g
                        transform={`translate(${node.x + node.width - badgeWidth + 8}, ${node.y - 10})`}
                      >
                        <rect
                          width={badgeWidth}
                          height={20}
                          rx={10}
                          fill={badgeFill}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                        />
                        <text
                          x={badgeWidth / 2}
                          y={14}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={11}
                          fontWeight={700}
                          fontFamily="ui-sans-serif, system-ui, sans-serif"
                        >
                          {badgeText}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Secondary Branch Sub-Lesson Nodes (#ffe599) */}
            <g>
              {layout.lessonNodes.map((node) => {
                const status: LessonStatus = statuses[node.id] ?? 'todo';
                const statusClass = getStatusClass(status);
                const isSelected = activeLessonId === node.id;
                const isPrereqHighlighted = hoveredPrereqs.has(node.id);
                const isDimmed = statusFilter !== 'all' && status !== statusFilter;

                return (
                  <g
                    key={node.id}
                    data-node-id={node.id}
                    data-node-kind="lesson"
                    data-status={status}
                    className={[
                      statusClass,
                      isSelected || isPrereqHighlighted ? 'node-highlighted' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ opacity: isDimmed ? 0.3 : 1 }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.lesson.title}, status ${status}`}
                    onClick={(e) => handleLessonClick(e, node.id)}
                    onContextMenu={(e) => openNodeContextMenu(e, node.id)}
                    onMouseEnter={(e) => {
                      setHoveredItemId(node.id);
                      if (!dragStateRef.current.active && onHoverLesson) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        onHoverLesson(node.id, {
                          left: rect.left,
                          top: rect.top,
                          width: rect.width,
                          height: rect.height,
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredItemId((prev) => (prev === node.id ? null : prev));
                      onLeaveLesson?.(node.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.shiftKey && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onQuickToggleDone(node.id);
                      } else if (
                        e.key === 'm' ||
                        e.key === 'M' ||
                        (e.shiftKey && e.key === 'F10')
                      ) {
                        openNodeContextMenu(e, node.id);
                      } else if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectLesson(node.id);
                      }
                    }}
                  >
                    <rect
                      className="node-rect transition-colors duration-100"
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      rx={5}
                      fill={ROADMAP_COLORS.lessonFill}
                      stroke={ROADMAP_COLORS.nodeStroke}
                      strokeWidth={2.7}
                    />
                    <text
                      className="node-label"
                      x={node.x + node.width / 2}
                      y={
                        node.y +
                        node.height / 2 +
                        6 -
                        ((node.lines.length - 1) * NODE_LINE_HEIGHT) / 2
                      }
                      textAnchor="middle"
                      fill={ROADMAP_COLORS.nodeText}
                      fontSize={16.5}
                      fontWeight={400}
                    >
                      {node.lines.map((line, idx) => (
                        <tspan
                          key={idx}
                          x={node.x + node.width / 2}
                          dy={idx === 0 ? 0 : NODE_LINE_HEIGHT}
                        >
                          {line}
                        </tspan>
                      ))}
                    </text>

                    {renderStatusCornerBadge(status, node.x + node.width - 10, node.y - 8)}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
