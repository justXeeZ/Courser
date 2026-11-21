import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { COURSES } from '@/data/courses';
import {
  PROGRESS_STORAGE_KEY,
  ProgressProvider,
  computeCourseStats,
  loadProgressState,
  parseImportedProgressJson,
  useProgress,
} from '@/store/useProgressStore';

const wrapper = ({ children }: { children: ReactNode }) => (
  <ProgressProvider>{children}</ProgressProvider>
);

describe('useProgressStore', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('tracks lesson statuses, toggleDone, and persists to localStorage', () => {
    const course = COURSES[0];
    const firstLesson = course.chapters[0].lessons[0].id;
    const secondLesson = course.chapters[0].lessons[1].id;

    const { result } = renderHook(() => useProgress(), { wrapper });

    expect(result.current.getLessonStatus(course.slug, firstLesson)).toBe('todo');

    act(() => {
      result.current.setLessonStatus(course.slug, firstLesson, 'learning');
      result.current.toggleDone(course.slug, secondLesson);
    });

    expect(result.current.getLessonStatus(course.slug, firstLesson)).toBe('learning');
    expect(result.current.getLessonStatus(course.slug, secondLesson)).toBe('done');

    const stats = result.current.getCourseStats(course);
    expect(stats.learning).toBe(1);
    expect(stats.done).toBe(1);
    expect(stats.percentDone).toBeGreaterThan(0);

    // Reload from localStorage
    const reloaded = loadProgressState(window.localStorage);
    expect(reloaded.statuses[course.slug][firstLesson]).toBe('learning');
    expect(reloaded.statuses[course.slug][secondLesson]).toBe('done');

    // Toggle done back off
    act(() => {
      result.current.toggleDone(course.slug, secondLesson);
    });
    expect(result.current.getLessonStatus(course.slug, secondLesson)).toBe('todo');
  });

  it('toggles bookmarks and round-trips export/import JSON', () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.toggleBookmark('cs201-data-structures');
      result.current.setLessonStatus('cs201-data-structures', 'cs201-big-o-analysis', 'done');
    });

    expect(result.current.isBookmarked('cs201-data-structures')).toBe(true);
    const exported = result.current.exportProgressJson();

    act(() => {
      result.current.resetCourseProgress('cs201-data-structures');
      result.current.toggleBookmark('cs201-data-structures');
    });
    expect(result.current.isBookmarked('cs201-data-structures')).toBe(false);
    expect(result.current.getLessonStatus('cs201-data-structures', 'cs201-big-o-analysis')).toBe('todo');

    act(() => {
      const res = result.current.importProgressJson(exported);
      expect(res.ok).toBe(true);
    });
    expect(result.current.isBookmarked('cs201-data-structures')).toBe(true);
    expect(result.current.getLessonStatus('cs201-data-structures', 'cs201-big-o-analysis')).toBe('done');
  });

  it('recovers safely from corrupted localStorage and invalid import payloads', () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, '{not valid json');
    const recovered = loadProgressState(window.localStorage);
    expect(recovered).toEqual({ version: 1, statuses: {}, bookmarks: [] });

    expect(parseImportedProgressJson('not json').ok).toBe(false);
    expect(parseImportedProgressJson(JSON.stringify({ version: 99 })).ok).toBe(false);
  });

  it('computes accurate percentage excluding skipped lessons from active denominator', () => {
    const course = COURSES[0];
    const allIds = course.chapters.flatMap((c) => c.lessons.map((l) => l.id));
    const statuses: Record<string, 'done' | 'skipped'> = {};
    allIds.forEach((id, idx) => {
      statuses[id] = idx === 0 ? 'skipped' : 'done';
    });
    const stats = computeCourseStats(course, statuses);
    expect(stats.skipped).toBe(1);
    expect(stats.done).toBe(allIds.length - 1);
    expect(stats.percentDone).toBe(100);
  });
});
