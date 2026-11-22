import { deriveFileId } from '@/lib/courseIds';
import {
  base64ToUint8Array,
  uint8ArrayToBase64,
  type CourseAttachment,
} from '@/lib/courseExchange';
import { getFile, putFile } from '@/lib/fileStore';
import { extractExtension, validateMaterialFile } from '@/lib/materialValidation';
import {
  AssessmentSchema,
  type AssessmentData,
  type AssessmentQuestion,
  type StoredFileRef,
} from '@/types/course';

export const ASSESSMENT_EXPORT_FORMAT = 'college-assessment' as const;
export const ASSESSMENT_EXPORT_VERSION = 1 as const;

const IMAGE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.avif',
]);

export type AssessmentAttachment = CourseAttachment;

export interface AssessmentExportEnvelope {
  format: typeof ASSESSMENT_EXPORT_FORMAT;
  version: typeof ASSESSMENT_EXPORT_VERSION;
  exportedAt: string;
  title?: string;
  kind?: 'exam' | 'assignment';
  assessment: AssessmentData;
  attachments?: AssessmentAttachment[];
}

export interface BuildAssessmentExportInput {
  title?: string;
  kind?: 'exam' | 'assignment';
  assessment: AssessmentData;
  attachments?: AssessmentAttachment[];
  includeFiles?: boolean;
  onWarning?: (warning: string) => void;
}

export type AssessmentImportResult =
  | {
      ok: true;
      assessment: AssessmentData;
      title?: string;
      kind?: 'exam' | 'assignment';
      warnings: string[];
    }
  | { ok: false; error: string };

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

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildAttachmentMap(rawAttachments: unknown): Map<string, AssessmentAttachment> {
  const map = new Map<string, AssessmentAttachment>();
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
        mimeType:
          typeof item.mimeType === 'string' ? item.mimeType : 'application/octet-stream',
        sizeBytes: typeof item.sizeBytes === 'number' ? item.sizeBytes : 0,
        dataBase64: item.dataBase64,
      });
    }
  }

  return map;
}

export async function buildAssessmentExport(
  input: BuildAssessmentExportInput
): Promise<AssessmentExportEnvelope> {
  const trimmedTitle = input.title?.trim();
  const includeFiles = input.includeFiles !== false;

  const suppliedMap = new Map<string, AssessmentAttachment>();
  if (Array.isArray(input.attachments)) {
    for (const att of input.attachments) {
      suppliedMap.set(att.id, att);
    }
  }

  const collected: AssessmentAttachment[] = [];
  if (includeFiles) {
    const referencedIds = new Set<string>();
    for (const question of input.assessment.questions) {
      const imageId = question.header.imageFile?.id;
      if (imageId) {
        referencedIds.add(imageId);
      }
    }

    for (const fileId of referencedIds) {
      const supplied = suppliedMap.get(fileId);
      if (supplied) {
        collected.push(supplied);
        continue;
      }

      const record = await getFile(fileId);
      if (!record) {
        input.onWarning?.(
          `Missing file attachment "${fileId}" in local storage; exported without image data.`
        );
        continue;
      }

      const bytes = await blobToUint8Array(record.blob);
      collected.push({
        id: record.id,
        name: record.name,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        dataBase64: uint8ArrayToBase64(bytes),
      });
    }
  }

  return {
    format: ASSESSMENT_EXPORT_FORMAT,
    version: ASSESSMENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    ...(trimmedTitle ? { title: trimmedTitle } : {}),
    ...(input.kind ? { kind: input.kind } : {}),
    assessment: input.assessment,
    ...(collected.length > 0 ? { attachments: collected } : {}),
  };
}

export async function parseAssessmentImport(
  jsonText: string,
  courseCode?: string
): Promise<AssessmentImportResult> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonText);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to parse JSON.';
    return { ok: false, error: `Invalid JSON: ${message}` };
  }

  if (!isPlainRecord(parsedJson)) {
    return { ok: false, error: 'Assessment JSON must be an object.' };
  }

  let rawAssessment: unknown;
  let rawAttachments: unknown;
  let importedTitle: string | undefined;
  let importedKind: 'exam' | 'assignment' | undefined;

  if ('format' in parsedJson) {
    if (parsedJson.format !== ASSESSMENT_EXPORT_FORMAT) {
      return {
        ok: false,
        error: `Unsupported assessment export format: "${String(parsedJson.format)}".`,
      };
    }

    if (
      parsedJson.version !== undefined &&
      parsedJson.version !== ASSESSMENT_EXPORT_VERSION
    ) {
      return {
        ok: false,
        error: `Unsupported assessment export version: ${String(parsedJson.version)}.`,
      };
    }

    if (!isPlainRecord(parsedJson.assessment)) {
      return {
        ok: false,
        error: 'assessment: Envelope is missing a valid assessment object.',
      };
    }

    if ('kind' in parsedJson && parsedJson.kind !== undefined) {
      if (parsedJson.kind !== 'exam' && parsedJson.kind !== 'assignment') {
        return {
          ok: false,
          error: `kind: Expected "exam" or "assignment", received "${String(parsedJson.kind)}".`,
        };
      }
      importedKind = parsedJson.kind;
    }

    if ('title' in parsedJson && parsedJson.title !== undefined) {
      if (typeof parsedJson.title !== 'string') {
        return { ok: false, error: 'title: Expected a string.' };
      }
      const trimmed = parsedJson.title.trim();
      if (trimmed.length > 0) {
        importedTitle = trimmed;
      }
    }

    rawAssessment = parsedJson.assessment;
    rawAttachments = parsedJson.attachments;
  } else {
    rawAssessment = parsedJson;
  }

  const validated = AssessmentSchema.safeParse(rawAssessment);
  if (!validated.success) {
    const issue = validated.error.issues[0];
    const path = issue?.path?.length ? issue.path.join('.') : 'assessment';
    return {
      ok: false,
      error: `${path}: ${issue?.message ?? 'Invalid assessment schema'}`,
    };
  }

  const warnings: string[] = [];
  const targetCourseCode = courseCode?.trim() || 'COURSE';
  const attachmentMap = buildAttachmentMap(rawAttachments);
  const storedRefsByOldId = new Map<string, StoredFileRef>();

  async function resolveQuestionImageFile(
    oldFileRef: StoredFileRef,
    contextLabel: string
  ): Promise<StoredFileRef | null> {
    const cached = storedRefsByOldId.get(oldFileRef.id);
    if (cached) {
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

    const normalizedMime = mimeType.split(';')[0].trim().toLowerCase();
    const ext = extractExtension(name);
    if (!normalizedMime.startsWith('image/') && !IMAGE_EXTENSIONS.has(ext)) {
      warnings.push(`${contextLabel}: attachment is not a supported image.`);
      return null;
    }

    const newFileId = deriveFileId(targetCourseCode);
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

  const nextQuestions: AssessmentQuestion[] = [];
  for (let qIdx = 0; qIdx < validated.data.questions.length; qIdx += 1) {
    const question = validated.data.questions[qIdx];
    if (!question.header.imageFile) {
      nextQuestions.push(question);
      continue;
    }

    const nextImageFile = await resolveQuestionImageFile(
      question.header.imageFile,
      `Question ${qIdx + 1} image "${question.header.imageFile.name}"`
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
        `Dropped image-only question ${qIdx + 1}: no text or fallback image URL remains.`
      );
    }
  }

  if (nextQuestions.length === 0) {
    return {
      ok: false,
      error: warnings[0] ?? 'No valid questions remain in assessment.',
    };
  }

  return {
    ok: true,
    assessment: {
      ...validated.data,
      questions: nextQuestions,
    },
    ...(importedTitle ? { title: importedTitle } : {}),
    ...(importedKind ? { kind: importedKind } : {}),
    warnings,
  };
}
