import { z } from 'zod';
import { CourseTreeSchema, type CourseTree } from '@/types/course';
import {
  PROGRESS_STORAGE_KEY,
  type CatalogLoadResult,
  type PersistResult,
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

export const CORRUPT_BACKUP_SUFFIX = '_corrupt_backup';

const StoredCatalogEnvelopeSchema = z.object({
  version: z.number().int().positive().optional(),
  courses: z.array(z.unknown()),
});

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string; code?: number };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014
  );
}

function describeStorageError(error: unknown, what: string): string {
  return isQuotaExceededError(error)
    ? `Browser storage is full, so ${what} could not be saved. Export a backup and free up space.`
    : `Could not save ${what} to browser storage (it may be disabled or restricted).`;
}

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
    loadCatalog(): CatalogLoadResult {
      const storage = resolveStorage(storageOverride);
      const missing: CatalogLoadResult = {
        courses: null,
        status: 'missing',
        droppedCount: 0,
        backedUp: false,
      };
      if (!storage) return missing;

      let raw: string | null;
      try {
        raw = storage.getItem(storageKey);
      } catch {
        return missing;
      }
      if (!raw) return missing;

      const backup = (): boolean => {
        try {
          storage.setItem(`${storageKey}${CORRUPT_BACKUP_SUFFIX}`, raw);
          return true;
        } catch {
          return false;
        }
      };

      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        return { courses: null, status: 'corrupt', droppedCount: 0, backedUp: backup() };
      }

      const envelope = StoredCatalogEnvelopeSchema.safeParse(json);
      if (!envelope.success) {
        return { courses: null, status: 'corrupt', droppedCount: 0, backedUp: backup() };
      }

      const valid: CourseTree[] = [];
      let dropped = 0;
      for (const entry of envelope.data.courses) {
        const parsed = CourseTreeSchema.safeParse(entry);
        if (parsed.success) valid.push(parsed.data);
        else dropped += 1;
      }

      if (dropped === 0) {
        return { courses: valid, status: 'ok', droppedCount: 0, backedUp: false };
      }
      const backedUp = backup();
      if (valid.length === 0) {
        return { courses: null, status: 'corrupt', droppedCount: dropped, backedUp };
      }
      return { courses: valid, status: 'recovered', droppedCount: dropped, backedUp };
    },

    loadCourses(): CourseTree[] | null {
      return this.loadCatalog().courses;
    },

    saveCourses(courses: CourseTree[]): PersistResult {
      const storage = resolveStorage(storageOverride);
      if (!storage) return { ok: true };
      try {
        storage.setItem(storageKey, JSON.stringify({ version: 2, courses }));
        return { ok: true };
      } catch (error) {
        return { ok: false, error: describeStorageError(error, 'your courses') };
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

    saveProgress(state: ProgressState): PersistResult {
      const storage =
        storageOverride !== undefined
          ? storageOverride
          : typeof window !== 'undefined'
            ? window.localStorage
            : null;
      if (!storage) return { ok: true };
      try {
        storage.setItem(storageKey, JSON.stringify(state));
        return { ok: true };
      } catch (error) {
        return { ok: false, error: describeStorageError(error, 'your progress') };
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
