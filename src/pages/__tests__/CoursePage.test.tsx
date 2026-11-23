import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BRAND } from '@/config/brand';
import { CoursePage } from '@/pages/CoursePage';
import { CourseProvider } from '@/store/useCourseStore';
import { ProgressProvider } from '@/store/useProgressStore';
import { ThemeProvider } from '@/store/useThemeStore';

function mockMatchMedia(prefersDark = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderCoursePage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ThemeProvider>
        <CourseProvider>
          <ProgressProvider>
            <Routes>
              <Route path="/course/:slug" element={<CoursePage />} />
              <Route path="/" element={<div data-testid="catalog-home">Catalog Home</div>} />
            </Routes>
          </ProgressProvider>
        </CourseProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

describe('CoursePage integration', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMatchMedia(false);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('opens MaterialViewerModal for YouTube resource and guards drawer Escape/shortcuts while modal is open', () => {
    renderCoursePage(
      '/course/demo201-feature-showcase?lesson=demo201-ch1-l1-course-overview-tree-structure'
    );

    const drawer = screen.getByRole('dialog', { name: 'Course Overview & Tree Structure' });
    expect(drawer).toBeInTheDocument();
    expect(screen.getByText('0 of 12 Required Items Done')).toBeInTheDocument();

    // Recommended video is pinned at top and opens MaterialViewerModal
    fireEvent.click(within(drawer).getByRole('button', { name: /Course Intro Walkthrough Video/i }));

    const viewer = screen.getByRole('dialog', { name: /Course Intro Walkthrough Video/i });
    expect(viewer).toBeInTheDocument();
    const iframe = viewer.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute('src')).toContain('youtube-nocookie.com/embed/ZA-tUyM_y7s');

    // While MaterialViewerModal is open, drawer keyboard shortcuts (L/D/S, ArrowRight) must not fire
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(
      screen.getByRole('dialog', { name: 'Course Overview & Tree Structure' })
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'd' });
    expect(screen.getByText('0 of 12 Required Items Done')).toBeInTheDocument();

    // Pressing Escape closes MaterialViewerModal ONLY — LessonDrawer stays open!
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: /Course Intro Walkthrough Video/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Course Overview & Tree Structure' })
    ).toBeInTheDocument();

    // Pressing Escape a second time (now with no modal open) closes LessonDrawer
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: 'Course Overview & Tree Structure' })
    ).not.toBeInTheDocument();
  });

  it('opens AssessmentRunnerModal for DEMO201 LaTeX exam, records Best score badge, and guards Escape', () => {
    renderCoursePage(
      '/course/demo201-feature-showcase?lesson=demo201-ch2-l1-asymptotic-notation-recurrences'
    );

    const drawer = screen.getByRole('dialog', { name: 'Asymptotic Notation & Recurrences' });
    fireEvent.click(
      within(drawer).getByRole('button', {
        name: /Interactive Quiz: Asymptotics & Master Theorem/i,
      })
    );

    const runner = screen.getByRole('dialog', {
      name: /Interactive Quiz: Asymptotics & Master Theorem/i,
    });
    expect(runner).toBeInTheDocument();
    // KaTeX math is rendered inside the runner
    expect(runner.querySelector('.katex')).not.toBeNull();

    // Select 2nd radio option ($\Theta(n \log n)$)
    const radios = within(runner).getAllByRole('radio');
    expect(radios).toHaveLength(4);
    fireEvent.click(radios[1]);

    // Pressing Escape while runner is open closes runner ONLY, keeping LessonDrawer open
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: /Interactive Quiz: Asymptotics & Master Theorem/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'Asymptotic Notation & Recurrences' })
    ).toBeInTheDocument();

    // Re-open, answer Q1 & submit exam to verify Best score persistence in MaterialList
    fireEvent.click(
      within(drawer).getByRole('button', {
        name: /Interactive Quiz: Asymptotics & Master Theorem/i,
      })
    );
    const reopenedRunner = screen.getByRole('dialog', {
      name: /Interactive Quiz: Asymptotics & Master Theorem/i,
    });
    const reopenedRadios = within(reopenedRunner).getAllByRole('radio');
    fireEvent.click(reopenedRadios[1]);

    fireEvent.click(within(reopenedRunner).getByRole('button', { name: 'Submit Exam' }));
    expect(within(reopenedRunner).getByText(/Score: 2 \/ 6 pts/i)).toBeInTheDocument();

    fireEvent.click(within(reopenedRunner).getByRole('button', { name: 'Close' }));

    const examResourceButton = within(drawer).getByRole('button', {
      name: /Interactive Quiz: Asymptotics & Master Theorem/i,
    });
    expect(within(examResourceButton).getByText('Best: 33%')).toBeInTheDocument();
  });

  it('uses BRAND.progressBackupFilename for Backup Progress download and closes on Escape', async () => {
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:progress-url');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    }
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:progress-url');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    let capturedDownload = '';
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(el, 'download', {
          configurable: true,
          get: () => capturedDownload,
          set: (val: string) => {
            capturedDownload = val;
          },
        });
      }
      return el;
    }) as typeof document.createElement);

    renderCoursePage('/course/demo201-feature-showcase');

    const backupBtn = screen.getAllByRole('button', { name: 'Backup Progress' })[0];
    fireEvent.click(backupBtn);

    const backupDialog = screen.getByRole('dialog', { name: 'Backup and Restore Progress' });
    expect(backupDialog).toBeInTheDocument();
    expect(backupDialog.className).toContain('dark:bg-[#121926]');

    fireEvent.click(within(backupDialog).getByRole('button', { name: /Download Progress JSON/i }));
    await waitFor(() => {
      expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    });
    expect(capturedDownload).toBe(BRAND.progressBackupFilename);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:progress-url');

    // Escape closes the inline Backup modal
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('dialog', { name: 'Backup and Restore Progress' })
    ).not.toBeInTheDocument();
  });

  it('renders Course Not Found with 4-tier Light/Dark palette for unknown slugs', () => {
    const { container } = renderCoursePage('/course/non-existent-course');
    expect(screen.getByRole('heading', { name: 'Course Not Found' })).toBeInTheDocument();
    expect(container.querySelector('main')?.className).toContain('dark:bg-[#0b0f17]');
  });

  it('shows QuickStatusPill on sublesson hover with grace delay, stays open while hovering pill, and keeps right-click working', () => {
    vi.useFakeTimers();
    try {
      renderCoursePage('/course/demo201-feature-showcase');

      const lessonNode = document.querySelector(
        'g[data-node-id="demo201-ch1-l1-course-overview-tree-structure"]'
      ) as SVGGElement;
      expect(lessonNode).not.toBeNull();

      // Hovering sublesson opens QuickStatusPill
      fireEvent.mouseEnter(lessonNode);
      const pill = screen.getByLabelText('Quick status menu');
      expect(pill).toBeInTheDocument();

      // Leaving node and entering pill within grace delay keeps it open
      fireEvent.mouseLeave(lessonNode);
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.mouseEnter(pill.parentElement!.parentElement!);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.getByLabelText('Quick status menu')).toBeInTheDocument();

      // Leaving pill closes it after grace delay
      fireEvent.mouseLeave(pill.parentElement!.parentElement!);
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(screen.queryByLabelText('Quick status menu')).not.toBeInTheDocument();

      // Right-click still opens QuickStatusPill and keeps it open without hover timeout
      fireEvent.contextMenu(lessonNode);
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByLabelText('Quick status menu')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
