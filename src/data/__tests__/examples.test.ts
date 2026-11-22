import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CourseTreeSchema } from '@/types/course';
import { ProgressStateSchema } from '@/lib/storage/types';
import { rekeyCourseContentIds } from '@/lib/courseIds';
import { getTrackableItems, isStandaloneChapter } from '@/lib/courseItems';
import { parseAssessmentImport } from '@/lib/assessmentExchange';
import { RESOURCE_BADGE_STYLES } from '@/lib/theme';
import { getAssessmentScoreKey } from '@/store/useProgressStore';
import { EXAMPLE_COURSE_EXPORT } from '@/data/exampleCourseExport';
import { EXAMPLE_PROGRESS_BACKUP } from '@/data/exampleProgressBackup';
import {
  DataFormatsPage,
  EXAMPLE_ASSESSMENT_EXPORT,
  LLM_AUTHORING_PROMPT,
  LLM_EXAM_PROMPT,
} from '@/pages/DataFormatsPage';

describe('EXAMPLE_COURSE_EXPORT', () => {
  it('uses the .course.json envelope with no attachments and passes CourseTreeSchema', () => {
    expect(EXAMPLE_COURSE_EXPORT.format).toBe('college-course-tree');
    expect(EXAMPLE_COURSE_EXPORT.version).toBe(1);
    expect(EXAMPLE_COURSE_EXPORT.exportedAt).toBe('2026-11-21T00:00:00.000Z');
    expect(EXAMPLE_COURSE_EXPORT.attachments).toBeUndefined();

    const parsed = CourseTreeSchema.parse(EXAMPLE_COURSE_EXPORT.course);
    expect(parsed.department).toBe('Preparatory');
    expect(parsed.year).toBe(1);
    expect(parsed.semester).toBe(1);
    expect(parsed.chapters).toHaveLength(3);

    const standaloneChapters = parsed.chapters.filter(isStandaloneChapter);
    expect(standaloneChapters.length).toBeGreaterThanOrEqual(1);
    const standalone = standaloneChapters[0];
    expect(standalone.notes).toBeTruthy();
    expect(standalone.prerequisites?.length).toBeGreaterThanOrEqual(1);
    expect(standalone.resources?.length).toBeGreaterThanOrEqual(1);

    // Showcases recommended pinning and an embedded interactive assessment
    const allResources = parsed.chapters.flatMap((ch) => [
      ...(ch.resources ?? []),
      ...ch.lessons.flatMap((l) => l.resources),
    ]);
    expect(allResources.some((r) => r.recommended === true)).toBe(true);
    expect(allResources.some((r) => Boolean(r.assessment))).toBe(true);

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

describe('EXAMPLE_ASSESSMENT_EXPORT', () => {
  it('passes parseAssessmentImport cleanly with LaTeX and all four question types', async () => {
    const result = await parseAssessmentImport(JSON.stringify(EXAMPLE_ASSESSMENT_EXPORT));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.warnings).toEqual([]);
    expect(result.assessment.mode).toBe('exam');
    const types = new Set(result.assessment.questions.map((q) => q.type));
    expect(types).toEqual(new Set(['mcq', 'multi-select', 'true-false', 'short-answer']));
  });
});

describe('EXAMPLE_PROGRESS_BACKUP', () => {
  it('passes ProgressStateSchema and references valid trackable items and assessmentScores', () => {
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

    // Must cover assessmentScores matching getAssessmentScoreKey
    const expectedScoreKey = getAssessmentScoreKey(
      'stat101-normal-binomial-models',
      'Midterm Practice Exam'
    );
    const courseScores = parsed.assessmentScores?.[course.slug];
    expect(courseScores).toBeDefined();
    expect(courseScores?.[expectedScoreKey]).toBeDefined();
    expect(courseScores?.[expectedScoreKey].bestScorePercent).toBe(90);
    expect(courseScores?.[expectedScoreKey].passed).toBe(true);
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

  it('renders TOC, sections 1-6 without Sparkles icon, exam/LaTeX/assessmentScores docs, and working copy buttons', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(createElement(MemoryRouter, null, createElement(DataFormatsPage)));

    const backLink = screen.getByRole('link', { name: /← Back to Catalog/i });
    expect(backLink).toHaveAttribute('href', '/');

    // Structured TOCs (desktop sidebar + mobile "On this page") and no old pill bar
    expect(screen.queryByRole('navigation', { name: /Page sections/i })).not.toBeInTheDocument();
    const desktopToc = screen.getByRole('navigation', { name: /Table of contents/i });
    const mobileToc = screen.getByRole('navigation', { name: /On this page/i });
    expect(within(desktopToc).getByRole('link', { name: /3\. Interactive Exams/i })).toHaveAttribute(
      'href',
      '#assessment-json'
    );
    expect(within(mobileToc).getByRole('link', { name: /6\. Prompts for an LLM/i })).toHaveAttribute(
      'href',
      '#llm-prompt'
    );

    expect(screen.getByRole('heading', { name: /1\. Overview/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /2\. Course JSON Format/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /3\. Interactive Exams & Assignments JSON/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /4\. Progress Backup JSON Format/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /5\. Full Valid Examples/i })).toBeInTheDocument();

    const promptsHeading = screen.getByRole('heading', { name: /6\. Prompts for an LLM/i });
    expect(promptsHeading).toBeInTheDocument();
    expect(promptsHeading.querySelector('svg')).toBeNull();

    expect(screen.getByText(/year: integer 1\.\.10/i)).toBeInTheDocument();
    expect(
      screen.getByText(/semester: 1 \(1st Semester\) \| 2 \(2nd Semester\)/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/assessmentScores/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/KaTeX LaTeX Math Syntax/i)).toBeInTheDocument();

    for (const [kind, style] of Object.entries(RESOURCE_BADGE_STYLES)) {
      expect(screen.getAllByText(kind).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(style.label).length).toBeGreaterThanOrEqual(1);
    }

    expect(LLM_AUTHORING_PROMPT).not.toContain('estimatedMinutes');
    expect(LLM_AUTHORING_PROMPT).not.toContain('durationMinutes');
    expect(LLM_EXAM_PROMPT).toContain('college-assessment');
    expect(LLM_EXAM_PROMPT).not.toContain('estimatedMinutes');
    expect(
      screen.getByText(/College Course Trees "\.course\.json" export envelope/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copy Course JSON/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(EXAMPLE_COURSE_EXPORT, null, 2));
    });
    expect(await screen.findByText('Copied!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Copy Exam JSON/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(EXAMPLE_ASSESSMENT_EXPORT, null, 2));
    });

    fireEvent.click(screen.getByRole('button', { name: /Copy Progress JSON/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(JSON.stringify(EXAMPLE_PROGRESS_BACKUP, null, 2));
    });

    fireEvent.click(screen.getByRole('button', { name: /Copy LLM Prompt/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(LLM_AUTHORING_PROMPT);
    });

    fireEvent.click(screen.getByRole('button', { name: /Copy Exam Prompt/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(LLM_EXAM_PROMPT);
    });
  });
});
