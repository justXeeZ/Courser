import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { COURSES } from '@/data/courses';
import { ChecklistView } from '@/components/ChecklistView';

describe('ChecklistView', () => {
  const demoCourse = COURSES[1]; // DEMO201: Ch1 has 4 lessons, Ch3 & Ch4 are standalone

  it('shows 0/3 chapter fraction after skipping 1 of 4 lessons and styles skip icons/badges in slate gray', () => {
    const skippedLesson = demoCourse.chapters[0].lessons[0];

    const { container } = render(
      <ChecklistView
        course={demoCourse}
        statuses={{ [skippedLesson.id]: 'skipped' }}
        statusFilter="all"
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );

    expect(screen.getByText('0/3')).toBeInTheDocument();

    const skippedBadges = screen.getAllByText('Skipped');
    expect(skippedBadges.length).toBeGreaterThanOrEqual(1);
    expect(skippedBadges[0].className).toContain('bg-slate-100');
    expect(skippedBadges[0].className).toContain('text-slate-700');

    // Ensure no teal classes remain anywhere in checklist view
    expect(container.innerHTML).not.toContain('teal');
  });

  it('renders standalone chapters as checkable rows with Open button triggering ChapterDrawer', () => {
    const onToggleDone = vi.fn();
    const onSelectChapter = vi.fn();
    const standaloneCh3 = demoCourse.chapters[2];

    render(
      <ChecklistView
        course={demoCourse}
        statuses={{ [standaloneCh3.id]: 'learning' }}
        statusFilter="all"
        onSelectLesson={vi.fn()}
        onSelectChapter={onSelectChapter}
        onToggleDone={onToggleDone}
      />
    );

    const toggleBtn = screen.getByRole('button', {
      name: `Toggle done for ${standaloneCh3.title}`,
    });
    fireEvent.click(toggleBtn);
    expect(onToggleDone).toHaveBeenCalledWith(standaloneCh3.id);

    const openBtn = screen.getByRole('button', {
      name: `Open ${standaloneCh3.title}`,
    });
    fireEvent.click(openBtn);
    expect(onSelectChapter).toHaveBeenCalledWith(standaloneCh3);
  });
});
