import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { COURSES } from '@/data/courses';
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
  year: 2,
  semester: 2,
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

describe('useCourseStore CRUD, migration, and repository boundaries', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('adds, edits with idMap/previousSlug, persists, and deletes courses', () => {
    const { result } = renderHook(() => useCourses(), { wrapper });
    expect(result.current.courses).toHaveLength(2);
    expect(result.current.courses.map((c) => c.slug)).toEqual([
      'guide101-quick-start',
      'demo201-feature-showcase',
    ]);

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

    // Edit course: rename lesson and course code/slug, verify idMap & previousSlug
    const created = result.current.getCourseBySlug(addedSlug)!;
    let updatedSlug = '';
    act(() => {
      const res = result.current.updateCourse(addedSlug, {
        ...created,
        slug: 'math202-applied-linear-algebra',
        code: 'MATH202',
        title: 'Applied Linear Algebra',
        chapters: [
          {
            ...created.chapters[0],
            lessons: [
              {
                ...created.chapters[0].lessons[0],
                title: 'Inner Products',
              },
              created.chapters[0].lessons[1],
            ],
          },
        ],
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        updatedSlug = res.course.slug;
        expect(res.previousSlug).toBe(addedSlug);
        expect(res.course.slug).toBe('math202-applied-linear-algebra');
        expect(res.idMap.get('math201-ch1-vectors-matrices')).toBe(
          'math202-ch1-vectors-matrices'
        );
        expect(res.idMap.get('math201-dot-products')).toBe('math202-inner-products');
        expect(res.idMap.get('math201-matrix-inverses')).toBe('math202-matrix-inverses');
      }
    });
    expect(result.current.getCourseBySlug(updatedSlug)?.title).toBe('Applied Linear Algebra');

    // Delete course
    act(() => {
      result.current.deleteCourse(updatedSlug);
    });
    expect(result.current.courses).toHaveLength(2);
    expect(result.current.getCourseBySlug(updatedSlug)).toBeUndefined();
  });

  it('distinguishes premade courses from user-created courses via isPremadeCourse', () => {
    const { result } = renderHook(() => useCourses(), { wrapper });
    expect(result.current.isPremadeCourse('guide101-quick-start')).toBe(true);
    expect(result.current.isPremadeCourse('demo201-feature-showcase')).toBe(true);
    expect(result.current.isPremadeCourse('math201-linear-algebra')).toBe(false);

    act(() => {
      result.current.addCourse(sampleNewCourse);
    });
    expect(result.current.isPremadeCourse('math201-linear-algebra')).toBe(false);
  });

  it('ignores legacy v1 catalog storage key and loads premade defaults unless v2 key is present', () => {
    window.localStorage.setItem(
      'college_course_trees_catalog_v1',
      JSON.stringify({
        version: 1,
        courses: [
          {
            ...structuredClone(COURSES[0]),
            slug: 'legacy-v1-course',
            code: 'LEG101',
          },
        ],
      })
    );

    const loaded = loadCoursesCatalog(window.localStorage);
    expect(loaded.map((c) => c.slug)).toEqual([
      'guide101-quick-start',
      'demo201-feature-showcase',
    ]);
    expect(window.localStorage.getItem(COURSES_STORAGE_KEY)).toBeNull();
  });

  it('rejects duplicate course slugs and recovers from corrupted localStorage', () => {
    const { result } = renderHook(() => useCourses(), { wrapper });
    act(() => {
      const res = result.current.addCourse({
        ...sampleNewCourse,
        slug: 'guide101-quick-start',
      });
      expect(res.ok).toBe(false);
    });

    window.localStorage.setItem(COURSES_STORAGE_KEY, '{corrupt');
    expect(loadCoursesCatalog(window.localStorage)).toHaveLength(2);
  });

  it('rejects dangling, cross-course, and self-referencing prerequisites in addCourse', () => {
    const { result } = renderHook(() => useCourses(), { wrapper });

    act(() => {
      const dangling = result.current.addCourse({
        ...sampleNewCourse,
        slug: 'math201-dangling',
        chapters: [
          {
            ...sampleNewCourse.chapters[0],
            prerequisites: ['non-existent-id'],
          },
        ],
      });
      expect(dangling.ok).toBe(false);
      if (!dangling.ok) {
        expect(dangling.error).toContain('non-existent-id');
      }

      const selfRef = result.current.addCourse({
        ...sampleNewCourse,
        slug: 'math201-selfref',
        chapters: [
          {
            ...sampleNewCourse.chapters[0],
            prerequisites: ['temp-ch1'],
          },
        ],
      });
      expect(selfRef.ok).toBe(false);
      if (!selfRef.ok) {
        expect(selfRef.error).toContain('temp-ch1');
      }
    });

    expect(result.current.courses).toHaveLength(2);
  });
});
