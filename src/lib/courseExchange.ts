import {
  deriveFileId,
  rekeyCourseContentIdsWithMap,
  validateRawCourseReferences,
} from '@/lib/courseIds';
import { collectReferencedFileIds, getFile, putFile } from '@/lib/fileStore';
import { extractExtension, validateMaterialFile } from '@/lib/materialValidation';
import {
  CourseTreeSchema,
  type AssessmentQuestion,
  type CourseTree,
  type LessonResource,
  type StoredFileRef,
} from '@/types/course';

export const COURSE_EXPORT_FORMAT = 'college-course-tree' as const;
export const COURSE_EXPORT_VERSION = 1 as const;

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.avif',
]);

export interface CourseAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64: string;
}

export interface CourseExportEnvelope {
  format: typeof COURSE_EXPORT_FORMAT;
  version: typeof COURSE_EXPORT_VERSION;
  exportedAt: string;
  course: CourseTree;
  attachments?: CourseAttachment[];
}

const BASE64_CHUNK_SIZE = 0x8000;

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK_SIZE) {
    const slice = bytes.subarray(i, i + BASE64_CHUNK_SIZE);
    let binary = '';
    for (let j = 0; j < slice.length; j += 1) {
      binary += String.fromCharCode(slice[j]);
    }
    chunks.push(binary);
  }
  return btoa(chunks.join(''));
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise<Uint8Array>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read Blob.'));
      reader.readAsArrayBuffer(blob);
    });
  }
  return new Uint8Array(await new Response(blob).arrayBuffer());
}

export async function buildCourseExport(
  course: CourseTree,
  options: { includeFiles: boolean }
): Promise<string> {
  let attachments: CourseAttachment[] | undefined;

  if (options.includeFiles) {
    const referencedIds = collectReferencedFileIds([course]);
    const collected: CourseAttachment[] = [];

    for (const fileId of referencedIds) {
      const record = await getFile(fileId);
      if (!record) continue;
      const bytes = await blobToUint8Array(record.blob);
      collected.push({
        id: record.id,
        name: record.name,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        dataBase64: uint8ArrayToBase64(bytes),
      });
    }

    if (collected.length > 0) {
      attachments = collected;
    }
  }

  const envelope: CourseExportEnvelope = {
    format: COURSE_EXPORT_FORMAT,
    version: COURSE_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    course,
    ...(attachments ? { attachments } : {}),
  };

  return JSON.stringify(envelope, null, 2);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function prepassSupplementList(
  rawNodes: unknown,
  prefix: string
): unknown {
  if (!Array.isArray(rawNodes)) return rawNodes;
  return rawNodes.map((rawNode, nIdx) => {
    if (!isPlainRecord(rawNode)) return rawNode;
    const nodeId =
      typeof rawNode.id === 'string' && rawNode.id.trim().length > 0
        ? rawNode.id
        : `${prefix}_s_${nIdx + 1}`;
    const resources =
      rawNode.resources === undefined || rawNode.resources === null ? [] : rawNode.resources;
    const children = Array.isArray(rawNode.children)
      ? prepassSupplementList(rawNode.children, `${prefix}_s_${nIdx + 1}`)
      : rawNode.children;
    return {
      ...rawNode,
      id: nodeId,
      resources,
      ...(children !== undefined ? { children } : {}),
    };
  });
}

function applyLenientPrepass(rawCourse: Record<string, unknown>): Record<string, unknown> {
  const rawDepartment = rawCourse.department;
  const department =
    typeof rawDepartment === 'string' && rawDepartment.trim().length > 0
      ? rawDepartment.trim()
      : 'Preparatory';

  let chapters: unknown = rawCourse.chapters;
  if (Array.isArray(rawCourse.chapters)) {
    chapters = rawCourse.chapters.map((rawChapter, cIdx) => {
      if (!isPlainRecord(rawChapter)) return rawChapter;

      const chapterId =
        typeof rawChapter.id === 'string' && rawChapter.id.trim().length > 0
          ? rawChapter.id
          : `__tmp_ch_${cIdx + 1}`;

      const order =
        rawChapter.order === undefined || rawChapter.order === null
          ? cIdx + 1
          : rawChapter.order;

      const chapterResources =
        rawChapter.resources === undefined || rawChapter.resources === null
          ? []
          : rawChapter.resources;

      let lessons: unknown = rawChapter.lessons;
      if (Array.isArray(rawChapter.lessons)) {
        lessons = rawChapter.lessons.map((rawLesson, lIdx) => {
          if (!isPlainRecord(rawLesson)) return rawLesson;

          const lessonId =
            typeof rawLesson.id === 'string' && rawLesson.id.trim().length > 0
              ? rawLesson.id
              : `__tmp_ch_${cIdx + 1}_l_${lIdx + 1}`;

          const lessonResources =
            rawLesson.resources === undefined || rawLesson.resources === null
              ? []
              : rawLesson.resources;

          const lessonSupplements = prepassSupplementList(
            rawLesson.supplements,
            `__tmp_ch_${cIdx + 1}_l_${lIdx + 1}`
          );

          return {
            ...rawLesson,
            id: lessonId,
            resources: lessonResources,
            ...(lessonSupplements !== undefined ? { supplements: lessonSupplements } : {}),
          };
        });
      }

      const chapterSupplements = prepassSupplementList(
        rawChapter.supplements,
        `__tmp_ch_${cIdx + 1}`
      );

      return {
        ...rawChapter,
        id: chapterId,
        order,
        resources: chapterResources,
        lessons,
        ...(chapterSupplements !== undefined ? { supplements: chapterSupplements } : {}),
      };
    });
  }

  const spineSupplements = prepassSupplementList(rawCourse.supplements, '__tmp_spine');

  return {
    ...rawCourse,
    department,
    chapters,
    ...(spineSupplements !== undefined ? { supplements: spineSupplements } : {}),
  };
}

function canRekeySupplements(rawNodes: unknown): boolean {
  if (rawNodes === undefined) return true;
  if (!Array.isArray(rawNodes)) return false;
  return rawNodes.every(
    (node) =>
      isPlainRecord(node) &&
      typeof node.id === 'string' &&
      typeof node.title === 'string' &&
      canRekeySupplements(node.children)
  );
}

function canRekeyCourseStructure(candidate: Record<string, unknown>): boolean {
  if (typeof candidate.code !== 'string' || candidate.code.trim().length === 0) {
    return false;
  }
  if (!Array.isArray(candidate.chapters) || candidate.chapters.length === 0) {
    return false;
  }
  if (!canRekeySupplements(candidate.supplements)) {
    return false;
  }
  return candidate.chapters.every((chapter) => {
    if (!isPlainRecord(chapter)) return false;
    if (typeof chapter.id !== 'string' || typeof chapter.title !== 'string') return false;
    if (!Array.isArray(chapter.lessons)) return false;
    if (!canRekeySupplements(chapter.supplements)) return false;
    return chapter.lessons.every(
      (lesson) =>
        isPlainRecord(lesson) &&
        typeof lesson.id === 'string' &&
        typeof lesson.title === 'string' &&
        canRekeySupplements(lesson.supplements)
    );
  });
}

function buildAttachmentMap(
  rawAttachments: unknown
): Map<string, CourseAttachment> {
  const map = new Map<string, CourseAttachment>();
  if (!Array.isArray(rawAttachments)) return map;

  for (const item of rawAttachments) {
    if (!isPlainRecord(item)) continue;
    if (
      typeof item.id === 'string' &&
      item.id.length > 0 &&
      typeof item.dataBase64 === 'string'
    ) {
      map.set(item.id, {
        id: item.id,
        name: typeof item.name === 'string' ? item.name : 'attachment',
        mimeType: typeof item.mimeType === 'string' ? item.mimeType : 'application/octet-stream',
        sizeBytes: typeof item.sizeBytes === 'number' ? item.sizeBytes : 0,
        dataBase64: item.dataBase64,
      });
    }
  }

  return map;
}

export type CourseImportResult =
  | { ok: true; course: CourseTree; warnings: string[] }
  | { ok: false; error: string };

const MAX_IMPORT_JSON_CHARS = 50 * 1024 * 1024; // 50 MB guard

export async function parseCourseImport(
  text: string,
  existingSlugs: Iterable<string>
): Promise<CourseImportResult> {
  if (text.length > MAX_IMPORT_JSON_CHARS) {
    return {
      ok: false,
      error: 'Course JSON exceeds the 50 MB import size limit.',
    };
  }
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to parse JSON.';
    return { ok: false, error: `Invalid JSON: ${message}` };
  }

  if (!isPlainRecord(parsedJson)) {
    return { ok: false, error: 'Course JSON must be an object.' };
  }

  let rawCourseInput: Record<string, unknown>;
  let rawAttachments: unknown;

  if ('format' in parsedJson) {
    if (parsedJson.format !== COURSE_EXPORT_FORMAT) {
      return {
        ok: false,
        error: `Unsupported course export format: "${String(parsedJson.format)}".`,
      };
    }
    if (parsedJson.version !== undefined && parsedJson.version !== COURSE_EXPORT_VERSION) {
      return {
        ok: false,
        error: `Unsupported course export version: ${String(parsedJson.version)}.`,
      };
    }
    if (!isPlainRecord(parsedJson.course)) {
      return { ok: false, error: 'course: Envelope is missing a valid course object.' };
    }
    rawCourseInput = parsedJson.course;
    rawAttachments = parsedJson.attachments;
  } else {
    rawCourseInput = parsedJson;
  }

  const rawRefError = validateRawCourseReferences(rawCourseInput);
  if (rawRefError) {
    return {
      ok: false,
      error: rawRefError,
    };
  }

  const prepassed = applyLenientPrepass(rawCourseInput);
  const candidate = canRekeyCourseStructure(prepassed)
    ? rekeyCourseContentIdsWithMap(prepassed as unknown as CourseTree).course
    : prepassed;

  const validated = CourseTreeSchema.safeParse(candidate);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    const path = issue?.path?.length ? issue.path.join('.') : 'course';
    return {
      ok: false,
      error: `${path}: ${issue?.message ?? 'Invalid course schema'}`,
    };
  }

  const warnings: string[] = [];
  let course = validated.data;

  // Resolve slug conflicts against existingSlugs
  const existingSet = new Set(Array.from(existingSlugs, (s) => s.toLowerCase()));
  if (existingSet.has(course.slug.toLowerCase())) {
    let suffix = 2;
    while (existingSet.has(`${course.slug}-${suffix}`.toLowerCase())) {
      suffix += 1;
    }
    const nextSlug = `${course.slug}-${suffix}`;
    warnings.push(
      `Course slug "${course.slug}" already exists; renamed to "${nextSlug}".`
    );
    course = { ...course, slug: nextSlug };
  }

  // Store attachments and remap file IDs; drop missing file resources with warnings
  const attachmentMap = buildAttachmentMap(rawAttachments);
  const storedRefsByOldId = new Map<string, StoredFileRef>();

  async function resolveStoredFileRef(
    oldFileRef: StoredFileRef,
    contextLabel: string,
    options?: { requireImage?: boolean }
  ): Promise<StoredFileRef | null> {
    const cached = storedRefsByOldId.get(oldFileRef.id);
    if (cached) {
      if (options?.requireImage) {
        const cachedExt = extractExtension(cached.name);
        const cachedMime = cached.mimeType.split(';')[0].trim().toLowerCase();
        if (!cachedMime.startsWith('image/') && !IMAGE_EXTENSIONS.has(cachedExt)) {
          warnings.push(`${contextLabel}: attachment is not a supported image.`);
          return null;
        }
      }
      return cached;
    }

    const attachment = attachmentMap.get(oldFileRef.id);
    if (!attachment) {
      warnings.push(`${contextLabel}: attachment data is missing.`);
      return null;
    }

    let bytes: Uint8Array;
    try {
      bytes = base64ToUint8Array(attachment.dataBase64);
    } catch {
      warnings.push(`${contextLabel}: attachment base64 is invalid.`);
      return null;
    }

    const name = attachment.name.trim() || oldFileRef.name;
    const mimeType =
      attachment.mimeType.trim() || oldFileRef.mimeType || 'application/octet-stream';

    const validation = validateMaterialFile({
      name,
      size: bytes.byteLength,
      type: mimeType,
    });
    if (!validation.ok) {
      warnings.push(`${contextLabel}: ${validation.error}`);
      return null;
    }

    if (options?.requireImage) {
      const normalizedMime = mimeType.split(';')[0].trim().toLowerCase();
      const ext = extractExtension(name);
      if (!normalizedMime.startsWith('image/') && !IMAGE_EXTENSIONS.has(ext)) {
        warnings.push(`${contextLabel}: attachment is not a supported image.`);
        return null;
      }
    }

    const newFileId = deriveFileId(course.code);
    const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });

    await putFile(newFileId, blob, name, mimeType);

    const newFileRef: StoredFileRef = {
      id: newFileId,
      name,
      mimeType,
      sizeBytes: bytes.byteLength,
    };
    storedRefsByOldId.set(oldFileRef.id, newFileRef);

    return newFileRef;
  }

  async function resolveResource(resource: LessonResource): Promise<LessonResource | null> {
    if (resource.file) {
      const nextFile = await resolveStoredFileRef(
        resource.file,
        `Dropped file resource "${resource.title}" (${resource.file.name})`
      );
      if (!nextFile) return null;
      return { ...resource, file: nextFile };
    }

    if (resource.assessment) {
      const nextQuestions: AssessmentQuestion[] = [];
      for (let qIdx = 0; qIdx < resource.assessment.questions.length; qIdx += 1) {
        const question = resource.assessment.questions[qIdx];
        if (!question.header.imageFile) {
          nextQuestions.push(question);
          continue;
        }

        const nextImageFile = await resolveStoredFileRef(
          question.header.imageFile,
          `Question ${qIdx + 1} image "${question.header.imageFile.name}" in "${resource.title}"`,
          { requireImage: true }
        );

        if (nextImageFile) {
          nextQuestions.push({
            ...question,
            header: {
              ...question.header,
              imageFile: nextImageFile,
            },
          });
          continue;
        }

        const hasFallbackHeader =
          Boolean(question.header.text && question.header.text.trim().length > 0) ||
          Boolean(question.header.imageUrl);

        if (hasFallbackHeader) {
          const { imageFile: _droppedImageFile, ...restHeader } = question.header;
          nextQuestions.push({
            ...question,
            header: restHeader,
          });
        } else {
          warnings.push(
            `Dropped image-only question ${qIdx + 1} in "${resource.title}": no text or fallback image URL remains.`
          );
        }
      }

      if (nextQuestions.length === 0) {
        warnings.push(
          `Dropped assessment "${resource.title}": no valid questions remain.`
        );
        return null;
      }

      return {
        ...resource,
        assessment: {
          ...resource.assessment,
          questions: nextQuestions,
        },
      };
    }

    return resource;
  }

  async function resolveResources(resources: LessonResource[]): Promise<LessonResource[]> {
    const resolved: LessonResource[] = [];
    for (const resource of resources) {
      const next = await resolveResource(resource);
      if (next) resolved.push(next);
    }
    return resolved;
  }

  async function resolveSupplements<T extends NonNullable<CourseTree['supplements']>[number] | NonNullable<CourseTree['chapters'][number]['supplements']>[number]>(
    nodes: T[]
  ): Promise<T[]> {
    const resolved: T[] = [];
    for (const node of nodes) {
      const nextResources = await resolveResources(node.resources);
      const maybeChildren = 'children' in node && Array.isArray(node.children)
        ? await resolveSupplements(node.children)
        : undefined;
      resolved.push({
        ...node,
        resources: nextResources,
        ...(maybeChildren !== undefined ? { children: maybeChildren } : {}),
      });
    }
    return resolved;
  }

  const nextChapters: CourseTree['chapters'] = [];
  for (const chapter of course.chapters) {
    const nextChapterResources = chapter.resources
      ? await resolveResources(chapter.resources)
      : undefined;

    const nextLessons: typeof chapter.lessons = [];
    for (const lesson of chapter.lessons) {
      const nextLessonResources = await resolveResources(lesson.resources);
      const nextLessonSupplements = lesson.supplements
        ? await resolveSupplements(lesson.supplements)
        : undefined;
      nextLessons.push({
        ...lesson,
        resources: nextLessonResources,
        ...(nextLessonSupplements !== undefined ? { supplements: nextLessonSupplements } : {}),
      });
    }

    const nextChapterSupplements = chapter.supplements
      ? await resolveSupplements(chapter.supplements)
      : undefined;

    nextChapters.push({
      ...chapter,
      ...(nextChapterResources !== undefined ? { resources: nextChapterResources } : {}),
      lessons: nextLessons,
      ...(nextChapterSupplements !== undefined ? { supplements: nextChapterSupplements } : {}),
    });
  }

  const nextSpineSupplements = course.supplements
    ? await resolveSupplements(course.supplements)
    : undefined;

  return {
    ok: true,
    course: {
      ...course,
      chapters: nextChapters,
      ...(nextSpineSupplements !== undefined ? { supplements: nextSpineSupplements } : {}),
    },
    warnings,
  };
}
