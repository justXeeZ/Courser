import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { COURSES } from '@/data/courses';
import { ChapterDrawer } from '@/components/ChapterDrawer';
import type { CourseTree } from '@/types/course';

describe('ChapterDrawer', () => {
  const demoCourse = COURSES[1]; // DEMO201
  const ch1 = demoCourse.chapters[0]; // 4 lessons
  const standaloneCh3 = demoCourse.chapters[2]; // 0 lessons (standalone)

  it('renders chapter details, 0/3 progress fraction after skipping 1 of 4 lessons, materials/notes tabs, and sub-lessons list', () => {
    const onSelectItem = vi.fn();
    const skippedLessonId = ch1.lessons[0].id;

    render(
      <ChapterDrawer
        course={demoCourse}
        chapter={ch1}
        status="todo"
        statuses={{ [skippedLessonId]: 'skipped' }}
        onChangeStatus={vi.fn()}
        onSelectItem={onSelectItem}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: ch1.title })).toBeInTheDocument();
    expect(screen.getByText('Ch 1')).toBeInTheDocument();
    expect(screen.getByText('Weeks 1–3')).toBeInTheDocument();
    expect(screen.getByText(ch1.description)).toBeInTheDocument();
    expect(screen.getByText('0/3')).toBeInTheDocument();
    expect(screen.getByText('1 skipped')).toBeInTheDocument();

    // Does not show status segmented control for non-standalone chapter
    expect(screen.queryByRole('button', { name: /^Learning$/i })).not.toBeInTheDocument();

    // Materials tab shows chapter-level materials
    expect(screen.getByText('MIT OCW Algorithms Course Homepage')).toBeInTheDocument();

    // Notes tab displays chapter notes
    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    expect(screen.getByText(ch1.notes!)).toBeInTheDocument();

    // Sub-lessons list stays clickable
    fireEvent.click(screen.getByRole('button', { name: new RegExp(ch1.lessons[1].title, 'i') }));
    expect(onSelectItem).toHaveBeenCalledWith(ch1.lessons[1].id);
  });

  it('renders status controls, prerequisites, and supports L/D/S/Arrow/Esc shortcuts for standalone chapters', () => {
    const onChangeStatus = vi.fn();
    const onSelectItem = vi.fn();
    const onClose = vi.fn();

    render(
      <ChapterDrawer
        course={demoCourse}
        chapter={standaloneCh3}
        status="todo"
        statuses={{}}
        onChangeStatus={onChangeStatus}
        onSelectItem={onSelectItem}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Standalone')).toBeInTheDocument();
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
    expect(onSelectItem).toHaveBeenCalledWith('demo201-midterm-practice-synthesis');

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

  it('renders a skipped standalone chapter prerequisite chip in slate gray with Ban icon only (not emerald Done)', () => {
    const customCourse: CourseTree = {
      slug: 'test102-prereqs',
      code: 'TEST102',
      title: 'Prereq Display Course',
      department: 'Preparatory',
      description: 'Test course',
      chapters: [
        {
          id: 'test102-ch1-standalone-prereq',
          order: 1,
          title: '1. Optional Warmup',
          description: 'Standalone warmup chapter',
          lessons: [],
        },
        {
          id: 'test102-ch2-target',
          order: 2,
          title: '2. Main Module',
          description: 'Depends on skipped standalone chapter',
          prerequisites: ['test102-ch1-standalone-prereq'],
          lessons: [],
        },
      ],
    };

    render(
      <ChapterDrawer
        course={customCourse}
        chapter={customCourse.chapters[1]}
        status="todo"
        statuses={{ 'test102-ch1-standalone-prereq': 'skipped' }}
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
});
