import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CourseTreeSchema, SEMESTER_OPTIONS } from '@/types/course';
import { ProgressStateSchema } from '@/lib/storage/types';
import { rekeyCourseContentIds } from '@/lib/courseIds';
import { getTrackableItems, isStandaloneChapter } from '@/lib/courseItems';
import { RESOURCE_BADGE_STYLES } from '@/lib/theme';
import { EXAMPLE_COURSE_EXPORT } from '@/data/exampleCourseExport';
import { EXAMPLE_PROGRESS_BACKUP } from '@/data/exampleProgressBackup';
import { DataFormatsPage, LLM_AUTHORING_PROMPT } from '@/pages/DataFormatsPage';

describe('EXAMPLE_COURSE_EXPORT', () => {
  it('uses the .course.json envelope with no attachments and passes CourseTreeSchema', () => {
    expect(EXAMPLE_COURSE_EXPORT.format).toBe('college-course-tree');
    expect(EXAMPLE_COURSE_EXPORT.version).toBe(1);
    expect(EXAMPLE_COURSE_EXPORT.exportedAt).toBe('2026-11-21T00:00:00.000Z');
    expect(EXAMPLE_COURSE_EXPORT.attachments).toBeUndefined();

    const parsed = CourseTreeSchema.parse(EXAMPLE_COURSE_EXPORT.course);
    expect(parsed.department).toBe('Preparatory');
    expect(parsed.semester).toBe('Year 1 - First Semester');
    expect(parsed.chapters).toHaveLength(3);

    const standaloneChapters = parsed.chapters.filter(isStandaloneChapter);
    expect(standaloneChapters.length).toBeGreaterThanOrEqual(1);
    const standalone = standaloneChapters[0];
    expect(standalone.notes).toBeTruthy();
    expect(standalone.prerequisites?.length).toBeGreaterThanOrEqual(1);
    expect(standalone.resources?.length).toBeGreaterThanOrEqual(1);

    // Cross-chapter prerequisites: lesson -> chapter and chapter -> lesson
    const ch2Lesson1 = parsed.chapters[1].lessons[0];
    expect(ch2Lesson1.prerequisites).toContain(parsed.chapters[0].id);
    expect(standalone.prerequisites).toContain(parsed.chapters[1].lessons[1].id);

    const serialized = JSON.stringify(EXAMPLE_COURSE_EXPORT);
    expect(serialized).not.toContain('estimatedMinutes');
    expect(serialized).not.toContain('durationMinutes');
  });

  it('already has canonical IDs so rekeyCourseContentIds leaves chapter and lesson IDs unchanged', () => {
    const original = EXAMPLE_COURSE_EXPORT.course;
    const rekeyed = rekeyCourseContentIds(original);

    expect(rekeyed.chapters.map((ch) => ch.id)).toEqual(original.chapters.map((ch) => ch.id));
    expect(rekeyed.chapters.flatMap((ch) => ch.lessons.map((l) => l.id))).toEqual(
      original.chapters.flatMap((ch) => ch.lessons.map((l) => l.id))
    );
    expect(rekeyed).toEqual(original);
  });
});

describe('EXAMPLE_PROGRESS_BACKUP', () => {
  it('passes ProgressStateSchema and references only valid trackable items including standalone chapter', () => {
    const parsed = ProgressStateSchema.parse(EXAMPLE_PROGRESS_BACKUP);
    const course = EXAMPLE_COURSE_EXPORT.course;
    const trackable = getTrackableItems(course);
    const trackableIds = new Set(trackable.map((item) => item.id));
    const standaloneIds = new Set(
      trackable.filter((item) => item.kind === 'chapter').map((item) => item.id)
    );

    expect(parsed.bookmarks).toContain(course.slug);

    const courseStatuses = parsed.statuses[course.slug];
    expect(courseStatuses).toBeDefined();

    const referencedIds = Object.keys(courseStatuses);
    expect(referencedIds.length).toBeGreaterThanOrEqual(3);
    for (const id of referencedIds) {
      expect(trackableIds.has(id)).toBe(true);
    }

    // Must cover both standalone chapter IDs and lesson IDs, plus done/learning/skipped
    expect(referencedIds.some((id) => standaloneIds.has(id))).toBe(true);
    const statusValues = Object.values(courseStatuses);
    expect(statusValues).toContain('done');
    expect(statusValues).toContain('learning');
    expect(statusValues).toContain('skipped');
  });
});

describe('DataFormatsPage', () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
    vi.restoreAllMocks();
  });

  it('renders all sections, semester options, resource kinds, LLM prompt, and working copy buttons', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      createElement(MemoryRouter, null, createElement(DataFormatsPage))
    );

    const backLink = screen.getByRole('link', { name: /← Back to Catalog/i });
    expect(backLink).toHaveAttribute('href', '/');

    expect(screen.getByRole('heading', { name: /1\. Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /2\. Course JSON Format/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /3\. Progress Backup JSON Format/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /4\. Full Valid Examples/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /5\. Prompt for an LLM/i })).toBeInTheDocument();

    for (const semester of SEMESTER_OPTIONS) {
      expect(screen.getAllByText(semester).length).toBeGreaterThanOrEqual(1);
    }

    for (const [kind, style] of Object.entries(RESOURCE_BADGE_STYLES)) {
      expect(screen.getAllByText(kind).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(style.label).length).toBeGreaterThanOrEqual(1);
    }

    expect(LLM_AUTHORING_PROMPT).not.toContain('estimatedMinutes');
    expect(LLM_AUTHORING_PROMPT).not.toContain('durationMinutes');
    expect(screen.getByText(/College Course Trees "\.course\.json" export envelope/i)).toBeInTheDocument();

    const copyCourseBtn = screen.getByRole('button', { name: /Copy Course JSON/i });
    fireEvent.click(copyCourseBtn);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(EXAMPLE_COURSE_EXPORT, null, 2));
    });
    expect(await screen.findByText('Copied!')).toBeInTheDocument();

    const copyProgressBtn = screen.getByRole('button', { name: /Copy Progress JSON/i });
    fireEvent.click(copyProgressBtn);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(EXAMPLE_PROGRESS_BACKUP, null, 2));
    });

    const copyPromptBtn = screen.getByRole('button', { name: /Copy LLM Prompt/i });
    fireEvent.click(copyPromptBtn);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(LLM_AUTHORING_PROMPT);
    });
  });
});
