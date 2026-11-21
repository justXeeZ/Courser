import { parseCourseTree } from '@/data/validateCourse';
import { demo201FeatureShowcase } from '@/data/courses/demo201-feature-showcase';
import { guide101QuickStart } from '@/data/courses/guide101-quick-start';
import { SEMESTER_OPTIONS, type CourseTree } from '@/types/course';

export const COURSES: CourseTree[] = [guide101QuickStart, demo201FeatureShowcase].map(
  parseCourseTree
);

export const PREMADE_COURSE_SLUGS: ReadonlySet<string> = new Set(
  COURSES.map((course) => course.slug)
);

const SEMESTER_RANK = new Map<string, number>(
  SEMESTER_OPTIONS.map((sem, idx) => [sem, idx])
);

const YEAR_BUCKETS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Unscheduled'] as const;

function compareCoursesBySemesterAndCode(a: CourseTree, b: CourseTree): number {
  const rankA = a.semester ? (SEMESTER_RANK.get(a.semester) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
  const rankB = b.semester ? (SEMESTER_RANK.get(b.semester) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
  if (rankA !== rankB) return rankA - rankB;
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
    sortedMap.set(dept, [...list].sort(compareCoursesBySemesterAndCode));
  }
  return sortedMap;
}

export function getCoursesByYear(
  courses: CourseTree[] = COURSES
): Map<string, CourseTree[]> {
  const grouped = new Map<string, CourseTree[]>();

  for (const course of courses) {
    const yearMatch = course.semester?.match(/^(Year [1-4])\b/);
    const bucket = yearMatch ? yearMatch[1] : 'Unscheduled';
    const list = grouped.get(bucket) ?? [];
    list.push(course);
    grouped.set(bucket, list);
  }

  const sortedMap = new Map<string, CourseTree[]>();
  for (const bucket of YEAR_BUCKETS) {
    const list = grouped.get(bucket);
    if (list && list.length > 0) {
      sortedMap.set(bucket, [...list].sort(compareCoursesBySemesterAndCode));
    }
  }
  return sortedMap;
}
