import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COURSES } from '@/data/courses';
import {
  USER_ROADMAPS_STORAGE_KEY,
  createLocalPremadeRoadmapRepository,
  localProgressRepository,
  localUserRoadmapRepository,
} from '@/lib/storage/localRepositories';

describe('local storage repositories', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('provides read-only boundary for premade roadmaps', () => {
    const repo = createLocalPremadeRoadmapRepository(COURSES);
    expect(repo.getAll()).toHaveLength(COURSES.length);
    expect(repo.getBySlug(COURSES[0].slug)?.code).toBe(COURSES[0].code);
    expect(repo.isPremadeSlug(COURSES[0].slug)).toBe(true);
    expect(repo.isPremadeSlug('user-custom-course')).toBe(false);
  });

  it('persists and clears user roadmaps cleanly', () => {
    expect(localUserRoadmapRepository.loadCourses()).toBeNull();

    localUserRoadmapRepository.saveCourses(COURSES);
    expect(window.localStorage.getItem(USER_ROADMAPS_STORAGE_KEY)).toContain(COURSES[0].slug);
    expect(localUserRoadmapRepository.loadCourses()).toHaveLength(COURSES.length);

    localUserRoadmapRepository.clear();
    expect(localUserRoadmapRepository.loadCourses()).toBeNull();
  });

  it('persists and clears per-user progress cleanly', () => {
    expect(localProgressRepository.loadProgress()).toEqual({
      version: 1,
      statuses: {},
      bookmarks: [],
    });

    localProgressRepository.saveProgress({
      version: 1,
      statuses: { 'cs201-data-structures': { 'cs201-big-o-analysis': 'done' } },
      bookmarks: ['cs201-data-structures'],
    });
    expect(localProgressRepository.loadProgress().bookmarks).toEqual(['cs201-data-structures']);

    localProgressRepository.clearProgress();
    expect(localProgressRepository.loadProgress()).toEqual({
      version: 1,
      statuses: {},
      bookmarks: [],
    });
  });

  it('returns quota failure result when Storage.setItem throws QuotaExceededError', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const courseRes = localUserRoadmapRepository.saveCourses([]);
    expect(courseRes.ok).toBe(false);
    if (!courseRes.ok) {
      expect(courseRes.error).toMatch(/storage|quota/i);
    }

    const progressRes = localProgressRepository.saveProgress({
      version: 1,
      statuses: {},
      bookmarks: [],
    });
    expect(progressRes.ok).toBe(false);
    if (!progressRes.ok) {
      expect(progressRes.error).toMatch(/storage|quota/i);
    }

    spy.mockRestore();
  });
});
