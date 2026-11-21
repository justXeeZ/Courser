import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { COURSES } from '@/data/courses';
import {
  COURSES_STORAGE_KEY,
  CourseProvider,
  LEGACY_COURSES_STORAGE_KEY,
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

  it('migrates v1 catalog to v2, dropping CS201/CS301, skipping corrupt entries, and keeping user courses', () => {
    const legacySeedCs201 = {
      ...structuredClone(COURSES[0]),
      slug: 'cs201-data-structures',
      code: 'CS201',
    };
    const legacySeedCs301 = {
      ...structuredClone(COURSES[1]),
      slug: 'cs301-operating-systems',
      code: 'CS301',
    };
    const userCourse = {
      slug: 'phys101-mechanics',
      code: 'PHYS101',
      title: 'Classical Mechanics',
      department: 'Physics',
      semester: 'Fall 2024', // legacy free-text semester -> dropped cleanly
      description: 'Newtonian mechanics and conservation laws.',
      chapters: [
        {
          id: 'phys101-ch1-kinematics',
          order: 1,
          title: '1. Kinematics',
          description: 'Motion in one and two dimensions.',
          lessons: [
            {
              id: 'phys101-vectors',
              title: 'Vectors',
              summary: 'Vector addition and components.',
              resources: [],
            },
          ],
        },
      ],
    };
    const corruptEntry = { slug: 'broken', chapters: [] };

    window.localStorage.setItem(
      LEGACY_COURSES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        courses: [legacySeedCs201, legacySeedCs301, userCourse, corruptEntry],
      })
    );

    const migrated = loadCoursesCatalog(window.localStorage);
    expect(migrated.map((c) => c.slug)).toEqual([
      'guide101-quick-start',
      'demo201-feature-showcase',
      'phys101-mechanics',
    ]);
    expect(migrated[2].semester).toBeUndefined();

    // v2 should now be persisted in localStorage
    const savedV2 = window.localStorage.getItem(COURSES_STORAGE_KEY);
    expect(savedV2).toBeTruthy();
    expect(savedV2).toContain('phys101-mechanics');
    expect(savedV2).not.toContain('cs201-data-structures');
    expect(savedV2).not.toContain('cs301-operating-systems');
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
});
