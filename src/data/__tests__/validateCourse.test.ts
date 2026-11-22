import { describe, expect, it } from 'vitest';
import {
  COURSES,
  PREMADE_COURSE_SLUGS,
  getCourseBySlug,
  getCoursesByDepartment,
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
import {
  AssessmentSchema,
  CourseTreeSchema,
  ResourceKindSchema,
  formatCourseTerm,
  type CourseTree,
} from '@/types/course';

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
    expect(guide101!.year).toBe(1);
    expect(guide101!.semester).toBe(1);
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
    expect(demo201!.year).toBe(2);
    expect(demo201!.semester).toBe(1);

    // All 9 resource kinds with https:// URLs or interactive assessments
    const observedKinds = new Set<string>();
    const allResources = demo201!.chapters.flatMap((ch) => [
      ...(ch.resources ?? []),
      ...ch.lessons.flatMap((l) => l.resources),
    ]);
    for (const res of allResources) {
      observedKinds.add(res.kind);
      if (res.url) {
        expect(res.url).toMatch(/^https:\/\//);
      } else {
        expect(res.assessment).toBeDefined();
        expect(AssessmentSchema.safeParse(res.assessment).success).toBe(true);
      }
    }
    for (const kind of ResourceKindSchema.options) {
      expect(observedKinds.has(kind)).toBe(true);
    }

    // Showcases recommended pinning, interactive LaTeX exam, and interactive assignment with hints
    expect(allResources.some((r) => r.recommended === true)).toBe(true);

    const interactiveExam = allResources.find(
      (r) => r.kind === 'exam' && r.assessment?.mode === 'exam'
    );
    expect(interactiveExam).toBeDefined();
    const examSerialized = JSON.stringify(interactiveExam!.assessment);
    expect(examSerialized).toContain('Theta(n \\\\log n)');
    expect(examSerialized).toContain('$$T(n) = 2T(n/2) + n$$');
    const examTypes = new Set(interactiveExam!.assessment!.questions.map((q) => q.type));
    expect(examTypes).toEqual(new Set(['mcq', 'multi-select', 'true-false', 'short-answer']));

    const interactiveAssignment = allResources.find(
      (r) => r.kind === 'assignment' && r.assessment?.mode === 'assignment'
    );
    expect(interactiveAssignment).toBeDefined();
    expect(interactiveAssignment!.assessment!.questions.some((q) => Boolean(q.hint))).toBe(true);

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

  it('groups courses cleanly by department and sorts by year, semester, then code', () => {
    const byDept = getCoursesByDepartment(COURSES);
    expect(Array.from(byDept.keys())).toEqual(['Preparatory', 'Computer Science']);
    expect(byDept.get('Preparatory')?.[0].code).toBe('GUIDE101');
    expect(byDept.get('Computer Science')?.[0].code).toBe('DEMO201');

    const base = structuredClone(COURSES[0]);
    const customCourses: CourseTree[] = [
      { ...base, slug: 'cs-unsched', code: 'CS999', department: 'Computer Science', year: undefined, semester: undefined },
      { ...base, slug: 'cs-y2s2', code: 'CS202', department: 'Computer Science', year: 2, semester: 2 },
      { ...base, slug: 'cs-y1s2', code: 'CS102', department: 'Computer Science', year: 1, semester: 2 },
      { ...base, slug: 'cs-y1s1-b', code: 'CS105', department: 'Computer Science', year: 1, semester: 1 },
      { ...base, slug: 'cs-y1s1-a', code: 'CS101', department: 'Computer Science', year: 1, semester: 1 },
    ];
    const sorted = getCoursesByDepartment(customCourses).get('Computer Science')!;
    expect(sorted.map((c) => c.code)).toEqual(['CS101', 'CS105', 'CS102', 'CS202', 'CS999']);
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
      year: 1,
      semester: 1,
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
                  kind: 'document',
                  recommended: true,
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

  it('defaults department to "Preparatory" and strictly rejects invalid year, semester, and legacy reading kind', () => {
    const omittedDept = structuredClone(COURSES[0]) as Record<string, unknown>;
    delete omittedDept.department;
    omittedDept.year = 4;
    omittedDept.semester = 2;
    const parsed = parseCourseTree(omittedDept);
    expect(parsed.department).toBe('Preparatory');
    expect(parsed.year).toBe(4);
    expect(parsed.semester).toBe(2);
    expect(formatCourseTerm(parsed)).toBe('Year 4 · 2nd Semester');
    expect(formatCourseTerm({ year: 1 })).toBe('Year 1');
    expect(formatCourseTerm({ semester: 2 })).toBe('2nd Semester');
    expect(formatCourseTerm({})).toBeNull();

    const legacySemester = {
      ...structuredClone(COURSES[0]),
      semester: 'Year 1 - First Semester',
    };
    expect(CourseTreeSchema.safeParse(legacySemester).success).toBe(false);

    const invalidSemNum = {
      ...structuredClone(COURSES[0]),
      semester: 3,
    };
    expect(CourseTreeSchema.safeParse(invalidSemNum).success).toBe(false);

    for (const badYear of [0, 11, 1.5, '1']) {
      const invalidYear = {
        ...structuredClone(COURSES[0]),
        year: badYear,
      };
      expect(CourseTreeSchema.safeParse(invalidYear).success).toBe(false);
    }

    const legacyReading = structuredClone(COURSES[0]) as unknown as {
      chapters: Array<{ lessons: Array<{ resources: Array<{ kind: string }> }> }>;
    };
    legacyReading.chapters[0].lessons[0].resources[0].kind = 'reading';
    expect(CourseTreeSchema.safeParse(legacyReading).success).toBe(false);
  });

  it('enforces strict 3-way XOR (url XOR file XOR assessment) on LessonResource and validates AssessmentSchema', () => {
    const neither = structuredClone(COURSES[0]);
    neither.chapters[0].lessons[0].resources = [
      { title: 'Broken', kind: 'document' } as unknown as CourseTree['chapters'][0]['lessons'][0]['resources'][0],
    ];
    expect(() => parseCourseTree(neither)).toThrow(
      /Provide exactly one of URL, uploaded file, or interactive assessment/
    );

    const bothUrlAndFile = structuredClone(COURSES[0]);
    bothUrlAndFile.chapters[0].lessons[0].resources = [
      {
        title: 'Both',
        kind: 'document',
        url: 'https://example.edu/a.pdf',
        file: {
          id: 'guide101-file-1234abcd',
          name: 'a.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 100,
        },
      },
    ];
    expect(() => parseCourseTree(bothUrlAndFile)).toThrow(
      /Provide exactly one of URL, uploaded file, or interactive assessment/
    );

    const validAssessment = {
      mode: 'exam' as const,
      timeLimitMinutes: 30,
      passingScorePercent: 70,
      questions: [
        {
          id: 'q1',
          type: 'mcq' as const,
          header: { text: 'What is $2+2$?' },
          options: ['3', '4'],
          correctIndices: [1],
        },
        {
          id: 'q2',
          type: 'multi-select' as const,
          header: { imageUrl: 'https://example.edu/diagram.png' },
          options: ['A', 'B', 'C'],
          correctIndices: [0, 2],
        },
        {
          id: 'q3',
          type: 'true-false' as const,
          header: { text: 'Is 0 even?' },
          correctIndices: [0],
        },
        {
          id: 'q4',
          type: 'short-answer' as const,
          header: { text: 'Define $O(1)$' },
          acceptedAnswers: ['constant'],
        },
      ],
    };

    expect(AssessmentSchema.safeParse(validAssessment).success).toBe(true);

    // 3-of-3 / 2-of-3 with assessment fails
    const urlAndAssessment = structuredClone(COURSES[0]);
    urlAndAssessment.chapters[0].lessons[0].resources = [
      {
        title: 'Two payloads',
        kind: 'exam',
        url: 'https://example.edu/exam',
        assessment: validAssessment,
      },
    ];
    expect(() => parseCourseTree(urlAndAssessment)).toThrow(
      /Provide exactly one of URL, uploaded file, or interactive assessment/
    );

    // Assessment-only resource succeeds
    const assessmentOnly = structuredClone(COURSES[0]);
    assessmentOnly.chapters[0].lessons[0].resources = [
      {
        title: 'Quiz 1',
        kind: 'exam',
        recommended: true,
        assessment: validAssessment,
      },
    ];
    expect(() => parseCourseTree(assessmentOnly)).not.toThrow();

    // Invalid question cases
    expect(
      AssessmentSchema.safeParse({
        mode: 'exam',
        questions: [
          {
            id: 'q1',
            type: 'mcq',
            header: { text: '   ' }, // empty header
            options: ['A', 'B'],
            correctIndices: [0],
          },
        ],
      }).success
    ).toBe(false);

    expect(
      AssessmentSchema.safeParse({
        mode: 'exam',
        questions: [
          {
            id: 'q1',
            type: 'mcq',
            header: { text: 'Duplicate indices' },
            options: ['A', 'B'],
            correctIndices: [0, 1], // MCQ must have exactly 1
          },
        ],
      }).success
    ).toBe(false);

    expect(
      AssessmentSchema.safeParse({
        mode: 'exam',
        questions: [
          {
            id: 'q1',
            type: 'multi-select',
            header: { text: 'Out of bounds' },
            options: ['A', 'B'],
            correctIndices: [2],
          },
        ],
      }).success
    ).toBe(false);

    expect(
      AssessmentSchema.safeParse({
        mode: 'exam',
        questions: [
          {
            id: 'q1',
            type: 'short-answer',
            header: { text: 'No answers' },
            acceptedAnswers: [],
          },
        ],
      }).success
    ).toBe(false);

    expect(
      AssessmentSchema.safeParse({
        mode: 'exam',
        questions: [
          {
            id: 'dup',
            type: 'true-false',
            header: { text: 'Q1' },
            correctIndices: [0],
          },
          {
            id: 'dup',
            type: 'true-false',
            header: { text: 'Q2' },
            correctIndices: [1],
          },
        ],
      }).success
    ).toBe(false);
  });
});
