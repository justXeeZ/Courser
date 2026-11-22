import { CourseTreeSchema, type Chapter, type CourseTree, type SubLesson } from '@/types/course';
export {
  findCourseItem,
  getAllItemRefs,
  getTrackableItems,
  isLeafChapter,
  type CourseItem,
  type CourseItemRef,
} from '@/lib/courseItems';

export function parseCourseTree(input: unknown): CourseTree {
  return CourseTreeSchema.parse(input);
}

export interface FlattenedLesson {
  chapter: Chapter;
  lesson: SubLesson;
  index: number;
}

export function getAllLessons(course: CourseTree): FlattenedLesson[] {
  const result: FlattenedLesson[] = [];
  let index = 0;
  for (const chapter of course.chapters) {
    for (const lesson of chapter.lessons) {
      result.push({ chapter, lesson, index });
      index += 1;
    }
  }
  return result;
}

export function getAllLessonIds(course: CourseTree): string[] {
  return getAllLessons(course).map((item) => item.lesson.id);
}

export function findLessonWithChapter(
  course: CourseTree,
  lessonId: string
): FlattenedLesson | undefined {
  return getAllLessons(course).find((item) => item.lesson.id === lessonId);
}
