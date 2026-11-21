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

export const LessonResourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  kind: ResourceKindSchema,
  durationMinutes: z.number().int().positive().optional(),
});
export type LessonResource = z.infer<typeof LessonResourceSchema>;

export const SubLessonSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  notes: z.string().optional(),
  side: z.enum(['left', 'right']).optional(),
  prerequisites: z.array(z.string().min(1)).optional(),
  estimatedMinutes: z.number().int().positive().optional(),
  resources: z.array(LessonResourceSchema),
});
export type SubLesson = z.infer<typeof SubLessonSchema>;

export const ChapterSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().positive(),
  title: z.string().min(1),
  weekRange: z.string().optional(),
  description: z.string().min(1),
  lessons: z.array(SubLessonSchema),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const CourseTreeSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be lowercase kebab-case'),
    code: z.string().min(2),
    title: z.string().min(2),
    department: z.string().min(2),
    semester: z.string().optional(),
    credits: z.number().int().positive().optional(),
    description: z.string().min(1),
    chapters: z.array(ChapterSchema).min(1),
  })
  .superRefine((course, ctx) => {
    const requiredPrefix = `${deriveCoursePrefix(course.code)}-`;
    const chapterIds = new Set<string>();
    const lessonIds = new Set<string>();

    course.chapters.forEach((chapter, cIdx) => {
      if (!chapter.id.startsWith(requiredPrefix)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Chapter id "${chapter.id}" must be derived from course prefix "${requiredPrefix}"`,
          path: ['chapters', cIdx, 'id'],
        });
      }
      if (chapterIds.has(chapter.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate chapter id "${chapter.id}"`,
          path: ['chapters', cIdx, 'id'],
        });
      }
      chapterIds.add(chapter.id);

      chapter.lessons.forEach((lesson, lIdx) => {
        if (!lesson.id.startsWith(requiredPrefix)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Lesson id "${lesson.id}" must be derived from course prefix "${requiredPrefix}"`,
            path: ['chapters', cIdx, 'lessons', lIdx, 'id'],
          });
        }
        if (lessonIds.has(lesson.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate lesson id "${lesson.id}"`,
            path: ['chapters', cIdx, 'lessons', lIdx, 'id'],
          });
        }
        lessonIds.add(lesson.id);
      });
    });

    course.chapters.forEach((chapter, cIdx) => {
      chapter.lessons.forEach((lesson, lIdx) => {
        lesson.prerequisites?.forEach((prereqId, pIdx) => {
          if (prereqId === lesson.id) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Lesson "${lesson.id}" cannot depend on itself`,
              path: ['chapters', cIdx, 'lessons', lIdx, 'prerequisites', pIdx],
            });
          } else if (!lessonIds.has(prereqId)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Unknown prerequisite lesson id "${prereqId}"`,
              path: ['chapters', cIdx, 'lessons', lIdx, 'prerequisites', pIdx],
            });
          }
        });
      });
    });
  });

export type CourseTree = z.infer<typeof CourseTreeSchema>;
