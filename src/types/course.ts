import { z } from 'zod';
import { deriveCoursePrefix } from '@/lib/courseIds';

export const LessonStatusSchema = z.enum(['todo', 'learning', 'done', 'skipped']);
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

export const ResourceKindSchema = z.enum([
  'slides',
  'video',
  'audio',
  'lab',
  'document',
  'textbook',
  'course',
  'official',
  'exam',
  'assignment',
]);
export type ResourceKind = z.infer<typeof ResourceKindSchema>;

export const CourseYearSchema = z.number().int().min(1).max(10);
export const CourseSemesterSchema = z.union([z.literal(1), z.literal(2)]);
export type CourseSemester = z.infer<typeof CourseSemesterSchema>;

export function formatCourseTerm(course: {
  year?: number;
  semester?: 1 | 2;
}): string | null {
  const hasYear = typeof course.year === 'number';
  const semLabel =
    course.semester === 1
      ? '1st Semester'
      : course.semester === 2
        ? '2nd Semester'
        : null;

  if (hasYear && semLabel) return `Year ${course.year} · ${semLabel}`;
  if (hasYear) return `Year ${course.year}`;
  if (semLabel) return semLabel;
  return null;
}

export const StoredFileRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});
export type StoredFileRef = z.infer<typeof StoredFileRefSchema>;

export const AssessmentQuestionHeaderSchema = z
  .object({
    text: z.string().optional(),
    imageUrl: z
      .string()
      .url()
      .refine((u) => /^https?:\/\//i.test(u), {
        message: 'Image URL must use http:// or https://',
      })
      .optional(),
    imageFile: StoredFileRefSchema.optional(),
  })
  .refine(
    (h) =>
      Boolean(h.text && h.text.trim().length > 0) ||
      Boolean(h.imageUrl) ||
      Boolean(h.imageFile),
    {
      message: 'Question header must provide text, an image URL, or an uploaded image.',
    }
  );
export type AssessmentQuestionHeader = z.infer<typeof AssessmentQuestionHeaderSchema>;

export const AssessmentQuestionTypeSchema = z.enum([
  'mcq',
  'multi-select',
  'true-false',
  'short-answer',
]);
export type AssessmentQuestionType = z.infer<typeof AssessmentQuestionTypeSchema>;

export const AssessmentQuestionSchema = z
  .object({
    id: z.string().min(1),
    type: AssessmentQuestionTypeSchema,
    header: AssessmentQuestionHeaderSchema,
    options: z.array(z.string().trim().min(1)).optional(),
    correctIndices: z.array(z.number().int().nonnegative()).optional(),
    acceptedAnswers: z.array(z.string().trim().min(1)).optional(),
    caseSensitive: z.boolean().optional(),
    points: z.number().positive().optional(),
    hint: z.string().optional(),
    explanation: z.string().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.type === 'mcq' || q.type === 'multi-select') {
      if (!q.options || q.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${q.type} questions require at least 2 options.`,
          path: ['options'],
        });
        return;
      }
      if (!q.correctIndices || q.correctIndices.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${q.type} questions require at least 1 correct index.`,
          path: ['correctIndices'],
        });
        return;
      }
      if (q.type === 'mcq' && q.correctIndices.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'MCQ questions must have exactly 1 correct index.',
          path: ['correctIndices'],
        });
      }
      if (new Set(q.correctIndices).size !== q.correctIndices.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'correctIndices must not contain duplicates.',
          path: ['correctIndices'],
        });
      }
      q.correctIndices.forEach((idx, i) => {
        if (idx >= q.options!.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `correctIndices[${i}] (${idx}) is out of bounds for ${q.options!.length} options.`,
            path: ['correctIndices', i],
          });
        }
      });
    } else if (q.type === 'true-false') {
      if (q.options !== undefined && q.options.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'true-false questions with explicit options must provide exactly 2 options.',
          path: ['options'],
        });
      }
      const optionCount = q.options ? q.options.length : 2;
      if (!q.correctIndices || q.correctIndices.length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'true-false questions must have exactly 1 correct index.',
          path: ['correctIndices'],
        });
        return;
      }
      if (q.correctIndices[0] >= optionCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `correctIndices[0] (${q.correctIndices[0]}) is out of bounds.`,
          path: ['correctIndices', 0],
        });
      }
    } else if (q.type === 'short-answer') {
      if (!q.acceptedAnswers || q.acceptedAnswers.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'short-answer questions require at least 1 accepted answer.',
          path: ['acceptedAnswers'],
        });
      }
    }
  });
export type AssessmentQuestion = z.infer<typeof AssessmentQuestionSchema>;

export const AssessmentSchema = z
  .object({
    mode: z.enum(['exam', 'assignment']),
    instructions: z.string().optional(),
    timeLimitMinutes: z.number().int().positive().optional(),
    passingScorePercent: z.number().min(0).max(100).optional(),
    shuffleQuestions: z.boolean().optional(),
    questions: z.array(AssessmentQuestionSchema).min(1),
  })
  .superRefine((assessment, ctx) => {
    const seenIds = new Set<string>();
    assessment.questions.forEach((q, idx) => {
      if (seenIds.has(q.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate question id "${q.id}".`,
          path: ['questions', idx, 'id'],
        });
      }
      seenIds.add(q.id);
    });
  });
export type AssessmentData = z.infer<typeof AssessmentSchema>;

export const LessonResourceSchema = z
  .object({
    title: z.string().min(1),
    kind: ResourceKindSchema,
    recommended: z.boolean().optional(),
    url: z
      .string()
      .url()
      .refine((v) => /^https?:\/\//i.test(v), {
        message: 'URL must start with http:// or https://',
      })
      .optional(),
    file: StoredFileRefSchema.optional(),
    assessment: AssessmentSchema.optional(),
  })
  .refine(
    (r) => {
      const payloadCount =
        Number(r.url !== undefined) +
        Number(r.file !== undefined) +
        Number(r.assessment !== undefined);
      return payloadCount === 1;
    },
    {
      message: 'Provide exactly one of URL, uploaded file, or interactive assessment',
    }
  );
export type LessonResource = z.infer<typeof LessonResourceSchema>;

export const SubLessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  notes: z.string().optional(),
  side: z.enum(['left', 'right']).optional(),
  prerequisites: z.array(z.string().min(1)).optional(),
  resources: z.array(LessonResourceSchema),
});
export type SubLesson = z.infer<typeof SubLessonSchema>;

export const ChapterSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1),
  weekRange: z.string().optional(),
  description: z.string().min(1),
  notes: z.string().optional(),
  prerequisites: z.array(z.string().min(1)).optional(),
  resources: z.array(LessonResourceSchema).optional(),
  lessons: z.array(SubLessonSchema),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const CourseTreeSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase kebab-case'),
    code: z.string().min(2),
    title: z.string().min(2),
    department: z.string().trim().min(2),
    year: CourseYearSchema.optional(),
    semester: CourseSemesterSchema.optional(),
    credits: z.number().int().positive().optional(),
    description: z.string().min(1),
    chapters: z.array(ChapterSchema).min(1),
  })
  .superRefine((course, ctx) => {
    const requiredPrefix = `${deriveCoursePrefix(course.code)}-`;
    const itemIds = new Set<string>();

    course.chapters.forEach((chapter, cIdx) => {
      if (!chapter.id.startsWith(requiredPrefix)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Chapter id "${chapter.id}" must be derived from course prefix "${requiredPrefix}"`,
          path: ['chapters', cIdx, 'id'],
        });
      }
      if (itemIds.has(chapter.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate item id "${chapter.id}"`,
          path: ['chapters', cIdx, 'id'],
        });
      }
      itemIds.add(chapter.id);

      chapter.lessons.forEach((lesson, lIdx) => {
        if (!lesson.id.startsWith(requiredPrefix)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Lesson id "${lesson.id}" must be derived from course prefix "${requiredPrefix}"`,
            path: ['chapters', cIdx, 'lessons', lIdx, 'id'],
          });
        }
        if (itemIds.has(lesson.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate item id "${lesson.id}"`,
            path: ['chapters', cIdx, 'lessons', lIdx, 'id'],
          });
        }
        itemIds.add(lesson.id);
      });
    });

    course.chapters.forEach((chapter, cIdx) => {
      chapter.prerequisites?.forEach((prereqId, pIdx) => {
        if (prereqId === chapter.id) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Chapter "${chapter.id}" cannot depend on itself`,
            path: ['chapters', cIdx, 'prerequisites', pIdx],
          });
        } else if (!itemIds.has(prereqId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown prerequisite id "${prereqId}"`,
            path: ['chapters', cIdx, 'prerequisites', pIdx],
          });
        }
      });

      chapter.lessons.forEach((lesson, lIdx) => {
        lesson.prerequisites?.forEach((prereqId, pIdx) => {
          if (prereqId === lesson.id) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Lesson "${lesson.id}" cannot depend on itself`,
              path: ['chapters', cIdx, 'lessons', lIdx, 'prerequisites', pIdx],
            });
          } else if (!itemIds.has(prereqId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Unknown prerequisite id "${prereqId}"`,
              path: ['chapters', cIdx, 'lessons', lIdx, 'prerequisites', pIdx],
            });
          }
        });
      });
    });
  });

export type CourseTree = z.infer<typeof CourseTreeSchema>;
