import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { COURSES } from '@/data/courses';
import { ChapterDrawer } from '@/components/ChapterDrawer';
import { ProgressProvider, saveProgressState } from '@/store/useProgressStore';
import type { CourseTree } from '@/types/course';

describe('ChapterDrawer', () => {
  const demoCourse = COURSES[1]; // DEMO201
  const ch1 = demoCourse.chapters[0]; // 4 lessons
  const leafCh3 = demoCourse.chapters[2]; // 0 lessons (leaf milestone chapter)

  it('renders chapter details, 0/3 progress fraction after skipping 1 of 4 lessons, materials/notes tabs, and sub-lessons list with independent checkmark toggle', () => {
    const onSelectItem = vi.fn();
    const onToggleLessonDone = vi.fn();
    const skippedLessonId = ch1.lessons[0].id;

    render(
      <ChapterDrawer
        course={demoCourse}
        chapter={ch1}
        status="todo"
        statuses={{ [skippedLessonId]: 'skipped' }}
        onChangeStatus={vi.fn()}
        onSelectItem={onSelectItem}
        onToggleLessonDone={onToggleLessonDone}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: ch1.title })).toBeInTheDocument();
    expect(screen.getByText('Ch 1')).toBeInTheDocument();
    expect(screen.getByText('Weeks 1–3')).toBeInTheDocument();
    expect(screen.getByText(ch1.description)).toBeInTheDocument();
    expect(screen.getByText('0/3')).toBeInTheDocument();
    expect(screen.getByText('1 skipped')).toBeInTheDocument();

    // Does not show status segmented control for multi-lesson chapter
    expect(screen.queryByRole('button', { name: /^Learning$/i })).not.toBeInTheDocument();

    // Materials tab shows chapter-level materials
    expect(screen.getByText('MIT OCW Algorithms Course Homepage')).toBeInTheDocument();

    // Notes tab displays chapter notes
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    expect(screen.getByText(ch1.notes!)).toBeInTheDocument();

    // Switch back to Overview tab to test sub-lessons list
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));

    // Clicking the small checkmark button beside a sublesson toggles done without navigating
    const toggleLessonBtn = screen.getByRole('button', {
      name: new RegExp(`Toggle done for ${ch1.lessons[1].title}`, 'i'),
    });
    fireEvent.click(toggleLessonBtn);
    expect(onToggleLessonDone).toHaveBeenCalledWith(ch1.lessons[1].id);
    expect(onSelectItem).not.toHaveBeenCalled();

    // Clicking the sublesson entry navigates to the lesson
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(`^${ch1.lessons[1].title}`, 'i') })
    );
    expect(onSelectItem).toHaveBeenCalledWith(ch1.lessons[1].id);
  });

  it('renders status controls, prerequisites, and supports L/D/S/Arrow/Esc shortcuts for leaf chapters', () => {
    const onChangeStatus = vi.fn();
    const onSelectItem = vi.fn();
    const onClose = vi.fn();

    render(
      <ChapterDrawer
        course={demoCourse}
        chapter={leafCh3}
        status="todo"
        statuses={{}}
        onChangeStatus={onChangeStatus}
        onSelectItem={onSelectItem}
        onClose={onClose}
      />
    );

    expect(screen.getByText('0/1')).toBeInTheDocument();

    // Prerequisite chips resolve both chapters and lessons
    fireEvent.click(
      screen.getByRole('button', { name: /2\. Six-Lesson Deep Dive/i })
    );
    expect(onSelectItem).toHaveBeenCalledWith('demo201-ch2-six-lesson-deep-dive');

    // Keyboard shortcuts L, D, S
    fireEvent.keyDown(window, { key: 'l' });
    expect(onChangeStatus).toHaveBeenCalledWith('learning');

    fireEvent.keyDown(window, { key: 'd' });
    expect(onChangeStatus).toHaveBeenCalledWith('done');

    fireEvent.keyDown(window, { key: 's' });
    expect(onChangeStatus).toHaveBeenCalledWith('skipped');

    // ArrowLeft / ArrowRight follow trackable items order
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onSelectItem).toHaveBeenCalledWith('demo201-ch2-l6-midterm-practice-synthesis');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onSelectItem).toHaveBeenCalledWith('demo201-ch4-final-exam-course-retrospective');

    // Ignore L/D/S when inside an input element
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    onChangeStatus.mockClear();
    fireEvent.keyDown(input, { key: 'd' });
    expect(onChangeStatus).not.toHaveBeenCalled();
    input.remove();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders a skipped leaf chapter prerequisite chip in slate gray with Ban icon only (not emerald Done)', () => {
    const customCourse: CourseTree = {
      slug: 'test102-prereqs',
      code: 'TEST102',
      title: 'Prereq Display Course',
      department: 'Preparatory',
      description: 'Test course',
      chapters: [
        {
          id: 'test102-ch1-leaf-prereq',
          order: 1,
          title: '1. Optional Warmup',
          description: 'Warmup milestone chapter',
          lessons: [],
        },
        {
          id: 'test102-ch2-target',
          order: 2,
          title: '2. Main Module',
          description: 'Depends on skipped leaf chapter',
          prerequisites: ['test102-ch1-leaf-prereq'],
          lessons: [],
        },
      ],
    };

    render(
      <ChapterDrawer
        course={customCourse}
        chapter={customCourse.chapters[1]}
        status="todo"
        statuses={{ 'test102-ch1-leaf-prereq': 'skipped' }}
        onChangeStatus={vi.fn()}
        onSelectItem={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const prereqHeading = screen.getByText(/Recommended Prerequisites/i);
    const prereqSection = prereqHeading.parentElement!;
    const prereqChip = within(prereqSection).getByRole('button', {
      name: /1\. Optional Warmup/i,
    });
    expect(prereqChip).toHaveClass('border-slate-300', 'bg-slate-100', 'text-slate-700');
    expect(prereqChip).not.toHaveClass('border-emerald-300', 'bg-emerald-50');
    expect(prereqChip.querySelectorAll('svg')).toHaveLength(1);
    expect(prereqChip.querySelector('svg')).toHaveClass('lucide-ban');
  });

  it('hides Chapter Materials on multi-lesson chapters with empty resources, hides Notes tab when notes are empty, and suppresses redundant Part/Chapter weekRange tags', () => {
    const multiLessonNoResCourse: CourseTree = {
      slug: 'test104-empty-mat',
      code: 'TEST104',
      title: 'Empty Chapter Materials',
      department: 'Preparatory',
      description: 'Test course',
      chapters: [
        {
          id: 'test104-ch1-multi',
          order: 1,
          title: '1. Multi-Lesson Chapter',
          description: 'Has sub-lessons, no chapter materials, no notes, redundant Part 1 tag',
          weekRange: 'Part 1',
          lessons: [
            {
              id: 'test104-ch1-l1-lesson-1',
              title: 'Lesson 1',
              summary: 'Sub lesson',
              resources: [],
            },
          ],
        },
        {
          id: 'test104-ch2-leaf',
          order: 2,
          title: '2. Leaf Milestone Chapter',
          description: 'No sub-lessons, no chapter materials',
          lessons: [],
        },
      ],
    };

    const { rerender } = render(
      <ChapterDrawer
        course={multiLessonNoResCourse}
        chapter={multiLessonNoResCourse.chapters[0]}
        status="todo"
        statuses={{}}
        onChangeStatus={vi.fn()}
        onSelectItem={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Notes' })).not.toBeInTheDocument();
    expect(screen.queryByText('Part 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Chapter Materials')).not.toBeInTheDocument();
    expect(screen.queryByText('No materials attached to this chapter yet.')).not.toBeInTheDocument();

    rerender(
      <ChapterDrawer
        course={multiLessonNoResCourse}
        chapter={multiLessonNoResCourse.chapters[1]}
        status="todo"
        statuses={{}}
        onChangeStatus={vi.fn()}
        onSelectItem={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('tab', { name: 'Materials' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Notes' })).not.toBeInTheDocument();
    expect(screen.getByText('Chapter Materials')).toBeInTheDocument();
    expect(screen.getByText('No materials attached to this chapter yet.')).toBeInTheDocument();
  });

  it('forwards onOpenMaterialViewer and onOpenAssessment and displays Best score when wrapped in ProgressProvider', () => {
    localStorage.clear();
    const onOpenMaterialViewer = vi.fn();
    const onOpenAssessment = vi.fn();

    const customCourse: CourseTree = {
      slug: 'test105-callbacks',
      code: 'TEST105',
      title: 'Callback Course',
      department: 'Preparatory',
      description: 'Test',
      chapters: [
        {
          id: 'test105-ch1-leaf',
          order: 1,
          title: '1. Milestone Exam',
          description: 'Desc',
          lessons: [],
          resources: [
            {
              title: 'Youtube Walkthrough',
              kind: 'video',
              url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            },
            {
              title: 'Chapter Quiz',
              kind: 'exam',
              assessment: {
                mode: 'exam',
                questions: [
                  {
                    id: 'q1',
                    type: 'true-false',
                    header: { text: '1+1=2?' },
                    options: ['True', 'False'],
                    correctIndices: [0],
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    saveProgressState({
      version: 1,
      statuses: {},
      bookmarks: [],
      assessmentScores: {
        'test105-callbacks': {
          'test105-ch1-leaf::Chapter Quiz': {
            bestScorePercent: 95,
            latestScorePercent: 95,
            attempts: 1,
            passed: true,
            updatedAt: '2026-11-22T00:00:00.000Z',
          },
        },
      },
    });

    render(
      <ProgressProvider>
        <ChapterDrawer
          course={customCourse}
          chapter={customCourse.chapters[0]}
          status="todo"
          statuses={{}}
          onChangeStatus={vi.fn()}
          onSelectItem={vi.fn()}
          onOpenMaterialViewer={onOpenMaterialViewer}
          onOpenAssessment={onOpenAssessment}
          onClose={vi.fn()}
        />
      </ProgressProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Youtube Walkthrough/i }));
    expect(onOpenMaterialViewer).toHaveBeenCalledTimes(1);

    const quizBtn = screen.getByRole('button', { name: /Chapter Quiz/i });
    expect(within(quizBtn).getByText('Best: 95%')).toBeInTheDocument();
    fireEvent.click(quizBtn);
    expect(onOpenAssessment).toHaveBeenCalledTimes(1);
  });
});
