import { describe, expect, it } from 'vitest';
import { COURSES } from '@/data/courses';
import { layoutCourseTree } from '@/lib/layoutTree';
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

  const allNodes: Rect[] = [...layout.chapterNodes, ...layout.lessonNodes];

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

  // Spine edges should equal chapters - 1
  const spineEdges = layout.edges.filter((e) => e.kind === 'spine');
  expect(spineEdges).toHaveLength(Math.max(0, course.chapters.length - 1));

  // Branch edges should equal total lessons
  const totalLessons = course.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0);
  const branchEdges = layout.edges.filter((e) => e.kind === 'branch');
  expect(branchEdges).toHaveLength(totalLessons);
}

describe('layoutCourseTree pure geometry engine', () => {
  it('lays out every seeded course with zero overlapping nodes', () => {
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
});
