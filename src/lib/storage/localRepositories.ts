import { z } from 'zod';
import { CourseTreeSchema, type CourseTree } from '@/types/course';
import {
  PROGRESS_STORAGE_KEY,
  ProgressStateSchema,
  createEmptyProgressState,
  type PremadeRoadmapRepository,
  type ProgressRepository,
  type ProgressState,
  type UserRoadmapRepository,
} from '@/lib/storage/types';

export const USER_ROADMAPS_STORAGE_KEY = 'college_course_trees_catalog_v2';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function resolveStorage(override?: StorageLike | null): StorageLike | null {
  if (override !== undefined) return override;
  return typeof window !== 'undefined' ? window.localStorage : null;
}

const StoredCatalogSchema = z.object({
  version: z.number().int().positive().optional(),
  courses: z.array(CourseTreeSchema),
});

export function createLocalPremadeRoadmapRepository(
  seedCourses: readonly CourseTree[]
): PremadeRoadmapRepository {
  const premadeSlugs = new Set(seedCourses.map((course) => course.slug));

  return {
    getAll: () => [...seedCourses],
    getBySlug: (slug: string) => seedCourses.find((course) => course.slug === slug),
    isPremadeSlug: (slug: string) => premadeSlugs.has(slug),
  };
}

export function createLocalUserRoadmapRepository(
  storageKey: string = USER_ROADMAPS_STORAGE_KEY,
  storageOverride?: StorageLike | null
): UserRoadmapRepository {
  return {
    loadCourses(): CourseTree[] | null {
      const storage = resolveStorage(storageOverride);
      if (!storage) return null;
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return null;
        const parsed = StoredCatalogSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data.courses : null;
      } catch {
        return null;
      }
    },

    saveCourses(courses: CourseTree[]): void {
      const storage = resolveStorage(storageOverride);
      if (!storage) return;
      try {
        storage.setItem(storageKey, JSON.stringify({ version: 2, courses }));
      } catch {
        // Ignore quota / private-browsing errors gracefully
      }
    },

    clear(): void {
      const storage = resolveStorage(storageOverride);
      if (!storage) return;
      try {
        storage.removeItem(storageKey);
      } catch {
        // Ignore storage errors gracefully
      }
    },
  };
}

export const localUserRoadmapRepository: UserRoadmapRepository =
  createLocalUserRoadmapRepository();

export function createLocalProgressRepository(
  storageOverride?: Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>> | null,
  storageKey: string = PROGRESS_STORAGE_KEY
): ProgressRepository {
  return {
    loadProgress(): ProgressState {
      const storage =
        storageOverride !== undefined
          ? storageOverride
          : typeof window !== 'undefined'
            ? window.localStorage
            : null;
      if (!storage) return createEmptyProgressState();
      try {
        const raw = storage.getItem(storageKey);
        if (!raw) return createEmptyProgressState();
        const parsed = ProgressStateSchema.safeParse(JSON.parse(raw));
        return parsed.success ? parsed.data : createEmptyProgressState();
      } catch {
        return createEmptyProgressState();
      }
    },

    saveProgress(state: ProgressState): void {
      const storage =
        storageOverride !== undefined
          ? storageOverride
          : typeof window !== 'undefined'
            ? window.localStorage
            : null;
      if (!storage) return;
      try {
        storage.setItem(storageKey, JSON.stringify(state));
      } catch {
        // Ignore quota / private-browsing errors gracefully
      }
    },

    clearProgress(): void {
      const storage =
        storageOverride !== undefined
          ? storageOverride
          : typeof window !== 'undefined'
            ? window.localStorage
            : null;
      if (!storage?.removeItem) return;
      try {
        storage.removeItem(storageKey);
      } catch {
        // Ignore storage errors gracefully
      }
    },
  };
}

export const localProgressRepository: ProgressRepository = createLocalProgressRepository();
