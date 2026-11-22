import { beforeEach, describe, expect, it } from 'vitest';
import { buildCourseExport, parseCourseImport, uint8ArrayToBase64 } from '@/lib/courseExchange';
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
    year: 1,
    semester: 1,
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

  it('rejects dangling, cross-course, self-referencing, and duplicate raw item IDs before re-keying', async () => {
    // (a) Dangling prerequisite on chapter
    const danglingPayload = {
      slug: 'math101-calc',
      code: 'MATH101',
      title: 'Calculus',
      department: 'Mathematics',
      description: 'Calculus',
      chapters: [
        {
          id: 'math101-ch1-limits',
          order: 1,
          title: 'Limits',
          description: 'Limits',
          prerequisites: ['does-not-exist'],
          lessons: [],
        },
      ],
    };
    const danglingResult = await parseCourseImport(JSON.stringify(danglingPayload), []);
    expect(danglingResult.ok).toBe(false);
    if (!danglingResult.ok) {
      expect(danglingResult.error).toContain('does-not-exist');
    }

    // (b) Cross-course prerequisite on lesson
    const crossCoursePayload = {
      slug: 'math101-calc',
      code: 'MATH101',
      title: 'Calculus',
      department: 'Mathematics',
      description: 'Calculus',
      chapters: [
        {
          id: 'math101-ch1-limits',
          order: 1,
          title: 'Limits',
          description: 'Limits',
          lessons: [
            {
              id: 'math101-derivatives',
              title: 'Derivatives',
              summary: 'Rates of change',
              prerequisites: ['guide101-ch1-navigating-the-catalog'],
              resources: [],
            },
          ],
        },
      ],
    };
    const crossCourseResult = await parseCourseImport(JSON.stringify(crossCoursePayload), []);
    expect(crossCourseResult.ok).toBe(false);
    if (!crossCourseResult.ok) {
      expect(crossCourseResult.error).toContain('guide101-ch1-navigating-the-catalog');
    }

    // (c) Self-prerequisite on chapter and lesson
    const selfChapterPayload = {
      slug: 'math101-calc',
      code: 'MATH101',
      title: 'Calculus',
      department: 'Mathematics',
      description: 'Calculus',
      chapters: [
        {
          id: 'raw-ch1',
          order: 1,
          title: 'Limits',
          description: 'Limits',
          prerequisites: ['raw-ch1'],
          lessons: [],
        },
      ],
    };
    const selfChapterResult = await parseCourseImport(JSON.stringify(selfChapterPayload), []);
    expect(selfChapterResult.ok).toBe(false);
    if (!selfChapterResult.ok) {
      expect(selfChapterResult.error).toContain('raw-ch1');
    }

    const selfLessonPayload = {
      slug: 'math101-calc',
      code: 'MATH101',
      title: 'Calculus',
      department: 'Mathematics',
      description: 'Calculus',
      chapters: [
        {
          id: 'raw-ch1',
          order: 1,
          title: 'Limits',
          description: 'Limits',
          lessons: [
            {
              id: 'raw-l1',
              title: 'Derivatives',
              summary: 'Rates of change',
              prerequisites: ['raw-l1'],
              resources: [],
            },
          ],
        },
      ],
    };
    const selfLessonResult = await parseCourseImport(JSON.stringify(selfLessonPayload), []);
    expect(selfLessonResult.ok).toBe(false);
    if (!selfLessonResult.ok) {
      expect(selfLessonResult.error).toContain('raw-l1');
    }

    // (d) Duplicate raw item IDs
    const duplicateIdPayload = {
      slug: 'math101-calc',
      code: 'MATH101',
      title: 'Calculus',
      department: 'Mathematics',
      description: 'Calculus',
      chapters: [
        {
          id: 'dup-id',
          order: 1,
          title: 'Limits',
          description: 'Limits',
          lessons: [
            {
              id: 'dup-id',
              title: 'Derivatives',
              summary: 'Rates of change',
              resources: [],
            },
          ],
        },
      ],
    };
    const duplicateResult = await parseCourseImport(JSON.stringify(duplicateIdPayload), []);
    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.error).toContain('dup-id');
    }
  });

  it('drops dangerous or empty (.exe, .html, 0-byte) embedded attachments with warnings and does not store them in IndexedDB', async () => {
    const craftedEnvelope = {
      format: 'college-course-tree',
      version: 1,
      exportedAt: new Date().toISOString(),
      course: {
        slug: 'sec101-appsec',
        code: 'SEC101',
        title: 'Application Security',
        department: 'Computer Science',
        description: 'Security fundamentals',
        chapters: [
          {
            id: 'sec101-ch1-intro',
            order: 1,
            title: '1. Threat Modeling',
            description: 'Basics',
            resources: [
              {
                title: 'Malware Binary',
                kind: 'lab',
                file: {
                  id: 'sec101-file-11111111',
                  name: 'malware.exe',
                  mimeType: 'application/x-msdownload',
                  sizeBytes: 4,
                },
              },
              {
                title: 'Safe Reference Link',
                kind: 'document',
                url: 'https://example.com/sec101',
              },
            ],
            lessons: [
              {
                id: 'sec101-xss',
                title: 'XSS Defense',
                summary: 'Sanitization',
                resources: [
                  {
                    title: 'HTML Payload',
                    kind: 'document',
                    file: {
                      id: 'sec101-file-22222222',
                      name: 'xss.html',
                      mimeType: 'text/html',
                      sizeBytes: 29,
                    },
                  },
                  {
                    title: 'Empty PDF',
                    kind: 'slides',
                    file: {
                      id: 'sec101-file-33333333',
                      name: 'empty.pdf',
                      mimeType: 'application/pdf',
                      sizeBytes: 0,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      attachments: [
        {
          id: 'sec101-file-11111111',
          name: 'malware.exe',
          mimeType: 'application/x-msdownload',
          sizeBytes: 4,
          dataBase64: btoa('MZ\x90\x00'),
        },
        {
          id: 'sec101-file-22222222',
          name: 'xss.html',
          mimeType: 'text/html',
          sizeBytes: 29,
          dataBase64: btoa('<script>alert(1)</script>'),
        },
        {
          id: 'sec101-file-33333333',
          name: 'empty.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 0,
          dataBase64: '',
        },
      ],
    };

    const result = await parseCourseImport(JSON.stringify(craftedEnvelope), []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // All 3 invalid attachments dropped with warnings; safe URL resource preserved
    expect(result.warnings).toHaveLength(3);
    expect(result.warnings[0]).toContain('malware.exe');
    expect(result.warnings[1]).toContain('xss.html');
    expect(result.warnings[2]).toContain('empty.pdf');
    expect(result.course.chapters[0].resources).toHaveLength(1);
    expect(result.course.chapters[0].resources?.[0].title).toBe('Safe Reference Link');
    expect(result.course.chapters[0].lessons[0].resources).toHaveLength(0);

    // Confirm NONE of the invalid attachments were stored in IndexedDB
    expect(await listFileIds()).toEqual([]);
  });

  it('round-trips assessment question header imageFile attachments and handles missing/invalid images gracefully', async () => {
    const imgBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    await putFile(
      'math101-file-aa112233',
      new Blob([imgBytes], { type: 'image/png' }),
      'graph.png',
      'image/png'
    );

    const courseWithAssessment: CourseTree = {
      slug: 'math101-calc',
      code: 'MATH101',
      title: 'Calculus I',
      department: 'Mathematics',
      year: 1,
      semester: 1,
      description: 'Differential calculus',
      chapters: [
        {
          id: 'math101-ch1-limits',
          order: 1,
          title: 'Limits',
          description: 'Limits',
          lessons: [
            {
              id: 'math101-graph-limits',
              title: 'Graphical Limits',
              summary: 'Reading graphs',
              resources: [
                {
                  title: 'Chapter 1 Quiz',
                  kind: 'exam',
                  assessment: {
                    mode: 'exam',
                    questions: [
                      {
                        id: 'q1',
                        type: 'mcq',
                        header: {
                          text: 'Estimate $\\lim_{x \\to 2} f(x)$',
                          imageFile: {
                            id: 'math101-file-aa112233',
                            name: 'graph.png',
                            mimeType: 'image/png',
                            sizeBytes: imgBytes.byteLength,
                          },
                        },
                        options: ['1', '2'],
                        correctIndices: [1],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const exportedJson = await buildCourseExport(courseWithAssessment, { includeFiles: true });
    await clearAllStoredFiles();

    const imported = await parseCourseImport(exportedJson, []);
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const importedImgRef =
      imported.course.chapters[0].lessons[0].resources[0].assessment?.questions[0].header
        .imageFile;
    expect(importedImgRef).toBeDefined();
    expect(importedImgRef!.id).toMatch(/^math101-file-[0-9a-f]{8}$/);
    expect(importedImgRef!.id).not.toBe('math101-file-aa112233');
    const restored = await getFile(importedImgRef!.id);
    expect(restored).toBeDefined();
    expect(await readBlobBytes(restored!.blob)).toEqual(imgBytes);

    // Missing attachment on text+image strips imageFile with warning; missing on image-only drops question & empty assessment
    const withoutAttachments = await buildCourseExport(courseWithAssessment, {
      includeFiles: false,
    });
    const stripped = await parseCourseImport(withoutAttachments, []);
    expect(stripped.ok).toBe(true);
    if (!stripped.ok) return;
    expect(stripped.warnings).toHaveLength(1);
    const q1 = stripped.course.chapters[0].lessons[0].resources[0].assessment?.questions[0];
    expect(q1?.header.text).toContain('Estimate');
    expect(q1?.header.imageFile).toBeUndefined();

    // Image-only question with dangerous SVG attachment drops question and empty assessment
    const imageOnlyEnvelope = {
      format: 'college-course-tree',
      version: 1,
      exportedAt: new Date().toISOString(),
      course: {
        ...courseWithAssessment,
        chapters: [
          {
            ...courseWithAssessment.chapters[0],
            lessons: [
              {
                ...courseWithAssessment.chapters[0].lessons[0],
                resources: [
                  {
                    title: 'Image Only Quiz',
                    kind: 'exam',
                    assessment: {
                      mode: 'exam',
                      questions: [
                        {
                          id: 'q-img',
                          type: 'true-false',
                          header: {
                            imageFile: {
                              id: 'math101-file-bad00001',
                              name: 'bad.svg',
                              mimeType: 'image/svg+xml',
                              sizeBytes: 10,
                            },
                          },
                          correctIndices: [0],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      attachments: [
        {
          id: 'math101-file-bad00001',
          name: 'bad.svg',
          mimeType: 'image/svg+xml',
          sizeBytes: 10,
          dataBase64: uint8ArrayToBase64(new TextEncoder().encode('<svg/>')),
        },
      ],
    };

    const droppedResult = await parseCourseImport(JSON.stringify(imageOnlyEnvelope), []);
    expect(droppedResult.ok).toBe(true);
    if (!droppedResult.ok) return;
    expect(droppedResult.warnings.length).toBeGreaterThanOrEqual(2);
    expect(droppedResult.course.chapters[0].lessons[0].resources).toHaveLength(0);
  });

  it('strictly rejects legacy kind: "reading" and legacy string semester values (R3)', async () => {
    const legacySemesterCourse = {
      ...makeCourseWithFiles(),
      semester: 'Year 1 - First Semester',
    };
    const semResult = await parseCourseImport(JSON.stringify(legacySemesterCourse), []);
    expect(semResult.ok).toBe(false);
    if (!semResult.ok) {
      expect(semResult.error).toContain('semester');
    }

    const legacyReadingCourse = {
      ...makeCourseWithFiles(),
      chapters: [
        {
          ...makeCourseWithFiles().chapters[0],
          resources: [
            {
              title: 'Legacy Reading',
              kind: 'reading',
              url: 'https://example.com/read',
            },
          ],
          lessons: [],
        },
      ],
    };
    const readingResult = await parseCourseImport(JSON.stringify(legacyReadingCourse), []);
    expect(readingResult.ok).toBe(false);
    if (!readingResult.ok) {
      expect(readingResult.error).toContain('kind');
    }
  });
});
