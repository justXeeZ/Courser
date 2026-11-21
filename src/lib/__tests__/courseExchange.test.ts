import { beforeEach, describe, expect, it } from 'vitest';
import { buildCourseExport, parseCourseImport } from '@/lib/courseExchange';
import { deleteFile, getFile, listFileIds, putFile } from '@/lib/fileStore';
import type { CourseTree } from '@/types/course';

async function clearAllStoredFiles(): Promise<void> {
  const ids = await listFileIds();
  for (const id of ids) {
    await deleteFile(id);
  }
}

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read Blob.'));
    reader.readAsArrayBuffer(blob);
  });
}

function makeCourseWithFiles(): CourseTree {
  return {
    slug: 'cs101-systems',
    code: 'CS101',
    title: 'Systems Foundations',
    department: 'Computer Science',
    semester: 'Year 1 - First Semester',
    description: 'Introductory systems course',
    chapters: [
      {
        id: 'cs101-ch1-overview',
        order: 1,
        title: 'Overview',
        description: 'Course overview',
        resources: [
          {
            title: 'Syllabus PDF',
            kind: 'official',
            file: {
              id: 'cs101-file-aa11bb22',
              name: 'syllabus.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 100,
            },
          },
          {
            title: 'Course Site',
            kind: 'course',
            url: 'https://example.com/cs101',
          },
        ],
        lessons: [
          {
            id: 'cs101-binary-data',
            title: 'Binary Data',
            summary: 'Bytes and encoding',
            resources: [
              {
                title: 'Lab Starter',
                kind: 'lab',
                file: {
                  id: 'cs101-file-cc33dd44',
                  name: 'starter.bin',
                  mimeType: 'application/octet-stream',
                  sizeBytes: 70_000,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

describe('courseExchange', () => {
  beforeEach(async () => {
    await clearAllStoredFiles();
  });

  it('round-trips exported course with attachments using chunked base64 and new file IDs', async () => {
    const syllabusBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 0, 255]);
    // >64 KiB payload to exercise chunked base64 encoding/decoding
    const largeBinary = new Uint8Array(70_000);
    for (let i = 0; i < largeBinary.length; i += 1) {
      largeBinary[i] = i % 256;
    }

    await putFile(
      'cs101-file-aa11bb22',
      new Blob([syllabusBytes], { type: 'application/pdf' }),
      'syllabus.pdf',
      'application/pdf'
    );
    await putFile(
      'cs101-file-cc33dd44',
      new Blob([largeBinary], { type: 'application/octet-stream' }),
      'starter.bin',
      'application/octet-stream'
    );

    const course = makeCourseWithFiles();
    const exportedJson = await buildCourseExport(course, { includeFiles: true });
    const parsedEnvelope = JSON.parse(exportedJson);

    expect(parsedEnvelope.format).toBe('college-course-tree');
    expect(parsedEnvelope.version).toBe(1);
    expect(parsedEnvelope.attachments).toHaveLength(2);

    // Clear IndexedDB to verify import genuinely restores blobs into new IDs
    await clearAllStoredFiles();

    const imported = await parseCourseImport(exportedJson, []);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(imported.warnings).toEqual([]);
    const importedChapterFile = imported.course.chapters[0].resources?.[0].file;
    const importedLessonFile = imported.course.chapters[0].lessons[0].resources[0].file;

    expect(importedChapterFile).toBeDefined();
    expect(importedLessonFile).toBeDefined();
    expect(importedChapterFile!.id).toMatch(/^cs101-file-[0-9a-f]{8}$/);
    expect(importedLessonFile!.id).toMatch(/^cs101-file-[0-9a-f]{8}$/);
    expect(importedChapterFile!.id).not.toBe('cs101-file-aa11bb22');
    expect(importedLessonFile!.id).not.toBe('cs101-file-cc33dd44');
    expect(importedChapterFile!.sizeBytes).toBe(syllabusBytes.byteLength);
    expect(importedLessonFile!.sizeBytes).toBe(largeBinary.byteLength);

    const storedChapterBlob = await getFile(importedChapterFile!.id);
    const storedLessonBlob = await getFile(importedLessonFile!.id);
    expect(storedChapterBlob).toBeDefined();
    expect(storedLessonBlob).toBeDefined();
    expect(await readBlobBytes(storedChapterBlob!.blob)).toEqual(syllabusBytes);
    expect(await readBlobBytes(storedLessonBlob!.blob)).toEqual(largeBinary);
  });

  it('exports without attachments when includeFiles is false and drops missing file resources with warnings on import', async () => {
    await putFile(
      'cs101-file-aa11bb22',
      new Blob(['syllabus']),
      'syllabus.pdf',
      'application/pdf'
    );

    const course = makeCourseWithFiles();
    const lightweightJson = await buildCourseExport(course, { includeFiles: false });
    const envelope = JSON.parse(lightweightJson);

    expect(envelope.format).toBe('college-course-tree');
    expect(envelope.attachments).toBeUndefined();
    expect(envelope.course.chapters[0].resources[0].file.id).toBe('cs101-file-aa11bb22');

    const imported = await parseCourseImport(lightweightJson, []);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    // Missing file resources dropped with warnings, URL resource preserved
    expect(imported.warnings).toHaveLength(2);
    expect(imported.course.chapters[0].resources).toHaveLength(1);
    expect(imported.course.chapters[0].resources?.[0].title).toBe('Course Site');
    expect(imported.course.chapters[0].lessons[0].resources).toHaveLength(0);
  });

  it('imports bare course JSON with lenient pre-pass (default department Preparatory, missing IDs/orders/resources) and re-keys prerequisites', async () => {
    const bareCourse = {
      slug: 'math105-calculus',
      code: 'MATH105',
      title: 'Calculus I',
      description: 'Limits and derivatives',
      chapters: [
        {
          id: 'raw-ch-1',
          title: 'Limits',
          description: 'Introduction to limits',
          lessons: [
            {
              id: 'raw-lesson-a',
              title: 'Epsilon Delta',
              summary: 'Formal limit definition',
            },
            {
              title: 'Continuity',
              summary: 'Continuous functions',
              prerequisites: ['raw-lesson-a'],
            },
          ],
        },
        {
          title: 'Capstone Review',
          description: 'Standalone review chapter',
          prerequisites: ['raw-ch-1', 'raw-lesson-a'],
          lessons: [],
        },
      ],
    };

    const result = await parseCourseImport(JSON.stringify(bareCourse), []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.course.department).toBe('Preparatory');
    expect(result.course.chapters[0].order).toBe(1);
    expect(result.course.chapters[0].id).toBe('math105-ch1-limits');
    expect(result.course.chapters[0].resources).toEqual([]);
    expect(result.course.chapters[0].lessons[0].id).toBe('math105-epsilon-delta');
    expect(result.course.chapters[0].lessons[0].resources).toEqual([]);
    expect(result.course.chapters[0].lessons[1].id).toBe('math105-continuity');
    expect(result.course.chapters[0].lessons[1].prerequisites).toEqual(['math105-epsilon-delta']);
    expect(result.course.chapters[1].order).toBe(2);
    expect(result.course.chapters[1].id).toBe('math105-ch2-capstone-review');
    expect(result.course.chapters[1].prerequisites).toEqual([
      'math105-ch1-limits',
      'math105-epsilon-delta',
    ]);
  });

  it('resolves slug conflicts by appending -2, -3 suffixes with a warning', async () => {
    const bareCourse = {
      slug: 'phys101-mechanics',
      code: 'PHYS101',
      title: 'Mechanics',
      department: '   ',
      description: 'Classical mechanics',
      chapters: [
        {
          id: 'c1',
          order: 1,
          title: 'Kinematics',
          description: 'Motion in 1D and 2D',
          lessons: [],
        },
      ],
    };

    const result = await parseCourseImport(JSON.stringify(bareCourse), [
      'phys101-mechanics',
      'phys101-mechanics-2',
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.course.department).toBe('Preparatory');
    expect(result.course.slug).toBe('phys101-mechanics-3');
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0]).toContain('phys101-mechanics-3');
  });

  it('returns descriptive errors for invalid JSON, unsupported envelopes, and schema failures', async () => {
    const badJson = await parseCourseImport('{ not valid json', []);
    expect(badJson.ok).toBe(false);
    if (!badJson.ok) {
      expect(badJson.error).toContain('Invalid JSON');
    }

    const badFormat = await parseCourseImport(
      JSON.stringify({ format: 'unknown-format', version: 1, course: {} }),
      []
    );
    expect(badFormat.ok).toBe(false);

    const badSchema = await parseCourseImport(
      JSON.stringify({
        slug: 'INVALID SLUG!',
        code: 'CS101',
        title: 'Test',
        description: 'Desc',
        chapters: [],
      }),
      []
    );
    expect(badSchema.ok).toBe(false);
    if (!badSchema.ok) {
      expect(badSchema.error).toContain('slug:');
    }
  });
});
