import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { COURSES } from '@/data/courses';
import { LessonDrawer } from '@/components/LessonDrawer';

describe('LessonDrawer', () => {
  const course = COURSES[0];
  const chapter = course.chapters[0];
  const lesson = chapter.lessons[1]; // Dynamic Arrays (has prerequisite big-o-analysis)

  it('renders lesson details, prerequisites, and color-coded resources', () => {
    render(
      <LessonDrawer
        course={course}
        chapter={chapter}
        lesson={lesson}
        status="todo"
        statuses={{}}
        onChangeStatus={vi.fn()}
        onNavigateLesson={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: lesson.title })).toBeInTheDocument();
    expect(screen.getByText(lesson.summary)).toBeInTheDocument();
    expect(screen.getByText('Lab')).toBeInTheDocument();
    expect(screen.getByText('Slides')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Asymptotic Analysis/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('supports L, D, S, and Escape keyboard shortcuts', () => {
    const onChangeStatus = vi.fn();
    const onClose = vi.fn();

    render(
      <LessonDrawer
        course={course}
        chapter={chapter}
        lesson={lesson}
        status="todo"
        statuses={{}}
        onChangeStatus={onChangeStatus}
        onNavigateLesson={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'l' });
    expect(onChangeStatus).toHaveBeenCalledWith('learning');

    fireEvent.keyDown(window, { key: 'd' });
    expect(onChangeStatus).toHaveBeenCalledWith('done');

    fireEvent.keyDown(window, { key: 's' });
    expect(onChangeStatus).toHaveBeenCalledWith('skipped');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('navigates when clicking a prerequisite chip', () => {
    const onNavigateLesson = vi.fn();
    render(
      <LessonDrawer
        course={course}
        chapter={chapter}
        lesson={lesson}
        status="todo"
        statuses={{}}
        onChangeStatus={vi.fn()}
        onNavigateLesson={onNavigateLesson}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getAllByRole('button', { name: /Asymptotic Analysis/i })[0]);
    expect(onNavigateLesson).toHaveBeenCalledWith('cs201-big-o-analysis');
  });
});
