import { describe, expect, it } from 'vitest';
import { COURSES, getCourseBySlug } from '@/data/courses';
import {
  findCourseItem,
  findLessonWithChapter,
  getAllItemRefs,
  getAllLessonIds,
  getTrackableItems,
  isStandaloneChapter,
  parseCourseTree,
} from '@/data/validateCourse';
import { SEMESTER_OPTIONS, type CourseTree } from '@/types/course';

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

  it('enforces a shared chapter and lesson ID uniqueness namespace', () => {
    const dupLessons = structuredClone(COURSES[0]);
    dupLessons.chapters[1].lessons[0].id = dupLessons.chapters[0].lessons[0].id;
    expect(() => parseCourseTree(dupLessons)).toThrow(/Duplicate item id/);

    const lessonCollidesWithChapter = structuredClone(COURSES[0]);
    lessonCollidesWithChapter.chapters[1].lessons[0].id =
      lessonCollidesWithChapter.chapters[0].id;
    expect(() => parseCourseTree(lessonCollidesWithChapter)).toThrow(/Duplicate item id/);
  });

  it('rejects dangling prerequisite IDs on lessons and chapters', () => {
    const invalidLesson = structuredClone(COURSES[0]);
    invalidLesson.chapters[0].lessons[0].prerequisites = ['does-not-exist'];
    expect(() => parseCourseTree(invalidLesson)).toThrow(/Unknown prerequisite id/);

    const invalidChapter = structuredClone(COURSES[0]);
    invalidChapter.chapters[0].prerequisites = ['missing-chapter-prereq'];
    expect(() => parseCourseTree(invalidChapter)).toThrow(/Unknown prerequisite id/);
  });

  it('rejects self-referencing prerequisites on lessons and chapters', () => {
    const invalidLesson = structuredClone(COURSES[0]);
    const firstId = invalidLesson.chapters[0].lessons[0].id;
    invalidLesson.chapters[0].lessons[0].prerequisites = [firstId];
    expect(() => parseCourseTree(invalidLesson)).toThrow(/cannot depend on itself/);

    const invalidChapter = structuredClone(COURSES[0]);
    const firstChId = invalidChapter.chapters[0].id;
    invalidChapter.chapters[0].prerequisites = [firstChId];
    expect(() => parseCourseTree(invalidChapter)).toThrow(/cannot depend on itself/);
  });

  it('supports chapter prerequisites, notes, resources, and standalone chapters', () => {
    const course: CourseTree = {
      slug: 'guide101-intro',
      code: 'GUIDE101',
      title: 'Quick Start',
      department: 'Preparatory',
      semester: SEMESTER_OPTIONS[0],
      description: 'Course with standalone chapter and cross-kind prerequisites.',
      chapters: [
        {
          id: 'guide101-ch1-basics',
          order: 1,
          title: '1. Basics',
          description: 'First chapter',
          lessons: [
            {
              id: 'guide101-welcome',
              title: 'Welcome',
              summary: 'Intro lesson',
              resources: [
                {
                  title: 'Syllabus PDF',
                  kind: 'reading',
                  file: {
                    id: 'guide101-file-deadbeef',
                    name: 'syllabus.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 2048,
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'guide101-ch2-capstone',
          order: 2,
          title: '2. Capstone',
          description: 'Standalone chapter',
          notes: 'Read carefully.',
          prerequisites: ['guide101-ch1-basics', 'guide101-welcome'],
          resources: [
            {
              title: 'Project Spec',
              kind: 'assignment',
              url: 'https://example.edu/spec',
            },
          ],
          lessons: [],
        },
      ],
    };

    const parsed = parseCourseTree(course);
    expect(isStandaloneChapter(parsed.chapters[1])).toBe(true);
    expect(getTrackableItems(parsed).map((i) => i.id)).toEqual([
      'guide101-welcome',
      'guide101-ch2-capstone',
    ]);
    expect(findCourseItem(parsed, 'guide101-ch2-capstone')?.kind).toBe('chapter');
    expect(getAllItemRefs(parsed)).toHaveLength(3);
  });

  it('defaults department to "Preparatory" and drops invalid semester values', () => {
    const raw = {
      ...structuredClone(COURSES[0]),
      department: '',
      semester: 'Legacy Fall 2024',
    };
    const parsed = parseCourseTree(raw);
    expect(parsed.department).toBe('Preparatory');
    expect(parsed.semester).toBeUndefined();

    const omittedDept = structuredClone(COURSES[0]) as Record<string, unknown>;
    delete omittedDept.department;
    omittedDept.semester = SEMESTER_OPTIONS[7];
    const parsed2 = parseCourseTree(omittedDept);
    expect(parsed2.department).toBe('Preparatory');
    expect(parsed2.semester).toBe('Year 4 - Second Semester');
  });

  it('requires either a URL or a file on LessonResource (XOR)', () => {
    const neither = structuredClone(COURSES[0]);
    neither.chapters[0].lessons[0].resources = [
      { title: 'Broken', kind: 'reading' } as unknown as CourseTree['chapters'][0]['lessons'][0]['resources'][0],
    ];
    expect(() => parseCourseTree(neither)).toThrow(/Provide either a URL or an uploaded file/);

    const both = structuredClone(COURSES[0]);
    both.chapters[0].lessons[0].resources = [
      {
        title: 'Both',
        kind: 'reading',
        url: 'https://example.edu/a.pdf',
        file: {
          id: 'cs201-file-1234abcd',
          name: 'a.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
        },
      },
    ];
    expect(() => parseCourseTree(both)).toThrow(/Provide either a URL or an uploaded file/);
  });
});
