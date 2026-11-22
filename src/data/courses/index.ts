import { parseCourseTree } from '@/data/validateCourse';
import { demo201FeatureShowcase } from '@/data/courses/demo201-feature-showcase';
import { guide101QuickStart } from '@/data/courses/guide101-quick-start';
import type { CourseTree } from '@/types/course';

export const COURSES: CourseTree[] = [guide101QuickStart, demo201FeatureShowcase].map(
  parseCourseTree
);

export const PREMADE_COURSE_SLUGS: ReadonlySet<string> = new Set(
  COURSES.map((course) => course.slug)
);

function compareCoursesByTermAndCode(a: CourseTree, b: CourseTree): number {
  const yearA = a.year ?? Number.MAX_SAFE_INTEGER;
  const yearB = b.year ?? Number.MAX_SAFE_INTEGER;
  if (yearA !== yearB) return yearA - yearB;

  const semA = a.semester ?? Number.MAX_SAFE_INTEGER;
  const semB = b.semester ?? Number.MAX_SAFE_INTEGER;
  if (semA !== semB) return semA - semB;

  return a.code.localeCompare(b.code);
}

export function getCourseBySlug(slug: string): CourseTree | undefined {
  return COURSES.find((course) => course.slug === slug);
}

export function getCoursesByDepartment(
  courses: CourseTree[] = COURSES
): Map<string, CourseTree[]> {
  const grouped = new Map<string, CourseTree[]>();
  for (const course of courses) {
    const dept = course.department || 'Preparatory';
    const list = grouped.get(dept) ?? [];
    list.push(course);
    grouped.set(dept, list);
  }

  const orderedDepts = Array.from(grouped.keys()).sort((a, b) => {
    if (a === 'Preparatory' && b !== 'Preparatory') return -1;
    if (b === 'Preparatory' && a !== 'Preparatory') return 1;
    return a.localeCompare(b);
  });

  const sortedMap = new Map<string, CourseTree[]>();
  for (const dept of orderedDepts) {
    const list = grouped.get(dept) ?? [];
    sortedMap.set(dept, [...list].sort(compareCoursesByTermAndCode));
  }
  return sortedMap;
}
