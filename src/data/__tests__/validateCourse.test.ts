import { describe, expect, it } from 'vitest';
import {
  COURSES,
  PREMADE_COURSE_SLUGS,
  getCourseBySlug,
  getCoursesByDepartment,
  getCoursesByYear,
} from '@/data/courses';
import {
  findCourseItem,
  findLessonWithChapter,
  getAllItemRefs,
  getAllLessonIds,
  getTrackableItems,
  isStandaloneChapter,
  parseCourseTree,
} from '@/data/validateCourse';
import { rekeyCourseContentIds } from '@/lib/courseIds';
import { ResourceKindSchema, SEMESTER_OPTIONS, type CourseTree } from '@/types/course';

describe('Course schema & seed validation', () => {
  it('validates all seeded college courses with unique IDs and valid prerequisites', () => {
    expect(COURSES).toHaveLength(2);
    expect(PREMADE_COURSE_SLUGS.has('guide101-quick-start')).toBe(true);
    expect(PREMADE_COURSE_SLUGS.has('demo201-feature-showcase')).toBe(true);

    for (const course of COURSES) {
      const parsed = parseCourseTree(course);
      expect(parsed.chapters.length).toBeGreaterThan(0);
      expect(getAllLessonIds(parsed).length).toBeGreaterThan(0);
      expect(rekeyCourseContentIds(parsed)).toEqual(parsed);
    }
  });

  it('validates GUIDE101 structure, departments, and standalone chapters', () => {
    const guide101 = getCourseBySlug('guide101-quick-start');
    expect(guide101).toBeDefined();
    expect(guide101!.code).toBe('GUIDE101');
    expect(guide101!.department).toBe('Preparatory');
    expect(guide101!.semester).toBe('Year 1 - First Semester');
    expect(guide101!.chapters).toHaveLength(6);

    const hit = findLessonWithChapter(guide101!, 'guide101-searching-with-ctrl-k');
    expect(hit?.chapter.id).toBe('guide101-ch1-navigating-the-catalog');
    expect(hit?.lesson.title).toBe('Searching with Ctrl+K');

    // Chapters 5 & 6 are standalone chapters
    const ch5 = guide101!.chapters[4];
    const ch6 = guide101!.chapters[5];
    expect(isStandaloneChapter(ch5)).toBe(true);
    expect(isStandaloneChapter(ch6)).toBe(true);
    expect(ch5.notes).toBeTruthy();
    expect(ch5.resources).toHaveLength(2);
    expect(ch5.prerequisites?.length).toBeGreaterThanOrEqual(1);
    expect(ch6.notes).toBeTruthy();
    expect(ch6.resources?.length).toBeGreaterThanOrEqual(1);
  });

  it('validates DEMO201 feature coverage: 9 resource kinds, sides, 6-lesson chapter, long title, cross-chapter & lesson-to-chapter prereqs, and 2 standalone chapters', () => {
    const demo201 = getCourseBySlug('demo201-feature-showcase');
    expect(demo201).toBeDefined();
    expect(demo201!.code).toBe('DEMO201');
    expect(demo201!.department).toBe('Computer Science');
    expect(demo201!.semester).toBe('Year 2 - First Semester');

    // All 9 resource kinds with https:// URLs
    const observedKinds = new Set<string>();
    for (const ch of demo201!.chapters) {
      for (const res of ch.resources ?? []) {
        observedKinds.add(res.kind);
        expect(res.url).toMatch(/^https:\/\//);
      }
      for (const lesson of ch.lessons) {
        for (const res of lesson.resources) {
          observedKinds.add(res.kind);
          expect(res.url).toMatch(/^https:\/\//);
        }
      }
    }
    for (const kind of ResourceKindSchema.options) {
      expect(observedKinds.has(kind)).toBe(true);
    }

    // Sides: left, right, and auto (undefined)
    const allLessons = demo201!.chapters.flatMap((c) => c.lessons);
    expect(allLessons.some((l) => l.side === 'left')).toBe(true);
    expect(allLessons.some((l) => l.side === 'right')).toBe(true);
    expect(allLessons.some((l) => l.side === undefined)).toBe(true);

    // Chapter with 6 lessons
    expect(demo201!.chapters.some((c) => c.lessons.length === 6)).toBe(true);

    // ~40-character lesson title
    expect(allLessons.some((l) => l.title.length >= 38 && l.title.length <= 44)).toBe(true);

    // Two standalone chapters with materials & prerequisites
    const standalone = demo201!.chapters.filter(isStandaloneChapter);
    expect(standalone).toHaveLength(2);
    for (const ch of standalone) {
      expect((ch.resources ?? []).length).toBeGreaterThan(0);
      expect((ch.prerequisites ?? []).length).toBeGreaterThan(0);
      expect(ch.notes).toBeTruthy();
    }

    // Cross-chapter lesson -> chapter prerequisite
    const chapterIds = new Set(demo201!.chapters.map((c) => c.id));
    const hasLessonToChapterPrereq = demo201!.chapters.some((ch) =>
      ch.lessons.some((l) =>
        (l.prerequisites ?? []).some((p) => chapterIds.has(p) && p !== ch.id)
      )
    );
    expect(hasLessonToChapterPrereq).toBe(true);
  });

  it('groups courses cleanly by department and by academic year', () => {
    const byDept = getCoursesByDepartment(COURSES);
    expect(Array.from(byDept.keys())).toEqual(['Preparatory', 'Computer Science']);
    expect(byDept.get('Preparatory')?.[0].code).toBe('GUIDE101');
    expect(byDept.get('Computer Science')?.[0].code).toBe('DEMO201');

    const byYear = getCoursesByYear(COURSES);
    expect(Array.from(byYear.keys())).toEqual(['Year 1', 'Year 2']);
    expect(byYear.get('Year 1')?.[0].code).toBe('GUIDE101');
    expect(byYear.get('Year 2')?.[0].code).toBe('DEMO201');
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
          id: 'guide101-file-1234abcd',
          name: 'a.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
        },
      },
    ];
    expect(() => parseCourseTree(both)).toThrow(/Provide either a URL or an uploaded file/);
  });
});
