import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { COURSES } from '@/data/courses';
import { ChecklistView } from '@/components/ChecklistView';

describe('ChecklistView', () => {
  const demoCourse = COURSES[1]; // DEMO201: Ch1 has 4 lessons, Ch3 & Ch4 are leaf chapters

  it('shows 0/3 chapter fraction after skipping 1 of 4 lessons and styles skip icons/badges in slate gray', () => {
    const skippedLesson = demoCourse.chapters[0].lessons[0];

    render(
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
    expect(skippedBadges[0].className).toContain('bg-[var(--status-skipped-bg)]');
    expect(skippedBadges[0].className).toContain('text-[var(--status-skipped-text)]');
    expect(skippedBadges[0].className).not.toContain('teal');

    // Chapter tags container stacks vertically on mobile and lays out horizontally on sm+
    const chapterTagGroups = screen.getAllByTestId('checklist-chapter-tags');
    expect(chapterTagGroups.length).toBeGreaterThan(0);
    expect(chapterTagGroups[0]).toHaveClass('flex-col', 'items-end', 'sm:flex-row');
  });

  it('renders leaf chapters as checkable rows with clickable title triggering ChapterDrawer and no redundant Open link', () => {
    const onToggleDone = vi.fn();
    const onSelectChapter = vi.fn();
    const leafCh3 = demoCourse.chapters[2];

    render(
      <ChecklistView
        course={demoCourse}
        statuses={{ [leafCh3.id]: 'learning' }}
        statusFilter="all"
        onSelectLesson={vi.fn()}
        onSelectChapter={onSelectChapter}
        onToggleDone={onToggleDone}
      />
    );

    const toggleBtn = screen.getByRole('button', {
      name: `Toggle done for ${leafCh3.title}`,
    });
    fireEvent.click(toggleBtn);
    expect(onToggleDone).toHaveBeenCalledWith(leafCh3.id);

    const titleBtn = screen.getByRole('button', {
      name: leafCh3.title,
    });
    fireEvent.click(titleBtn);
    expect(onSelectChapter).toHaveBeenCalledWith(leafCh3);

    expect(screen.queryByRole('button', { name: /^Open\b/i })).not.toBeInTheDocument();
  });

  it('omits extra leaf badge and redundant child row, formats singular/plural materials, and uses neutral amber-accented chapter headers', () => {
    const { container } = render(
      <ChecklistView
        course={demoCourse}
        statuses={{}}
        statusFilter="all"
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );

    expect(screen.getAllByText('1 Material').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('1 Materials')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('bg-[#fdff00]');

    const ch3TitleBtn = screen.getByRole('button', { name: demoCourse.chapters[2].title });
    const headerBar = ch3TitleBtn.closest('div[class*="border-l-[var(--accent-amber)]"]') as HTMLElement;
    expect(headerBar).toHaveClass('bg-[var(--surface-chapter-header)]', 'border-l-4', 'border-l-[var(--accent-amber)]');
    expect(headerBar.nextElementSibling).toBeNull();
  });

  it('dims non-matching leaf chapter cards when statusFilter is active', () => {
    const leafCh3 = demoCourse.chapters[2];
    const { container } = render(
      <ChecklistView
        course={demoCourse}
        statuses={{ [leafCh3.id]: 'todo' }}
        statusFilter="done"
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );

    const dimmedCards = container.querySelectorAll('[data-filtered-out="true"]');
    expect(dimmedCards.length).toBeGreaterThanOrEqual(1);
    expect(dimmedCards[0]).toHaveClass('opacity-40');
    expect(screen.queryByText(/No items match the current filter/i)).not.toBeInTheDocument();
  });

  it('renders spine, chapter, and lesson supplements without Supplement or Info pills, using Info icon for trackable: false', () => {
    const onSelectSupplement = vi.fn();
    const onToggleDone = vi.fn();
    render(
      <ChecklistView
        course={demoCourse}
        statuses={{}}
        statusFilter="all"
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onSelectSupplement={onSelectSupplement}
        onToggleDone={onToggleDone}
      />
    );

    expect(screen.queryByText('Supplement')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom Node')).not.toBeInTheDocument();
    expect(screen.getAllByText(/1 Material$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Info')).not.toBeInTheDocument();

    const infoRow = screen.getByRole('button', { name: /Syllabus Reference Card/i }).closest('li')!;
    expect(infoRow.querySelector('svg.lucide-info')).not.toBeNull();
    expect(infoRow.querySelector('svg.lucide-sparkles')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Midterm Checkpoint' }));
    expect(onSelectSupplement).toHaveBeenCalledWith('demo201-s1-midterm-checkpoint');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle done for Office Hours Prep' }));
    expect(onToggleDone).toHaveBeenCalledWith('demo201-s1-s1-office-hours-prep');
  });

  it('strikes through parent chapter and parent spine supplement titles when all trackable children are done', () => {
    const ch1 = demoCourse.chapters[0];
    const spineSup = demoCourse.supplements![0];
    const allDoneStatuses: Record<string, 'done'> = {};
    for (const lesson of ch1.lessons) {
      allDoneStatuses[lesson.id] = 'done';
      for (const sup of lesson.supplements ?? []) {
        allDoneStatuses[sup.id] = 'done';
      }
    }
    for (const sup of ch1.supplements ?? []) {
      allDoneStatuses[sup.id] = 'done';
    }
    for (const child of spineSup.children ?? []) {
      allDoneStatuses[child.id] = 'done';
    }

    render(
      <ChecklistView
        course={demoCourse}
        statuses={allDoneStatuses}
        statusFilter="all"
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onSelectSupplement={vi.fn()}
        onToggleDone={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: ch1.title })).toHaveClass('line-through');
    expect(screen.getByRole('button', { name: spineSup.title })).toHaveClass('line-through');
  });
});
