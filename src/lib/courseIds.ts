import type { CourseTree } from '@/types/course';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function deriveCoursePrefix(courseCode: string): string {
  const cleaned = courseCode
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return cleaned || 'course';
}

export function deriveCourseSlug(courseCode: string, title: string): string {
  const prefix = deriveCoursePrefix(courseCode);
  const titleSlug = slugify(title);
  if (!titleSlug) return prefix;
  if (titleSlug === prefix || titleSlug.startsWith(`${prefix}-`)) {
    return titleSlug;
  }
  return `${prefix}-${titleSlug}`;
}

function makeUniqueId(base: string, existingIds?: Set<string>): string {
  if (!existingIds || !existingIds.has(base)) {
    existingIds?.add(base);
    return base;
  }
  let suffix = 2;
  while (existingIds.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  const unique = `${base}-${suffix}`;
  existingIds.add(unique);
  return unique;
}

export function deriveChapterId(
  courseCode: string,
  order: number,
  title: string,
  existingIds?: Set<string>
): string {
  const prefix = deriveCoursePrefix(courseCode);
  // Strip leading chapter numbers like "1. " or "Ch 1:" from the title before slugifying
  const stripped = title.replace(/^(ch(?:apter)?\s*)?\d+\s*[.:)-]?\s*/i, '');
  const titlePart = slugify(stripped) || slugify(title) || 'section';
  const base = `${prefix}-ch${order}-${titlePart}`;
  return makeUniqueId(base, existingIds);
}

export function deriveLessonId(
  courseCode: string,
  title: string,
  existingIds?: Set<string>
): string {
  const prefix = deriveCoursePrefix(courseCode);
  const titlePart = slugify(title) || 'lesson';
  const base = `${prefix}-${titlePart}`;
  return makeUniqueId(base, existingIds);
}

/**
 * Re-derives all chapter and lesson IDs from the course's current `code`,
 * automatically remapping every prerequisite reference to the new lesson IDs.
 */
export function rekeyCourseContentIds(course: CourseTree): CourseTree {
  const usedChapterIds = new Set<string>();
  const usedLessonIds = new Set<string>();
  const lessonIdMap = new Map<string, string>();

  const chaptersWithNewIds = course.chapters.map((chapter, idx) => {
    const order = idx + 1;
    const newChapterId = deriveChapterId(course.code, order, chapter.title, usedChapterIds);
    const lessons = chapter.lessons.map((lesson) => {
      const newLessonId = deriveLessonId(course.code, lesson.title, usedLessonIds);
      lessonIdMap.set(lesson.id, newLessonId);
      return {
        ...lesson,
        id: newLessonId,
      };
    });

    return {
      ...chapter,
      order,
      id: newChapterId,
      lessons,
    };
  });

  // Remap prerequisites to new lesson IDs and prune any dangling references
  const validLessonIds = new Set(lessonIdMap.values());
  const remappedChapters = chaptersWithNewIds.map((chapter) => ({
    ...chapter,
    lessons: chapter.lessons.map((lesson) => {
      if (!lesson.prerequisites || lesson.prerequisites.length === 0) {
        return { ...lesson, prerequisites: undefined };
      }
      const nextPrereqs = Array.from(
        new Set(
          lesson.prerequisites
            .map((oldId) => lessonIdMap.get(oldId) ?? oldId)
            .filter((mappedId) => validLessonIds.has(mappedId) && mappedId !== lesson.id)
        )
      );
      return {
        ...lesson,
        prerequisites: nextPrereqs.length > 0 ? nextPrereqs : undefined,
      };
    }),
  }));

  return {
    ...course,
    chapters: remappedChapters,
  };
}
