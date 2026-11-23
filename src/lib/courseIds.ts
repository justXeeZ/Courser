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

export function formatChapterPositionTag(chapterOrder: number): string {
  return `Ch${chapterOrder}`;
}

export function formatLessonPositionTag(chapterOrder: number, lessonOrder: number): string {
  return `Ch${chapterOrder} / L${lessonOrder}`;
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
  chapterOrder: number,
  lessonOrder: number,
  title: string,
  existingIds?: Set<string>
): string {
  const prefix = deriveCoursePrefix(courseCode);
  const stripped = title.replace(
    /^(?:ch(?:apter)?\s*\d+\s*[-.:)]*\s*)?(?:l(?:esson)?\s*)?\d+(?:\.\d+)?\s*[.:)-]?\s*/i,
    ''
  );
  const titlePart = slugify(stripped) || slugify(title) || 'lesson';
  const base = `${prefix}-ch${chapterOrder}-l${lessonOrder}-${titlePart}`;
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

    const lessons = chapter.lessons.map((lesson, lIdx) => {
      const newLessonId = deriveLessonId(course.code, order, lIdx + 1, lesson.title, usedItemIds);
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates raw chapter/lesson IDs and prerequisite references BEFORE re-keying
 * so duplicate raw IDs, self-references, and dangling/cross-course prerequisite IDs
 * fail loudly instead of being silently pruned during re-keying.
 */
export function validateRawCourseReferences(rawCourse: unknown): string | null {
  if (!isPlainObject(rawCourse) || !Array.isArray(rawCourse.chapters)) {
    return null;
  }

  const declaredRawIds = new Set<string>();
  const chapterRawIds: Array<string | null> = [];
  const lessonRawIds: Array<Array<string | null>> = [];

  for (let cIdx = 0; cIdx < rawCourse.chapters.length; cIdx += 1) {
    const rawChapter = rawCourse.chapters[cIdx];
    if (!isPlainObject(rawChapter)) {
      chapterRawIds.push(null);
      lessonRawIds.push([]);
      continue;
    }

    const chapterId =
      typeof rawChapter.id === 'string' && rawChapter.id.trim().length > 0
        ? rawChapter.id
        : null;

    if (chapterId !== null) {
      if (declaredRawIds.has(chapterId)) {
        return `chapters.${cIdx}.id: Duplicate item id "${chapterId}".`;
      }
      declaredRawIds.add(chapterId);
    }
    chapterRawIds.push(chapterId);

    const chapterLessonIds: Array<string | null> = [];
    if (Array.isArray(rawChapter.lessons)) {
      for (let lIdx = 0; lIdx < rawChapter.lessons.length; lIdx += 1) {
        const rawLesson = rawChapter.lessons[lIdx];
        if (!isPlainObject(rawLesson)) {
          chapterLessonIds.push(null);
          continue;
        }
        const lessonId =
          typeof rawLesson.id === 'string' && rawLesson.id.trim().length > 0
            ? rawLesson.id
            : null;
        if (lessonId !== null) {
          if (declaredRawIds.has(lessonId)) {
            return `chapters.${cIdx}.lessons.${lIdx}.id: Duplicate item id "${lessonId}".`;
          }
          declaredRawIds.add(lessonId);
        }
        chapterLessonIds.push(lessonId);
      }
    }
    lessonRawIds.push(chapterLessonIds);
  }

  for (let cIdx = 0; cIdx < rawCourse.chapters.length; cIdx += 1) {
    const rawChapter = rawCourse.chapters[cIdx];
    if (!isPlainObject(rawChapter)) continue;

    const chapterId = chapterRawIds[cIdx];
    if (rawChapter.prerequisites !== undefined) {
      if (!Array.isArray(rawChapter.prerequisites)) {
        return `chapters.${cIdx}.prerequisites: Expected an array of prerequisite IDs.`;
      }
      for (let pIdx = 0; pIdx < rawChapter.prerequisites.length; pIdx += 1) {
        const prereqId = rawChapter.prerequisites[pIdx];
        if (typeof prereqId !== 'string' || prereqId.trim().length === 0) {
          return `chapters.${cIdx}.prerequisites.${pIdx}: Prerequisite id must be a non-empty string.`;
        }
        if (chapterId !== null && prereqId === chapterId) {
          return `chapters.${cIdx}.prerequisites.${pIdx}: Chapter "${chapterId}" cannot depend on itself.`;
        }
        if (!declaredRawIds.has(prereqId)) {
          return `chapters.${cIdx}.prerequisites.${pIdx}: Unknown prerequisite id "${prereqId}".`;
        }
      }
    }

    if (Array.isArray(rawChapter.lessons)) {
      for (let lIdx = 0; lIdx < rawChapter.lessons.length; lIdx += 1) {
        const rawLesson = rawChapter.lessons[lIdx];
        if (!isPlainObject(rawLesson)) continue;

        const lessonId = lessonRawIds[cIdx]?.[lIdx] ?? null;
        if (rawLesson.prerequisites !== undefined) {
          if (!Array.isArray(rawLesson.prerequisites)) {
            return `chapters.${cIdx}.lessons.${lIdx}.prerequisites: Expected an array of prerequisite IDs.`;
          }
          for (let pIdx = 0; pIdx < rawLesson.prerequisites.length; pIdx += 1) {
            const prereqId = rawLesson.prerequisites[pIdx];
            if (typeof prereqId !== 'string' || prereqId.trim().length === 0) {
              return `chapters.${cIdx}.lessons.${lIdx}.prerequisites.${pIdx}: Prerequisite id must be a non-empty string.`;
            }
            if (lessonId !== null && prereqId === lessonId) {
              return `chapters.${cIdx}.lessons.${lIdx}.prerequisites.${pIdx}: Lesson "${lessonId}" cannot depend on itself.`;
            }
            if (!declaredRawIds.has(prereqId)) {
              return `chapters.${cIdx}.lessons.${lIdx}.prerequisites.${pIdx}: Unknown prerequisite id "${prereqId}".`;
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Re-derives all chapter and lesson IDs from the course's current `code`,
 * automatically remapping every prerequisite reference.
 */
export function rekeyCourseContentIds(course: CourseTree): CourseTree {
  return rekeyCourseContentIdsWithMap(course).course;
}
