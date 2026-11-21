import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { z } from 'zod';
import { LessonStatusSchema, type Chapter, type CourseTree, type LessonStatus } from '@/types/course';

export const PROGRESS_STORAGE_KEY = 'college_course_trees_progress_v1';

export const ProgressStateSchema = z.object({
  version: z.literal(1),
  statuses: z.record(z.string(), z.record(z.string(), LessonStatusSchema)),
  bookmarks: z.array(z.string()),
});

export type ProgressState = z.infer<typeof ProgressStateSchema>;

export interface ProgressStats {
  total: number;
  done: number;
  learning: number;
  skipped: number;
  todo: number;
  percentDone: number;
}

export function createEmptyProgressState(): ProgressState {
  return {
    version: 1,
    statuses: {},
    bookmarks: [],
  };
}

export function loadProgressState(storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): ProgressState {
  if (!storage) return createEmptyProgressState();
  try {
    const raw = storage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return createEmptyProgressState();
    const parsed = ProgressStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : createEmptyProgressState();
  } catch {
    return createEmptyProgressState();
  }
}

export function saveProgressState(
  state: ProgressState,
  storage: Pick<Storage, 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null
): void {
  if (!storage) return;
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota / private-browsing errors gracefully
  }
}

export function parseImportedProgressJson(raw: string): { ok: true; state: ProgressState } | { ok: false; error: string } {
  try {
    const parsedJson = JSON.parse(raw);
    const parsed = ProgressStateSchema.safeParse(parsedJson);
    if (!parsed.success) {
      return { ok: false, error: 'Invalid progress backup format.' };
    }
    return { ok: true, state: parsed.data };
  } catch {
    return { ok: false, error: 'Could not parse JSON file.' };
  }
}

export function computeChapterStats(
  chapter: Chapter,
  courseStatuses: Record<string, LessonStatus> = {}
): ProgressStats {
  const total = chapter.lessons.length;
  let done = 0;
  let learning = 0;
  let skipped = 0;

  for (const lesson of chapter.lessons) {
    const status = courseStatuses[lesson.id] ?? 'todo';
    if (status === 'done') done += 1;
    else if (status === 'learning') learning += 1;
    else if (status === 'skipped') skipped += 1;
  }

  const todo = total - done - learning - skipped;
  const activeDenominator = Math.max(0, total - skipped);
  const percentDone =
    activeDenominator === 0
      ? total > 0 && skipped === total
        ? 100
        : 0
      : Math.round((done / activeDenominator) * 100);

  return { total, done, learning, skipped, todo, percentDone };
}

export function computeCourseStats(
  course: CourseTree,
  courseStatuses: Record<string, LessonStatus> = {}
): ProgressStats {
  let total = 0;
  let done = 0;
  let learning = 0;
  let skipped = 0;

  for (const chapter of course.chapters) {
    const stats = computeChapterStats(chapter, courseStatuses);
    total += stats.total;
    done += stats.done;
    learning += stats.learning;
    skipped += stats.skipped;
  }

  const todo = total - done - learning - skipped;
  const activeDenominator = Math.max(0, total - skipped);
  const percentDone =
    activeDenominator === 0
      ? total > 0 && skipped === total
        ? 100
        : 0
      : Math.round((done / activeDenominator) * 100);

  return { total, done, learning, skipped, todo, percentDone };
}

interface ProgressContextValue {
  state: ProgressState;
  getCourseStatuses: (courseSlug: string) => Record<string, LessonStatus>;
  getLessonStatus: (courseSlug: string, lessonId: string) => LessonStatus;
  setLessonStatus: (courseSlug: string, lessonId: string, status: LessonStatus) => void;
  toggleDone: (courseSlug: string, lessonId: string) => void;
  isBookmarked: (courseSlug: string) => boolean;
  toggleBookmark: (courseSlug: string) => void;
  resetCourseProgress: (courseSlug: string) => void;
  exportProgressJson: () => string;
  importProgressJson: (raw: string) => { ok: true } | { ok: false; error: string };
  getCourseStats: (course: CourseTree) => ProgressStats;
  getChapterStats: (courseSlug: string, chapter: Chapter) => ProgressStats;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(() => loadProgressState());

  useEffect(() => {
    saveProgressState(state);
  }, [state]);

  const getCourseStatuses = useCallback(
    (courseSlug: string) => state.statuses[courseSlug] ?? {},
    [state.statuses]
  );

  const getLessonStatus = useCallback(
    (courseSlug: string, lessonId: string): LessonStatus =>
      state.statuses[courseSlug]?.[lessonId] ?? 'todo',
    [state.statuses]
  );

  const setLessonStatus = useCallback(
    (courseSlug: string, lessonId: string, status: LessonStatus) => {
      setState((prev) => {
        const courseMap = { ...(prev.statuses[courseSlug] ?? {}) };
        if (status === 'todo') {
          delete courseMap[lessonId];
        } else {
          courseMap[lessonId] = status;
        }
        return {
          ...prev,
          statuses: {
            ...prev.statuses,
            [courseSlug]: courseMap,
          },
        };
      });
    },
    []
  );

  const toggleDone = useCallback((courseSlug: string, lessonId: string) => {
    setState((prev) => {
      const courseMap = { ...(prev.statuses[courseSlug] ?? {}) };
      if (courseMap[lessonId] === 'done') {
        delete courseMap[lessonId];
      } else {
        courseMap[lessonId] = 'done';
      }
      return {
        ...prev,
        statuses: {
          ...prev.statuses,
          [courseSlug]: courseMap,
        },
      };
    });
  }, []);

  const isBookmarked = useCallback(
    (courseSlug: string) => state.bookmarks.includes(courseSlug),
    [state.bookmarks]
  );

  const toggleBookmark = useCallback((courseSlug: string) => {
    setState((prev) => {
      const exists = prev.bookmarks.includes(courseSlug);
      return {
        ...prev,
        bookmarks: exists
          ? prev.bookmarks.filter((slug) => slug !== courseSlug)
          : [...prev.bookmarks, courseSlug],
      };
    });
  }, []);

  const resetCourseProgress = useCallback((courseSlug: string) => {
    setState((prev) => {
      const nextStatuses = { ...prev.statuses };
      delete nextStatuses[courseSlug];
      return {
        ...prev,
        statuses: nextStatuses,
      };
    });
  }, []);

  const exportProgressJson = useCallback(() => JSON.stringify(state, null, 2), [state]);

  const importProgressJson = useCallback((raw: string) => {
    const result = parseImportedProgressJson(raw);
    if (!result.ok) {
      return result;
    }
    setState(result.state);
    return { ok: true as const };
  }, []);

  const getCourseStats = useCallback(
    (course: CourseTree) => computeCourseStats(course, state.statuses[course.slug]),
    [state.statuses]
  );

  const getChapterStats = useCallback(
    (courseSlug: string, chapter: Chapter) =>
      computeChapterStats(chapter, state.statuses[courseSlug]),
    [state.statuses]
  );

  const value = useMemo<ProgressContextValue>(
    () => ({
      state,
      getCourseStatuses,
      getLessonStatus,
      setLessonStatus,
      toggleDone,
      isBookmarked,
      toggleBookmark,
      resetCourseProgress,
      exportProgressJson,
      importProgressJson,
      getCourseStats,
      getChapterStats,
    }),
    [
      state,
      getCourseStatuses,
      getLessonStatus,
      setLessonStatus,
      toggleDone,
      isBookmarked,
      toggleBookmark,
      resetCourseProgress,
      exportProgressJson,
      importProgressJson,
      getCourseStats,
      getChapterStats,
    ]
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return ctx;
}
