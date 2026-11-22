import { describe, expect, it } from 'vitest';
import {
  deriveChapterId,
  deriveCoursePrefix,
  deriveCourseSlug,
  deriveFileId,
  deriveLessonId,
  rekeyCourseContentIds,
  rekeyCourseContentIdsWithMap,
} from '@/lib/courseIds';
import { parseCourseTree } from '@/data/validateCourse';
import type { CourseTree } from '@/types/course';

describe('courseIds derivation helpers', () => {
  it('derives normalized prefixes and course slugs', () => {
    expect(deriveCoursePrefix('CS 201')).toBe('cs201');
    expect(deriveCoursePrefix('MATH-101')).toBe('math101');
    expect(deriveCourseSlug('CS201', 'Data Structures & Algorithms')).toBe(
      'cs201-data-structures-algorithms'
    );
  });

  it('derives unique chapter and lesson IDs prefixed by course code', () => {
    const chIds = new Set<string>();
    expect(deriveChapterId('CS201', 1, '1. Complexity & Linear Data', chIds)).toBe(
      'cs201-ch1-complexity-linear-data'
    );
    expect(deriveChapterId('CS201', 1, '1. Complexity & Linear Data', chIds)).toBe(
      'cs201-ch1-complexity-linear-data-2'
    );

    const lIds = new Set<string>();
    expect(deriveLessonId('CS201', 'Dynamic Arrays', lIds)).toBe('cs201-dynamic-arrays');
    expect(deriveLessonId('CS201', 'Dynamic Arrays', lIds)).toBe('cs201-dynamic-arrays-2');
  });

  it('derives random 8-hex file IDs prefixed by course code', () => {
    const id1 = deriveFileId('CS 201');
    const id2 = deriveFileId('CS 201');
    expect(id1).toMatch(/^cs201-file-[0-9a-f]{8}$/);
    expect(id2).toMatch(/^cs201-file-[0-9a-f]{8}$/);
    expect(id1).not.toBe(id2);
  });

  it('rekeys all chapter/lesson IDs, returns idMap, remaps chapter & lesson prereqs, and preserves file IDs', () => {
    const draft: CourseTree = {
      slug: 'math201-linear-algebra',
      code: 'MATH201',
      title: 'Linear Algebra',
      department: 'Mathematics',
      description: 'Vectors and matrices.',
      chapters: [
        {
          id: 'old-ch-1',
          order: 1,
          title: '1. Vectors',
          description: 'Intro to vectors',
          prerequisites: ['old-ch-1', 'deleted-chapter'],
          resources: [
            {
              title: 'Chapter Notes',
              kind: 'document',
              file: {
                id: 'legacy-file-1234abcd',
                name: 'notes.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 512,
              },
            },
          ],
          lessons: [
            {
              id: 'old-l1',
              title: 'Dot Products',
              summary: 'Inner products',
              resources: [
                {
                  title: 'Slides',
                  kind: 'slides',
                  file: {
                    id: 'legacy-file-99887766',
                    name: 'slides.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 1024,
                  },
                },
              ],
            },
            {
              id: 'old-l2',
              title: 'Orthogonality',
              summary: 'Right angles',
              prerequisites: ['old-l1', 'old-l2', 'deleted-lesson'],
              resources: [],
            },
          ],
        },
        {
          id: 'old-ch-2',
          order: 2,
          title: '2. Capstone Project',
          description: 'Standalone chapter depending on ch1 and lesson 1',
          prerequisites: ['old-ch-1', 'old-l1', 'missing-ref'],
          lessons: [],
        },
      ],
    };

    const { course: rekeyed, idMap } = rekeyCourseContentIdsWithMap(draft);
    expect(rekeyed.chapters[0].id).toBe('math201-ch1-vectors');
    expect(rekeyed.chapters[0].lessons[0].id).toBe('math201-dot-products');
    expect(rekeyed.chapters[0].lessons[1].id).toBe('math201-orthogonality');
    expect(rekeyed.chapters[1].id).toBe('math201-ch2-capstone-project');

    expect(idMap.get('old-ch-1')).toBe('math201-ch1-vectors');
    expect(idMap.get('old-ch-2')).toBe('math201-ch2-capstone-project');
    expect(idMap.get('old-l1')).toBe('math201-dot-products');
    expect(idMap.get('old-l2')).toBe('math201-orthogonality');

    // Self-refs and dangling refs dropped; valid chapter & lesson prereqs remapped
    expect(rekeyed.chapters[0].prerequisites).toBeUndefined();
    expect(rekeyed.chapters[0].lessons[1].prerequisites).toEqual(['math201-dot-products']);
    expect(rekeyed.chapters[1].prerequisites).toEqual([
      'math201-ch1-vectors',
      'math201-dot-products',
    ]);

    // File IDs are never modified
    expect(rekeyed.chapters[0].resources?.[0].file?.id).toBe('legacy-file-1234abcd');
    expect(rekeyed.chapters[0].lessons[0].resources[0].file?.id).toBe('legacy-file-99887766');

    // Wrapper returns the same course and passes strict schema
    expect(rekeyCourseContentIds(draft)).toEqual(rekeyed);
    expect(() => parseCourseTree(rekeyed)).not.toThrow();
  });
});
