import { useState, type MouseEvent, type RefObject } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { isStandaloneChapter } from '@/lib/courseItems';
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

function getStandaloneBadge(status: LessonStatus): { symbol: string; fill: string } {
  if (status === 'done') return { symbol: '✓', fill: '#16a34a' };
  if (status === 'learning') return { symbol: '◐', fill: '#7c3aed' };
  if (status === 'skipped') return { symbol: '—', fill: '#64748b' };
  return { symbol: '○', fill: '#0f172b' };
}

export function CourseTreeCanvas({
  layout,
  statuses,
  activeLessonId,
  activeChapterId,
  statusFilter = 'all',
  svgRef,
  onSelectLesson,
  onSelectChapter,
  onQuickToggleDone,
  onContextMenuLesson,
}: CourseTreeCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

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
    standalone: boolean
  ) => {
    if (standalone && e.shiftKey) {
      e.preventDefault();
      onQuickToggleDone(chapter.id);
      return;
    }
    onSelectChapter?.(chapter);
  };

  const openNodeContextMenu = (e: MouseEvent<SVGGElement>, itemId: string) => {
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
          onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(2))))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          <RotateCcw className="h-3 w-3" />
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="w-full overflow-x-auto pb-8">
        <div
          className="mx-auto transition-[width] duration-150"
          style={{
            width: `${Math.round(zoom * 100)}%`,
            maxWidth: `${Math.round(layout.width * zoom)}px`,
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
                const standalone = isStandaloneChapter(node.chapter);
                const stats = computeChapterStats(node.chapter, statuses);
                const chapterStatus: LessonStatus = standalone
                  ? (statuses[node.id] ?? 'todo')
                  : 'todo';
                const statusClass = standalone ? getStatusClass(chapterStatus) : '';
                const isSelected = activeChapterId === node.id;
                const isPrereqHighlighted = hoveredPrereqs.has(node.id);
                const isDimmed =
                  standalone && statusFilter !== 'all' && chapterStatus !== statusFilter;

                const allDone = stats.total > 0 && stats.percentDone === 100;
                const standaloneBadge = getStandaloneBadge(chapterStatus);
                const badgeText = standalone
                  ? standaloneBadge.symbol
                  : `${stats.done}/${stats.required}`;
                const badgeFill = standalone
                  ? standaloneBadge.fill
                  : allDone
                    ? '#16a34a'
                    : '#0f172b';
                const badgeWidth = standalone
                  ? 28
                  : Math.max(36, badgeText.length * 8 + 14);

                return (
                  <g
                    key={node.id}
                    data-node-id={node.id}
                    data-node-kind="chapter"
                    data-standalone={standalone ? 'true' : undefined}
                    data-status={standalone ? chapterStatus : undefined}
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
                      standalone
                        ? `Chapter ${node.chapter.title}, standalone, status ${chapterStatus}`
                        : `Chapter ${node.chapter.title}, ${stats.done} of ${stats.required} required lessons done`
                    }
                    onClick={(e) => handleChapterClick(e, node.chapter, standalone)}
                    onContextMenu={(e) => {
                      if (standalone) {
                        openNodeContextMenu(e, node.id);
                      }
                    }}
                    onMouseEnter={() => setHoveredItemId(node.id)}
                    onMouseLeave={() =>
                      setHoveredItemId((prev) => (prev === node.id ? null : prev))
                    }
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

                    {/* Compact chapter completion or standalone status badge */}
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
                    onMouseEnter={() => setHoveredItemId(node.id)}
                    onMouseLeave={() =>
                      setHoveredItemId((prev) => (prev === node.id ? null : prev))
                    }
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

                    {/* Done check badge (top-right) */}
                    {status === 'done' && (
                      <g transform={`translate(${node.x + node.width - 10}, ${node.y - 8})`}>
                        <circle
                          cx={8}
                          cy={8}
                          r={9}
                          fill="#16a34a"
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
                    )}

                    {/* Learning dot badge (top-right) */}
                    {status === 'learning' && (
                      <g transform={`translate(${node.x + node.width - 10}, ${node.y - 8})`}>
                        <circle
                          cx={8}
                          cy={8}
                          r={8}
                          fill="#7c3aed"
                          stroke="#ffffff"
                          strokeWidth={1.5}
                        />
                        <circle cx={8} cy={8} r={3} fill="#ffffff" />
                      </g>
                    )}

                    {/* Skipped slate badge (top-right) */}
                    {status === 'skipped' && (
                      <g transform={`translate(${node.x + node.width - 10}, ${node.y - 8})`}>
                        <circle
                          cx={8}
                          cy={8}
                          r={8}
                          fill="#64748b"
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
