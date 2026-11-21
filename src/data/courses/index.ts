import { parseCourseTree } from '@/data/validateCourse';
import { cs201DataStructures } from '@/data/courses/cs201-data-structures';
import { cs301OperatingSystems } from '@/data/courses/cs301-operating-systems';
import type { CourseTree } from '@/types/course';

export const COURSES: CourseTree[] = [
  parseCourseTree(cs201DataStructures),
  parseCourseTree(cs301OperatingSystems),
];

export function getCourseBySlug(slug: string): CourseTree | undefined {
  return COURSES.find((course) => course.slug === slug);
}

export function getCoursesByDepartment(courses: CourseTree[] = COURSES): Map<string, CourseTree[]> {
  const map = new Map<string, CourseTree[]>();
  for (const course of courses) {
    const list = map.get(course.department) ?? [];
    list.push(course);
    map.set(course.department, list);
  }
  return map;
}
