import { describe, expect, it } from 'vitest';
import {
  findCourseItem,
  getAllItemRefs,
  getTrackableItems,
  isLeafChapter,
} from '@/lib/courseItems';
import type { CourseTree } from '@/types/course';

const sampleCourse: CourseTree = {
  slug: 'cs101-intro',
  code: 'CS101',
  title: 'Intro to CS',
  department: 'Preparatory',
  description: 'Sample course with leaf and multi-lesson chapters.',
  chapters: [
    {
      id: 'cs101-ch2-capstone',
      order: 2,
      title: '2. Capstone Lab',
      description: 'No sub-lessons here.',
      lessons: [],
    },
    {
      id: 'cs101-ch1-foundations',
      order: 1,
      title: '1. Foundations',
      description: 'Two sub-lessons.',
      lessons: [
        {
          id: 'cs101-ch1-l1-variables',
          title: 'Variables',
          summary: 'Data types and bindings.',
          resources: [],
        },
        {
          id: 'cs101-ch1-l2-loops',
          title: 'Loops',
          summary: 'Iteration constructs.',
          resources: [],
        },
      ],
    },
  ],
};

describe('courseItems utilities', () => {
  it('identifies leaf chapters without sub-lessons', () => {
    expect(isLeafChapter(sampleCourse.chapters[0])).toBe(true);
    expect(isLeafChapter(sampleCourse.chapters[1])).toBe(false);
  });

  it('returns trackable items in chapter order, including leaf chapters', () => {
    const items = getTrackableItems(sampleCourse);
    expect(items.map((item) => `${item.kind}:${item.id}:${item.index}`)).toEqual([
      'lesson:cs101-ch1-l1-variables:0',
      'lesson:cs101-ch1-l2-loops:1',
      'chapter:cs101-ch2-capstone:2',
    ]);
  });

  it('finds leaf chapters, multi-lesson chapters, and lessons by ID', () => {
    const leafHit = findCourseItem(sampleCourse, 'cs101-ch2-capstone');
    expect(leafHit).toMatchObject({ kind: 'chapter', id: 'cs101-ch2-capstone', index: 2 });

    const parentChapterHit = findCourseItem(sampleCourse, 'cs101-ch1-foundations');
    expect(parentChapterHit).toMatchObject({
      kind: 'chapter',
      id: 'cs101-ch1-foundations',
      index: 0,
    });

    const lessonHit = findCourseItem(sampleCourse, 'cs101-ch1-l2-loops');
    expect(lessonHit).toMatchObject({ kind: 'lesson', id: 'cs101-ch1-l2-loops', index: 1 });

    expect(findCourseItem(sampleCourse, 'nonexistent')).toBeUndefined();
  });

  it('lists all chapter and lesson refs in chapter order', () => {
    expect(getAllItemRefs(sampleCourse)).toEqual([
      {
        id: 'cs101-ch1-foundations',
        kind: 'chapter',
        title: '1. Foundations',
        chapterTitle: '1. Foundations',
      },
      {
        id: 'cs101-ch1-l1-variables',
        kind: 'lesson',
        title: 'Variables',
        chapterTitle: '1. Foundations',
      },
      {
        id: 'cs101-ch1-l2-loops',
        kind: 'lesson',
        title: 'Loops',
        chapterTitle: '1. Foundations',
      },
      {
        id: 'cs101-ch2-capstone',
        kind: 'chapter',
        title: '2. Capstone Lab',
        chapterTitle: '2. Capstone Lab',
      },
    ]);
  });
});
