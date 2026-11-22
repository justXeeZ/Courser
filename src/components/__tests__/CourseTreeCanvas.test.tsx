import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { COURSES } from '@/data/courses';
import { layoutCourseTree } from '@/lib/layoutTree';
import { CourseTreeCanvas } from '@/components/CourseTreeCanvas';

describe('CourseTreeCanvas', () => {
  const demoCourse = COURSES[1]; // DEMO201: Ch1 & Ch2 multi-lesson, Ch3 & Ch4 standalone
  const layout = layoutCourseTree(demoCourse);

  it('animates zoom in, zoom out, and reset smoothly with width and max-width transitions', () => {
    const { container } = render(
      <CourseTreeCanvas
        layout={layout}
        statuses={{}}
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onQuickToggleDone={vi.fn()}
        onContextMenuLesson={vi.fn()}
      />
    );

    const zoomWrapper = container.querySelector('svg[role="img"]')?.parentElement as HTMLElement;
    expect(zoomWrapper).toHaveClass('transition-[width,max-width]', 'duration-200', 'ease-out');
    expect(zoomWrapper.style.width).toBe('100%');

    const zoomInBtn = screen.getByRole('button', { name: 'Zoom in' });
    const zoomOutBtn = screen.getByRole('button', { name: 'Zoom out' });
    const resetBtn = screen.getByRole('button', { name: 'Reset zoom' });

    fireEvent.click(zoomInBtn);
    expect(resetBtn).toHaveTextContent('110%');
    expect(zoomWrapper.style.width).toBe('110%');

    fireEvent.click(zoomOutBtn);
    fireEvent.click(zoomOutBtn);
    expect(resetBtn).toHaveTextContent('90%');
    expect(zoomWrapper.style.width).toBe('90%');

    fireEvent.click(resetBtn);
    expect(resetBtn).toHaveTextContent('100%');
    expect(zoomWrapper.style.width).toBe('100%');
  });

  it('dims multi-lesson chapters when statusFilter matches none of their lessons', () => {
    const ch1 = demoCourse.chapters[0];
    const ch2 = demoCourse.chapters[1];

    const { container } = render(
      <CourseTreeCanvas
        layout={layout}
        statuses={{
          [ch1.lessons[0].id]: 'done',
        }}
        statusFilter="done"
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onQuickToggleDone={vi.fn()}
        onContextMenuLesson={vi.fn()}
      />
    );

    const ch1Group = container.querySelector(`g[data-node-id="${ch1.id}"]`) as SVGGElement;
    const ch2Group = container.querySelector(`g[data-node-id="${ch2.id}"]`) as SVGGElement;

    expect(ch1Group.style.opacity).toBe('1');
    expect(ch2Group.style.opacity).toBe('0.3');
  });

  it('hides status badge completely on todo standalone chapters and renders circular badges when non-todo', () => {
    const standaloneCh3 = demoCourse.chapters[2];
    const standaloneCh4 = demoCourse.chapters[3];

    const { container, rerender } = render(
      <CourseTreeCanvas
        layout={layout}
        statuses={{}}
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onQuickToggleDone={vi.fn()}
        onContextMenuLesson={vi.fn()}
      />
    );

    const ch3Group = container.querySelector(`g[data-node-id="${standaloneCh3.id}"]`) as SVGGElement;
    expect(ch3Group.querySelector('[data-status-badge]')).toBeNull();
    expect(ch3Group.textContent).not.toContain('○');

    rerender(
      <CourseTreeCanvas
        layout={layout}
        statuses={{
          [standaloneCh3.id]: 'done',
          [standaloneCh4.id]: 'learning',
        }}
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onQuickToggleDone={vi.fn()}
        onContextMenuLesson={vi.fn()}
      />
    );

    const doneBadge = ch3Group.querySelector('[data-status-badge="done"]');
    expect(doneBadge).not.toBeNull();
    expect(doneBadge?.querySelector('circle')).toHaveAttribute('fill', '#16a34a');

    const ch4Group = container.querySelector(`g[data-node-id="${standaloneCh4.id}"]`) as SVGGElement;
    const learningBadge = ch4Group.querySelector('[data-status-badge="learning"]');
    expect(learningBadge).not.toBeNull();
    expect(learningBadge?.querySelector('circle')).toHaveAttribute('fill', '#7c3aed');
  });

  it('renders all-skipped multi-lesson chapter 0/0 pill in slate #64748b instead of green #16a34a', () => {
    const ch1 = demoCourse.chapters[0];
    const ch2 = demoCourse.chapters[1];
    const allSkippedStatuses = Object.fromEntries(ch1.lessons.map((l) => [l.id, 'skipped' as const]));

    const { container } = render(
      <CourseTreeCanvas
        layout={layout}
        statuses={{
          ...allSkippedStatuses,
          [ch2.lessons[0].id]: 'done',
          ...Object.fromEntries(ch2.lessons.slice(1).map((l) => [l.id, 'skipped' as const])),
        }}
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onQuickToggleDone={vi.fn()}
        onContextMenuLesson={vi.fn()}
      />
    );

    const ch1Group = container.querySelector(`g[data-node-id="${ch1.id}"]`) as SVGGElement;
    expect(ch1Group.textContent).toContain('0/0');
    const ch1Pills = ch1Group.querySelectorAll('rect[rx="10"]');
    expect(ch1Pills[0]).toHaveAttribute('fill', '#64748b');

    const ch2Group = container.querySelector(`g[data-node-id="${ch2.id}"]`) as SVGGElement;
    expect(ch2Group.textContent).toContain('1/1');
    const ch2Pills = ch2Group.querySelectorAll('rect[rx="10"]');
    expect(ch2Pills[0]).toHaveAttribute('fill', '#16a34a');
  });

  it('handles Shift+Click and context menu on standalone chapters & lessons, and ignores context menu on multi-lesson chapters', () => {
    const onQuickToggleDone = vi.fn();
    const onContextMenuLesson = vi.fn();
    const ch1 = demoCourse.chapters[0];
    const lesson1 = ch1.lessons[0];
    const standaloneCh3 = demoCourse.chapters[2];

    const { container } = render(
      <CourseTreeCanvas
        layout={layout}
        statuses={{}}
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onQuickToggleDone={onQuickToggleDone}
        onContextMenuLesson={onContextMenuLesson}
      />
    );

    const lessonGroup = container.querySelector(`g[data-node-id="${lesson1.id}"]`) as SVGGElement;
    fireEvent.click(lessonGroup, { shiftKey: true });
    expect(onQuickToggleDone).toHaveBeenCalledWith(lesson1.id);

    const ch3Group = container.querySelector(`g[data-node-id="${standaloneCh3.id}"]`) as SVGGElement;
    fireEvent.click(ch3Group, { shiftKey: true });
    expect(onQuickToggleDone).toHaveBeenCalledWith(standaloneCh3.id);

    fireEvent.contextMenu(ch3Group);
    expect(onContextMenuLesson).toHaveBeenCalledTimes(1);
    expect(onContextMenuLesson.mock.calls[0][0]).toBe(standaloneCh3.id);

    const ch1Group = container.querySelector(`g[data-node-id="${ch1.id}"]`) as SVGGElement;
    fireEvent.contextMenu(ch1Group);
    expect(onContextMenuLesson).toHaveBeenCalledTimes(1);
  });
});
