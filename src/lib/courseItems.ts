import {
  formatChapterSupplementTag,
  formatLessonSupplementTag,
  formatSpineChildSupplementTag,
  formatSpineSupplementTag,
} from '@/lib/courseIds';
import type { Chapter, CourseTree, SpineSupplement, SubLesson, Supplement } from '@/types/course';

export type SupplementPlacement = 'spine' | 'spine-child' | 'chapter-child' | 'lesson-child';

export type CourseItem =
  | { kind: 'chapter'; id: string; chapter: Chapter; index: number }
  | { kind: 'lesson'; id: string; chapter: Chapter; lesson: SubLesson; index: number }
  | {
      kind: 'supplement';
      id: string;
      node: Supplement | SpineSupplement;
      placement: SupplementPlacement;
      positionTag: string;
      chapter?: Chapter;
      lesson?: SubLesson;
      parentSupplement?: SpineSupplement;
      index: number;
    };

export interface CourseItemRef {
  id: string;
  kind: 'chapter' | 'lesson' | 'supplement';
  title: string;
  chapterTitle: string;
  positionTag?: string;
}

export type OrderedSpineEntry =
  | { kind: 'chapter'; chapter: Chapter; chapterIndex: number }
  | { kind: 'supplement'; node: SpineSupplement; spineOrder: number };

export function isLeafChapter(chapter: Chapter): boolean {
  return chapter.lessons.length === 0 && (chapter.supplements?.length ?? 0) === 0;
}

export function isSupplementTrackable(node: Supplement): boolean {
  return node.trackable !== false;
}

export function getOrderedSpineEntries(course: CourseTree): OrderedSpineEntry[] {
  const orderedChapters = [...course.chapters].sort((a, b) => a.order - b.order);
  const spineNodes = course.supplements ?? [];
  const entries: OrderedSpineEntry[] = [];

  spineNodes.forEach((node, idx) => {
    if (node.afterChapterOrder <= 0) {
      entries.push({ kind: 'supplement', node, spineOrder: idx + 1 });
    }
  });

  orderedChapters.forEach((chapter, cIdx) => {
    entries.push({ kind: 'chapter', chapter, chapterIndex: cIdx });
    const isLastChapter = cIdx === orderedChapters.length - 1;
    spineNodes.forEach((node, idx) => {
      const matchesHere = isLastChapter
        ? node.afterChapterOrder >= chapter.order
        : node.afterChapterOrder === chapter.order;
      if (matchesHere) {
        entries.push({ kind: 'supplement', node, spineOrder: idx + 1 });
      }
    });
  });

  return entries;
}

function collectAllCourseItems(course: CourseTree, trackableOnly: boolean): CourseItem[] {
  const items: CourseItem[] = [];
  let index = 0;
  const spineEntries = getOrderedSpineEntries(course);

  for (const entry of spineEntries) {
    if (entry.kind === 'chapter') {
      const { chapter } = entry;
      if (isLeafChapter(chapter)) {
        items.push({ kind: 'chapter', id: chapter.id, chapter, index });
        index += 1;
      } else {
        chapter.lessons.forEach((lesson, lIdx) => {
          items.push({ kind: 'lesson', id: lesson.id, chapter, lesson, index });
          index += 1;
          lesson.supplements?.forEach((node, nIdx) => {
            if (!trackableOnly || isSupplementTrackable(node)) {
              items.push({
                kind: 'supplement',
                id: node.id,
                node,
                placement: 'lesson-child',
                positionTag: formatLessonSupplementTag(chapter.order, lIdx + 1, nIdx + 1),
                chapter,
                lesson,
                index,
              });
              index += 1;
            }
          });
        });

        chapter.supplements?.forEach((node, nIdx) => {
          if (!trackableOnly || isSupplementTrackable(node)) {
            items.push({
              kind: 'supplement',
              id: node.id,
              node,
              placement: 'chapter-child',
              positionTag: formatChapterSupplementTag(chapter.order, nIdx + 1),
              chapter,
              index,
            });
            index += 1;
          }
        });
      }
    } else {
      const { node, spineOrder } = entry;
      const children = node.children ?? [];
      if (children.length === 0) {
        if (!trackableOnly || isSupplementTrackable(node)) {
          items.push({
            kind: 'supplement',
            id: node.id,
            node,
            placement: 'spine',
            positionTag: formatSpineSupplementTag(spineOrder),
            index,
          });
          index += 1;
        }
      } else {
        if (!trackableOnly) {
          items.push({
            kind: 'supplement',
            id: node.id,
            node,
            placement: 'spine',
            positionTag: formatSpineSupplementTag(spineOrder),
            index,
          });
          index += 1;
        }
        children.forEach((child, cIdx) => {
          if (!trackableOnly || isSupplementTrackable(child)) {
            items.push({
              kind: 'supplement',
              id: child.id,
              node: child,
              placement: 'spine-child',
              positionTag: formatSpineChildSupplementTag(spineOrder, cIdx + 1),
              parentSupplement: node,
              index,
            });
            index += 1;
          }
        });
      }
    }
  }

  return items;
}

export function getTrackableItems(course: CourseTree): CourseItem[] {
  return collectAllCourseItems(course, true);
}

export function findCourseItem(course: CourseTree, id: string): CourseItem | undefined {
  const allItems = collectAllCourseItems(course, false);
  const directHit = allItems.find((item) => item.id === id);
  if (directHit) {
    return directHit;
  }

  const orderedChapters = [...course.chapters].sort((a, b) => a.order - b.order);
  const chapterIndex = orderedChapters.findIndex((chapter) => chapter.id === id);
  if (chapterIndex !== -1) {
    const chapter = orderedChapters[chapterIndex];
    return {
      kind: 'chapter',
      id: chapter.id,
      chapter,
      index: chapterIndex,
    };
  }

  return undefined;
}

export function getAllItemRefs(course: CourseTree): CourseItemRef[] {
  const refs: CourseItemRef[] = [];
  const spineEntries = getOrderedSpineEntries(course);

  for (const entry of spineEntries) {
    if (entry.kind === 'chapter') {
      const { chapter } = entry;
      refs.push({
        id: chapter.id,
        kind: 'chapter',
        title: chapter.title,
        chapterTitle: chapter.title,
      });

      chapter.lessons.forEach((lesson, lIdx) => {
        refs.push({
          id: lesson.id,
          kind: 'lesson',
          title: lesson.title,
          chapterTitle: chapter.title,
        });
        lesson.supplements?.forEach((node, nIdx) => {
          refs.push({
            id: node.id,
            kind: 'supplement',
            title: node.title,
            chapterTitle: `${chapter.title} › ${lesson.title}`,
            positionTag: formatLessonSupplementTag(chapter.order, lIdx + 1, nIdx + 1),
          });
        });
      });

      chapter.supplements?.forEach((node, nIdx) => {
        refs.push({
          id: node.id,
          kind: 'supplement',
          title: node.title,
          chapterTitle: chapter.title,
          positionTag: formatChapterSupplementTag(chapter.order, nIdx + 1),
        });
      });
    } else {
      const { node, spineOrder } = entry;
      refs.push({
        id: node.id,
        kind: 'supplement',
        title: node.title,
        chapterTitle: node.title,
        positionTag: formatSpineSupplementTag(spineOrder),
      });
      node.children?.forEach((child, cIdx) => {
        refs.push({
          id: child.id,
          kind: 'supplement',
          title: child.title,
          chapterTitle: node.title,
          positionTag: formatSpineChildSupplementTag(spineOrder, cIdx + 1),
        });
      });
    }
  }

  return refs;
}
