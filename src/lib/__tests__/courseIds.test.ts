import { describe, expect, it } from 'vitest';
import {
  deriveChapterId,
  deriveCoursePrefix,
  deriveCourseSlug,
  deriveLessonId,
  rekeyCourseContentIds,
} from '@/lib/courseIds';
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

  it('rekeys all chapter/lesson IDs and remaps prerequisites when course code changes', () => {
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
          lessons: [
            {
              id: 'old-l1',
              title: 'Dot Products',
              summary: 'Inner products',
              resources: [],
            },
            {
              id: 'old-l2',
              title: 'Orthogonality',
              summary: 'Right angles',
              prerequisites: ['old-l1', 'deleted-lesson'],
              resources: [],
            },
          ],
        },
      ],
    };

    const rekeyed = rekeyCourseContentIds(draft);
    expect(rekeyed.chapters[0].id).toBe('math201-ch1-vectors');
    expect(rekeyed.chapters[0].lessons[0].id).toBe('math201-dot-products');
    expect(rekeyed.chapters[0].lessons[1].id).toBe('math201-orthogonality');
    expect(rekeyed.chapters[0].lessons[1].prerequisites).toEqual(['math201-dot-products']);
  });
});
