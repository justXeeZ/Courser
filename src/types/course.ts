import { z } from 'zod';
import { deriveCoursePrefix } from '@/lib/courseIds';

export const LessonStatusSchema = z.enum(['todo', 'learning', 'done', 'skipped']);
export type LessonStatus = z.infer<typeof LessonStatusSchema>;

export const ResourceKindSchema = z.enum([
  'slides',
  'video',
  'lab',
  'reading',
  'textbook',
  'course',
  'official',
  'exam',
  'assignment',
]);
export type ResourceKind = z.infer<typeof ResourceKindSchema>;

export const SEMESTER_OPTIONS = [
  'Year 1 - First Semester',
  'Year 1 - Second Semester',
  'Year 2 - First Semester',
  'Year 2 - Second Semester',
  'Year 3 - First Semester',
  'Year 3 - Second Semester',
  'Year 4 - First Semester',
  'Year 4 - Second Semester',
] as const;
export const SemesterSchema = z.enum(SEMESTER_OPTIONS);
export type SemesterOption = z.infer<typeof SemesterSchema>;

export const StoredFileRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});
export type StoredFileRef = z.infer<typeof StoredFileRefSchema>;

export const LessonResourceSchema = z
  .object({
    title: z.string().min(1),
    kind: ResourceKindSchema,
    url: z.string().url().optional(),
    file: StoredFileRefSchema.optional(),
  })
  .refine((r) => Boolean(r.url) !== Boolean(r.file), {
    message: 'Provide either a URL or an uploaded file',
  });
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
    department: z.string().trim().min(2).catch('Preparatory'),
    semester: SemesterSchema.optional().catch(undefined),
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
