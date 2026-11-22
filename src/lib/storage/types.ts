import { z } from 'zod';
import { LessonStatusSchema, type CourseTree } from '@/types/course';

export const PROGRESS_STORAGE_KEY = 'college_course_trees_progress_v1';

export const AssessmentScoreRecordSchema = z.object({
  bestScorePercent: z.number().min(0).max(100),
  latestScorePercent: z.number().min(0).max(100),
  attempts: z.number().int().positive(),
  passed: z.boolean(),
  updatedAt: z.string().min(1),
});
export type AssessmentScoreRecord = z.infer<typeof AssessmentScoreRecordSchema>;

export const ProgressStateSchema = z.object({
  version: z.literal(1),
  statuses: z.record(z.string(), z.record(z.string(), LessonStatusSchema)),
  bookmarks: z.array(z.string()),
  assessmentScores: z
    .record(z.string(), z.record(z.string(), AssessmentScoreRecordSchema))
    .optional(),
});

export type ProgressState = z.infer<typeof ProgressStateSchema>;

export function createEmptyProgressState(): ProgressState {
  return {
    version: 1,
    statuses: {},
    bookmarks: [],
  };
}

export interface StoredFileRecord {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  blob: Blob;
  createdAt: number;
}

/**
 * Read-only boundary for bundled premade course roadmaps.
 * Swappable for a future multi-user backend without changing UI/store contracts.
 */
export interface PremadeRoadmapRepository {
  getAll(): CourseTree[];
  getBySlug(slug: string): CourseTree | undefined;
  isPremadeSlug(slug: string): boolean;
}

/**
 * Persistence boundary for user-managed course roadmaps.
 * Swappable for a future multi-user backend without changing UI/store contracts.
 */
export interface UserRoadmapRepository {
  loadCourses(): CourseTree[] | null;
  saveCourses(courses: CourseTree[]): void;
  clear(): void;
}

/**
 * Persistence boundary for per-user course progress and bookmarks.
 * Swappable for a future multi-user backend without changing UI/store contracts.
 */
export interface ProgressRepository {
  loadProgress(): ProgressState;
  saveProgress(state: ProgressState): void;
  clearProgress(): void;
}

/**
 * Persistence boundary for binary uploaded material files (IndexedDB locally).
 */
export interface MaterialFileRepository {
  putFile(id: string, file: Blob, name: string, mimeType: string): Promise<void>;
  getFile(id: string): Promise<StoredFileRecord | undefined>;
  deleteFile(id: string): Promise<void>;
  listFileIds(): Promise<string[]>;
  garbageCollectFiles(referenced: Set<string>): Promise<number>;
}
