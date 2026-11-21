import { useState, type MouseEvent, type RefObject } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { ROADMAP_COLORS } from '@/lib/theme';
import type { TreeLayout } from '@/lib/layoutTree';
import type { Chapter, LessonStatus } from '@/types/course';
import { computeChapterStats } from '@/store/useProgressStore';

export type StatusFilter = 'all' | 'todo' | 'learning' | 'done';

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
  statusFilter?: StatusFilter;
  svgRef?: RefObject<SVGSVGElement | null>;
  onSelectLesson: (lessonId: string) => void;
  onSelectChapter?: (chapter: Chapter) => void;
  onQuickToggleDone: (lessonId: string) => void;
  onContextMenuLesson: (lessonId: string, anchor: NodeAnchorRect) => void;
}

function getStatusClass(status: LessonStatus): string {
  if (status === 'done') return 'node-done';
  if (status === 'learning') return 'node-learning';
  if (status === 'skipped') return 'node-skipped';
  return '';
}

export function CourseTreeCanvas({
  layout,
  statuses,
  activeLessonId,
  statusFilter = 'all',
  svgRef,
  onSelectLesson,
  onSelectChapter,
  onQuickToggleDone,
  onContextMenuLesson,
}: CourseTreeCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [hoveredLessonId, setHoveredLessonId] = useState<string | null>(null);

  const hoveredLesson = hoveredLessonId
    ? layout.lessonNodes.find((n) => n.id === hoveredLessonId)?.lesson
    : undefined;
  const highlightedPrereqs = new Set(hoveredLesson?.prerequisites ?? []);

  const handleLessonClick = (e: MouseEvent<SVGGElement>, lessonId: string) => {
    if (e.shiftKey) {
      e.preventDefault();
      onQuickToggleDone(lessonId);
      return;
    }
    onSelectLesson(lessonId);
  };

  const handleLessonContextMenu = (e: MouseEvent<SVGGElement>, lessonId: string) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    onContextMenuLesson(lessonId, {
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
          onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(2))))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          <RotateCcw className="h-3 w-3" />
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="w-full overflow-x-auto pb-8">
        <div
          className="mx-auto transition-[width] duration-150"
          style={{ width: `${Math.round(zoom * 100)}%`, maxWidth: `${Math.round(layout.width * zoom)}px` }}
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
                const stats = computeChapterStats(node.chapter, statuses);
                const allDone = stats.total > 0 && stats.percentDone === 100;
                const badgeText = `${stats.done}/${stats.total}`;
                const badgeWidth = Math.max(36, badgeText.length * 8 + 14);

                return (
                  <g
                    key={node.id}
                    data-node-id={node.id}
                    data-node-kind="chapter"
                    role="button"
                    tabIndex={0}
                    aria-label={`Chapter ${node.chapter.title}, ${stats.done} of ${stats.total} lessons done`}
                    onClick={() => onSelectChapter?.(node.chapter)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
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
                      y={node.y + node.height / 2 + 6}
                      textAnchor="middle"
                      fill={ROADMAP_COLORS.nodeText}
                      fontSize={17}
                      fontWeight={700}
                    >
                      {node.chapter.title}
                    </text>

                    {/* Compact chapter completion badge */}
                    <g transform={`translate(${node.x + node.width - badgeWidth + 8}, ${node.y - 10})`}>
                      <rect
                        width={badgeWidth}
                        height={20}
                        rx={10}
                        fill={allDone ? '#16a34a' : '#0f172b'}
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
                const isPrereqHighlighted = highlightedPrereqs.has(node.id);
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
                    onContextMenu={(e) => handleLessonContextMenu(e, node.id)}
                    onMouseEnter={() => setHoveredLessonId(node.id)}
                    onMouseLeave={() => setHoveredLessonId((prev) => (prev === node.id ? null : prev))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
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
                      y={node.y + node.height / 2 + 6}
                      textAnchor="middle"
                      fill={ROADMAP_COLORS.nodeText}
                      fontSize={16.5}
                      fontWeight={400}
                    >
                      {node.lesson.title}
                    </text>

                    {/* Done check badge (top-right) */}
                    {status === 'done' && (
                      <g transform={`translate(${node.x + node.width - 10}, ${node.y - 8})`}>
                        <circle cx={8} cy={8} r={9} fill="#16a34a" stroke="#ffffff" strokeWidth={1.5} />
                        <path
                          d="M 4.5 8.2 L 7 10.6 L 11.6 5.6"
                          fill="none"
                          stroke="#ffffff"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </g>
                    )}

                    {/* Learning dot badge (top-right) */}
                    {status === 'learning' && (
                      <g transform={`translate(${node.x + node.width - 10}, ${node.y - 8})`}>
                        <circle cx={8} cy={8} r={8} fill="#7c3aed" stroke="#ffffff" strokeWidth={1.5} />
                        <circle cx={8} cy={8} r={3} fill="#ffffff" />
                      </g>
                    )}
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
