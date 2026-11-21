import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  COURSES_STORAGE_KEY,
  CourseProvider,
  loadCoursesCatalog,
  useCourses,
} from '@/store/useCourseStore';
import type { CourseTree } from '@/types/course';

const wrapper = ({ children }: { children: ReactNode }) => (
  <CourseProvider>{children}</CourseProvider>
);

const sampleNewCourse: CourseTree = {
  slug: 'math201-linear-algebra',
  code: 'MATH201',
  title: 'Linear Algebra',
  department: 'Mathematics',
  semester: 'Year 2 - Second Semester',
  credits: 3,
  description: 'Vector spaces, linear transformations, eigenvalues, and SVD.',
  chapters: [
    {
      id: 'temp-ch1',
      order: 1,
      title: '1. Vectors & Matrices',
      description: 'Linear combinations and Gaussian elimination.',
      lessons: [
        {
          id: 'temp-l1',
          title: 'Dot Products',
          summary: 'Inner products and orthogonality.',
          resources: [
            {
              title: 'MIT 18.06 Lecture 1',
              url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/',
              kind: 'slides',
            },
          ],
        },
        {
          id: 'temp-l2',
          title: 'Matrix Inverses',
          summary: 'Invertibility and Gauss-Jordan elimination.',
          prerequisites: ['temp-l1'],
          resources: [],
        },
      ],
    },
  ],
};

describe('useCourseStore CRUD & course-derived IDs', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('adds, edits, persists, and deletes courses while deriving all content IDs from course code', () => {
    const { result } = renderHook(() => useCourses(), { wrapper });
    expect(result.current.courses).toHaveLength(2);

    // Add course
    let addedSlug = '';
    act(() => {
      const res = result.current.addCourse(sampleNewCourse);
      expect(res.ok).toBe(true);
      if (res.ok) {
        addedSlug = res.course.slug;
        expect(res.course.chapters[0].id).toBe('math201-ch1-vectors-matrices');
        expect(res.course.chapters[0].lessons[0].id).toBe('math201-dot-products');
        expect(res.course.chapters[0].lessons[1].id).toBe('math201-matrix-inverses');
        expect(res.course.chapters[0].lessons[1].prerequisites).toEqual([
          'math201-dot-products',
        ]);
      }
    });

    expect(result.current.courses).toHaveLength(3);
    expect(loadCoursesCatalog(window.localStorage)).toHaveLength(3);

    // Edit course
    const created = result.current.getCourseBySlug(addedSlug)!;
    act(() => {
      const res = result.current.updateCourse(addedSlug, {
        ...created,
        title: 'Applied Linear Algebra',
      });
      expect(res.ok).toBe(true);
    });
    expect(result.current.getCourseBySlug(addedSlug)?.title).toBe('Applied Linear Algebra');

    // Delete course
    act(() => {
      result.current.deleteCourse(addedSlug);
    });
    expect(result.current.courses).toHaveLength(2);
    expect(result.current.getCourseBySlug(addedSlug)).toBeUndefined();
  });

  it('rejects duplicate course slugs and recovers from corrupted localStorage', () => {
    const { result } = renderHook(() => useCourses(), { wrapper });
    act(() => {
      const res = result.current.addCourse({
        ...sampleNewCourse,
        slug: 'cs201-data-structures',
      });
      expect(res.ok).toBe(false);
    });

    window.localStorage.setItem(COURSES_STORAGE_KEY, '{corrupt');
    expect(loadCoursesCatalog(window.localStorage)).toHaveLength(2);
  });
});
