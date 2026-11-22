import type { Chapter, CourseTree, SubLesson } from '@/types/course';

export type CourseItem =
  | { kind: 'chapter'; id: string; chapter: Chapter; index: number }
  | { kind: 'lesson'; id: string; chapter: Chapter; lesson: SubLesson; index: number };

export interface CourseItemRef {
  id: string;
  kind: 'chapter' | 'lesson';
  title: string;
  chapterTitle: string;
}

export function isLeafChapter(chapter: Chapter): boolean {
  return chapter.lessons.length === 0;
}

export function getTrackableItems(course: CourseTree): CourseItem[] {
  const orderedChapters = [...course.chapters].sort((a, b) => a.order - b.order);
  const items: CourseItem[] = [];
  let index = 0;

  for (const chapter of orderedChapters) {
    if (isLeafChapter(chapter)) {
      items.push({
        kind: 'chapter',
        id: chapter.id,
        chapter,
        index,
      });
      index += 1;
    } else {
      for (const lesson of chapter.lessons) {
        items.push({
          kind: 'lesson',
          id: lesson.id,
          chapter,
          lesson,
          index,
        });
        index += 1;
      }
    }
  }

  return items;
}

export function findCourseItem(course: CourseTree, id: string): CourseItem | undefined {
  const trackable = getTrackableItems(course);
  const trackableHit = trackable.find((item) => item.id === id);
  if (trackableHit) {
    return trackableHit;
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
  const orderedChapters = [...course.chapters].sort((a, b) => a.order - b.order);
  const refs: CourseItemRef[] = [];

  for (const chapter of orderedChapters) {
    refs.push({
      id: chapter.id,
      kind: 'chapter',
      title: chapter.title,
      chapterTitle: chapter.title,
    });

    for (const lesson of chapter.lessons) {
      refs.push({
        id: lesson.id,
        kind: 'lesson',
        title: lesson.title,
        chapterTitle: chapter.title,
      });
    }
  }

  return refs;
}
