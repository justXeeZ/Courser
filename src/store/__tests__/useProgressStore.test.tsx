import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { COURSES } from '@/data/courses';
import {
  PROGRESS_STORAGE_KEY,
  ProgressProvider,
  computeChapterStats,
  computeCourseStats,
  loadProgressState,
  parseImportedProgressJson,
  useProgress,
} from '@/store/useProgressStore';
import type { Chapter, CourseTree } from '@/types/course';

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
      result.current.toggleBookmark('guide101-quick-start');
      result.current.setLessonStatus('guide101-quick-start', 'guide101-browsing-bookmarks', 'done');
    });

    expect(result.current.isBookmarked('guide101-quick-start')).toBe(true);
    const exported = result.current.exportProgressJson();

    act(() => {
      result.current.resetCourseProgress('guide101-quick-start');
      result.current.toggleBookmark('guide101-quick-start');
    });
    expect(result.current.isBookmarked('guide101-quick-start')).toBe(false);
    expect(result.current.getLessonStatus('guide101-quick-start', 'guide101-browsing-bookmarks')).toBe('todo');

    act(() => {
      const res = result.current.importProgressJson(exported);
      expect(res.ok).toBe(true);
    });
    expect(result.current.isBookmarked('guide101-quick-start')).toBe(true);
    expect(result.current.getLessonStatus('guide101-quick-start', 'guide101-browsing-bookmarks')).toBe('done');
  });

  it('recovers safely from corrupted localStorage and invalid import payloads', () => {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, '{not valid json');
    const recovered = loadProgressState(window.localStorage);
    expect(recovered).toEqual({ version: 1, statuses: {}, bookmarks: [] });

    expect(parseImportedProgressJson('not json').ok).toBe(false);
    expect(parseImportedProgressJson(JSON.stringify({ version: 99 })).ok).toBe(false);
  });

  it('reduces required denominator when items are skipped (e.g. skipping 1 of 4 yields 0/3)', () => {
    const chapter: Chapter = {
      id: 'cs101-ch1-basics',
      order: 1,
      title: '1. Basics',
      description: 'Four lessons',
      lessons: [
        { id: 'cs101-a', title: 'A', summary: 'A', resources: [] },
        { id: 'cs101-b', title: 'B', summary: 'B', resources: [] },
        { id: 'cs101-c', title: 'C', summary: 'C', resources: [] },
        { id: 'cs101-d', title: 'D', summary: 'D', resources: [] },
      ],
    };

    const oneSkipped = computeChapterStats(chapter, { 'cs101-a': 'skipped' });
    expect(oneSkipped).toEqual({
      total: 4,
      required: 3,
      done: 0,
      learning: 0,
      skipped: 1,
      todo: 3,
      percentDone: 0,
    });

    const threeDoneOneSkipped = computeChapterStats(chapter, {
      'cs101-a': 'skipped',
      'cs101-b': 'done',
      'cs101-c': 'done',
      'cs101-d': 'done',
    });
    expect(threeDoneOneSkipped.required).toBe(3);
    expect(threeDoneOneSkipped.done).toBe(3);
    expect(threeDoneOneSkipped.percentDone).toBe(100);

    const allSkipped = computeChapterStats(chapter, {
      'cs101-a': 'skipped',
      'cs101-b': 'skipped',
      'cs101-c': 'skipped',
      'cs101-d': 'skipped',
    });
    expect(allSkipped.required).toBe(0);
    expect(allSkipped.percentDone).toBe(100);
  });

  it('counts standalone chapters as 1 item in chapter and course stats', () => {
    const course: CourseTree = {
      slug: 'cs101-standalone',
      code: 'CS101',
      title: 'Standalone Demo',
      department: 'Preparatory',
      description: 'Tests standalone chapter counting.',
      chapters: [
        {
          id: 'cs101-ch1-project',
          order: 1,
          title: '1. Project',
          description: 'Standalone',
          lessons: [],
        },
        {
          id: 'cs101-ch2-review',
          order: 2,
          title: '2. Review',
          description: 'Standalone',
          lessons: [],
        },
      ],
    };

    expect(computeChapterStats(course.chapters[0], {})).toEqual({
      total: 1,
      required: 1,
      done: 0,
      learning: 0,
      skipped: 0,
      todo: 1,
      percentDone: 0,
    });

    expect(
      computeCourseStats(course, {
        'cs101-ch1-project': 'done',
        'cs101-ch2-review': 'skipped',
      })
    ).toEqual({
      total: 2,
      required: 1,
      done: 1,
      learning: 0,
      skipped: 1,
      todo: 0,
      percentDone: 100,
    });
  });

  it('remaps course progress and bookmarks across slug and ID changes', () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.toggleBookmark('old-course-slug');
      result.current.setLessonStatus('old-course-slug', 'old-ch1', 'done');
      result.current.setLessonStatus('old-course-slug', 'old-l1', 'learning');
      result.current.setLessonStatus('old-course-slug', 'deleted-l2', 'done');
    });

    const idMap = new Map<string, string>([
      ['old-ch1', 'new-ch1'],
      ['old-l1', 'new-l1'],
    ]);

    act(() => {
      result.current.remapCourseProgress('old-course-slug', 'new-course-slug', idMap);
    });

    expect(result.current.isBookmarked('old-course-slug')).toBe(false);
    expect(result.current.isBookmarked('new-course-slug')).toBe(true);
    expect(result.current.getCourseStatuses('old-course-slug')).toEqual({});
    expect(result.current.getCourseStatuses('new-course-slug')).toEqual({
      'new-ch1': 'done',
      'new-l1': 'learning',
    });

    const persisted = loadProgressState(window.localStorage);
    expect(persisted.statuses['old-course-slug']).toBeUndefined();
    expect(persisted.statuses['new-course-slug']).toEqual({
      'new-ch1': 'done',
      'new-l1': 'learning',
    });
    expect(persisted.bookmarks).toEqual(['new-course-slug']);
  });

  it('forgets all statuses and bookmark when a course is deleted', () => {
    const { result } = renderHook(() => useProgress(), { wrapper });

    act(() => {
      result.current.toggleBookmark('course-a');
      result.current.setLessonStatus('course-a', 'coursea-l1', 'done');
      result.current.setLessonStatus('course-b', 'courseb-l1', 'learning');
    });

    act(() => {
      result.current.forgetCourse('course-a');
    });

    expect(result.current.isBookmarked('course-a')).toBe(false);
    expect(result.current.getCourseStatuses('course-a')).toEqual({});
    expect(result.current.getLessonStatus('course-b', 'courseb-l1')).toBe('learning');
  });
});
