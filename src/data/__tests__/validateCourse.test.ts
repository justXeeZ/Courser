import { describe, expect, it } from 'vitest';
import { COURSES, getCourseBySlug } from '@/data/courses';
import { findLessonWithChapter, getAllLessonIds, parseCourseTree } from '@/data/validateCourse';

describe('Course schema & seed validation', () => {
  it('validates all seeded college courses with unique IDs and valid prerequisites', () => {
    expect(COURSES.length).toBeGreaterThanOrEqual(2);
    for (const course of COURSES) {
      const parsed = parseCourseTree(course);
      expect(parsed.chapters.length).toBeGreaterThan(0);
      expect(getAllLessonIds(parsed).length).toBeGreaterThan(0);
    }
  });

  it('finds courses by slug and lessons with their parent chapter', () => {
    const cs201 = getCourseBySlug('cs201-data-structures');
    expect(cs201).toBeDefined();
    const hit = findLessonWithChapter(cs201!, 'cs201-binary-search');
    expect(hit?.chapter.id).toBe('cs201-ch1-linear');
    expect(hit?.lesson.title).toBe('Binary Search');
  });

  it('rejects chapter or lesson IDs not derived from their course prefix', () => {
    const invalidChapter = structuredClone(COURSES[0]);
    invalidChapter.chapters[0].id = 'unprefixed-chapter';
    expect(() => parseCourseTree(invalidChapter)).toThrow(/must be derived from course prefix/);

    const invalidLesson = structuredClone(COURSES[0]);
    invalidLesson.chapters[0].lessons[0].id = 'unprefixed-lesson';
    expect(() => parseCourseTree(invalidLesson)).toThrow(/must be derived from course prefix/);
  });

  it('rejects duplicate lesson IDs across chapters', () => {
    const invalid = structuredClone(COURSES[0]);
    invalid.chapters[1].lessons[0].id = invalid.chapters[0].lessons[0].id;
    expect(() => parseCourseTree(invalid)).toThrow(/Duplicate lesson id/);
  });

  it('rejects dangling prerequisite IDs', () => {
    const invalid = structuredClone(COURSES[0]);
    invalid.chapters[0].lessons[0].prerequisites = ['does-not-exist'];
    expect(() => parseCourseTree(invalid)).toThrow(/Unknown prerequisite lesson id/);
  });

  it('rejects self-referencing prerequisites', () => {
    const invalid = structuredClone(COURSES[0]);
    const firstId = invalid.chapters[0].lessons[0].id;
    invalid.chapters[0].lessons[0].prerequisites = [firstId];
    expect(() => parseCourseTree(invalid)).toThrow(/cannot depend on itself/);
  });
});
