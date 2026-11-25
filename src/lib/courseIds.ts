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

export function formatSpineSupplementTag(nodeOrder: number): string {
  return `S${nodeOrder}`;
}

export function formatSpineChildSupplementTag(parentOrder: number, childOrder: number): string {
  return `S${parentOrder} / S${childOrder}`;
}

export function formatChapterSupplementTag(chapterOrder: number, nodeOrder: number): string {
  return `Ch${chapterOrder} / S${nodeOrder}`;
}

export function formatLessonSupplementTag(
  chapterOrder: number,
  lessonOrder: number,
  nodeOrder: number
): string {
  return `Ch${chapterOrder} / L${lessonOrder} / S${nodeOrder}`;
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

export function deriveSpineSupplementId(
  courseCode: string,
  order: number,
  title: string,
  existingIds?: Set<string>
): string {
  const prefix = deriveCoursePrefix(courseCode);
  const titlePart = slugify(title) || 'supplement';
  const base = `${prefix}-s${order}-${titlePart}`;
  return makeUniqueId(base, existingIds);
}

export function deriveSpineChildSupplementId(
  courseCode: string,
  parentOrder: number,
  childOrder: number,
  title: string,
  existingIds?: Set<string>
): string {
  const prefix = deriveCoursePrefix(courseCode);
  const titlePart = slugify(title) || 'supplement';
  const base = `${prefix}-s${parentOrder}-s${childOrder}-${titlePart}`;
  return makeUniqueId(base, existingIds);
}

export function deriveChapterSupplementId(
  courseCode: string,
  chapterOrder: number,
  nodeOrder: number,
  title: string,
  existingIds?: Set<string>
): string {
  const prefix = deriveCoursePrefix(courseCode);
  const titlePart = slugify(title) || 'supplement';
  const base = `${prefix}-ch${chapterOrder}-s${nodeOrder}-${titlePart}`;
  return makeUniqueId(base, existingIds);
}

export function deriveLessonSupplementId(
  courseCode: string,
  chapterOrder: number,
  lessonOrder: number,
  nodeOrder: number,
  title: string,
  existingIds?: Set<string>
): string {
  const prefix = deriveCoursePrefix(courseCode);
  const titlePart = slugify(title) || 'supplement';
  const base = `${prefix}-ch${chapterOrder}-l${lessonOrder}-s${nodeOrder}-${titlePart}`;
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
      const lessonOrder = lIdx + 1;
      const newLessonId = deriveLessonId(course.code, order, lessonOrder, lesson.title, usedItemIds);
      idMap.set(lesson.id, newLessonId);
      const lessonSupplements = lesson.supplements?.map((node, nIdx) => {
        const newNodeId = deriveLessonSupplementId(
          course.code,
          order,
          lessonOrder,
          nIdx + 1,
          node.title,
          usedItemIds
        );
        idMap.set(node.id, newNodeId);
        return { ...node, id: newNodeId };
      });
      return {
        ...lesson,
        id: newLessonId,
        ...(lessonSupplements !== undefined ? { supplements: lessonSupplements } : {}),
      };
    });

    const chapterSupplements = chapter.supplements?.map((node, nIdx) => {
      const newNodeId = deriveChapterSupplementId(
        course.code,
        order,
        nIdx + 1,
        node.title,
        usedItemIds
      );
      idMap.set(node.id, newNodeId);
      return { ...node, id: newNodeId };
    });

    return {
      ...chapter,
      order,
      id: newChapterId,
      lessons,
      ...(chapterSupplements !== undefined ? { supplements: chapterSupplements } : {}),
    };
  });

  const spineNodesWithNewIds = course.supplements?.map((spineNode, sIdx) => {
    const parentOrder = sIdx + 1;
    const newSpineId = deriveSpineSupplementId(
      course.code,
      parentOrder,
      spineNode.title,
      usedItemIds
    );
    idMap.set(spineNode.id, newSpineId);
    const children = spineNode.children?.map((child, cIdx) => {
      const newChildId = deriveSpineChildSupplementId(
        course.code,
        parentOrder,
        cIdx + 1,
        child.title,
        usedItemIds
      );
      idMap.set(child.id, newChildId);
      return { ...child, id: newChildId };
    });
    return {
      ...spineNode,
      id: newSpineId,
      ...(children !== undefined ? { children } : {}),
    };
  });

  // Remap prerequisites on chapters, lessons, and all supplements
  const validItemIds = new Set(usedItemIds);
  const remappedChapters = chaptersWithNewIds.map((chapter) => ({
    ...chapter,
    prerequisites: remapPrerequisites(chapter.prerequisites, chapter.id, idMap, validItemIds),
    lessons: chapter.lessons.map((lesson) => ({
      ...lesson,
      prerequisites: remapPrerequisites(lesson.prerequisites, lesson.id, idMap, validItemIds),
      ...(lesson.supplements !== undefined
        ? {
            supplements: lesson.supplements.map((node) => ({
              ...node,
              prerequisites: remapPrerequisites(node.prerequisites, node.id, idMap, validItemIds),
            })),
          }
        : {}),
    })),
    ...(chapter.supplements !== undefined
      ? {
          supplements: chapter.supplements.map((node) => ({
            ...node,
            prerequisites: remapPrerequisites(node.prerequisites, node.id, idMap, validItemIds),
          })),
        }
      : {}),
  }));

  const remappedSpineNodes = spineNodesWithNewIds?.map((spineNode) => ({
    ...spineNode,
    prerequisites: remapPrerequisites(
      spineNode.prerequisites,
      spineNode.id,
      idMap,
      validItemIds
    ),
    ...(spineNode.children !== undefined
      ? {
          children: spineNode.children.map((child) => ({
            ...child,
            prerequisites: remapPrerequisites(child.prerequisites, child.id, idMap, validItemIds),
          })),
        }
      : {}),
  }));

  return {
    course: {
      ...course,
      chapters: remappedChapters,
      ...(remappedSpineNodes !== undefined ? { supplements: remappedSpineNodes } : {}),
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

  const collectNodeId = (rawNode: unknown, pathLabel: string): string | null => {
    if (!isPlainObject(rawNode)) return null;
    const nodeId =
      typeof rawNode.id === 'string' && rawNode.id.trim().length > 0 ? rawNode.id : null;
    if (nodeId !== null) {
      if (declaredRawIds.has(nodeId)) {
        throw new Error(`${pathLabel}.id: Duplicate item id "${nodeId}".`);
      }
      declaredRawIds.add(nodeId);
    }
    return nodeId;
  };

  try {
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

          if (Array.isArray(rawLesson.supplements)) {
            rawLesson.supplements.forEach((rawNode, nIdx) => {
              collectNodeId(rawNode, `chapters.${cIdx}.lessons.${lIdx}.supplements.${nIdx}`);
            });
          }
        }
      }
      lessonRawIds.push(chapterLessonIds);

      if (Array.isArray(rawChapter.supplements)) {
        rawChapter.supplements.forEach((rawNode, nIdx) => {
          collectNodeId(rawNode, `chapters.${cIdx}.supplements.${nIdx}`);
        });
      }
    }

    if (Array.isArray(rawCourse.supplements)) {
      rawCourse.supplements.forEach((rawSpineNode, sIdx) => {
        collectNodeId(rawSpineNode, `supplements.${sIdx}`);
        if (isPlainObject(rawSpineNode) && Array.isArray(rawSpineNode.children)) {
          rawSpineNode.children.forEach((rawChild, cIdx) => {
            collectNodeId(rawChild, `supplements.${sIdx}.children.${cIdx}`);
          });
        }
      });
    }
  } catch (err) {
    return err instanceof Error ? err.message : 'Duplicate item id.';
  }

  const validateRawPrereqs = (
    rawObj: Record<string, unknown>,
    selfId: string | null,
    selfLabel: string,
    pathPrefix: string
  ): string | null => {
    if (rawObj.prerequisites === undefined) return null;
    if (!Array.isArray(rawObj.prerequisites)) {
      return `${pathPrefix}.prerequisites: Expected an array of prerequisite IDs.`;
    }
    for (let pIdx = 0; pIdx < rawObj.prerequisites.length; pIdx += 1) {
      const prereqId = rawObj.prerequisites[pIdx];
      if (typeof prereqId !== 'string' || prereqId.trim().length === 0) {
        return `${pathPrefix}.prerequisites.${pIdx}: Prerequisite id must be a non-empty string.`;
      }
      if (selfId !== null && prereqId === selfId) {
        return `${pathPrefix}.prerequisites.${pIdx}: ${selfLabel} "${selfId}" cannot depend on itself.`;
      }
      if (!declaredRawIds.has(prereqId)) {
        return `${pathPrefix}.prerequisites.${pIdx}: Unknown prerequisite id "${prereqId}".`;
      }
    }
    return null;
  };

  for (let cIdx = 0; cIdx < rawCourse.chapters.length; cIdx += 1) {
    const rawChapter = rawCourse.chapters[cIdx];
    if (!isPlainObject(rawChapter)) continue;

    const chErr = validateRawPrereqs(
      rawChapter,
      chapterRawIds[cIdx],
      'Chapter',
      `chapters.${cIdx}`
    );
    if (chErr) return chErr;

    if (Array.isArray(rawChapter.supplements)) {
      for (let nIdx = 0; nIdx < rawChapter.supplements.length; nIdx += 1) {
        const rawNode = rawChapter.supplements[nIdx];
        if (!isPlainObject(rawNode)) continue;
        const nId = typeof rawNode.id === 'string' && rawNode.id.trim() ? rawNode.id : null;
        const err = validateRawPrereqs(
          rawNode,
          nId,
          'Supplement',
          `chapters.${cIdx}.supplements.${nIdx}`
        );
        if (err) return err;
      }
    }

    if (Array.isArray(rawChapter.lessons)) {
      for (let lIdx = 0; lIdx < rawChapter.lessons.length; lIdx += 1) {
        const rawLesson = rawChapter.lessons[lIdx];
        if (!isPlainObject(rawLesson)) continue;

        const lErr = validateRawPrereqs(
          rawLesson,
          lessonRawIds[cIdx]?.[lIdx] ?? null,
          'Lesson',
          `chapters.${cIdx}.lessons.${lIdx}`
        );
        if (lErr) return lErr;

        if (Array.isArray(rawLesson.supplements)) {
          for (let nIdx = 0; nIdx < rawLesson.supplements.length; nIdx += 1) {
            const rawNode = rawLesson.supplements[nIdx];
            if (!isPlainObject(rawNode)) continue;
            const nId = typeof rawNode.id === 'string' && rawNode.id.trim() ? rawNode.id : null;
            const err = validateRawPrereqs(
              rawNode,
              nId,
              'Supplement',
              `chapters.${cIdx}.lessons.${lIdx}.supplements.${nIdx}`
            );
            if (err) return err;
          }
        }
      }
    }
  }

  if (Array.isArray(rawCourse.supplements)) {
    for (let sIdx = 0; sIdx < rawCourse.supplements.length; sIdx += 1) {
      const rawSpineNode = rawCourse.supplements[sIdx];
      if (!isPlainObject(rawSpineNode)) continue;
      const sId =
        typeof rawSpineNode.id === 'string' && rawSpineNode.id.trim() ? rawSpineNode.id : null;
      const sErr = validateRawPrereqs(rawSpineNode, sId, 'Supplement', `supplements.${sIdx}`);
      if (sErr) return sErr;

      if (Array.isArray(rawSpineNode.children)) {
        for (let cIdx = 0; cIdx < rawSpineNode.children.length; cIdx += 1) {
          const rawChild = rawSpineNode.children[cIdx];
          if (!isPlainObject(rawChild)) continue;
          const cId = typeof rawChild.id === 'string' && rawChild.id.trim() ? rawChild.id : null;
          const cErr = validateRawPrereqs(
            rawChild,
            cId,
            'Supplement',
            `supplements.${sIdx}.children.${cIdx}`
          );
          if (cErr) return cErr;
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
