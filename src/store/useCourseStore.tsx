import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { COURSES as DEFAULT_COURSES } from '@/data/courses';
import { rekeyCourseContentIds } from '@/lib/courseIds';
import { CourseTreeSchema, type CourseTree } from '@/types/course';

export const COURSES_STORAGE_KEY = 'college_course_trees_catalog_v1';

const StoredCatalogSchema = z.object({
  version: z.literal(1),
  courses: z.array(CourseTreeSchema),
});

export function loadCoursesCatalog(
  storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): CourseTree[] {
  if (!storage) return DEFAULT_COURSES;
  try {
    const raw = storage.getItem(COURSES_STORAGE_KEY);
    if (!raw) return DEFAULT_COURSES;
    const parsed = StoredCatalogSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.courses : DEFAULT_COURSES;
  } catch {
    return DEFAULT_COURSES;
  }
}

export function saveCoursesCatalog(
  courses: CourseTree[],
  storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): void {
  if (!storage) return;
  try {
    storage.setItem(
      COURSES_STORAGE_KEY,
      JSON.stringify({ version: 1, courses })
    );
  } catch {
    // Ignore quota / private-browsing errors gracefully
  }
}

export type CourseMutationResult =
  | { ok: true; course: CourseTree }
  | { ok: false; error: string };

interface CourseContextValue {
  courses: CourseTree[];
  getCourseBySlug: (slug: string) => CourseTree | undefined;
  addCourse: (course: CourseTree) => CourseMutationResult;
  updateCourse: (originalSlug: string, updated: CourseTree) => CourseMutationResult;
  deleteCourse: (slug: string) => void;
  resetCatalogToDefaults: () => void;
}

const CourseContext = createContext<CourseContextValue | null>(null);

export function CourseProvider({ children }: { children: ReactNode }) {
  const [courses, setCourses] = useState<CourseTree[]>(() => loadCoursesCatalog());

  useEffect(() => {
    saveCoursesCatalog(courses);
  }, [courses]);

  const getCourseBySlug = useCallback(
    (slug: string) => courses.find((c) => c.slug === slug),
    [courses]
  );

  const addCourse = useCallback(
    (rawCourse: CourseTree): CourseMutationResult => {
      const normalized = rekeyCourseContentIds(rawCourse);
      const parsed = CourseTreeSchema.safeParse(normalized);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return {
          ok: false,
          error: `${first.path.join('.') || 'Course'}: ${first.message}`,
        };
      }

      if (courses.some((c) => c.slug === parsed.data.slug)) {
        return {
          ok: false,
          error: `A course with slug "${parsed.data.slug}" already exists.`,
        };
      }

      setCourses((prev) => [...prev, parsed.data]);
      return { ok: true, course: parsed.data };
    },
    [courses]
  );

  const updateCourse = useCallback(
    (originalSlug: string, rawUpdated: CourseTree): CourseMutationResult => {
      const normalized = rekeyCourseContentIds(rawUpdated);
      const parsed = CourseTreeSchema.safeParse(normalized);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return {
          ok: false,
          error: `${first.path.join('.') || 'Course'}: ${first.message}`,
        };
      }

      const conflicting = courses.some(
        (c) => c.slug === parsed.data.slug && c.slug !== originalSlug
      );
      if (conflicting) {
        return {
          ok: false,
          error: `Another course already uses slug "${parsed.data.slug}".`,
        };
      }

      setCourses((prev) =>
        prev.map((c) => (c.slug === originalSlug ? parsed.data : c))
      );
      return { ok: true, course: parsed.data };
    },
    [courses]
  );

  const deleteCourse = useCallback((slug: string) => {
    setCourses((prev) => prev.filter((c) => c.slug !== slug));
  }, []);

  const resetCatalogToDefaults = useCallback(() => {
    setCourses(DEFAULT_COURSES);
  }, []);

  const value = useMemo<CourseContextValue>(
    () => ({
      courses,
      getCourseBySlug,
      addCourse,
      updateCourse,
      deleteCourse,
      resetCatalogToDefaults,
    }),
    [courses, getCourseBySlug, addCourse, updateCourse, deleteCourse, resetCatalogToDefaults]
  );

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
}

export function useCourses(): CourseContextValue {
  const ctx = useContext(CourseContext);
  if (!ctx) {
    throw new Error('useCourses must be used within a CourseProvider');
  }
  return ctx;
}
