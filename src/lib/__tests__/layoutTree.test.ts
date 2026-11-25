import { describe, expect, it } from 'vitest';
import { COURSES } from '@/data/courses';
import { estimateTextWidth, layoutCourseTree, wrapNodeLabel } from '@/lib/layoutTree';
import type { CourseTree } from '@/types/course';

interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function assertLayoutValid(course: CourseTree) {
  const layout = layoutCourseTree(course);
  expect(layout.width).toBeGreaterThan(0);
  expect(layout.height).toBeGreaterThan(0);

  const allNodes: Rect[] = [
    ...layout.chapterNodes,
    ...layout.lessonNodes,
    ...layout.supplementNodes,
  ];

  for (const node of allNodes) {
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
    expect(node.x + node.width).toBeLessThanOrEqual(layout.width);
    expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
  }

  for (let i = 0; i < allNodes.length; i += 1) {
    for (let j = i + 1; j < allNodes.length; j += 1) {
      expect(
        rectsOverlap(allNodes[i], allNodes[j]),
        `Overlap detected between ${allNodes[i].id} and ${allNodes[j].id}`
      ).toBe(false);
    }
  }

  const spineSupplementCount = course.supplements?.length ?? 0;
  const spineEdges = layout.edges.filter((e) => e.kind === 'spine');
  expect(spineEdges).toHaveLength(Math.max(0, course.chapters.length + spineSupplementCount - 1));

  const totalLessons = course.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
  const totalSupplementBranches =
    (course.supplements?.reduce((sum, n) => sum + (n.children?.length ?? 0), 0) ?? 0) +
    course.chapters.reduce(
      (sum, ch) =>
        sum +
        (ch.supplements?.length ?? 0) +
        ch.lessons.reduce((ls, l) => ls + (l.supplements?.length ?? 0), 0),
      0
    );
  const branchEdges = layout.edges.filter((e) => e.kind === 'branch');
  expect(branchEdges).toHaveLength(totalLessons + totalSupplementBranches);
}

describe('layoutCourseTree pure geometry engine', () => {
  it('lays out every seeded course (GUIDE101 and DEMO201) with zero overlapping nodes', () => {
    expect(COURSES.map((c) => c.slug)).toEqual([
      'guide101-quick-start',
      'demo201-feature-showcase',
    ]);
    for (const course of COURSES) {
      assertLayoutValid(course);
    }
  });

  it('handles edge cases: 0 lessons, 1 lesson, 7 lessons on one side, and long titles', () => {
    const edgeCourse: CourseTree = {
      slug: 'edge-case-course',
      code: 'CS999',
      title: 'Edge Case Course',
      department: 'Computer Science',
      description: 'Stress test layout engine.',
      chapters: [
        {
          id: 'cs999-ch1-empty',
          order: 1,
          title: '1. Empty Chapter With Very Long Title For Width Test',
          description: 'No lessons',
          lessons: [],
        },
        {
          id: 'cs999-ch2-single',
          order: 2,
          title: '2. Single Lesson',
          description: 'One lesson',
          lessons: [
            {
              id: 'cs999-single-lesson',
              title: 'A Very Descriptive Sub-Lesson Title',
              summary: 'Summary',
              resources: [],
            },
          ],
        },
        {
          id: 'cs999-ch3-dense',
          order: 3,
          title: '3. Dense Chapter',
          description: 'Seven lessons stacked on left',
          lessons: Array.from({ length: 7 }, (_, i) => ({
            id: `cs999-dense-lesson-${i + 1}`,
            title: `Dense Lesson ${i + 1}`,
            summary: 'Summary',
            side: 'left' as const,
            resources: [],
          })),
        },
      ],
    };

    assertLayoutValid(edgeCourse);
  });

  it('produces deterministic output across repeated calls', () => {
    const first = layoutCourseTree(COURSES[0]);
    const second = layoutCourseTree(COURSES[0]);
    expect(second).toEqual(first);
  });

  it('wraps 40+ char lesson and chapter titles cleanly inside node bounds with zero overlap', () => {
    const demo201 = COURSES.find((c) => c.slug === 'demo201-feature-showcase');
    expect(demo201).toBeDefined();

    const demoLayout = layoutCourseTree(demo201!);
    const longLessonNode = demoLayout.lessonNodes.find(
      (n) => n.lesson.title === 'Implementing Lock-Free Concurrent Queues'
    );
    expect(longLessonNode).toBeDefined();
    expect(longLessonNode!.lines.length).toBeGreaterThan(1);
    expect(longLessonNode!.height).toBeGreaterThan(46);

    for (const line of longLessonNode!.lines) {
      expect(estimateTextWidth(line, 16.5)).toBeLessThanOrEqual(longLessonNode!.width - 40);
    }

    const longTitleCourse: CourseTree = {
      slug: 'long-titles-course',
      code: 'CS888',
      title: 'Long Titles Stress Test',
      department: 'Computer Science',
      description: 'Verifies multi-line wrapping and zero neighbor overlap.',
      chapters: [
        {
          id: 'cs888-ch1',
          order: 1,
          title: '1. Foundations of Distributed Consensus Protocols and Fault Tolerance',
          description: 'Long chapter title',
          lessons: [
            {
              id: 'cs888-l1',
              title: 'Implementing Lock-Free Concurrent Queues with Atomic Primitives',
              summary: 'Summary',
              side: 'right',
              resources: [],
            },
            {
              id: 'cs888-l2',
              title: 'Linearizability Proofs and Memory Ordering Guarantees in Practice',
              summary: 'Summary',
              side: 'right',
              resources: [],
            },
            {
              id: 'cs888-l3',
              title: 'WaitFreeSingleProducerSingleConsumerRingBufferImplementationToken',
              summary: 'Summary',
              side: 'left',
              resources: [],
            },
          ],
        },
      ],
    };

    assertLayoutValid(longTitleCourse);
    const longLayout = layoutCourseTree(longTitleCourse);
    for (const ch of longLayout.chapterNodes) {
      expect(ch.lines.length).toBeGreaterThan(1);
      expect(ch.height).toBeGreaterThan(46);
      for (const line of ch.lines) {
        expect(estimateTextWidth(line, 17)).toBeLessThanOrEqual(ch.width - 48);
      }
    }
    for (const lesson of longLayout.lessonNodes) {
      expect(lesson.lines.length).toBeGreaterThan(1);
      expect(lesson.height).toBeGreaterThan(46);
      for (const line of lesson.lines) {
        expect(estimateTextWidth(line, 16.5)).toBeLessThanOrEqual(lesson.width - 40);
      }
    }

    expect(wrapNodeLabel('Short Title', 260, 16.5)).toEqual(['Short Title']);
  });

  it('positions interleaved spine supplements and up/down/outward lesson child supplements without overlaps', () => {
    const customCourse: CourseTree = {
      slug: 'cs400-supplements',
      code: 'CS400',
      title: 'Supplements Layout',
      department: 'Computer Science',
      description: 'Layout test for supplements.',
      chapters: [
        {
          id: 'cs400-ch1-intro',
          order: 1,
          title: '1. Intro',
          description: 'Ch 1',
          lessons: [
            {
              id: 'cs400-ch1-l1-left',
              title: 'Left Lesson',
              summary: 'Left',
              side: 'left',
              resources: [],
              supplements: [
                { id: 'cs400-ch1-l1-s1-up', title: 'Up Note', summary: 'Up', side: 'up', resources: [] },
                { id: 'cs400-ch1-l1-s2-down', title: 'Down Note', summary: 'Down', side: 'down', resources: [] },
                { id: 'cs400-ch1-l1-s3-inward', title: 'Coerced Outward', summary: 'Out', side: 'right', resources: [] },
              ],
            },
          ],
          supplements: [
            { id: 'cs400-ch1-s1-chsub', title: 'Chapter Sub', summary: 'Sub', side: 'right', resources: [] },
          ],
        },
        {
          id: 'cs400-ch2-next',
          order: 2,
          title: '2. Next',
          description: 'Ch 2',
          lessons: [],
        },
      ],
      supplements: [
        {
          id: 'cs400-s1-before',
          title: 'Course Orientation',
          summary: 'Before Ch 1',
          afterChapterOrder: 0,
          resources: [],
        },
        {
          id: 'cs400-s2-between',
          title: 'Midterm Checkpoint',
          summary: 'Between Ch 1 and Ch 2',
          afterChapterOrder: 1,
          resources: [],
          children: [
            { id: 'cs400-s2-s1-child', title: 'Prep Sheet', summary: 'Prep', side: 'left', resources: [] },
          ],
        },
      ],
    };

    assertLayoutValid(customCourse);
    const layout = layoutCourseTree(customCourse);
    const s1 = layout.supplementNodes.find((n) => n.id === 'cs400-s1-before')!;
    const ch1 = layout.chapterNodes.find((n) => n.id === 'cs400-ch1-intro')!;
    const s2 = layout.supplementNodes.find((n) => n.id === 'cs400-s2-between')!;
    const ch2 = layout.chapterNodes.find((n) => n.id === 'cs400-ch2-next')!;
    expect(s1.y).toBeLessThan(ch1.y);
    expect(ch1.y).toBeLessThan(s2.y);
    expect(s2.y).toBeLessThan(ch2.y);

    // Left-branch lesson's inward 'right' child supplement is coerced outward to 'left'
    const coerced = layout.supplementNodes.find((n) => n.id === 'cs400-ch1-l1-s3-inward')!;
    expect(coerced.side).toBe('left');
  });
});
