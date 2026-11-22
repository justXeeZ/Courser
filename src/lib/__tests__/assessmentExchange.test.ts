import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ASSESSMENT_EXPORT_FORMAT,
  ASSESSMENT_EXPORT_VERSION,
  buildAssessmentExport,
  parseAssessmentImport,
} from '@/lib/assessmentExchange';
import { uint8ArrayToBase64 } from '@/lib/courseExchange';
import { deleteFile, getFile, listFileIds, putFile } from '@/lib/fileStore';
import type { AssessmentData } from '@/types/course';

async function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') {
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read Blob'));
    reader.readAsArrayBuffer(blob);
  });
}

describe('assessmentExchange', () => {
  beforeEach(async () => {
    const ids = await listFileIds();
    await Promise.all(ids.map((id) => deleteFile(id)));
  });

  it('exports and round-trips .assessment.json envelope with >64 KiB image attachments and deduplicated shared images', async () => {
    const smallPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const largeJpg = new Uint8Array(70_000);
    for (let i = 0; i < largeJpg.length; i += 1) {
      largeJpg[i] = (i * 19 + 7) & 0xff;
    }

    await putFile(
      'math101-file-aa112233',
      new Blob([smallPng], { type: 'image/png' }),
      'graph.png',
      'image/png'
    );
    await putFile(
      'math101-file-bb223344',
      new Blob([largeJpg], { type: 'image/jpeg' }),
      'diagram.jpg',
      'image/jpeg'
    );

    const assessment: AssessmentData = {
      mode: 'exam',
      instructions: 'Solve $\\int_0^1 x^2 dx$.',
      timeLimitMinutes: 30,
      passingScorePercent: 75,
      shuffleQuestions: true,
      questions: [
        {
          id: 'q1',
          type: 'mcq',
          header: {
            text: 'Find the slope in graph 1:',
            imageFile: {
              id: 'math101-file-aa112233',
              name: 'graph.png',
              mimeType: 'image/png',
              sizeBytes: smallPng.byteLength,
            },
          },
          options: ['1', '2'],
          correctIndices: [1],
          points: 2,
        },
        {
          id: 'q2',
          type: 'true-false',
          header: {
            text: 'Same graph 1 is convex.',
            imageFile: {
              id: 'math101-file-aa112233',
              name: 'graph.png',
              mimeType: 'image/png',
              sizeBytes: smallPng.byteLength,
            },
          },
          options: ['True', 'False'],
          correctIndices: [0],
        },
        {
          id: 'q3',
          type: 'short-answer',
          header: {
            imageFile: {
              id: 'math101-file-bb223344',
              name: 'diagram.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: largeJpg.byteLength,
            },
          },
          acceptedAnswers: ['euler'],
          caseSensitive: false,
        },
      ],
    };

    const envelope = await buildAssessmentExport({
      title: '  Midterm 1  ',
      kind: 'exam',
      assessment,
    });

    expect(envelope.format).toBe(ASSESSMENT_EXPORT_FORMAT);
    expect(envelope.version).toBe(ASSESSMENT_EXPORT_VERSION);
    expect(envelope.title).toBe('Midterm 1');
    expect(envelope.kind).toBe('exam');
    expect(Number.isNaN(Date.parse(envelope.exportedAt))).toBe(false);
    expect(envelope.attachments).toHaveLength(2);

    // Clear IndexedDB before import
    const idsBefore = await listFileIds();
    await Promise.all(idsBefore.map((id) => deleteFile(id)));

    const imported = await parseAssessmentImport(JSON.stringify(envelope), 'PHYS202');
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(imported.warnings).toEqual([]);
    expect(imported.title).toBe('Midterm 1');
    expect(imported.kind).toBe('exam');

    const q1Image = imported.assessment.questions[0].header.imageFile!;
    const q2Image = imported.assessment.questions[1].header.imageFile!;
    const q3Image = imported.assessment.questions[2].header.imageFile!;

    expect(q1Image.id).toMatch(/^phys202-file-[0-9a-f]{8}$/);
    expect(q1Image.id).not.toBe('math101-file-aa112233');
    expect(q2Image.id).toBe(q1Image.id); // Deduplicated shared image
    expect(q3Image.id).toMatch(/^phys202-file-[0-9a-f]{8}$/);
    expect(q3Image.sizeBytes).toBe(largeJpg.byteLength);

    const restoredLarge = await getFile(q3Image.id);
    expect(restoredLarge).toBeDefined();
    expect(await readBlobBytes(restoredLarge!.blob)).toEqual(largeJpg);
  });

  it('uses fallback COURSE prefix when courseCode is omitted or blank', async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 8]);
    const envelope = await buildAssessmentExport({
      assessment: {
        mode: 'assignment',
        questions: [
          {
            id: 'q1',
            type: 'mcq',
            header: {
              text: 'Pick A',
              imageFile: {
                id: 'old-file-1',
                name: 'pic.png',
                mimeType: 'image/png',
                sizeBytes: png.byteLength,
              },
            },
            options: ['A', 'B'],
            correctIndices: [0],
          },
        ],
      },
      attachments: [
        {
          id: 'old-file-1',
          name: 'pic.png',
          mimeType: 'image/png',
          sizeBytes: png.byteLength,
          dataBase64: uint8ArrayToBase64(png),
        },
      ],
    });

    const imported = await parseAssessmentImport(JSON.stringify(envelope), '   ');
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.assessment.questions[0].header.imageFile?.id).toMatch(
      /^course-file-[0-9a-f]{8}$/
    );
  });

  it('handles missing blobs during buildAssessmentExport via onWarning and respects includeFiles: false', async () => {
    const onWarning = vi.fn();
    const assessment: AssessmentData = {
      mode: 'exam',
      questions: [
        {
          id: 'q1',
          type: 'true-false',
          header: {
            text: 'Question with missing file',
            imageFile: {
              id: 'math101-file-missing1',
              name: 'missing.png',
              mimeType: 'image/png',
              sizeBytes: 123,
            },
          },
          correctIndices: [0],
        },
      ],
    };

    const envelope = await buildAssessmentExport({
      assessment,
      onWarning,
    });
    expect(envelope.attachments).toBeUndefined();
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onWarning.mock.calls[0][0]).toContain('math101-file-missing1');

    const noFilesWarn = vi.fn();
    const noFilesEnvelope = await buildAssessmentExport({
      assessment,
      includeFiles: false,
      onWarning: noFilesWarn,
    });
    expect(noFilesEnvelope.attachments).toBeUndefined();
    expect(noFilesWarn).not.toHaveBeenCalled();
  });

  it('imports bare AssessmentData JSON supporting all 4 question types and LaTeX', async () => {
    const bare: AssessmentData = {
      mode: 'assignment',
      instructions: 'Compute $\\frac{a}{b}$.',
      questions: [
        {
          id: 'q1',
          type: 'mcq',
          header: { text: 'Value of $2+2$?' },
          options: ['$3$', '$4$'],
          correctIndices: [1],
          hint: 'Count carefully',
          explanation: '$2+2 = 4$',
        },
        {
          id: 'q2',
          type: 'multi-select',
          header: { text: 'Prime numbers:' },
          options: ['2', '3', '4'],
          correctIndices: [0, 1],
        },
        {
          id: 'q3',
          type: 'true-false',
          header: { text: '$\\pi > 3$' },
          correctIndices: [0],
        },
        {
          id: 'q4',
          type: 'short-answer',
          header: { text: 'Symbol for sodium?' },
          acceptedAnswers: ['Na'],
          caseSensitive: true,
        },
      ],
    };

    const imported = await parseAssessmentImport(JSON.stringify(bare));
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    expect(imported.title).toBeUndefined();
    expect(imported.kind).toBeUndefined();
    expect(imported.warnings).toEqual([]);
    expect(imported.assessment).toEqual(bare);
  });

  it('strips missing/invalid imageFile on fallback questions, drops image-only failures, and ignores unreferenced attachments', async () => {
    const svgBytes = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
    const pdfBytes = new TextEncoder().encode('%PDF-1.4');
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]);

    const envelope = {
      format: ASSESSMENT_EXPORT_FORMAT,
      version: ASSESSMENT_EXPORT_VERSION,
      assessment: {
        mode: 'exam',
        questions: [
          {
            id: 'q-text-fallback',
            type: 'true-false',
            header: {
              text: 'Text fallback kept',
              imageFile: {
                id: 'missing-id',
                name: 'missing.png',
                mimeType: 'image/png',
                sizeBytes: 10,
              },
            },
            correctIndices: [0],
          },
          {
            id: 'q-url-fallback',
            type: 'true-false',
            header: {
              imageUrl: 'https://example.com/fallback.png',
              imageFile: {
                id: 'bad-base64-id',
                name: 'broken.png',
                mimeType: 'image/png',
                sizeBytes: 10,
              },
            },
            correctIndices: [1],
          },
          {
            id: 'q-svg-dropped',
            type: 'true-false',
            header: {
              imageFile: {
                id: 'svg-id',
                name: 'evil.svg',
                mimeType: 'image/svg+xml',
                sizeBytes: svgBytes.byteLength,
              },
            },
            correctIndices: [0],
          },
          {
            id: 'q-pdf-dropped',
            type: 'true-false',
            header: {
              imageFile: {
                id: 'pdf-id',
                name: 'notes.pdf',
                mimeType: 'application/pdf',
                sizeBytes: pdfBytes.byteLength,
              },
            },
            correctIndices: [0],
          },
        ],
      },
      attachments: [
        {
          id: 'bad-base64-id',
          name: 'broken.png',
          mimeType: 'image/png',
          sizeBytes: 10,
          dataBase64: '!!!not-valid-base64!!!',
        },
        {
          id: 'svg-id',
          name: 'evil.svg',
          mimeType: 'image/svg+xml',
          sizeBytes: svgBytes.byteLength,
          dataBase64: uint8ArrayToBase64(svgBytes),
        },
        {
          id: 'pdf-id',
          name: 'notes.pdf',
          mimeType: 'application/pdf',
          sizeBytes: pdfBytes.byteLength,
          dataBase64: uint8ArrayToBase64(pdfBytes),
        },
        {
          id: 'unreferenced-extra',
          name: 'extra.png',
          mimeType: 'image/png',
          sizeBytes: pngBytes.byteLength,
          dataBase64: uint8ArrayToBase64(pngBytes),
        },
      ],
    };

    const res = await parseAssessmentImport(JSON.stringify(envelope), 'CS101');
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.assessment.questions).toHaveLength(2);
    expect(res.assessment.questions[0].header).toEqual({ text: 'Text fallback kept' });
    expect(res.assessment.questions[1].header).toEqual({
      imageUrl: 'https://example.com/fallback.png',
    });
    expect(res.warnings.length).toBeGreaterThanOrEqual(4);
    expect(await listFileIds()).toEqual([]);

    // Only image-only question with dangerous .svg -> fails with ok: false
    const onlyDangerous = await parseAssessmentImport(
      JSON.stringify({
        format: ASSESSMENT_EXPORT_FORMAT,
        version: ASSESSMENT_EXPORT_VERSION,
        assessment: {
          mode: 'exam',
          questions: [
            {
              id: 'q1',
              type: 'true-false',
              header: {
                imageFile: {
                  id: 'svg-id',
                  name: 'evil.svg',
                  mimeType: 'image/svg+xml',
                  sizeBytes: svgBytes.byteLength,
                },
              },
              correctIndices: [0],
            },
          ],
        },
        attachments: [
          {
            id: 'svg-id',
            name: 'evil.svg',
            mimeType: 'image/svg+xml',
            sizeBytes: svgBytes.byteLength,
            dataBase64: uint8ArrayToBase64(svgBytes),
          },
        ],
      })
    );
    expect(onlyDangerous.ok).toBe(false);
    expect(await listFileIds()).toEqual([]);
  });

  it('rejects invalid JSON, wrong envelopes, legacy reading kind, invalid schemas, and unsafe imageUrl protocols', async () => {
    expect(await parseAssessmentImport('{ bad')).toMatchObject({
      ok: false,
      error: expect.stringContaining('Invalid JSON'),
    });
    expect(await parseAssessmentImport('[]')).toMatchObject({ ok: false });
    expect(await parseAssessmentImport('null')).toMatchObject({ ok: false });

    expect(
      await parseAssessmentImport(
        JSON.stringify({ format: 'college-course-tree', version: 1, assessment: {} })
      )
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining('Unsupported assessment export format'),
    });

    expect(
      await parseAssessmentImport(
        JSON.stringify({ format: ASSESSMENT_EXPORT_FORMAT, version: 2, assessment: {} })
      )
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining('Unsupported assessment export version'),
    });

    // Strict R3: reject 'reading' or 'slides' kind
    for (const badKind of ['reading', 'slides']) {
      const res = await parseAssessmentImport(
        JSON.stringify({
          format: ASSESSMENT_EXPORT_FORMAT,
          version: 1,
          kind: badKind,
          assessment: {
            mode: 'exam',
            questions: [
              {
                id: 'q1',
                type: 'true-false',
                header: { text: 'Q' },
                correctIndices: [0],
              },
            ],
          },
        })
      );
      expect(res.ok).toBe(false);
    }

    // Schema errors
    expect(
      await parseAssessmentImport(JSON.stringify({ mode: 'exam', questions: [] }))
    ).toMatchObject({ ok: false });

    expect(
      await parseAssessmentImport(
        JSON.stringify({
          mode: 'exam',
          passingScorePercent: 105,
          questions: [
            { id: 'q1', type: 'true-false', header: { text: 'Q' }, correctIndices: [0] },
          ],
        })
      )
    ).toMatchObject({ ok: false });

    expect(
      await parseAssessmentImport(
        JSON.stringify({
          mode: 'exam',
          questions: [
            { id: 'dup', type: 'true-false', header: { text: 'A' }, correctIndices: [0] },
            { id: 'dup', type: 'true-false', header: { text: 'B' }, correctIndices: [1] },
          ],
        })
      )
    ).toMatchObject({ ok: false });

    expect(
      await parseAssessmentImport(
        JSON.stringify({
          mode: 'exam',
          questions: [
            {
              id: 'q1',
              type: 'mcq',
              header: { text: 'Q' },
              options: ['A', 'B'],
              correctIndices: [0, 1],
            },
          ],
        })
      )
    ).toMatchObject({ ok: false });

    // Unsafe imageUrl schemes
    for (const unsafeUrl of [
      'javascript:alert(1)',
      'data:image/png;base64,iVBORw0KGgo=',
      'file:///etc/passwd',
      'ftp://example.com/a.png',
    ]) {
      const res = await parseAssessmentImport(
        JSON.stringify({
          mode: 'exam',
          questions: [
            {
              id: 'q1',
              type: 'true-false',
              header: { imageUrl: unsafeUrl },
              correctIndices: [0],
            },
          ],
        })
      );
      expect(res.ok).toBe(false);
    }
  });
});
