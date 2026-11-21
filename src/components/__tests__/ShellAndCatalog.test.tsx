import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import App from '@/App';
import { Navbar } from '@/components/Navbar';
import { SearchModal } from '@/components/SearchModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CatalogPage } from '@/pages/CatalogPage';
import { CourseProvider } from '@/store/useCourseStore';
import { ProgressProvider } from '@/store/useProgressStore';
import { THEME_STORAGE_KEY, ThemeProvider } from '@/store/useThemeStore';
import { deleteFile, listFileIds, putFile } from '@/lib/fileStore';

function mockMatchMedia(prefersDark: boolean) {
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

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{`${location.pathname}${location.search}`}</div>;
}

describe('Navbar theme toggle and mobile layout', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    mockMatchMedia(false);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  it('cycles theme system -> light -> dark -> system, persists to localStorage, and toggles .dark', () => {
    mockMatchMedia(true);

    render(
      <MemoryRouter>
        <ThemeProvider>
          <Navbar bookmarkCount={2} onOpenSearch={vi.fn()} />
        </ThemeProvider>
      </MemoryRouter>
    );

    // Default is system (with OS dark = true)
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    const toggleBtn = screen.getByRole('button', { name: /Theme: System/i });

    // system -> light
    fireEvent.click(toggleBtn);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(screen.getByRole('button', { name: /Theme: Light/i })).toBeInTheDocument();

    // light -> dark
    fireEvent.click(screen.getByRole('button', { name: /Theme: Light/i }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button', { name: /Theme: Dark/i })).toBeInTheDocument();

    // dark -> system (OS dark = true)
    fireEvent.click(screen.getByRole('button', { name: /Theme: Dark/i }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('button', { name: /Theme: System/i })).toBeInTheDocument();
  });

  it('renders + New Course as a compact mobile icon button and hides Bookmarked text below sm', () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <Navbar bookmarkCount={3} onOpenSearch={vi.fn()} />
        </ThemeProvider>
      </MemoryRouter>
    );

    const newCourseLink = screen.getByRole('link', { name: 'New Course' });
    expect(newCourseLink).toHaveAttribute('href', '/editor/new');
    expect(newCourseLink).toHaveClass('h-8', 'w-8', 'rounded-full', 'p-0', 'sm:w-auto', 'sm:px-3.5');

    const newCourseLabel = within(newCourseLink).getByText('New Course');
    expect(newCourseLabel).toHaveClass('hidden', 'sm:inline');

    const bookmarkedLabel = screen.getByText('Bookmarked');
    expect(bookmarkedLabel).toHaveClass('hidden', 'sm:inline');
  });
});

describe('CatalogPage & CourseCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('groups courses by Department, displays semester on CourseCard, and renders the docs footer link', () => {
    render(
      <MemoryRouter>
        <CourseProvider>
          <ProgressProvider>
            <CatalogPage />
          </ProgressProvider>
        </CourseProvider>
      </MemoryRouter>
    );

    const headings = screen.getAllByRole('heading', { level: 2 });
    const headingTexts = headings.map((h) => h.textContent);
    expect(headingTexts).toEqual(['Preparatory', 'Computer Science']);

    expect(screen.getByText('GUIDE101')).toBeInTheDocument();
    expect(screen.getByText('Quick Start: Using Course Trees')).toBeInTheDocument();
    expect(screen.getByText('Year 1 - First Semester')).toBeInTheDocument();

    expect(screen.getByText('DEMO201')).toBeInTheDocument();
    expect(screen.getByText('Feature Showcase: Sample Course')).toBeInTheDocument();
    expect(screen.getByText('Year 2 - First Semester')).toBeInTheDocument();

    const footerLink = screen.getByRole('link', {
      name: /Data formats & LLM course-authoring guide →/i,
    });
    expect(footerLink).toHaveAttribute('href', '/docs/data-formats');

    const mainEl = screen.getByRole('main');
    expect(mainEl).toHaveClass('bg-black', 'text-white');
  });
});

describe('SearchModal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('searches by Department and navigates to chapter (?chapter=) and lesson (?lesson=) results', () => {
    const onClose = vi.fn();

    render(
      <MemoryRouter initialEntries={['/']}>
        <CourseProvider>
          <SearchModal open={true} onClose={onClose} />
          <LocationProbe />
        </CourseProvider>
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Search courses, departments, chapters, or lessons/i);

    // Search by Department
    fireEvent.change(input, { target: { value: 'Computer Science' } });
    const demoCourseBtn = screen.getByRole('button', {
      name: /DEMO201: Feature Showcase: Sample Course/i,
    });
    expect(within(demoCourseBtn).getByText(/Computer Science/)).toBeInTheDocument();

    // Search for a chapter and click it -> ?chapter=
    fireEvent.change(input, { target: { value: 'Six-Lesson' } });
    const chapterBtns = screen.getAllByRole('button', {
      name: /2\. Six-Lesson Deep Dive/i,
    });
    const chapterBtn = chapterBtns.find((btn) => within(btn).queryByText('chapter'));
    expect(chapterBtn).toBeDefined();
    expect(within(chapterBtn!).getByText(/DEMO201 · Computer Science/)).toBeInTheDocument();
    fireEvent.click(chapterBtn!);
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/course/demo201-feature-showcase?chapter=demo201-ch2-six-lesson-deep-dive'
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    // Search for a lesson and click it -> ?lesson=
    fireEvent.change(input, { target: { value: 'Searching with Ctrl+K' } });
    const lessonBtn = screen.getByRole('button', {
      name: /Searching with Ctrl\+K/i,
    });
    expect(within(lessonBtn).getByText('lesson')).toBeInTheDocument();
    fireEvent.click(lessonBtn);
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/course/guide101-quick-start?lesson=guide101-searching-with-ctrl-k'
    );
  });
});

describe('ConfirmDialog dark mode and keyboard handling', () => {
  it('renders dark variant classes and invokes onCancel on Escape', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open={true}
        title="Delete Course?"
        description="This action cannot be undone."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const dialog = screen.getByRole('dialog', { name: 'Delete Course?' });
    expect(dialog).toHaveClass('dark:bg-slate-900', 'dark:border-slate-700', 'dark:text-slate-100');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('App routing & startup IndexedDB garbage collection', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMatchMedia(false);
  });

  afterEach(async () => {
    const ids = await listFileIds();
    for (const id of ids) {
      await deleteFile(id);
    }
  });

  it('routes /docs/data-formats to DataFormatsPage', () => {
    render(
      <MemoryRouter initialEntries={['/docs/data-formats']}>
        <Routes>
          <Route path="*" element={<App />} />
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /Course & Progress JSON Formats/i })
    ).toBeInTheDocument();
  });

  it('skips startup GC on editor routes and runs GC once on non-editor routes', async () => {
    const orphanId = 'demo201-file-deadbeef';
    await putFile(orphanId, new Blob(['orphan'], { type: 'text/plain' }), 'orphan.txt', 'text/plain');
    expect(await listFileIds()).toContain(orphanId);

    // Mount on /editor/new -> should NOT garbage collect
    const { unmount } = render(
      <MemoryRouter initialEntries={['/editor/new']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('NEW COURSE')).toBeInTheDocument();
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(await listFileIds()).toContain(orphanId);
    unmount();

    // Mount on / -> SHOULD garbage collect unreferenced file
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(async () => {
      const remaining = await listFileIds();
      expect(remaining).not.toContain(orphanId);
    });
  });
});
