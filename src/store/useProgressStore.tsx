import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AssessmentScoreRecordSchema,
  PROGRESS_STORAGE_KEY,
  ProgressStateSchema,
  createEmptyProgressState,
  type AssessmentScoreRecord,
  type ProgressState,
} from '@/lib/storage/types';
import {
  createLocalProgressRepository,
  localProgressRepository,
} from '@/lib/storage/localRepositories';
import type { Chapter, CourseTree, LessonStatus } from '@/types/course';

export {
  AssessmentScoreRecordSchema,
  PROGRESS_STORAGE_KEY,
  ProgressStateSchema,
  createEmptyProgressState,
  type AssessmentScoreRecord,
  type ProgressState,
};

const SCORE_KEY_SEPARATOR = '::';

export function getAssessmentScoreKey(itemId: string, resourceTitle: string): string {
  return `${itemId}${SCORE_KEY_SEPARATOR}${resourceTitle}`;
}

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
  getAssessmentScore: (
    courseSlug: string,
    itemId: string,
    resourceTitle: string
  ) => AssessmentScoreRecord | undefined;
  recordAssessmentScore: (
    courseSlug: string,
    itemId: string,
    resourceTitle: string,
    scorePercent: number,
    passed: boolean
  ) => void;
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

  const getAssessmentScore = useCallback(
    (
      courseSlug: string,
      itemId: string,
      resourceTitle: string
    ): AssessmentScoreRecord | undefined =>
      state.assessmentScores?.[courseSlug]?.[getAssessmentScoreKey(itemId, resourceTitle)],
    [state.assessmentScores]
  );

  const recordAssessmentScore = useCallback(
    (
      courseSlug: string,
      itemId: string,
      resourceTitle: string,
      scorePercent: number,
      passed: boolean
    ) => {
      const normalizedScore = Number.isFinite(scorePercent)
        ? Math.max(0, Math.min(100, Math.round(scorePercent)))
        : 0;
      const scoreKey = getAssessmentScoreKey(itemId, resourceTitle);
      const updatedAt = new Date().toISOString();

      setState((prev) => {
        const courseScores = { ...(prev.assessmentScores?.[courseSlug] ?? {}) };
        const existing = courseScores[scoreKey];
        courseScores[scoreKey] = {
          bestScorePercent: existing
            ? Math.max(existing.bestScorePercent, normalizedScore)
            : normalizedScore,
          latestScorePercent: normalizedScore,
          attempts: (existing?.attempts ?? 0) + 1,
          passed: Boolean(existing?.passed || passed),
          updatedAt,
        };

        return {
          ...prev,
          assessmentScores: {
            ...(prev.assessmentScores ?? {}),
            [courseSlug]: courseScores,
          },
        };
      });
    },
    []
  );

  const resetCourseProgress = useCallback((courseSlug: string) => {
    setState((prev) => {
      const nextStatuses = { ...prev.statuses };
      delete nextStatuses[courseSlug];

      let nextAssessmentScores = prev.assessmentScores;
      if (prev.assessmentScores && courseSlug in prev.assessmentScores) {
        const updatedScores = { ...prev.assessmentScores };
        delete updatedScores[courseSlug];
        nextAssessmentScores =
          Object.keys(updatedScores).length > 0 ? updatedScores : undefined;
      }

      const { assessmentScores: _omitScores, ...rest } = prev;
      return {
        ...rest,
        statuses: nextStatuses,
        ...(nextAssessmentScores ? { assessmentScores: nextAssessmentScores } : {}),
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

        let nextAssessmentScores = prev.assessmentScores;
        if (prev.assessmentScores) {
          const updatedScores = { ...prev.assessmentScores };
          const oldCourseScores = prev.assessmentScores[oldSlug];
          if (oldSlug !== newSlug) {
            delete updatedScores[oldSlug];
          }
          if (oldCourseScores) {
            const remappedScores: Record<string, AssessmentScoreRecord> = {};
            for (const [oldKey, record] of Object.entries(oldCourseScores)) {
              const sepIdx = oldKey.indexOf(SCORE_KEY_SEPARATOR);
              if (sepIdx <= 0) continue;
              const oldItemId = oldKey.slice(0, sepIdx);
              const resourceTitle = oldKey.slice(sepIdx + SCORE_KEY_SEPARATOR.length);
              const newItemId = idMap.get(oldItemId);
              if (newItemId) {
                remappedScores[getAssessmentScoreKey(newItemId, resourceTitle)] = record;
              }
            }
            if (Object.keys(remappedScores).length > 0) {
              updatedScores[newSlug] = remappedScores;
            } else {
              delete updatedScores[newSlug];
            }
          }
          nextAssessmentScores =
            Object.keys(updatedScores).length > 0 ? updatedScores : undefined;
        }

        const { assessmentScores: _omitScores, ...rest } = prev;
        return {
          ...rest,
          statuses: nextStatuses,
          bookmarks: nextBookmarks,
          ...(nextAssessmentScores ? { assessmentScores: nextAssessmentScores } : {}),
        };
      });
    },
    []
  );

  const forgetCourse = useCallback((slug: string) => {
    setState((prev) => {
      const nextStatuses = { ...prev.statuses };
      delete nextStatuses[slug];

      let nextAssessmentScores = prev.assessmentScores;
      if (prev.assessmentScores && slug in prev.assessmentScores) {
        const updatedScores = { ...prev.assessmentScores };
        delete updatedScores[slug];
        nextAssessmentScores =
          Object.keys(updatedScores).length > 0 ? updatedScores : undefined;
      }

      const { assessmentScores: _omitScores, ...rest } = prev;
      return {
        ...rest,
        statuses: nextStatuses,
        bookmarks: prev.bookmarks.filter((item) => item !== slug),
        ...(nextAssessmentScores ? { assessmentScores: nextAssessmentScores } : {}),
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
      getAssessmentScore,
      recordAssessmentScore,
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
      getAssessmentScore,
      recordAssessmentScore,
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
