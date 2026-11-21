import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  PROGRESS_STORAGE_KEY,
  ProgressStateSchema,
  createEmptyProgressState,
  type ProgressState,
} from '@/lib/storage/types';
import {
  createLocalProgressRepository,
  localProgressRepository,
} from '@/lib/storage/localRepositories';
import type { Chapter, CourseTree, LessonStatus } from '@/types/course';

export {
  PROGRESS_STORAGE_KEY,
  ProgressStateSchema,
  createEmptyProgressState,
  type ProgressState,
};

export interface ProgressStats {
  total: number;
  required: number;
  done: number;
  learning: number;
  skipped: number;
  todo: number;
  percentDone: number;
}

export function loadProgressState(
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): ProgressState {
  if (storage !== undefined) {
    return createLocalProgressRepository(storage).loadProgress();
  }
  return localProgressRepository.loadProgress();
}

export function saveProgressState(
  state: ProgressState,
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null
): void {
  if (storage !== undefined) {
    createLocalProgressRepository(storage).saveProgress(state);
    return;
  }
  localProgressRepository.saveProgress(state);
}

export function parseImportedProgressJson(
  raw: string
): { ok: true; state: ProgressState } | { ok: false; error: string } {
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
  if (chapter.lessons.length === 0) {
    const status = courseStatuses[chapter.id] ?? 'todo';
    const done = status === 'done' ? 1 : 0;
    const learning = status === 'learning' ? 1 : 0;
    const skipped = status === 'skipped' ? 1 : 0;
    const todo = status === 'todo' ? 1 : 0;
    const total = 1;
    const required = total - skipped;
    const percentDone = required === 0 ? 100 : Math.round((done / required) * 100);

    return { total, required, done, learning, skipped, todo, percentDone };
  }

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
  const required = Math.max(0, total - skipped);
  const percentDone =
    required === 0 ? (total > 0 ? 100 : 0) : Math.round((done / required) * 100);

  return { total, required, done, learning, skipped, todo, percentDone };
}

export function computeCourseStats(
  course: CourseTree,
  courseStatuses: Record<string, LessonStatus> = {}
): ProgressStats {
  let total = 0;
  let required = 0;
  let done = 0;
  let learning = 0;
  let skipped = 0;
  let todo = 0;

  for (const chapter of course.chapters) {
    const stats = computeChapterStats(chapter, courseStatuses);
    total += stats.total;
    required += stats.required;
    done += stats.done;
    learning += stats.learning;
    skipped += stats.skipped;
    todo += stats.todo;
  }

  const percentDone =
    required === 0 ? (total > 0 ? 100 : 0) : Math.round((done / required) * 100);

  return { total, required, done, learning, skipped, todo, percentDone };
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
  remapCourseProgress: (oldSlug: string, newSlug: string, idMap: Map<string, string>) => void;
  forgetCourse: (slug: string) => void;
  exportProgressJson: () => string;
  importProgressJson: (raw: string) => { ok: true } | { ok: false; error: string };
  getCourseStats: (course: CourseTree) => ProgressStats;
  getChapterStats: (courseSlug: string, chapter: Chapter) => ProgressStats;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProgressState>(() => localProgressRepository.loadProgress());

  useEffect(() => {
    localProgressRepository.saveProgress(state);
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

  const remapCourseProgress = useCallback(
    (oldSlug: string, newSlug: string, idMap: Map<string, string>) => {
      setState((prev) => {
        const nextStatuses = { ...prev.statuses };
        const oldCourseMap = prev.statuses[oldSlug];

        if (oldSlug !== newSlug) {
          delete nextStatuses[oldSlug];
        }

        if (oldCourseMap) {
          const remappedCourseMap: Record<string, LessonStatus> = {};
          for (const [oldItemId, status] of Object.entries(oldCourseMap)) {
            const newItemId = idMap.get(oldItemId);
            if (newItemId) {
              remappedCourseMap[newItemId] = status;
            }
          }
          if (Object.keys(remappedCourseMap).length > 0) {
            nextStatuses[newSlug] = remappedCourseMap;
          } else {
            delete nextStatuses[newSlug];
          }
        }

        const nextBookmarks =
          oldSlug === newSlug
            ? prev.bookmarks
            : Array.from(
                new Set(prev.bookmarks.map((slug) => (slug === oldSlug ? newSlug : slug)))
              );

        return {
          ...prev,
          statuses: nextStatuses,
          bookmarks: nextBookmarks,
        };
      });
    },
    []
  );

  const forgetCourse = useCallback((slug: string) => {
    setState((prev) => {
      const nextStatuses = { ...prev.statuses };
      delete nextStatuses[slug];
      return {
        ...prev,
        statuses: nextStatuses,
        bookmarks: prev.bookmarks.filter((item) => item !== slug),
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
      remapCourseProgress,
      forgetCourse,
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
      remapCourseProgress,
      forgetCourse,
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
