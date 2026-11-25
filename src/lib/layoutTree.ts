import {
  formatChapterSupplementTag,
  formatLessonSupplementTag,
  formatSpineChildSupplementTag,
  formatSpineSupplementTag,
} from '@/lib/courseIds';
import { getOrderedSpineEntries, type SupplementPlacement } from '@/lib/courseItems';
import type { Chapter, CourseTree, Supplement, SpineSupplement, SubLesson } from '@/types/course';

export interface PositionedChapterNode {
  kind: 'chapter';
  id: string;
  chapter: Chapter;
  lines: string[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedLessonNode {
  kind: 'lesson';
  id: string;
  chapterId: string;
  lesson: SubLesson;
  lines: string[];
  side: 'left' | 'right';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PositionedSupplement {
  kind: 'supplement';
  id: string;
  node: Supplement | SpineSupplement;
  placement: SupplementPlacement;
  positionTag: string;
  lines: string[];
  side?: 'left' | 'right' | 'up' | 'down';
  parentId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutEdge {
  id: string;
  kind: 'spine' | 'branch';
  fromId: string;
  toId: string;
  d: string;
}

export interface TreeLayout {
  width: number;
  height: number;
  viewBox: string;
  chapterNodes: PositionedChapterNode[];
  lessonNodes: PositionedLessonNode[];
  supplementNodes: PositionedSupplement[];
  edges: LayoutEdge[];
}

const SUB_BRANCH_GAP_X = 44;
const SUB_BRANCH_GAP_Y = 26;
const SUB_GAP_Y = 12;

export interface LayoutOptions {
  rtl?: boolean;
}

export const NODE_LINE_HEIGHT = 20;
const BASE_NODE_HEIGHT = 46;
const CHAPTER_MIN_WIDTH = 256;
const CHAPTER_MAX_WIDTH = 340;
const CHAPTER_PADDING_X = 48;
const CHAPTER_FONT_SIZE = 17;
const LESSON_MIN_WIDTH = 172;
const LESSON_MAX_WIDTH = 300;
const LESSON_PADDING_X = 40;
const LESSON_FONT_SIZE = 16.5;
const BRANCH_GAP_X = 72;
const LESSON_GAP_Y = 16;
const CHAPTER_GAP_Y = 64;
const PADDING_X = 40;
const PADDING_TOP = 36;
const PADDING_BOTTOM = 48;

export function estimateTextWidth(text: string, fontSize = 17): number {
  // Conservative width estimate for bold Balsamiq Sans labels
  return Math.ceil(text.length * fontSize * 0.6);
}

function splitOversizedWord(word: string, maxTextWidth: number, fontSize: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const ch of word) {
    const candidate = current + ch;
    if (current && estimateTextWidth(candidate, fontSize) > maxTextWidth) {
      chunks.push(current);
      current = ch;
    } else {
      current = candidate;
    }
  }
  if (current) {
    chunks.push(current);
  }
  return chunks;
}

export function wrapNodeLabel(
  title: string,
  maxTextWidth: number,
  fontSize = 17
): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const fullText = words.join(' ');
  if (estimateTextWidth(fullText, fontSize) <= maxTextWidth) {
    return [fullText];
  }

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      if (estimateTextWidth(word, fontSize) <= maxTextWidth) {
        currentLine = word;
      } else {
        const chunks = splitOversizedWord(word, maxTextWidth, fontSize);
        lines.push(...chunks.slice(0, -1));
        currentLine = chunks[chunks.length - 1] ?? '';
      }
      continue;
    }

    const candidate = `${currentLine} ${word}`;
    if (estimateTextWidth(candidate, fontSize) <= maxTextWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      if (estimateTextWidth(word, fontSize) <= maxTextWidth) {
        currentLine = word;
      } else {
        const chunks = splitOversizedWord(word, maxTextWidth, fontSize);
        lines.push(...chunks.slice(0, -1));
        currentLine = chunks[chunks.length - 1] ?? '';
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stackHeight(items: { height: number }[]): number {
  if (items.length === 0) return 0;
  const totalNodeHeight = items.reduce((sum, item) => sum + item.height, 0);
  return totalNodeHeight + (items.length - 1) * LESSON_GAP_Y;
}

interface MeasuredBox {
  lines: string[];
  width: number;
  height: number;
}

function measureBox(
  title: string,
  minWidth: number,
  maxWidth: number,
  paddingX: number,
  fontSize: number
): MeasuredBox {
  const maxTextWidth = maxWidth - paddingX;
  const lines = wrapNodeLabel(title, maxTextWidth, fontSize);
  const longestLine = Math.max(...lines.map((line) => estimateTextWidth(line, fontSize)));
  const width = clamp(longestLine + paddingX, minWidth, maxWidth);
  const height = BASE_NODE_HEIGHT + Math.max(0, lines.length - 1) * NODE_LINE_HEIGHT;
  return { lines, width, height };
}

interface MeasuredLessonSupplement {
  node: Supplement;
  positionTag: string;
  box: MeasuredBox;
  resolvedSide: 'left' | 'right' | 'up' | 'down';
}

interface MeasuredLessonSlot {
  lesson: SubLesson;
  box: MeasuredBox;
  upNodes: MeasuredLessonSupplement[];
  downNodes: MeasuredLessonSupplement[];
  outwardNodes: MeasuredLessonSupplement[];
  topOffset: number;
  bottomOffset: number;
  slotHeight: number;
  maxOutwardReach: number;
}

interface MeasuredChapterSupplement {
  kind: 'supplement';
  node: Supplement;
  positionTag: string;
  box: MeasuredBox;
  slotHeight: number;
}

interface MeasuredChapterLesson {
  kind: 'lesson';
  slot: MeasuredLessonSlot;
  slotHeight: number;
}

type MeasuredBranchItem = MeasuredChapterLesson | MeasuredChapterSupplement;

function resolveLessonChildSide(
  requested: Supplement['side'],
  lessonSide: 'left' | 'right'
): 'left' | 'right' | 'up' | 'down' {
  if (requested === 'up' || requested === 'down') return requested;
  if (requested === 'left' || requested === 'right') {
    // Coerce inward horizontal directions outward so they never collide with the central spine
    return requested === lessonSide ? lessonSide : lessonSide;
  }
  return lessonSide;
}

function subStackHeight(items: { box: MeasuredBox }[]): number {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + item.box.height, 0);
  return total + (items.length - 1) * SUB_GAP_Y;
}

export function layoutCourseTree(course: CourseTree, options: LayoutOptions = {}): TreeLayout {
  const spineEntries = getOrderedSpineEntries(course);
  const rtl = options.rtl ?? false;

  // Measure max left/right widths so the SVG viewBox never clips wide titles or lesson sub-nodes
  let maxSpineWidth = CHAPTER_MIN_WIDTH;
  let maxLeftWidth = LESSON_MIN_WIDTH;
  let maxRightWidth = LESSON_MIN_WIDTH;

  type SpinePlan =
    | {
        kind: 'chapter';
        chapter: Chapter;
        box: MeasuredBox;
        leftItems: MeasuredBranchItem[];
        rightItems: MeasuredBranchItem[];
      }
    | {
        kind: 'supplement';
        node: SpineSupplement;
        positionTag: string;
        box: MeasuredBox;
        leftChildren: { node: Supplement; positionTag: string; box: MeasuredBox }[];
        rightChildren: { node: Supplement; positionTag: string; box: MeasuredBox }[];
      };

  const spinePlans: SpinePlan[] = spineEntries.map((entry) => {
    if (entry.kind === 'supplement') {
      const box = measureBox(
        entry.node.title,
        CHAPTER_MIN_WIDTH,
        CHAPTER_MAX_WIDTH,
        CHAPTER_PADDING_X,
        CHAPTER_FONT_SIZE
      );
      maxSpineWidth = Math.max(maxSpineWidth, box.width);

      const leftChildren: { node: Supplement; positionTag: string; box: MeasuredBox }[] = [];
      const rightChildren: { node: Supplement; positionTag: string; box: MeasuredBox }[] = [];

      (entry.node.children ?? []).forEach((child, idx) => {
        const preferredSide: 'left' | 'right' =
          child.side === 'left' || child.side === 'right'
            ? child.side
            : idx % 2 === 0
              ? 'left'
              : 'right';
        const finalSide: 'left' | 'right' = rtl
          ? preferredSide === 'left'
            ? 'right'
            : 'left'
          : preferredSide;
        const childBox = measureBox(
          child.title,
          LESSON_MIN_WIDTH,
          LESSON_MAX_WIDTH,
          LESSON_PADDING_X,
          LESSON_FONT_SIZE
        );
        const positionTag = formatSpineChildSupplementTag(entry.spineOrder, idx + 1);
        if (finalSide === 'left') {
          leftChildren.push({ node: child, positionTag, box: childBox });
          maxLeftWidth = Math.max(maxLeftWidth, childBox.width);
        } else {
          rightChildren.push({ node: child, positionTag, box: childBox });
          maxRightWidth = Math.max(maxRightWidth, childBox.width);
        }
      });

      return {
        kind: 'supplement',
        node: entry.node,
        positionTag: formatSpineSupplementTag(entry.spineOrder),
        box,
        leftChildren,
        rightChildren,
      };
    }

    const { chapter } = entry;
    const chapterBox = measureBox(
      chapter.title,
      CHAPTER_MIN_WIDTH,
      CHAPTER_MAX_WIDTH,
      CHAPTER_PADDING_X,
      CHAPTER_FONT_SIZE
    );
    maxSpineWidth = Math.max(maxSpineWidth, chapterBox.width);

    const leftItems: MeasuredBranchItem[] = [];
    const rightItems: MeasuredBranchItem[] = [];

    chapter.lessons.forEach((lesson, lIdx) => {
      const preferredSide: 'left' | 'right' =
        lesson.side ?? (lIdx % 2 === 0 ? 'left' : 'right');
      const finalSide: 'left' | 'right' = rtl
        ? preferredSide === 'left'
          ? 'right'
          : 'left'
        : preferredSide;

      const box = measureBox(
        lesson.title,
        LESSON_MIN_WIDTH,
        LESSON_MAX_WIDTH,
        LESSON_PADDING_X,
        LESSON_FONT_SIZE
      );

      const upNodes: MeasuredLessonSupplement[] = [];
      const downNodes: MeasuredLessonSupplement[] = [];
      const outwardNodes: MeasuredLessonSupplement[] = [];

      (lesson.supplements ?? []).forEach((cn, cnIdx) => {
        const cnBox = measureBox(
          cn.title,
          LESSON_MIN_WIDTH,
          LESSON_MAX_WIDTH,
          LESSON_PADDING_X,
          LESSON_FONT_SIZE
        );
        const resolvedSide = resolveLessonChildSide(cn.side, finalSide);
        const measured: MeasuredLessonSupplement = {
          node: cn,
          positionTag: formatLessonSupplementTag(chapter.order, lIdx + 1, cnIdx + 1),
          box: cnBox,
          resolvedSide,
        };
        if (resolvedSide === 'up') {
          upNodes.push(measured);
        } else if (resolvedSide === 'down') {
          downNodes.push(measured);
        } else {
          outwardNodes.push(measured);
        }
      });

      const upH = subStackHeight(upNodes);
      const downH = subStackHeight(downNodes);
      const outwardH = subStackHeight(outwardNodes);
      const topExtra = upH > 0 ? upH + SUB_BRANCH_GAP_Y : 0;
      const bottomExtra = downH > 0 ? downH + SUB_BRANCH_GAP_Y : 0;
      const outwardExtra = Math.max(0, (outwardH - box.height) / 2);
      const topOffset = Math.max(topExtra, outwardExtra);
      const bottomOffset = Math.max(bottomExtra, outwardExtra);
      const slotHeight = topOffset + box.height + bottomOffset;

      const maxOutwardChildW =
        outwardNodes.length > 0 ? Math.max(...outwardNodes.map((n) => n.box.width)) : 0;
      const maxUpDownW = Math.max(
        upNodes.length > 0 ? Math.max(...upNodes.map((n) => n.box.width)) : 0,
        downNodes.length > 0 ? Math.max(...downNodes.map((n) => n.box.width)) : 0
      );
      const maxOutwardReach =
        maxOutwardChildW > 0
          ? Math.max(box.width + SUB_BRANCH_GAP_X + maxOutwardChildW, maxUpDownW)
          : Math.max(box.width, maxUpDownW);

      const slot: MeasuredLessonSlot = {
        lesson,
        box,
        upNodes,
        downNodes,
        outwardNodes,
        topOffset,
        bottomOffset,
        slotHeight,
        maxOutwardReach,
      };

      if (finalSide === 'left') {
        leftItems.push({ kind: 'lesson', slot, slotHeight });
        maxLeftWidth = Math.max(maxLeftWidth, maxOutwardReach);
      } else {
        rightItems.push({ kind: 'lesson', slot, slotHeight });
        maxRightWidth = Math.max(maxRightWidth, maxOutwardReach);
      }
    });

    (chapter.supplements ?? []).forEach((cn, idx) => {
      const preferredSide: 'left' | 'right' =
        cn.side === 'left' || cn.side === 'right'
          ? cn.side
          : (chapter.lessons.length + idx) % 2 === 0
            ? 'left'
            : 'right';
      const finalSide: 'left' | 'right' = rtl
        ? preferredSide === 'left'
          ? 'right'
          : 'left'
        : preferredSide;
      const box = measureBox(
        cn.title,
        LESSON_MIN_WIDTH,
        LESSON_MAX_WIDTH,
        LESSON_PADDING_X,
        LESSON_FONT_SIZE
      );
      const item: MeasuredChapterSupplement = {
        kind: 'supplement',
        node: cn,
        positionTag: formatChapterSupplementTag(chapter.order, idx + 1),
        box,
        slotHeight: box.height,
      };
      if (finalSide === 'left') {
        leftItems.push(item);
        maxLeftWidth = Math.max(maxLeftWidth, box.width);
      } else {
        rightItems.push(item);
        maxRightWidth = Math.max(maxRightWidth, box.width);
      }
    });

    return {
      kind: 'chapter',
      chapter,
      box: chapterBox,
      leftItems,
      rightItems,
    };
  });

  const spineCenterX = PADDING_X + maxLeftWidth + BRANCH_GAP_X + maxSpineWidth / 2;
  const totalWidth = Math.ceil(
    spineCenterX + maxSpineWidth / 2 + BRANCH_GAP_X + maxRightWidth + PADDING_X
  );

  const chapterNodes: PositionedChapterNode[] = [];
  const lessonNodes: PositionedLessonNode[] = [];
  const supplementNodes: PositionedSupplement[] = [];
  const edges: LayoutEdge[] = [];

  let cursorY = PADDING_TOP;
  let prevSpineNode: { id: string; y: number; height: number } | null = null;

  spinePlans.forEach((plan) => {
    if (plan.kind === 'supplement') {
      const leftH = stackHeight(plan.leftChildren.map((c) => ({ height: c.box.height })));
      const rightH = stackHeight(plan.rightChildren.map((c) => ({ height: c.box.height })));
      const bandHeight = Math.max(plan.box.height, leftH, rightH);

      const spineX = spineCenterX - plan.box.width / 2;
      const spineY = cursorY + (bandHeight - plan.box.height) / 2;

      supplementNodes.push({
        kind: 'supplement',
        id: plan.node.id,
        node: plan.node,
        placement: 'spine',
        positionTag: plan.positionTag,
        lines: plan.box.lines,
        x: spineX,
        y: spineY,
        width: plan.box.width,
        height: plan.box.height,
      });

      if (prevSpineNode) {
        edges.push({
          id: `spine-${prevSpineNode.id}-${plan.node.id}`,
          kind: 'spine',
          fromId: prevSpineNode.id,
          toId: plan.node.id,
          d: `M ${spineCenterX} ${prevSpineNode.y + prevSpineNode.height} L ${spineCenterX} ${spineY}`,
        });
      }
      prevSpineNode = { id: plan.node.id, y: spineY, height: plan.box.height };

      const spineMidY = spineY + plan.box.height / 2;

      let leftCursorY = cursorY + (bandHeight - leftH) / 2;
      plan.leftChildren.forEach(({ node, positionTag, box }) => {
        const y = leftCursorY;
        leftCursorY += box.height + LESSON_GAP_Y;
        const rightEdgeX = spineX - BRANCH_GAP_X;
        const x = rightEdgeX - box.width;
        supplementNodes.push({
          kind: 'supplement',
          id: node.id,
          node,
          placement: 'spine-child',
          positionTag,
          lines: box.lines,
          side: 'left',
          parentId: plan.node.id,
          x,
          y,
          width: box.width,
          height: box.height,
        });
        const childMidY = y + box.height / 2;
        const cx1 = spineX - BRANCH_GAP_X * 0.5;
        const cx2 = rightEdgeX + BRANCH_GAP_X * 0.5;
        edges.push({
          id: `branch-${plan.node.id}-${node.id}`,
          kind: 'branch',
          fromId: plan.node.id,
          toId: node.id,
          d: `M ${spineX} ${spineMidY} C ${cx1} ${spineMidY}, ${cx2} ${childMidY}, ${rightEdgeX} ${childMidY}`,
        });
      });

      let rightCursorY = cursorY + (bandHeight - rightH) / 2;
      const spineRightEdge = spineX + plan.box.width;
      plan.rightChildren.forEach(({ node, positionTag, box }) => {
        const y = rightCursorY;
        rightCursorY += box.height + LESSON_GAP_Y;
        const x = spineRightEdge + BRANCH_GAP_X;
        supplementNodes.push({
          kind: 'supplement',
          id: node.id,
          node,
          placement: 'spine-child',
          positionTag,
          lines: box.lines,
          side: 'right',
          parentId: plan.node.id,
          x,
          y,
          width: box.width,
          height: box.height,
        });
        const childMidY = y + box.height / 2;
        const cx1 = spineRightEdge + BRANCH_GAP_X * 0.5;
        const cx2 = x - BRANCH_GAP_X * 0.5;
        edges.push({
          id: `branch-${plan.node.id}-${node.id}`,
          kind: 'branch',
          fromId: plan.node.id,
          toId: node.id,
          d: `M ${spineRightEdge} ${spineMidY} C ${cx1} ${spineMidY}, ${cx2} ${childMidY}, ${x} ${childMidY}`,
        });
      });

      cursorY += bandHeight + CHAPTER_GAP_Y;
      return;
    }

    const { chapter, box: chapterBox, leftItems, rightItems } = plan;
    const leftH = stackHeight(leftItems.map((item) => ({ height: item.slotHeight })));
    const rightH = stackHeight(rightItems.map((item) => ({ height: item.slotHeight })));
    const bandHeight = Math.max(chapterBox.height, leftH, rightH);

    const chapterX = spineCenterX - chapterBox.width / 2;
    const chapterY = cursorY + (bandHeight - chapterBox.height) / 2;

    const chapterNode: PositionedChapterNode = {
      kind: 'chapter',
      id: chapter.id,
      chapter,
      lines: chapterBox.lines,
      x: chapterX,
      y: chapterY,
      width: chapterBox.width,
      height: chapterBox.height,
    };
    chapterNodes.push(chapterNode);

    if (prevSpineNode) {
      edges.push({
        id: `spine-${prevSpineNode.id}-${chapterNode.id}`,
        kind: 'spine',
        fromId: prevSpineNode.id,
        toId: chapterNode.id,
        d: `M ${spineCenterX} ${prevSpineNode.y + prevSpineNode.height} L ${spineCenterX} ${chapterNode.y}`,
      });
    }
    prevSpineNode = { id: chapterNode.id, y: chapterNode.y, height: chapterNode.height };

    const chapterMidY = chapterY + chapterBox.height / 2;

    const placeBranchSide = (items: MeasuredBranchItem[], side: 'left' | 'right', sideH: number) => {
      let sideCursorY = cursorY + (bandHeight - sideH) / 2;
      const chapterRightEdge = chapterX + chapterBox.width;

      items.forEach((item) => {
        if (item.kind === 'supplement') {
          const y = sideCursorY;
          sideCursorY += item.slotHeight + LESSON_GAP_Y;

          if (side === 'left') {
            const rightEdgeX = chapterX - BRANCH_GAP_X;
            const x = rightEdgeX - item.box.width;
            supplementNodes.push({
              kind: 'supplement',
              id: item.node.id,
              node: item.node,
              placement: 'chapter-child',
              positionTag: item.positionTag,
              lines: item.box.lines,
              side: 'left',
              parentId: chapter.id,
              x,
              y,
              width: item.box.width,
              height: item.box.height,
            });
            const midY = y + item.box.height / 2;
            const cx1 = chapterX - BRANCH_GAP_X * 0.5;
            const cx2 = rightEdgeX + BRANCH_GAP_X * 0.5;
            edges.push({
              id: `branch-${chapter.id}-${item.node.id}`,
              kind: 'branch',
              fromId: chapter.id,
              toId: item.node.id,
              d: `M ${chapterX} ${chapterMidY} C ${cx1} ${chapterMidY}, ${cx2} ${midY}, ${rightEdgeX} ${midY}`,
            });
          } else {
            const x = chapterRightEdge + BRANCH_GAP_X;
            supplementNodes.push({
              kind: 'supplement',
              id: item.node.id,
              node: item.node,
              placement: 'chapter-child',
              positionTag: item.positionTag,
              lines: item.box.lines,
              side: 'right',
              parentId: chapter.id,
              x,
              y,
              width: item.box.width,
              height: item.box.height,
            });
            const midY = y + item.box.height / 2;
            const cx1 = chapterRightEdge + BRANCH_GAP_X * 0.5;
            const cx2 = x - BRANCH_GAP_X * 0.5;
            edges.push({
              id: `branch-${chapter.id}-${item.node.id}`,
              kind: 'branch',
              fromId: chapter.id,
              toId: item.node.id,
              d: `M ${chapterRightEdge} ${chapterMidY} C ${cx1} ${chapterMidY}, ${cx2} ${midY}, ${x} ${midY}`,
            });
          }
          return;
        }

        const { slot } = item;
        const lessonY = sideCursorY + slot.topOffset;
        sideCursorY += slot.slotHeight + LESSON_GAP_Y;

        const lessonX =
          side === 'left'
            ? chapterX - BRANCH_GAP_X - slot.box.width
            : chapterRightEdge + BRANCH_GAP_X;

        lessonNodes.push({
          kind: 'lesson',
          id: slot.lesson.id,
          chapterId: chapter.id,
          lesson: slot.lesson,
          lines: slot.box.lines,
          side,
          x: lessonX,
          y: lessonY,
          width: slot.box.width,
          height: slot.box.height,
        });

        const lessonMidY = lessonY + slot.box.height / 2;
        if (side === 'left') {
          const rightEdgeX = chapterX - BRANCH_GAP_X;
          const cx1 = chapterX - BRANCH_GAP_X * 0.5;
          const cx2 = rightEdgeX + BRANCH_GAP_X * 0.5;
          edges.push({
            id: `branch-${chapter.id}-${slot.lesson.id}`,
            kind: 'branch',
            fromId: chapter.id,
            toId: slot.lesson.id,
            d: `M ${chapterX} ${chapterMidY} C ${cx1} ${chapterMidY}, ${cx2} ${lessonMidY}, ${rightEdgeX} ${lessonMidY}`,
          });
        } else {
          const cx1 = chapterRightEdge + BRANCH_GAP_X * 0.5;
          const cx2 = lessonX - BRANCH_GAP_X * 0.5;
          edges.push({
            id: `branch-${chapter.id}-${slot.lesson.id}`,
            kind: 'branch',
            fromId: chapter.id,
            toId: slot.lesson.id,
            d: `M ${chapterRightEdge} ${chapterMidY} C ${cx1} ${chapterMidY}, ${cx2} ${lessonMidY}, ${lessonX} ${lessonMidY}`,
          });
        }

        const lessonCenterX = lessonX + slot.box.width / 2;

        // Place 'up' lesson custom sub-nodes stacked above the lesson
        let upCursorBottom = lessonY - SUB_BRANCH_GAP_Y;
        slot.upNodes.forEach((cn) => {
          const cnY = upCursorBottom - cn.box.height;
          upCursorBottom = cnY - SUB_GAP_Y;
          const cnX = lessonCenterX - cn.box.width / 2;
          supplementNodes.push({
            kind: 'supplement',
            id: cn.node.id,
            node: cn.node,
            placement: 'lesson-child',
            positionTag: cn.positionTag,
            lines: cn.box.lines,
            side: 'up',
            parentId: slot.lesson.id,
            x: cnX,
            y: cnY,
            width: cn.box.width,
            height: cn.box.height,
          });
          edges.push({
            id: `branch-${slot.lesson.id}-${cn.node.id}`,
            kind: 'branch',
            fromId: slot.lesson.id,
            toId: cn.node.id,
            d: `M ${lessonCenterX} ${lessonY} L ${lessonCenterX} ${cnY + cn.box.height}`,
          });
        });

        // Place 'down' lesson custom sub-nodes stacked below the lesson
        let downCursorTop = lessonY + slot.box.height + SUB_BRANCH_GAP_Y;
        slot.downNodes.forEach((cn) => {
          const cnY = downCursorTop;
          downCursorTop += cn.box.height + SUB_GAP_Y;
          const cnX = lessonCenterX - cn.box.width / 2;
          supplementNodes.push({
            kind: 'supplement',
            id: cn.node.id,
            node: cn.node,
            placement: 'lesson-child',
            positionTag: cn.positionTag,
            lines: cn.box.lines,
            side: 'down',
            parentId: slot.lesson.id,
            x: cnX,
            y: cnY,
            width: cn.box.width,
            height: cn.box.height,
          });
          edges.push({
            id: `branch-${slot.lesson.id}-${cn.node.id}`,
            kind: 'branch',
            fromId: slot.lesson.id,
            toId: cn.node.id,
            d: `M ${lessonCenterX} ${lessonY + slot.box.height} L ${lessonCenterX} ${cnY}`,
          });
        });

        // Place outward horizontal lesson custom sub-nodes
        if (slot.outwardNodes.length > 0) {
          const outwardTotalH = subStackHeight(slot.outwardNodes);
          let outwardCursorY = lessonMidY - outwardTotalH / 2;
          slot.outwardNodes.forEach((cn) => {
            const cnY = outwardCursorY;
            outwardCursorY += cn.box.height + SUB_GAP_Y;
            const cnMidY = cnY + cn.box.height / 2;
            if (side === 'left') {
              const cnRightEdge = lessonX - SUB_BRANCH_GAP_X;
              const cnX = cnRightEdge - cn.box.width;
              supplementNodes.push({
                kind: 'supplement',
                id: cn.node.id,
                node: cn.node,
                placement: 'lesson-child',
                positionTag: cn.positionTag,
                lines: cn.box.lines,
                side: 'left',
                parentId: slot.lesson.id,
                x: cnX,
                y: cnY,
                width: cn.box.width,
                height: cn.box.height,
              });
              const cx1 = lessonX - SUB_BRANCH_GAP_X * 0.5;
              const cx2 = cnRightEdge + SUB_BRANCH_GAP_X * 0.5;
              edges.push({
                id: `branch-${slot.lesson.id}-${cn.node.id}`,
                kind: 'branch',
                fromId: slot.lesson.id,
                toId: cn.node.id,
                d: `M ${lessonX} ${lessonMidY} C ${cx1} ${lessonMidY}, ${cx2} ${cnMidY}, ${cnRightEdge} ${cnMidY}`,
              });
            } else {
              const cnX = lessonX + slot.box.width + SUB_BRANCH_GAP_X;
              const lessonRightEdge = lessonX + slot.box.width;
              supplementNodes.push({
                kind: 'supplement',
                id: cn.node.id,
                node: cn.node,
                placement: 'lesson-child',
                positionTag: cn.positionTag,
                lines: cn.box.lines,
                side: 'right',
                parentId: slot.lesson.id,
                x: cnX,
                y: cnY,
                width: cn.box.width,
                height: cn.box.height,
              });
              const cx1 = lessonRightEdge + SUB_BRANCH_GAP_X * 0.5;
              const cx2 = cnX - SUB_BRANCH_GAP_X * 0.5;
              edges.push({
                id: `branch-${slot.lesson.id}-${cn.node.id}`,
                kind: 'branch',
                fromId: slot.lesson.id,
                toId: cn.node.id,
                d: `M ${lessonRightEdge} ${lessonMidY} C ${cx1} ${lessonMidY}, ${cx2} ${cnMidY}, ${cnX} ${cnMidY}`,
              });
            }
          });
        }
      });
    };

    placeBranchSide(leftItems, 'left', leftH);
    placeBranchSide(rightItems, 'right', rightH);

    cursorY += bandHeight + CHAPTER_GAP_Y;
  });

  const totalHeight = Math.max(
    PADDING_TOP + PADDING_BOTTOM + BASE_NODE_HEIGHT,
    Math.ceil(cursorY - CHAPTER_GAP_Y + PADDING_BOTTOM)
  );

  return {
    width: totalWidth,
    height: totalHeight,
    viewBox: `0 0 ${totalWidth} ${totalHeight}`,
    chapterNodes,
    lessonNodes,
    supplementNodes,
    edges,
  };
}
