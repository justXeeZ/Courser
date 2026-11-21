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

export function deriveFileId(courseCode: string): string {
  const prefix = deriveCoursePrefix(courseCode);
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-file-${hex}`;
}

function remapPrerequisites(
  prerequisites: string[] | undefined,
  selfId: string,
  idMap: Map<string, string>,
  validItemIds: Set<string>
): string[] | undefined {
  if (!prerequisites || prerequisites.length === 0) {
    return undefined;
  }
  const nextPrereqs = Array.from(
    new Set(
      prerequisites
        .map((oldId) => idMap.get(oldId) ?? oldId)
        .filter((mappedId) => validItemIds.has(mappedId) && mappedId !== selfId)
    )
  );
  return nextPrereqs.length > 0 ? nextPrereqs : undefined;
}

/**
 * Re-derives all chapter and lesson IDs from the course's current `code`,
 * automatically remapping every prerequisite reference on chapters and lessons
 * and returning the `oldId -> newId` map. Never alters `resource.file.id`.
 */
export function rekeyCourseContentIdsWithMap(course: CourseTree): {
  course: CourseTree;
  idMap: Map<string, string>;
} {
  const usedItemIds = new Set<string>();
  const idMap = new Map<string, string>();

  const chaptersWithNewIds = course.chapters.map((chapter, idx) => {
    const order = idx + 1;
    const newChapterId = deriveChapterId(course.code, order, chapter.title, usedItemIds);
    idMap.set(chapter.id, newChapterId);

    const lessons = chapter.lessons.map((lesson) => {
      const newLessonId = deriveLessonId(course.code, lesson.title, usedItemIds);
      idMap.set(lesson.id, newLessonId);
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

  // Remap prerequisites on both chapters and lessons and prune dangling/self references
  const validItemIds = new Set(usedItemIds);
  const remappedChapters = chaptersWithNewIds.map((chapter) => ({
    ...chapter,
    prerequisites: remapPrerequisites(chapter.prerequisites, chapter.id, idMap, validItemIds),
    lessons: chapter.lessons.map((lesson) => ({
      ...lesson,
      prerequisites: remapPrerequisites(lesson.prerequisites, lesson.id, idMap, validItemIds),
    })),
  }));

  return {
    course: {
      ...course,
      chapters: remappedChapters,
    },
    idMap,
  };
}

/**
 * Re-derives all chapter and lesson IDs from the course's current `code`,
 * automatically remapping every prerequisite reference.
 */
export function rekeyCourseContentIds(course: CourseTree): CourseTree {
  return rekeyCourseContentIdsWithMap(course).course;
}
