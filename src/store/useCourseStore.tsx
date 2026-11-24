import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { COURSES as DEFAULT_COURSES } from '@/data/courses';
import {
  rekeyCourseContentIds,
  rekeyCourseContentIdsWithMap,
  validateRawCourseReferences,
} from '@/lib/courseIds';
import {
  USER_ROADMAPS_STORAGE_KEY,
  createLocalPremadeRoadmapRepository,
  createLocalUserRoadmapRepository,
  localUserRoadmapRepository,
} from '@/lib/storage/localRepositories';
import type {
  CatalogLoadResult,
  PersistResult,
  PremadeRoadmapRepository,
  UserRoadmapRepository,
} from '@/lib/storage/types';
import { CourseTreeSchema, type CourseTree } from '@/types/course';

export const COURSES_STORAGE_KEY = USER_ROADMAPS_STORAGE_KEY;

const defaultPremadeRoadmapRepository: PremadeRoadmapRepository =
  createLocalPremadeRoadmapRepository(DEFAULT_COURSES);

type CatalogReadStorage = Pick<Storage, 'getItem'> &
  Partial<Pick<Storage, 'setItem' | 'removeItem'>>;

type CatalogWriteStorage = Pick<Storage, 'setItem'> &
  Partial<Pick<Storage, 'getItem' | 'removeItem'>>;

function createUserRepoForStorage(storage: CatalogReadStorage): UserRoadmapRepository {
  return createLocalUserRoadmapRepository(COURSES_STORAGE_KEY, {
    getItem: storage.getItem.bind(storage),
    setItem: storage.setItem ? storage.setItem.bind(storage) : () => {},
    removeItem: storage.removeItem ? storage.removeItem.bind(storage) : () => {},
  });
}

export interface CatalogRecovery {
  status: 'recovered' | 'corrupt';
  droppedCount: number;
  backedUp: boolean;
}

function toRecovery(result: CatalogLoadResult): CatalogRecovery | null {
  if (result.status === 'recovered' || result.status === 'corrupt') {
    return {
      status: result.status,
      droppedCount: result.droppedCount,
      backedUp: result.backedUp,
    };
  }
  return null;
}

export function loadCoursesCatalog(
  storage?: CatalogReadStorage | null,
  premadeRepo: PremadeRoadmapRepository = defaultPremadeRoadmapRepository
): CourseTree[] {
  return loadCoursesCatalogDetailed(storage, premadeRepo).courses;
}

export function loadCoursesCatalogDetailed(
  storage?: CatalogReadStorage | null,
  premadeRepo: PremadeRoadmapRepository = defaultPremadeRoadmapRepository
): { courses: CourseTree[]; recovery: CatalogRecovery | null } {
  const effectiveStorage: CatalogReadStorage | null =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  if (!effectiveStorage) {
    return { courses: premadeRepo.getAll(), recovery: null };
  }

  const userRepo: UserRoadmapRepository =
    storage === undefined ? localUserRoadmapRepository : createUserRepoForStorage(effectiveStorage);

  try {
    const result = userRepo.loadCatalog();
    return {
      courses: result.courses ?? premadeRepo.getAll(),
      recovery: toRecovery(result),
    };
  } catch {
    return { courses: premadeRepo.getAll(), recovery: null };
  }
}

export function saveCoursesCatalog(
  courses: CourseTree[],
  storage?: CatalogWriteStorage | null
): PersistResult {
  if (storage === null) return { ok: true };
  const effectiveStorage: CatalogWriteStorage | null =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  if (!effectiveStorage) return { ok: true };

  const userRepo: UserRoadmapRepository =
    storage === undefined
      ? localUserRoadmapRepository
      : createLocalUserRoadmapRepository(COURSES_STORAGE_KEY, {
          getItem: effectiveStorage.getItem ? effectiveStorage.getItem.bind(effectiveStorage) : () => null,
          setItem: effectiveStorage.setItem.bind(effectiveStorage),
          removeItem: effectiveStorage.removeItem ? effectiveStorage.removeItem.bind(effectiveStorage) : () => {},
        });

  return userRepo.saveCourses(courses);
}

export type CourseMutationResult =
  | { ok: true; course: CourseTree }
  | { ok: false; error: string };

export type CourseUpdateResult =
  | { ok: true; course: CourseTree; idMap: Map<string, string>; previousSlug: string }
  | { ok: false; error: string };

interface CourseContextValue {
  courses: CourseTree[];
  getCourseBySlug: (slug: string) => CourseTree | undefined;
  getCourse: (slug: string) => CourseTree | undefined;
  addCourse: (course: CourseTree) => CourseMutationResult;
  updateCourse: (existingSlug: string, updated: CourseTree) => CourseUpdateResult;
  deleteCourse: (slug: string) => void;
  resetCatalogToDefaults: () => void;
  resetCatalog: () => void;
  isPremadeCourse: (slug: string) => boolean;
  /** Set when the stored catalog was corrupt/partially invalid at startup. */
  catalogRecovery: CatalogRecovery | null;
  dismissCatalogRecovery: () => void;
  /** Set when the last attempt to persist the catalog failed (e.g. quota). */
  persistError: string | null;
  dismissPersistError: () => void;
}

const CourseContext = createContext<CourseContextValue | null>(null);

interface CourseProviderProps {
  children: ReactNode;
  premadeRepository?: PremadeRoadmapRepository;
  userRepository?: UserRoadmapRepository;
}

export function CourseProvider({
  children,
  premadeRepository = defaultPremadeRoadmapRepository,
  userRepository,
}: CourseProviderProps) {
  const [initial] = useState(() => {
    if (userRepository) {
      const result = userRepository.loadCatalog
        ? userRepository.loadCatalog()
        : {
            courses: userRepository.loadCourses(),
            status: 'ok' as const,
            droppedCount: 0,
            backedUp: false,
          };
      return {
        courses: result.courses ?? premadeRepository.getAll(),
        recovery: toRecovery(result),
      };
    }
    return loadCoursesCatalogDetailed(undefined, premadeRepository);
  });
  const [courses, setCourses] = useState<CourseTree[]>(initial.courses);
  const [catalogRecovery, setCatalogRecovery] = useState<CatalogRecovery | null>(
    initial.recovery
  );
  const [persistError, setPersistError] = useState<string | null>(null);
  const skipNextSaveRef = useRef(false);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const result = userRepository
      ? userRepository.saveCourses(courses)
      : saveCoursesCatalog(courses);
    setPersistError(result && !result.ok ? result.error : null);
  }, [courses, userRepository]);

  // Keep multiple tabs in sync: adopt catalog changes written by another tab.
  useEffect(() => {
    if (userRepository || typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      if (event.key !== null && event.key !== COURSES_STORAGE_KEY) return;
      const result = localUserRoadmapRepository.loadCatalog();
      if (!result.courses) return;
      skipNextSaveRef.current = true;
      setCourses(result.courses);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [userRepository]);

  const dismissCatalogRecovery = useCallback(() => setCatalogRecovery(null), []);
  const dismissPersistError = useCallback(() => setPersistError(null), []);
  const getCourseBySlug = useCallback(
    (slug: string) => courses.find((c) => c.slug === slug),
    [courses]
  );

  const addCourse = useCallback(
    (rawCourse: CourseTree): CourseMutationResult => {
      const refError = validateRawCourseReferences(rawCourse);
      if (refError) {
        return { ok: false, error: refError };
      }

      const normalized = rekeyCourseContentIds(rawCourse);
      const parsed = CourseTreeSchema.safeParse(normalized);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return {
          ok: false,
          error: `${first.path.join('.') || 'Course'}: ${first.message}`,
        };
      }

      if (courses.some((c) => c.slug === parsed.data.slug)) {
        return {
          ok: false,
          error: `A course with slug "${parsed.data.slug}" already exists.`,
        };
      }

      setCourses((prev) => [...prev, parsed.data]);
      return { ok: true, course: parsed.data };
    },
    [courses]
  );

  const updateCourse = useCallback(
    (existingSlug: string, rawUpdated: CourseTree): CourseUpdateResult => {
      if (!courses.some((c) => c.slug === existingSlug)) {
        return {
          ok: false,
          error: `Course "${existingSlug}" was not found.`,
        };
      }

      const refError = validateRawCourseReferences(rawUpdated);
      if (refError) {
        return { ok: false, error: refError };
      }

      const { course: normalized, idMap } = rekeyCourseContentIdsWithMap(rawUpdated);
      const parsed = CourseTreeSchema.safeParse(normalized);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return {
          ok: false,
          error: `${first.path.join('.') || 'Course'}: ${first.message}`,
        };
      }

      const conflicting = courses.some(
        (c) => c.slug === parsed.data.slug && c.slug !== existingSlug
      );
      if (conflicting) {
        return {
          ok: false,
          error: `Another course already uses slug "${parsed.data.slug}".`,
        };
      }

      setCourses((prev) =>
        prev.map((c) => (c.slug === existingSlug ? parsed.data : c))
      );
      return {
        ok: true,
        course: parsed.data,
        idMap,
        previousSlug: existingSlug,
      };
    },
    [courses]
  );

  const deleteCourse = useCallback((slug: string) => {
    setCourses((prev) => prev.filter((c) => c.slug !== slug));
  }, []);

  const resetCatalogToDefaults = useCallback(() => {
    setCourses(premadeRepository.getAll());
  }, [premadeRepository]);

  const isPremadeCourse = useCallback(
    (slug: string) => premadeRepository.isPremadeSlug(slug),
    [premadeRepository]
  );

  const value = useMemo<CourseContextValue>(
    () => ({
      courses,
      getCourseBySlug,
      getCourse: getCourseBySlug,
      addCourse,
      updateCourse,
      deleteCourse,
      resetCatalogToDefaults,
      resetCatalog: resetCatalogToDefaults,
      isPremadeCourse,
      catalogRecovery,
      dismissCatalogRecovery,
      persistError,
      dismissPersistError,
    }),
    [
      courses,
      getCourseBySlug,
      addCourse,
      updateCourse,
      deleteCourse,
      resetCatalogToDefaults,
      isPremadeCourse,
      catalogRecovery,
      dismissCatalogRecovery,
      persistError,
      dismissPersistError,
    ]
  );

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
}

export function useCourses(): CourseContextValue {
  const ctx = useContext(CourseContext);
  if (!ctx) {
    throw new Error('useCourses must be used within a CourseProvider');
  }
  return ctx;
}
