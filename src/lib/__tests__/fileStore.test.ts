import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FILE_DB_NAME,
  collectReferencedFileIds,
  deleteFile,
  garbageCollectFiles,
  getFile,
  listFileIds,
  localMaterialFileRepository,
  openStoredFile,
  putFile,
} from '@/lib/fileStore';
import type { CourseTree } from '@/types/course';

async function clearAllStoredFiles(): Promise<void> {
  const ids = await listFileIds();
  for (const id of ids) {
    await deleteFile(id);
  }
}

async function readBlobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') {
    return blob.text();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read Blob.'));
    reader.readAsText(blob);
  });
}

describe('fileStore', () => {
  beforeEach(async () => {
    await clearAllStoredFiles();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('stores, retrieves, lists, and deletes binary files in IndexedDB', async () => {
    const content = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]); // %PDF-1.4
    const blob = new Blob([content], { type: 'application/pdf' });

    await putFile('cs101-file-1111aaaa', blob, 'syllabus.pdf', 'application/pdf');

    const record = await getFile('cs101-file-1111aaaa');
    expect(record).toBeDefined();
    expect(record?.id).toBe('cs101-file-1111aaaa');
    expect(record?.name).toBe('syllabus.pdf');
    expect(record?.mimeType).toBe('application/pdf');
    expect(record?.sizeBytes).toBe(content.byteLength);
    expect(record?.createdAt).toBeTypeOf('number');
    expect(await readBlobText(record!.blob)).toBe('%PDF-1.4');

    expect(await listFileIds()).toEqual(['cs101-file-1111aaaa']);

    await deleteFile('cs101-file-1111aaaa');
    expect(await getFile('cs101-file-1111aaaa')).toBeUndefined();
    expect(await listFileIds()).toEqual([]);
  });

  it('exposes localMaterialFileRepository conforming to MaterialFileRepository', async () => {
    const blob = new Blob(['hello world'], { type: 'text/plain' });
    await localMaterialFileRepository.putFile(
      'cs101-file-2222bbbb',
      blob,
      'notes.txt',
      'text/plain'
    );

    const fetched = await localMaterialFileRepository.getFile('cs101-file-2222bbbb');
    expect(fetched?.name).toBe('notes.txt');
    expect(await localMaterialFileRepository.listFileIds()).toEqual(['cs101-file-2222bbbb']);

    const removed = await localMaterialFileRepository.garbageCollectFiles(new Set());
    expect(removed).toBe(1);
    expect(await localMaterialFileRepository.listFileIds()).toEqual([]);
  });

  it('collects referenced file IDs from both chapter and lesson resources and garbage collects orphans', async () => {
    const course: CourseTree = {
      slug: 'cs101-intro',
      code: 'CS101',
      title: 'Intro to CS',
      department: 'Preparatory',
      description: 'Foundations',
      chapters: [
        {
          id: 'cs101-ch1-basics',
          order: 1,
          title: 'Basics',
          description: 'Getting started',
          resources: [
            {
              title: 'Chapter Handout',
              kind: 'document',
              file: {
                id: 'cs101-file-ch000001',
                name: 'handout.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 100,
              },
            },
            {
              title: 'External Link',
              kind: 'official',
              url: 'https://example.com/docs',
            },
          ],
          lessons: [
            {
              id: 'cs101-variables',
              title: 'Variables',
              summary: 'Storing state',
              resources: [
                {
                  title: 'Lesson Slides',
                  kind: 'slides',
                  file: {
                    id: 'cs101-file-ls000002',
                    name: 'slides.pptx',
                    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                    sizeBytes: 200,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    await putFile('cs101-file-ch000001', new Blob(['ch']), 'handout.pdf', 'application/pdf');
    await putFile('cs101-file-ls000002', new Blob(['ls']), 'slides.pptx', 'application/octet-stream');
    await putFile('cs101-file-orphan01', new Blob(['old1']), 'old1.pdf', 'application/pdf');
    await putFile('cs101-file-orphan02', new Blob(['old2']), 'old2.pdf', 'application/pdf');

    const referenced = collectReferencedFileIds([course]);
    expect(referenced).toEqual(new Set(['cs101-file-ch000001', 'cs101-file-ls000002']));

    const deletedCount = await garbageCollectFiles(referenced);
    expect(deletedCount).toBe(2);

    const remaining = await listFileIds();
    expect(remaining.sort()).toEqual(['cs101-file-ch000001', 'cs101-file-ls000002']);
    expect(FILE_DB_NAME).toBe('college_course_trees');
  });

  it('opens PDF/media inline, re-wraps text/code files as text/plain, downloads binaries, and revokes URLs after 60s', async () => {
    const createdBlobs: Blob[] = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    const createObjectURLMock = vi.fn((obj: Blob | MediaSource) => {
      if (obj instanceof Blob) {
        createdBlobs.push(obj);
      }
      return `blob:mock-${createdBlobs.length}`;
    });
    const revokeObjectURLMock = vi.fn();

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });

    const revokeTimers: Array<() => void> = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) => {
      if (timeout === 60_000 && typeof handler === 'function') {
        revokeTimers.push(() => handler(...args));
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }
      return originalSetTimeout(handler, timeout, ...args);
    }) as typeof setTimeout);

    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    try {
      // 1. Missing file returns false
      expect(await openStoredFile('missing-id')).toBe(false);

      // 2. PDF opens in new tab directly
      await putFile('cs101-file-pdf00001', new Blob(['pdf-bytes']), 'guide.pdf', 'application/pdf');
      expect(await openStoredFile('cs101-file-pdf00001')).toBe(true);
      expect(windowOpenSpy).toHaveBeenLastCalledWith(
        'blob:mock-1',
        '_blank',
        'noopener,noreferrer'
      );
      expect(createdBlobs[0].type).toBe('application/pdf');

      // 3. Text/code file (.py) re-wrapped as text/plain and opened in new tab
      await putFile(
        'cs101-file-py000002',
        new Blob(['print("hello")'], { type: 'text/x-python' }),
        'script.py',
        'text/x-python'
      );
      expect(await openStoredFile('cs101-file-py000002')).toBe(true);
      expect(windowOpenSpy).toHaveBeenLastCalledWith(
        'blob:mock-2',
        '_blank',
        'noopener,noreferrer'
      );
      expect(createdBlobs[1].type).toBe('text/plain');

      // 4. Other files (e.g. .zip) trigger <a download>
      const clickSpy = vi
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(() => {});
      const appendSpy = vi.spyOn(document.body, 'appendChild');

      await putFile(
        'cs101-file-zip00003',
        new Blob(['zip-bytes'], { type: 'application/zip' }),
        'starter.zip',
        'application/zip'
      );
      expect(await openStoredFile('cs101-file-zip00003')).toBe(true);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      const appendedAnchor = appendSpy.mock.calls.at(-1)?.[0] as HTMLAnchorElement | undefined;
      expect(appendedAnchor?.download).toBe('starter.zip');
      expect(appendedAnchor?.href).toContain('blob:mock-3');

      // 5. All object URLs scheduled for revocation after 60s and revoked when timers fire
      expect(createObjectURLMock).toHaveBeenCalledTimes(3);
      expect(revokeObjectURLMock).not.toHaveBeenCalled();
      expect(revokeTimers).toHaveLength(3);

      for (const fire of revokeTimers) {
        fire();
      }
      expect(revokeObjectURLMock).toHaveBeenCalledTimes(3);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-1');
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-2');
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-3');
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
    }
  });

  it('collects assessment question header imageFile IDs and protects them from garbage collection', async () => {
    const course: CourseTree = {
      slug: 'phys201-optics',
      code: 'PHYS201',
      title: 'Optics',
      department: 'Physics',
      description: 'Wave optics',
      chapters: [
        {
          id: 'phys201-ch1-waves',
          order: 1,
          title: 'Waves',
          description: 'Wave basics',
          resources: [
            {
              title: 'Chapter Quiz',
              kind: 'exam',
              assessment: {
                mode: 'exam',
                questions: [
                  {
                    id: 'q1',
                    type: 'mcq',
                    header: {
                      text: 'Identify the fringe pattern.',
                      imageFile: {
                        id: 'phys201-file-aaaa1111',
                        name: 'fringe.png',
                        mimeType: 'image/png',
                        sizeBytes: 128,
                      },
                    },
                    options: ['Single slit', 'Double slit'],
                    correctIndices: [1],
                  },
                ],
              },
            },
          ],
          lessons: [
            {
              id: 'phys201-diffraction',
              title: 'Diffraction',
              summary: 'Diffraction patterns',
              resources: [
                {
                  title: 'Practice Assignment',
                  kind: 'assignment',
                  assessment: {
                    mode: 'assignment',
                    questions: [
                      {
                        id: 'q2',
                        type: 'true-false',
                        header: {
                          imageFile: {
                            id: 'phys201-file-bbbb2222',
                            name: 'setup.jpg',
                            mimeType: 'image/jpeg',
                            sizeBytes: 256,
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
    };

    await putFile('phys201-file-aaaa1111', new Blob(['img1']), 'fringe.png', 'image/png');
    await putFile('phys201-file-bbbb2222', new Blob(['img2']), 'setup.jpg', 'image/jpeg');
    await putFile('phys201-file-dead9999', new Blob(['orphan']), 'orphan.png', 'image/png');

    const referenced = collectReferencedFileIds([course]);
    expect(referenced).toEqual(new Set(['phys201-file-aaaa1111', 'phys201-file-bbbb2222']));

    const deleted = await garbageCollectFiles(referenced);
    expect(deleted).toBe(1);
    expect((await listFileIds()).sort()).toEqual([
      'phys201-file-aaaa1111',
      'phys201-file-bbbb2222',
    ]);
  });

  it('opens aligned inline media (.mov, .m4a, .wav) and code (.tsx, .sql) in a tab while downloading .svg/.pptx', async () => {
    const createdBlobs: Blob[] = [];
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn((obj: Blob | MediaSource) => {
        if (obj instanceof Blob) createdBlobs.push(obj);
        return `blob:aligned-${createdBlobs.length}`;
      }),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });

    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    try {
      await putFile('cs101-file-mov00001', new Blob(['mov']), 'clip.mov', '');
      await putFile('cs101-file-m4a00002', new Blob(['m4a']), 'audio.m4a', 'application/octet-stream');
      await putFile('cs101-file-wav00003', new Blob(['wav']), 'sound.wav', 'audio/wav');
      await putFile('cs101-file-tsx00004', new Blob(['const x = 1;']), 'App.tsx', 'application/octet-stream');
      await putFile('cs101-file-sql00005', new Blob(['SELECT 1;']), 'query.sql', 'application/sql');
      await putFile('cs101-file-svg00006', new Blob(['<svg/>']), 'bad.svg', 'image/svg+xml');

      expect(await openStoredFile('cs101-file-mov00001')).toBe(true);
      expect(await openStoredFile('cs101-file-m4a00002')).toBe(true);
      expect(await openStoredFile('cs101-file-wav00003')).toBe(true);
      expect(await openStoredFile('cs101-file-tsx00004')).toBe(true);
      expect(await openStoredFile('cs101-file-sql00005')).toBe(true);
      expect(windowOpenSpy).toHaveBeenCalledTimes(5);
      expect(createdBlobs[0].type).toBe('video/quicktime');
      expect(createdBlobs[1].type).toBe('audio/mp4');
      expect(createdBlobs[3].type).toBe('text/plain');
      expect(createdBlobs[4].type).toBe('text/plain');

      expect(await openStoredFile('cs101-file-svg00006')).toBe(true);
      expect(windowOpenSpy).toHaveBeenCalledTimes(5);
      expect(clickSpy).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
    }
  });
});
