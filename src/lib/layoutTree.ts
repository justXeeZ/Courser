import type { Chapter, CourseTree, SubLesson } from '@/types/course';

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
  edges: LayoutEdge[];
}

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
  // Conservative width estimate for Balsamiq Sans (roughly 0.56 * fontSize per char)
  return Math.ceil(text.length * fontSize * 0.56);
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

export function layoutCourseTree(course: CourseTree, options: LayoutOptions = {}): TreeLayout {
  const orderedChapters = [...course.chapters].sort((a, b) => a.order - b.order);
  const rtl = options.rtl ?? false;

  // Measure max left/right widths so the SVG viewBox never clips wide titles
  let maxChapterWidth = CHAPTER_MIN_WIDTH;
  let maxLeftWidth = LESSON_MIN_WIDTH;
  let maxRightWidth = LESSON_MIN_WIDTH;

  const chapterMaxTextWidth = CHAPTER_MAX_WIDTH - CHAPTER_PADDING_X;
  const lessonMaxTextWidth = LESSON_MAX_WIDTH - LESSON_PADDING_X;

  const chapterSplits = orderedChapters.map((chapter) => {
    const chapterLines = wrapNodeLabel(chapter.title, chapterMaxTextWidth, CHAPTER_FONT_SIZE);
    const chapterLongestLine = Math.max(
      ...chapterLines.map((line) => estimateTextWidth(line, CHAPTER_FONT_SIZE))
    );
    const chapterWidth = clamp(
      chapterLongestLine + CHAPTER_PADDING_X,
      CHAPTER_MIN_WIDTH,
      CHAPTER_MAX_WIDTH
    );
    const chapterHeight =
      BASE_NODE_HEIGHT + Math.max(0, chapterLines.length - 1) * NODE_LINE_HEIGHT;
    maxChapterWidth = Math.max(maxChapterWidth, chapterWidth);

    const leftLessons: { lesson: SubLesson; lines: string[]; width: number; height: number }[] = [];
    const rightLessons: { lesson: SubLesson; lines: string[]; width: number; height: number }[] = [];

    chapter.lessons.forEach((lesson, idx) => {
      const preferredSide: 'left' | 'right' =
        lesson.side ?? (idx % 2 === 0 ? 'left' : 'right');
      const finalSide: 'left' | 'right' = rtl
        ? preferredSide === 'left'
          ? 'right'
          : 'left'
        : preferredSide;

      const lines = wrapNodeLabel(lesson.title, lessonMaxTextWidth, LESSON_FONT_SIZE);
      const longestLine = Math.max(
        ...lines.map((line) => estimateTextWidth(line, LESSON_FONT_SIZE))
      );
      const width = clamp(
        longestLine + LESSON_PADDING_X,
        LESSON_MIN_WIDTH,
        LESSON_MAX_WIDTH
      );
      const height = BASE_NODE_HEIGHT + Math.max(0, lines.length - 1) * NODE_LINE_HEIGHT;

      if (finalSide === 'left') {
        leftLessons.push({ lesson, lines, width, height });
        maxLeftWidth = Math.max(maxLeftWidth, width);
      } else {
        rightLessons.push({ lesson, lines, width, height });
        maxRightWidth = Math.max(maxRightWidth, width);
      }
    });

    return { chapter, chapterLines, chapterWidth, chapterHeight, leftLessons, rightLessons };
  });

  const spineCenterX = PADDING_X + maxLeftWidth + BRANCH_GAP_X + maxChapterWidth / 2;
  const totalWidth = Math.ceil(
    spineCenterX + maxChapterWidth / 2 + BRANCH_GAP_X + maxRightWidth + PADDING_X
  );

  const chapterNodes: PositionedChapterNode[] = [];
  const lessonNodes: PositionedLessonNode[] = [];
  const edges: LayoutEdge[] = [];

  let cursorY = PADDING_TOP;

  chapterSplits.forEach(
    ({ chapter, chapterLines, chapterWidth, chapterHeight, leftLessons, rightLessons }, chIdx) => {
      const leftH = stackHeight(leftLessons);
      const rightH = stackHeight(rightLessons);
      const bandHeight = Math.max(chapterHeight, leftH, rightH);

      const chapterX = spineCenterX - chapterWidth / 2;
      const chapterY = cursorY + (bandHeight - chapterHeight) / 2;

      const chapterNode: PositionedChapterNode = {
        kind: 'chapter',
        id: chapter.id,
        chapter,
        lines: chapterLines,
        x: chapterX,
        y: chapterY,
        width: chapterWidth,
        height: chapterHeight,
      };
      chapterNodes.push(chapterNode);

      // Connect from previous chapter spine node
      if (chIdx > 0) {
        const prev = chapterNodes[chIdx - 1];
        const startY = prev.y + prev.height;
        const endY = chapterNode.y;
        edges.push({
          id: `spine-${prev.id}-${chapterNode.id}`,
          kind: 'spine',
          fromId: prev.id,
          toId: chapterNode.id,
          d: `M ${spineCenterX} ${startY} L ${spineCenterX} ${endY}`,
        });
      }

      const chapterMidY = chapterY + chapterHeight / 2;

      // Position left branch sub-lessons
      let leftCursorY = cursorY + (bandHeight - leftH) / 2;
      leftLessons.forEach(({ lesson, lines, width, height }) => {
        const y = leftCursorY;
        leftCursorY += height + LESSON_GAP_Y;
        const rightEdgeX = chapterX - BRANCH_GAP_X;
        const x = rightEdgeX - width;
        lessonNodes.push({
          kind: 'lesson',
          id: lesson.id,
          chapterId: chapter.id,
          lesson,
          lines,
          side: 'left',
          x,
          y,
          width,
          height,
        });

        const lessonMidY = y + height / 2;
        const cx1 = chapterX - BRANCH_GAP_X * 0.5;
        const cx2 = rightEdgeX + BRANCH_GAP_X * 0.5;
        edges.push({
          id: `branch-${chapter.id}-${lesson.id}`,
          kind: 'branch',
          fromId: chapter.id,
          toId: lesson.id,
          d: `M ${chapterX} ${chapterMidY} C ${cx1} ${chapterMidY}, ${cx2} ${lessonMidY}, ${rightEdgeX} ${lessonMidY}`,
        });
      });

      // Position right branch sub-lessons
      let rightCursorY = cursorY + (bandHeight - rightH) / 2;
      const chapterRightEdge = chapterX + chapterWidth;
      rightLessons.forEach(({ lesson, lines, width, height }) => {
        const y = rightCursorY;
        rightCursorY += height + LESSON_GAP_Y;
        const x = chapterRightEdge + BRANCH_GAP_X;
        lessonNodes.push({
          kind: 'lesson',
          id: lesson.id,
          chapterId: chapter.id,
          lesson,
          lines,
          side: 'right',
          x,
          y,
          width,
          height,
        });

        const lessonMidY = y + height / 2;
        const cx1 = chapterRightEdge + BRANCH_GAP_X * 0.5;
        const cx2 = x - BRANCH_GAP_X * 0.5;
        edges.push({
          id: `branch-${chapter.id}-${lesson.id}`,
          kind: 'branch',
          fromId: chapter.id,
          toId: lesson.id,
          d: `M ${chapterRightEdge} ${chapterMidY} C ${cx1} ${chapterMidY}, ${cx2} ${lessonMidY}, ${x} ${lessonMidY}`,
        });
      });

      cursorY += bandHeight + CHAPTER_GAP_Y;
    }
  );

  const totalHeight = Math.ceil(cursorY - CHAPTER_GAP_Y + PADDING_BOTTOM);

  return {
    width: totalWidth,
    height: totalHeight,
    viewBox: `0 0 ${totalWidth} ${totalHeight}`,
    chapterNodes,
    lessonNodes,
    edges,
  };
}
