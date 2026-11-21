import type { Chapter, CourseTree, SubLesson } from '@/types/course';

export interface PositionedChapterNode {
  kind: 'chapter';
  id: string;
  chapter: Chapter;
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

const NODE_HEIGHT = 46;
const CHAPTER_MIN_WIDTH = 256;
const CHAPTER_MAX_WIDTH = 330;
const LESSON_MIN_WIDTH = 172;
const LESSON_MAX_WIDTH = 276;
const BRANCH_GAP_X = 72;
const LESSON_GAP_Y = 16;
const CHAPTER_GAP_Y = 64;
const PADDING_X = 40;
const PADDING_TOP = 36;
const PADDING_BOTTOM = 48;

function estimateTextWidth(text: string, fontSize = 17): number {
  // Conservative width estimate for Balsamiq Sans (roughly 0.56 * fontSize per char)
  return Math.ceil(text.length * fontSize * 0.56);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stackHeight(count: number): number {
  if (count <= 0) return 0;
  return count * NODE_HEIGHT + (count - 1) * LESSON_GAP_Y;
}

export function layoutCourseTree(course: CourseTree, options: LayoutOptions = {}): TreeLayout {
  const orderedChapters = [...course.chapters].sort((a, b) => a.order - b.order);
  const rtl = options.rtl ?? false;

  // Measure max left/right widths so the SVG viewBox never clips wide titles
  let maxChapterWidth = CHAPTER_MIN_WIDTH;
  let maxLeftWidth = LESSON_MIN_WIDTH;
  let maxRightWidth = LESSON_MIN_WIDTH;

  const chapterSplits = orderedChapters.map((chapter) => {
    const chapterWidth = clamp(
      estimateTextWidth(chapter.title, 17) + 48,
      CHAPTER_MIN_WIDTH,
      CHAPTER_MAX_WIDTH
    );
    maxChapterWidth = Math.max(maxChapterWidth, chapterWidth);

    const leftLessons: { lesson: SubLesson; width: number }[] = [];
    const rightLessons: { lesson: SubLesson; width: number }[] = [];

    chapter.lessons.forEach((lesson, idx) => {
      const preferredSide: 'left' | 'right' =
        lesson.side ?? (idx % 2 === 0 ? 'left' : 'right');
      const finalSide: 'left' | 'right' = rtl
        ? preferredSide === 'left'
          ? 'right'
          : 'left'
        : preferredSide;

      const width = clamp(
        estimateTextWidth(lesson.title, 17) + 40,
        LESSON_MIN_WIDTH,
        LESSON_MAX_WIDTH
      );

      if (finalSide === 'left') {
        leftLessons.push({ lesson, width });
        maxLeftWidth = Math.max(maxLeftWidth, width);
      } else {
        rightLessons.push({ lesson, width });
        maxRightWidth = Math.max(maxRightWidth, width);
      }
    });

    return { chapter, chapterWidth, leftLessons, rightLessons };
  });

  const spineCenterX = PADDING_X + maxLeftWidth + BRANCH_GAP_X + maxChapterWidth / 2;
  const totalWidth = Math.ceil(
    spineCenterX + maxChapterWidth / 2 + BRANCH_GAP_X + maxRightWidth + PADDING_X
  );

  const chapterNodes: PositionedChapterNode[] = [];
  const lessonNodes: PositionedLessonNode[] = [];
  const edges: LayoutEdge[] = [];

  let cursorY = PADDING_TOP;

  chapterSplits.forEach(({ chapter, chapterWidth, leftLessons, rightLessons }, chIdx) => {
    const leftH = stackHeight(leftLessons.length);
    const rightH = stackHeight(rightLessons.length);
    const bandHeight = Math.max(NODE_HEIGHT, leftH, rightH);

    const chapterX = spineCenterX - chapterWidth / 2;
    const chapterY = cursorY + (bandHeight - NODE_HEIGHT) / 2;

    const chapterNode: PositionedChapterNode = {
      kind: 'chapter',
      id: chapter.id,
      chapter,
      x: chapterX,
      y: chapterY,
      width: chapterWidth,
      height: NODE_HEIGHT,
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

    const chapterMidY = chapterY + NODE_HEIGHT / 2;

    // Position left branch sub-lessons
    const leftStartY = cursorY + (bandHeight - leftH) / 2;
    leftLessons.forEach(({ lesson, width }, idx) => {
      const y = leftStartY + idx * (NODE_HEIGHT + LESSON_GAP_Y);
      const rightEdgeX = chapterX - BRANCH_GAP_X;
      const x = rightEdgeX - width;
      lessonNodes.push({
        kind: 'lesson',
        id: lesson.id,
        chapterId: chapter.id,
        lesson,
        side: 'left',
        x,
        y,
        width,
        height: NODE_HEIGHT,
      });

      const lessonMidY = y + NODE_HEIGHT / 2;
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
    const rightStartY = cursorY + (bandHeight - rightH) / 2;
    const chapterRightEdge = chapterX + chapterWidth;
    rightLessons.forEach(({ lesson, width }, idx) => {
      const y = rightStartY + idx * (NODE_HEIGHT + LESSON_GAP_Y);
      const x = chapterRightEdge + BRANCH_GAP_X;
      lessonNodes.push({
        kind: 'lesson',
        id: lesson.id,
        chapterId: chapter.id,
        lesson,
        side: 'right',
        x,
        y,
        width,
        height: NODE_HEIGHT,
      });

      const lessonMidY = y + NODE_HEIGHT / 2;
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
  });

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
