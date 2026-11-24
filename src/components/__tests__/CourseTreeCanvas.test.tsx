import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { COURSES } from '@/data/courses';
import { layoutCourseTree } from '@/lib/layoutTree';
import { CourseTreeCanvas } from '@/components/CourseTreeCanvas';

describe('CourseTreeCanvas', () => {
  const demoCourse = COURSES[1]; // DEMO201: Ch1 & Ch2 multi-lesson, Ch3 & Ch4 leaf chapters
  const layout = layoutCourseTree(demoCourse);

  it('animates zoom in up to 250%, zoom out, reset, and sets responsive minWidth for smaller viewports', () => {
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
    expect(zoomWrapper).toHaveClass(
      'transition-[width,max-width,min-width]',
      'duration-200',
      'ease-out'
    );
    expect(zoomWrapper.style.width).toBe('100%');
    expect(zoomWrapper.style.minWidth).toBe(`${Math.round(Math.min(layout.width, 640))}px`);

    const zoomInBtn = screen.getByRole('button', { name: 'Zoom in' });
    const zoomOutBtn = screen.getByRole('button', { name: 'Zoom out' });
    const resetBtn = screen.getByRole('button', { name: 'Reset zoom' });

    fireEvent.click(zoomInBtn);
    expect(resetBtn).toHaveTextContent('110%');
    expect(zoomWrapper.style.width).toBe('110%');

    // Zoom all the way up to 250%
    for (let i = 0; i < 20; i++) {
      fireEvent.click(zoomInBtn);
    }
    expect(resetBtn).toHaveTextContent('250%');
    expect(zoomWrapper.style.width).toBe('250%');

    fireEvent.click(resetBtn);
    expect(resetBtn).toHaveTextContent('100%');
    expect(zoomWrapper.style.width).toBe('100%');

    fireEvent.click(zoomOutBtn);
    expect(resetBtn).toHaveTextContent('90%');
    expect(zoomWrapper.style.width).toBe('90%');
  });

  it('supports free 2D click-and-drag panning (both sideways and up/down), resets pan on Reset zoom, and suppresses accidental node click after drag', () => {
    const onSelectChapter = vi.fn();
    const ch1 = demoCourse.chapters[0];

    const { container } = render(
      <CourseTreeCanvas
        layout={layout}
        statuses={{}}
        onSelectLesson={vi.fn()}
        onSelectChapter={onSelectChapter}
        onQuickToggleDone={vi.fn()}
        onContextMenuLesson={vi.fn()}
      />
    );

    const scrollEl = container.querySelector('[data-testid="tree-scroll-container"]') as HTMLElement;
    const zoomWrapper = container.querySelector('svg[role="img"]')?.parentElement as HTMLElement;
    expect(scrollEl).toHaveClass('cursor-grab', 'touch-none');
    expect(zoomWrapper.style.transform).toBe('translate(0px, 0px)');

    fireEvent.mouseDown(scrollEl, { button: 0, clientX: 200, clientY: 200 });
    expect(scrollEl).toHaveClass('cursor-grabbing');

    fireEvent.mouseMove(scrollEl, { clientX: 160, clientY: 150 });
    expect(zoomWrapper.style.transform).toBe('translate(-40px, -50px)');

    fireEvent.mouseUp(scrollEl);
    expect(scrollEl).toHaveClass('cursor-grab');

    // Clicking a node immediately after a drag (>5px) is suppressed once
    const ch1Group = container.querySelector(`g[data-node-id="${ch1.id}"]`) as SVGGElement;
    fireEvent.click(ch1Group);
    expect(onSelectChapter).not.toHaveBeenCalled();

    // Next normal click works as expected
    fireEvent.click(ch1Group);
    expect(onSelectChapter).toHaveBeenCalledWith(ch1);

    // Touch swipe gestures also pan freely in 2D
    fireEvent.touchStart(scrollEl, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchMove(scrollEl, { touches: [{ clientX: 130, clientY: 145 }] });
    expect(zoomWrapper.style.transform).toBe('translate(-10px, -5px)');
    fireEvent.touchEnd(scrollEl);

    // Reset zoom button resets pan to (0, 0)
    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
    expect(zoomWrapper.style.transform).toBe('translate(0px, 0px)');

    // Panning is clamped to container + tree boundaries (cannot pan endlessly off-screen)
    Object.defineProperty(scrollEl, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(scrollEl, 'clientHeight', { configurable: true, value: 500 });
    Object.defineProperty(zoomWrapper, 'offsetWidth', { configurable: true, value: 800 });
    Object.defineProperty(zoomWrapper, 'offsetHeight', { configurable: true, value: 700 });

    fireEvent.mouseDown(scrollEl, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(scrollEl, { clientX: -5000, clientY: -5000 });
    expect(zoomWrapper.style.transform).toBe('translate(-464px, -264px)');

    fireEvent.mouseMove(scrollEl, { clientX: 5000, clientY: 5000 });
    expect(zoomWrapper.style.transform).toBe('translate(64px, 64px)');
    fireEvent.mouseUp(scrollEl);
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

  it('hides status badge completely on todo leaf chapters and renders circular badges when non-todo', () => {
    const leafCh3 = demoCourse.chapters[2];
    const leafCh4 = demoCourse.chapters[3];

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

    const ch3Group = container.querySelector(`g[data-node-id="${leafCh3.id}"]`) as SVGGElement;
    expect(ch3Group.querySelector('[data-status-badge]')).toBeNull();
    expect(ch3Group.textContent).not.toContain('○');

    rerender(
      <CourseTreeCanvas
        layout={layout}
        statuses={{
          [leafCh3.id]: 'done',
          [leafCh4.id]: 'learning',
        }}
        onSelectLesson={vi.fn()}
        onSelectChapter={vi.fn()}
        onQuickToggleDone={vi.fn()}
        onContextMenuLesson={vi.fn()}
      />
    );

    const doneBadge = ch3Group.querySelector('[data-status-badge="done"]');
    expect(doneBadge).not.toBeNull();
    expect(doneBadge?.querySelector('circle')).toHaveAttribute('fill', '#15803d');

    const ch4Group = container.querySelector(`g[data-node-id="${leafCh4.id}"]`) as SVGGElement;
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
    expect(ch2Pills[0]).toHaveAttribute('fill', '#15803d');
  });

  it('handles Shift+Click and context menu on leaf chapters & lessons, and ignores context menu on multi-lesson chapters', () => {
    const onQuickToggleDone = vi.fn();
    const onContextMenuLesson = vi.fn();
    const ch1 = demoCourse.chapters[0];
    const lesson1 = ch1.lessons[0];
    const leafCh3 = demoCourse.chapters[2];

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

    const ch3Group = container.querySelector(`g[data-node-id="${leafCh3.id}"]`) as SVGGElement;
    fireEvent.click(ch3Group, { shiftKey: true });
    expect(onQuickToggleDone).toHaveBeenCalledWith(leafCh3.id);

    fireEvent.contextMenu(ch3Group);
    expect(onContextMenuLesson).toHaveBeenCalledTimes(1);
    expect(onContextMenuLesson.mock.calls[0][0]).toBe(leafCh3.id);

    const ch1Group = container.querySelector(`g[data-node-id="${ch1.id}"]`) as SVGGElement;
    fireEvent.contextMenu(ch1Group);
    expect(onContextMenuLesson).toHaveBeenCalledTimes(1);
  });

  it('updates zoom on two-finger pinch and disables width transition while pinching', () => {
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

    const canvasContainer = container.querySelector('.touch-none') as HTMLDivElement;
    const zoomWrapper = canvasContainer.firstElementChild as HTMLDivElement;
    expect(zoomWrapper.className).toContain('transition-[width,max-width,min-width]');

    fireEvent.touchStart(canvasContainer, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 100, clientY: 0 },
      ],
    });
    expect(zoomWrapper.className).not.toContain('transition-[width,max-width,min-width]');

    fireEvent.touchMove(canvasContainer, {
      touches: [
        { clientX: 0, clientY: 0 },
        { clientX: 150, clientY: 0 },
      ],
    });
    expect(screen.getByText('150%')).toBeInTheDocument();

    fireEvent.touchEnd(canvasContainer, { touches: [] });
    expect(zoomWrapper.className).toContain('transition-[width,max-width,min-width]');
  });

  it('centers mathematically on the first click of Fit and Reset zoom (100%)', () => {
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

    const scrollEl = container.querySelector('.touch-none') as HTMLDivElement;
    const zoomWrapper = scrollEl.firstElementChild as HTMLDivElement;
    Object.defineProperty(scrollEl, 'clientWidth', { configurable: true, value: 360 });
    // Even if offsetWidth is stale (e.g. 0), first click of Fit and Reset zoom centers mathematically
    Object.defineProperty(zoomWrapper, 'offsetWidth', { configurable: true, value: 0 });

    fireEvent.click(screen.getByRole('button', { name: 'Fit tree to screen' }));
    expect(zoomWrapper.style.transform).toBe('translate(0px, 0px)');

    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }));
    const expectedMinW = Math.round(Math.min(layout.width, 640));
    const expectedCenterPanX = -Math.round((expectedMinW - 360) / 2);
    expect(zoomWrapper.style.transform).toBe(`translate(${expectedCenterPanX}px, 0px)`);
  });
});
