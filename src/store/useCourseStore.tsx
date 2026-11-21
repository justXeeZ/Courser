import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { COURSES as DEFAULT_COURSES } from '@/data/courses';
import { rekeyCourseContentIds, rekeyCourseContentIdsWithMap } from '@/lib/courseIds';
import {
  USER_ROADMAPS_STORAGE_KEY,
  createLocalPremadeRoadmapRepository,
  createLocalUserRoadmapRepository,
  localUserRoadmapRepository,
} from '@/lib/storage/localRepositories';
import type { PremadeRoadmapRepository, UserRoadmapRepository } from '@/lib/storage/types';
import { CourseTreeSchema, type CourseTree } from '@/types/course';

export const COURSES_STORAGE_KEY = USER_ROADMAPS_STORAGE_KEY;
export const LEGACY_COURSES_STORAGE_KEY = 'college_course_trees_catalog_v1';
export const LEGACY_SEED_SLUGS: ReadonlySet<string> = new Set([
  'cs201-data-structures',
  'cs301-operating-systems',
]);

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

function migrateLegacyV1Catalog(
  rawV1: string,
  premadeRepo: PremadeRoadmapRepository
): CourseTree[] | null {
  try {
    const parsedJson: unknown = JSON.parse(rawV1);
    const rawCourses: unknown[] | null = Array.isArray(parsedJson)
      ? parsedJson
      : parsedJson &&
          typeof parsedJson === 'object' &&
          Array.isArray((parsedJson as { courses?: unknown }).courses)
        ? (parsedJson as { courses: unknown[] }).courses
        : null;

    if (!rawCourses) {
      return null;
    }

    const premadeCourses = premadeRepo.getAll();
    const seenSlugs = new Set<string>(premadeCourses.map((course) => course.slug));
    const userCourses: CourseTree[] = [];

    for (const entry of rawCourses) {
      const parsedEntry = CourseTreeSchema.safeParse(entry);
      if (!parsedEntry.success) continue;
      const course = parsedEntry.data;
      if (LEGACY_SEED_SLUGS.has(course.slug)) continue;
      if (seenSlugs.has(course.slug)) continue;
      seenSlugs.add(course.slug);
      userCourses.push(course);
    }

    return [...premadeCourses, ...userCourses];
  } catch {
    return null;
  }
}

export function loadCoursesCatalog(
  storage?: CatalogReadStorage | null,
  premadeRepo: PremadeRoadmapRepository = defaultPremadeRoadmapRepository
): CourseTree[] {
  const effectiveStorage: CatalogReadStorage | null =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  if (!effectiveStorage) {
    return premadeRepo.getAll();
  }

  const userRepo: UserRoadmapRepository =
    storage === undefined ? localUserRoadmapRepository : createUserRepoForStorage(effectiveStorage);

  try {
    const rawV2 = effectiveStorage.getItem(COURSES_STORAGE_KEY);
    if (rawV2 !== null) {
      const v2Courses = userRepo.loadCourses();
      return v2Courses ?? premadeRepo.getAll();
    }

    const rawV1 = effectiveStorage.getItem(LEGACY_COURSES_STORAGE_KEY);
    if (rawV1 !== null) {
      const migrated = migrateLegacyV1Catalog(rawV1, premadeRepo);
      if (migrated) {
        userRepo.saveCourses(migrated);
        return migrated;
      }
      return premadeRepo.getAll();
    }

    return premadeRepo.getAll();
  } catch {
    return premadeRepo.getAll();
  }
}

export function saveCoursesCatalog(
  courses: CourseTree[],
  storage?: CatalogWriteStorage | null
): void {
  if (storage === null) return;
  const effectiveStorage: CatalogWriteStorage | null =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.localStorage
        : null;

  if (!effectiveStorage) return;

  const userRepo: UserRoadmapRepository =
    storage === undefined
      ? localUserRoadmapRepository
      : createLocalUserRoadmapRepository(COURSES_STORAGE_KEY, {
          getItem: effectiveStorage.getItem ? effectiveStorage.getItem.bind(effectiveStorage) : () => null,
          setItem: effectiveStorage.setItem.bind(effectiveStorage),
          removeItem: effectiveStorage.removeItem ? effectiveStorage.removeItem.bind(effectiveStorage) : () => {},
        });

  userRepo.saveCourses(courses);
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
  const [courses, setCourses] = useState<CourseTree[]>(() => {
    if (userRepository) {
      return userRepository.loadCourses() ?? premadeRepository.getAll();
    }
    return loadCoursesCatalog(undefined, premadeRepository);
  });

  useEffect(() => {
    if (userRepository) {
      userRepository.saveCourses(courses);
    } else {
      saveCoursesCatalog(courses);
    }
  }, [courses, userRepository]);

  const getCourseBySlug = useCallback(
    (slug: string) => courses.find((c) => c.slug === slug),
    [courses]
  );

  const addCourse = useCallback(
    (rawCourse: CourseTree): CourseMutationResult => {
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
    }),
    [
      courses,
      getCourseBySlug,
      addCourse,
      updateCourse,
      deleteCourse,
      resetCatalogToDefaults,
      isPremadeCourse,
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
