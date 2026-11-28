import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { loadCoursesCatalog, CourseProvider } from '@/store/useCourseStore';
import {
  PROGRESS_STORAGE_KEY,
  ProgressProvider,
  loadProgressState,
  saveProgressState,
} from '@/store/useProgressStore';
import { ASSESSMENT_EXPORT_FORMAT } from '@/lib/assessmentExchange';
import { deleteFile, getFile, listFileIds } from '@/lib/fileStore';
import { EXAMPLE_COURSE_EXPORT } from '@/data/exampleCourseExport';
import { CourseEditorPage } from '@/pages/CourseEditorPage';

async function clearStoredFiles(): Promise<void> {
  const ids = await listFileIds();
  for (const id of ids) {
    await deleteFile(id);
  }
}

function renderEditor(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <CourseProvider>
        <ProgressProvider>
          <Routes>
            <Route path="/editor/new" element={<CourseEditorPage />} />
            <Route path="/course/:slug/edit" element={<CourseEditorPage />} />
            <Route
              path="/course/:slug"
              element={<div data-testid="course-view-destination">Course Page</div>}
            />
            <Route path="/" element={<div data-testid="catalog-destination">Catalog</div>} />
          </Routes>
        </ProgressProvider>
      </CourseProvider>
    </MemoryRouter>
  );
}

function expandChapter1AndLesson1() {
  const expandCh1 = screen.queryByRole('button', { name: /Expand Chapter 1/i });
  if (expandCh1) {
    fireEvent.click(expandCh1);
  }
  const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement | null;
  if (lessonCard) {
    const toggleBtn = lessonCard.querySelector(
      'button[aria-expanded="false"]'
    ) as HTMLButtonElement | null;
    if (toggleBtn) {
      fireEvent.click(toggleBtn);
    }
  }
}

describe('CourseEditorPage & editor components', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await clearStoredFiles();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders active Department defaulting to Preparatory, Year input + 1st/2nd Semester radios, and no estimated time inputs', () => {
    renderEditor('/editor/new');

    const deptInput = screen.getByLabelText(/Department/i) as HTMLInputElement;
    expect(deptInput).toBeVisible();
    expect(deptInput.value).toBe('Preparatory');

    const yearInput = screen.getByLabelText(/Year/i) as HTMLInputElement;
    expect(yearInput.value).toBe('');
    expect(yearInput.min).toBe('1');
    expect(yearInput.max).toBe('10');

    const semGroup = screen.getByRole('radiogroup', { name: /Semester/i });
    const sem1 = within(semGroup).getByRole('radio', { name: '1st' }) as HTMLInputElement;
    const sem2 = within(semGroup).getByRole('radio', { name: '2nd' }) as HTMLInputElement;
    expect(sem1.checked).toBe(false);
    expect(sem2.checked).toBe(false);

    fireEvent.click(sem2);
    expect(sem2.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^Clear$/i }));
    expect(sem2.checked).toBe(false);

    // No estimated time / duration inputs anywhere in the editor
    expect(screen.queryByLabelText(/estimated/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/duration/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/est\.?\s*minutes/i)).not.toBeInTheDocument();
  });

  it('validates uploads: rejects .exe, accepts .pdf into IndexedDB, allows large files with no size cap, warns without blocking mismatched kind, and auto-suggests kind', async () => {
    renderEditor('/editor/new');
    expandChapter1AndLesson1();

    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    const lessonScope = within(lessonCard);

    // Add a material row inside the initially expanded lesson
    fireEvent.click(lessonScope.getByRole('button', { name: /Add Material/i }));

    // Switch row to Upload mode
    fireEvent.click(lessonScope.getByRole('button', { name: /^Upload$/i }));

    // Shows expected extensions hint for default kind (document)
    expect(lessonScope.getByText(/Expected for/i)).toBeInTheDocument();
    expect(lessonScope.getByText(/\.pdf, \.doc, \.docx/i)).toBeInTheDocument();

    // 1) Reject .exe
    const exeInput = lessonScope.getByLabelText(/Upload material file/i) as HTMLInputElement;
    const exeFile = new File(['MZ'], 'installer.exe', {
      type: 'application/x-msdownload',
    });
    fireEvent.change(exeInput, { target: { files: [exeFile] } });

    await waitFor(() => {
      expect(lessonScope.getByRole('alert')).toHaveTextContent(/blocked/i);
    });
    expect(await listFileIds()).toHaveLength(0);

    // 2) Auto-suggest kind on fresh upload (.pptx -> Slides) and persist in IndexedDB
    const pptxFile = new File(['slides-binary'], 'lecture-01.pptx', {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    });
    fireEvent.change(lessonScope.getByLabelText(/Upload material file/i), {
      target: { files: [pptxFile] },
    });

    await waitFor(() => {
      expect(lessonScope.getByText('lecture-01.pptx')).toBeInTheDocument();
    });
    expect(lessonScope.getByText(/Auto-suggested kind: Slides/i)).toBeInTheDocument();

    const storedIdsAfterPptx = await listFileIds();
    expect(storedIdsAfterPptx).toHaveLength(1);
    const storedPptx = await getFile(storedIdsAfterPptx[0]);
    expect(storedPptx?.name).toBe('lecture-01.pptx');

    // 3) Switching Link <-> Upload clears opposite field (after confirming populated upload discard)
    fireEvent.click(lessonScope.getByRole('button', { name: /^Link$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Switch Mode$/i }));
    const urlInput = lessonScope.getByLabelText(/Material URL/i) as HTMLInputElement;
    expect(urlInput.value).toBe('');
    fireEvent.change(urlInput, { target: { value: 'https://example.edu/test' } });
    fireEvent.click(lessonScope.getByRole('button', { name: /^Upload$/i }));
    expect(lessonScope.queryByText('lecture-01.pptx')).not.toBeInTheDocument();

    // 4) Explicitly select Video kind, then upload .txt -> non-blocking warning while keeping file attached
    const kindSelect = lessonScope.getByLabelText(/Resource kind/i) as HTMLSelectElement;
    fireEvent.change(kindSelect, { target: { value: 'video' } });

    const txtFile = new File(['transcript text'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(lessonScope.getByLabelText(/Upload material file/i), {
      target: { files: [txtFile] },
    });

    await waitFor(() => {
      expect(lessonScope.getByText('notes.txt')).toBeInTheDocument();
    });
    expect(lessonScope.getByRole('status')).toHaveTextContent(
      /doesn't match typical video extensions/i
    );
    expect(kindSelect.value).toBe('video');

    // Clicking "Use document" applies suggested kind and clears warning
    fireEvent.click(lessonScope.getByRole('button', { name: /Use document/i }));
    expect(kindSelect.value).toBe('document');
    expect(lessonScope.queryByRole('status')).not.toBeInTheDocument();

    // 5) Accepts .pdf and large file metadata (> 25 MB) with NO size cap
    fireEvent.click(lessonScope.getByRole('button', { name: /Remove file/i }));
    const largePdf = new File(['%PDF-1.7'], 'big-textbook.pdf', {
      type: 'application/pdf',
    });
    Object.defineProperty(largePdf, 'size', { value: 60 * 1024 * 1024 });
    fireEvent.change(lessonScope.getByLabelText(/Upload material file/i), {
      target: { files: [largePdf] },
    });

    await waitFor(() => {
      expect(lessonScope.getByText('big-textbook.pdf')).toBeInTheDocument();
    });
    expect(lessonScope.getByText('60 MB')).toBeInTheDocument();
    expect(lessonScope.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('toggles chapter prerequisites while excluding self and own lessons, and displays 0-lesson hint when 0 lessons', () => {
    renderEditor('/editor/new');

    // Add a second chapter so Chapter 2 has Chapter 1 + Lesson 1 as eligible prerequisites
    fireEvent.click(within(screen.getByTestId('editor-sticky-bar')).getByRole('button', { name: /^Add$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add Chapter/i }));

    const chapterCards = document.querySelectorAll('[data-edit-chapter]');
    expect(chapterCards).toHaveLength(2);

    const chapter2Card = chapterCards[1] as HTMLElement;
    const ch2Id = chapter2Card.getAttribute('data-edit-chapter')!;
    const ch2PrereqPicker = chapter2Card.querySelector(
      `[data-prereq-for="${ch2Id}"]`
    ) as HTMLElement;
    const ch2PrereqScope = within(ch2PrereqPicker);

    // Prerequisites section starts collapsed by default
    const ch2PrereqToggle = ch2PrereqScope.getByRole('button', {
      name: /Prerequisites \(click to toggle\)/i,
    });
    expect(ch2PrereqToggle).toHaveAttribute('aria-expanded', 'false');
    expect(ch2PrereqScope.queryByText('Ch1: 1. Foundations')).not.toBeInTheDocument();

    // Expand Prerequisites section
    fireEvent.click(ch2PrereqToggle);
    expect(ch2PrereqToggle).toHaveAttribute('aria-expanded', 'true');

    // Chapter 2's PrerequisitePicker excludes itself ("Ch2: 2. New Chapter") and its own lesson ("Topic 2.1")
    expect(
      ch2PrereqScope.queryByRole('button', { name: /Ch2\s+2\. New Chapter/i })
    ).not.toBeInTheDocument();
    expect(ch2PrereqScope.queryByRole('button', { name: /Topic 2\.1/i })).not.toBeInTheDocument();

    // Group heading keeps "Ch1: 1. Foundations" format
    expect(ch2PrereqScope.getByText('Ch1: 1. Foundations')).toBeInTheDocument();

    // Chapter 1 and its lesson are available in Chapter 2's PrerequisitePicker with Ch1 and Ch1 / L1 tags
    const ch1PrereqBtn = ch2PrereqScope.getByRole('button', {
      name: /Ch1\s+1\. Foundations/i,
    });
    const ch1Tag = within(ch1PrereqBtn).getByTestId('prereq-tag-chapter');
    expect(ch1Tag).toHaveTextContent('Ch1');
    expect(ch1Tag.className).toContain('bg-[var(--tag-amber-bg)]');
    expect(ch1Tag.className).toContain('text-[var(--tag-amber-text)]');
    expect(ch1PrereqBtn).toHaveAttribute('aria-pressed', 'false');

    // Selecting chapter prerequisite applies amber fill
    fireEvent.click(ch1PrereqBtn);
    expect(ch1PrereqBtn).toHaveAttribute('aria-pressed', 'true');
    expect(ch1PrereqBtn.className).toContain('bg-[var(--tag-amber-bg)]');

    // Toggle back off
    fireEvent.click(ch1PrereqBtn);
    expect(ch1PrereqBtn).toHaveAttribute('aria-pressed', 'false');

    // Selecting lesson prerequisite shows Ch1 / L1 light-blue tag and applies blue fill on selection
    const l1PrereqBtn = ch2PrereqScope.getByRole('button', {
      name: /Ch1 \/ L1\s+Course Introduction/i,
    });
    const l1Tag = within(l1PrereqBtn).getByTestId('prereq-tag-lesson');
    expect(l1Tag).toHaveTextContent('Ch1 / L1');
    expect(l1Tag.className).toContain('bg-[var(--tag-peach-bg)]');
    expect(l1Tag.className).toContain('text-[var(--tag-peach-text)]');
    fireEvent.click(l1PrereqBtn);
    expect(l1PrereqBtn).toHaveAttribute('aria-pressed', 'true');
    expect(l1PrereqBtn.className).toContain('bg-[var(--tag-peach-bg)]');
    fireEvent.click(l1PrereqBtn);
    expect(l1PrereqBtn).toHaveAttribute('aria-pressed', 'false');

    // Delete Chapter 2's only lesson -> becomes 0-lesson chapter with updated empty message
    const ch2Scope = within(chapter2Card);
    fireEvent.click(ch2Scope.getByRole('button', { name: /Delete Topic 2\.1/i }));
    expect(ch2Scope.getByText(/No sub-lessons added yet/i)).toBeInTheDocument();
  });

  it('updates the sticky bar breadcrumb when focusing chapter or lesson fields and falls back on metadata focus', () => {
    renderEditor('/editor/new');

    const stickyBar = screen.getByTestId('editor-sticky-bar');
    expect(within(stickyBar).getByText('CS101')).toBeInTheDocument();
    expect(within(stickyBar).getByText('Course Overview')).toBeInTheDocument();

    expandChapter1AndLesson1();

    // Focus chapter title input inside Chapter 1 -> shows amber Ch1 tag + chapter title
    const ch1TitleInput = screen.getByLabelText('Chapter 1 title');
    fireEvent.focus(ch1TitleInput);
    expect(within(stickyBar).getByText('Ch1')).toBeInTheDocument();
    expect(within(stickyBar).getByText('1. Foundations')).toBeInTheDocument();

    // Focus lesson title input inside Lesson 1 -> shows Ch1 tag, chapter title, Ch1 / L1 tag, and lesson title
    const lessonTitleInput = screen.getByLabelText('Sub-Lesson Title');
    fireEvent.focus(lessonTitleInput);
    expect(within(stickyBar).getByText('Ch1')).toBeInTheDocument();
    expect(within(stickyBar).getByText('1. Foundations')).toBeInTheDocument();
    expect(within(stickyBar).getByText('Ch1 / L1')).toBeInTheDocument();
    expect(within(stickyBar).getByText('Course Introduction')).toBeInTheDocument();

    // Focus metadata input -> falls back cleanly to Course Overview
    fireEvent.focus(screen.getByLabelText(/Course Code/i));
    expect(within(stickyBar).getByText('Course Overview')).toBeInTheDocument();
    expect(within(stickyBar).queryByText('Course Introduction')).not.toBeInTheDocument();

    // Add & focus a lesson child supplement -> shows Ch1 › Ch1 / L1 › Ch1 / L1 / S1
    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    fireEvent.click(within(lessonCard).getByRole('button', { name: /Add Child Supplement$/i }));
    const lessonSupTitle = within(lessonCard).getByLabelText('Supplement Title');
    fireEvent.focus(lessonSupTitle);
    expect(within(stickyBar).getByText('Ch1 / L1 / S1')).toBeInTheDocument();
    expect(within(stickyBar).getByText('Child Supplement 1')).toBeInTheDocument();

    // Add a spine supplement & spine child supplement -> shows S1 › S1 / S1
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Add$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add Supplement/i }));
    expect(within(stickyBar).getByText('S1')).toBeInTheDocument();
    expect(within(stickyBar).getByText('Supplement 1')).toBeInTheDocument();

    const spineCard = Array.from(document.querySelectorAll('[data-edit-supplement]')).find((el) =>
      el.querySelector('[data-sticky-header="supplement-spine"]')
    ) as HTMLElement;
    fireEvent.click(within(spineCard).getByRole('button', { name: /Add Child Supplement/i }));
    const spineChildCard = spineCard.querySelector('[data-edit-supplement]') as HTMLElement;
    fireEvent.focus(within(spineChildCard).getByLabelText('Supplement Title'));
    expect(within(stickyBar).getByText('S1')).toBeInTheDocument();
    expect(within(stickyBar).getByText('S1 / S1')).toBeInTheDocument();

    // Nav has vertical padding so overflow-x-auto does not clip tag borders on mobile
    const nav = within(stickyBar).getByRole('navigation', { name: /Editing context/i });
    expect(nav.className).toContain('py-0.5');
  });

  it('remaps saved progress and bookmarks when renaming a lesson and course code on save', () => {
    // Seed existing progress on GUIDE101's first lesson ("guide101-ch1-l1-browsing-bookmarks")
    saveProgressState({
      version: 1,
      statuses: {
        'guide101-quick-start': {
          'guide101-ch1-l1-browsing-bookmarks': 'done',
        },
      },
      bookmarks: ['guide101-quick-start'],
    });

    renderEditor('/course/guide101-quick-start/edit');
    expandChapter1AndLesson1();

    // Change course code and slug so both slug and item IDs change
    const codeInput = screen.getByLabelText(/Course Code/i);
    fireEvent.change(codeInput, { target: { value: 'GUIDE102' } });
    const slugInput = screen.getByLabelText(/URL Slug/i);
    fireEvent.change(slugInput, { target: { value: 'guide102-quick-start' } });

    // Rename the first lesson (already expanded initially)
    const lessonTitleInput = screen.getByLabelText('Sub-Lesson Title');
    fireEvent.change(lessonTitleInput, { target: { value: 'Catalog Navigation' } });

    // Click Save in the sticky bar
    const stickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));

    expect(screen.getByTestId('course-view-destination')).toBeInTheDocument();

    const updatedProgress = loadProgressState();
    expect(updatedProgress.statuses['guide101-quick-start']).toBeUndefined();
    expect(updatedProgress.statuses['guide102-quick-start']).toEqual({
      'guide102-ch1-l1-catalog-navigation': 'done',
    });
    expect(updatedProgress.bookmarks).toEqual(['guide102-quick-start']);
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toContain(
      'guide102-ch1-l1-catalog-navigation'
    );
  });

  it('imports EXAMPLE_COURSE_EXPORT via ImportCourseDialog and displays the imported banner', async () => {
    renderEditor('/editor/new');

    fireEvent.click(screen.getByRole('button', { name: /Import Course/i }));

    const dialog = screen.getByRole('dialog', { name: /Import Course/i });
    const jsonTextarea = within(dialog).getByLabelText(/^Course JSON$/i);
    fireEvent.change(jsonTextarea, {
      target: { value: JSON.stringify(EXAMPLE_COURSE_EXPORT) },
    });

    fireEvent.click(within(dialog).getByRole('button', { name: /Import Course/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Import Course/i })).not.toBeInTheDocument();
    });

    expect(screen.getByText(/Imported — review and click Save/i)).toBeInTheDocument();
    expect((screen.getByLabelText(/Course Code/i) as HTMLInputElement).value).toBe('STAT101');
    expect((screen.getByLabelText(/Course Title/i) as HTMLInputElement).value).toBe(
      'Probability & Statistics'
    );
    expect(document.querySelectorAll('[data-edit-chapter]')).toHaveLength(3);
  });

  it('shows inline error in ImportCourseDialog on invalid JSON and warns on slug conflict', async () => {
    renderEditor('/editor/new');

    fireEvent.click(screen.getByRole('button', { name: /Import Course/i }));
    const dialog = screen.getByRole('dialog', { name: /Import Course/i });
    const jsonTextarea = within(dialog).getByLabelText(/^Course JSON$/i);

    // Invalid JSON shows inline error inside dialog
    fireEvent.change(jsonTextarea, { target: { value: '{bad json' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Import Course/i }));

    await waitFor(() => {
      expect(within(dialog).getByRole('alert')).toHaveTextContent(/Invalid JSON/i);
    });
    expect(screen.getByRole('dialog', { name: /Import Course/i })).toBeInTheDocument();

    // Valid import whose slug conflicts with existing GUIDE101 resolves slug + shows warning
    const conflictingExport = {
      ...EXAMPLE_COURSE_EXPORT,
      course: {
        ...EXAMPLE_COURSE_EXPORT.course,
        slug: 'guide101-quick-start',
      },
    };
    fireEvent.change(jsonTextarea, { target: { value: JSON.stringify(conflictingExport) } });
    fireEvent.click(within(dialog).getByRole('button', { name: /Import Course/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Import Course/i })).not.toBeInTheDocument();
    });
    const banner = screen.getByRole('status');
    expect(within(banner).getByText(/Imported — review and click Save/i)).toBeInTheDocument();
    expect(within(banner).getByText(/guide101-quick-start-2/i)).toBeInTheDocument();
  });

  it('lesson PrerequisitePicker excludes self and own parent chapter, and Collapse all collapses expanded lessons', () => {
    renderEditor('/editor/new');
    expandChapter1AndLesson1();

    // Add a second lesson inside Chapter 1 and a second chapter
    fireEvent.click(screen.getByRole('button', { name: /Add Sub-Lesson to Chapter 1/i }));
    fireEvent.click(within(screen.getByTestId('editor-sticky-bar')).getByRole('button', { name: /^Add$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add Chapter/i }));

    const chapter1Card = document.querySelectorAll('[data-edit-chapter]')[0] as HTMLElement;
    const ch1Lessons = chapter1Card.querySelectorAll('[data-edit-lesson]');
    expect(ch1Lessons).toHaveLength(2);

    const firstLessonCard = ch1Lessons[0] as HTMLElement;
    const firstLessonId = firstLessonCard.getAttribute('data-edit-lesson')!;
    const lessonPrereqPicker = firstLessonCard.querySelector(
      `[data-prereq-for="${firstLessonId}"]`
    ) as HTMLElement;
    const lessonPrereqScope = within(lessonPrereqPicker);

    // Expand Prerequisites section (collapsed by default)
    fireEvent.click(
      lessonPrereqScope.getByRole('button', { name: /Prerequisites \(click to toggle\)/i })
    );

    // Excludes self ("Course Introduction") and own parent chapter ("Ch1 1. Foundations")
    expect(
      lessonPrereqScope.queryByRole('button', { name: /Course Introduction/i })
    ).not.toBeInTheDocument();
    expect(
      lessonPrereqScope.queryByRole('button', { name: /Ch1\s+1\. Foundations/i })
    ).not.toBeInTheDocument();

    // Allows sibling lesson ("Ch1 / L2 New Sub-Lesson 2") and Chapter 2 ("Ch2 2. New Chapter")
    expect(
      lessonPrereqScope.getByRole('button', { name: /Ch1 \/ L2\s+New Sub-Lesson 2/i })
    ).toBeInTheDocument();
    expect(
      lessonPrereqScope.getByRole('button', { name: /Ch2\s+2\. New Chapter/i })
    ).toBeInTheDocument();

    // Collapse all collapses expanded lessons and chapters, and chapters can be manually toggled
    const stickyBar = screen.getByTestId('editor-sticky-bar');
    expect(screen.getAllByLabelText('Sub-Lesson Title').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Chapter 1 title')).toBeInTheDocument();

    // Manually collapse and expand Chapter 1
    fireEvent.click(screen.getByRole('button', { name: /Collapse Chapter 1/i }));
    expect(screen.queryByLabelText('Chapter 1 title')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Expand Chapter 1/i }));
    expect(screen.getByLabelText('Chapter 1 title')).toBeInTheDocument();

    // Collapse all collapses all chapters and lessons
    fireEvent.click(within(stickyBar).getByRole('button', { name: /Collapse all/i }));
    expect(screen.queryByLabelText('Sub-Lesson Title')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Chapter 1 title')).not.toBeInTheDocument();
  });

  it('forgets progress and bookmarks when deleting an existing course', () => {
    saveProgressState({
      version: 1,
      statuses: {
        'guide101-quick-start': {
          'guide101-ch1-l1-browsing-bookmarks': 'done',
        },
      },
      bookmarks: ['guide101-quick-start'],
    });

    renderEditor('/course/guide101-quick-start/edit');

    fireEvent.click(screen.getByRole('button', { name: /Delete Course/i }));
    const confirmDialog = screen.getByRole('dialog');
    fireEvent.click(within(confirmDialog).getByRole('button', { name: /^Delete Course$/i }));

    expect(screen.getByTestId('catalog-destination')).toBeInTheDocument();
    const progress = loadProgressState();
    expect(progress.statuses['guide101-quick-start']).toBeUndefined();
    expect(progress.bookmarks).toEqual([]);
  });

  it('keeps sticky Add Chapter in EditorStickyBar and smoothly scrolls to newly added chapters', () => {
    const scrollIntoViewMock = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });

    renderEditor('/editor/new');

    const stickyBar = screen.getByTestId('editor-sticky-bar');
    const addButtons = screen.getAllByRole('button', { name: /^Add$/i });
    expect(addButtons).toHaveLength(1);
    expect(within(stickyBar).getByRole('button', { name: /^Add$/i })).toBe(
      addButtons[0]
    );

    fireEvent.click(addButtons[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: /Add Chapter/i }));

    const chapters = document.querySelectorAll('[data-edit-chapter]');
    expect(chapters).toHaveLength(2);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    expect(scrollIntoViewMock.mock.instances[0]).toBe(chapters[1]);
  });

  it('preserves typed #course-year text on out-of-range input, shows inline alert, blocks Save, and saves valid year', () => {
    renderEditor('/editor/new');

    const yearInput = screen.getByLabelText(/Year/i) as HTMLInputElement;
    const stickyBar = screen.getByTestId('editor-sticky-bar');

    // Out-of-range high (11)
    fireEvent.change(yearInput, { target: { value: '11' } });
    expect(yearInput.value).toBe('11');
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Year must be an integer from 1 to 10\./i
    );

    // Save is blocked while year is invalid
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));
    expect(screen.queryByTestId('course-view-destination')).not.toBeInTheDocument();

    // Out-of-range low (0)
    fireEvent.change(yearInput, { target: { value: '0' } });
    expect(yearInput.value).toBe('0');
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);

    // Valid integer (2) clears error and saves cleanly
    fireEvent.change(yearInput, { target: { value: '2' } });
    expect(yearInput.value).toBe('2');
    expect(screen.queryByText(/Year must be an integer from 1 to 10\./i)).not.toBeInTheDocument();

    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));
    expect(screen.getByTestId('course-view-destination')).toBeInTheDocument();

    const savedCourses = loadCoursesCatalog();
    expect(savedCourses.some((c) => c.year === 2)).toBe(true);
  });

  it('keeps LessonEditorCard header background and border classes identical across expand/collapse', () => {
    renderEditor('/editor/new');
    expandChapter1AndLesson1();

    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    const toggleBtn = lessonCard.querySelector('button[aria-expanded]') as HTMLButtonElement;
    const headerRow = toggleBtn.parentElement as HTMLElement;

    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    const expandedClasses = headerRow.className;
    expect(expandedClasses).toContain('bg-[var(--surface-editor-header)]');
    expect(expandedClasses).toContain('border-[var(--border-subtle)]');
    expect(expandedClasses).toContain('border-l-4');
    expect(expandedClasses).toContain('border-l-[var(--tag-peach-border)]');
    expect(expandedClasses).not.toContain('#ffe599');

    const lessonPosBadge = within(headerRow).getByText('Ch1 / L1');
    expect(lessonPosBadge.className).toContain('bg-[var(--tag-peach-bg)]');
    expect(lessonPosBadge.className).toContain('text-[var(--tag-peach-text)]');
    expect(lessonPosBadge.className).toContain('border-[var(--tag-peach-border)]');
    expect(lessonPosBadge.className).not.toContain('bg-slate-900');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    const collapsedClasses = headerRow.className;

    expect(collapsedClasses).toContain('bg-[var(--surface-editor-header)]');
    expect(collapsedClasses).toContain('border-[var(--border-subtle)]');
    expect(collapsedClasses).toContain('border-l-[var(--tag-peach-border)]');
    expect(collapsedClasses).not.toContain('#ffe599');
  });

  it('toggles Pin as Recommended on a material row and persists recommended: true on Save', () => {
    renderEditor('/editor/new');
    expandChapter1AndLesson1();

    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    const lessonScope = within(lessonCard);

    fireEvent.click(lessonScope.getByRole('button', { name: /Add Material/i }));
    fireEvent.change(lessonScope.getByLabelText(/Material title/i), {
      target: { value: 'Core Syllabus PDF' },
    });
    fireEvent.change(lessonScope.getByLabelText(/Material URL/i), {
      target: { value: 'https://example.edu/syllabus.pdf' },
    });

    const pinBtn = lessonScope.getByRole('button', { name: /Pin as recommended/i });
    expect(pinBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(pinBtn);
    const unpinBtn = lessonScope.getByRole('button', { name: /Unpin recommended material/i });
    expect(unpinBtn).toHaveAttribute('aria-pressed', 'true');
    expect(unpinBtn.className).toContain('border-[var(--recommended-border)]');

    // Pinned resources are grouped inside a single dashed purple Recommended container
    const recGroup = lessonScope.getByTestId('editor-recommended-group');
    expect(recGroup).toHaveClass('recommended-group-box');
    expect(within(recGroup).getByRole('heading', { name: 'Recommended' })).toBeInTheDocument();

    // Add a second material and verify reordering with Move material up / Move material down + delete button consistency
    fireEvent.click(lessonScope.getByRole('button', { name: /Add Material/i }));
    const titleInputs = lessonScope.getAllByLabelText(/Material title/i) as HTMLInputElement[];
    fireEvent.change(titleInputs[1], { target: { value: 'Second Material' } });
    fireEvent.change(lessonScope.getAllByLabelText(/Material URL/i)[1], {
      target: { value: 'https://example.edu/second.pdf' },
    });
    // Pin second material too so both are in the same group and can be reordered
    fireEvent.click(lessonScope.getByRole('button', { name: /Pin as recommended/i }));
    const moveUpBtns = lessonScope.getAllByRole('button', { name: /Move material up/i });
    const moveDownBtns = lessonScope.getAllByRole('button', { name: /Move material down/i });
    expect(moveUpBtns[0]).toBeDisabled();
    expect(moveDownBtns[1]).toBeDisabled();
    fireEvent.click(moveUpBtns[1]);
    expect(
      (lessonScope.getAllByLabelText(/Material title/i)[0] as HTMLInputElement).value
    ).toBe('Second Material');
    // Move back so Core Syllabus PDF is first for the existing assertion below
    fireEvent.click(lessonScope.getAllByRole('button', { name: /Move material down/i })[0]);
    expect(
      (lessonScope.getAllByLabelText(/Material title/i)[0] as HTMLInputElement).value
    ).toBe('Core Syllabus PDF');
    // Delete button matches chapter/sublesson delete button styling
    const removeBtns = lessonScope.getAllByRole('button', { name: /Remove material/i });
    expect(removeBtns[0]).toHaveClass('border', 'border-[var(--status-danger-border)]');

    const stickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));
    expect(screen.getByTestId('course-view-destination')).toBeInTheDocument();

    const savedCourses = loadCoursesCatalog();
    const created = savedCourses.find((c) => c.slug === 'cs101-new-college-course');
    const resource = created?.chapters[0]?.lessons[0]?.resources[0];
    expect(resource?.title).toBe('Core Syllabus PDF');
    expect(resource?.recommended).toBe(true);
  });

  it('supports Interactive material mode only when exam or assignment kind is chosen: 3-way XOR, Build / Edit modal, inline Import JSON, and Export JSON', async () => {
    renderEditor('/editor/new');
    expandChapter1AndLesson1();

    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    const lessonScope = within(lessonCard);

    fireEvent.click(lessonScope.getByRole('button', { name: /Add Material/i }));
    fireEvent.change(lessonScope.getByLabelText(/Material URL/i), {
      target: { value: 'https://example.edu/will-be-cleared' },
    });

    // Default kind is 'document' -> Interactive tab is NOT visible
    expect(lessonScope.queryByRole('button', { name: /^Interactive$/i })).not.toBeInTheDocument();

    // Select 'exam' kind -> Interactive tab becomes visible
    const kindSelect = lessonScope.getByLabelText(/Resource kind/i) as HTMLSelectElement;
    fireEvent.change(kindSelect, { target: { value: 'exam' } });
    expect(lessonScope.getByRole('button', { name: /^Interactive$/i })).toBeInTheDocument();

    // Switch to Interactive mode (clears URL)
    fireEvent.click(lessonScope.getByRole('button', { name: /^Interactive$/i }));
    expect(lessonScope.queryByLabelText(/Material URL/i)).not.toBeInTheDocument();

    // Open Build / Edit -> AssessmentBuilderModal
    fireEvent.click(lessonScope.getByRole('button', { name: /Build \/ Edit/i }));
    const builderDialog = screen.getByRole('dialog');
    const builderScope = within(builderDialog);

    fireEvent.change(builderScope.getByLabelText(/Assessment title/i), {
      target: { value: 'Midterm Diagnostic' },
    });
    fireEvent.change(builderScope.getByLabelText(/Question text/i), {
      target: { value: 'What is $2 + 2$?' },
    });
    fireEvent.click(builderScope.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(lessonScope.getByText(/Exam · 1 question/i)).toBeInTheDocument();
    expect((lessonScope.getByLabelText(/Material title/i) as HTMLInputElement).value).toBe(
      'Midterm Diagnostic'
    );

    // Export JSON produces formatted .assessment.json envelope and revokes Blob URL
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLMock = vi.fn(
      (_obj: Blob | MediaSource) => 'blob:mock-assessment-url'
    );
    const revokeObjectURLMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLMock,
    });
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    try {
      vi.useFakeTimers();
      fireEvent.click(lessonScope.getByRole('button', { name: /Export JSON/i }));

      await vi.advanceTimersByTimeAsync(1000);
      vi.useRealTimers();

      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-assessment-url');

      const exportedBlob = createObjectURLMock.mock.calls[0][0] as Blob;
      const exportedText = await new Promise<string>((resolve, reject) => {
        if (typeof exportedBlob.text === 'function') {
          exportedBlob.text().then(resolve, reject);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
        reader.readAsText(exportedBlob);
      });
      const exportedParsed = JSON.parse(exportedText) as {
        format: string;
        title?: string;
        assessment: { questions: Array<{ header: { text?: string } }> };
      };
      expect(exportedParsed.format).toBe(ASSESSMENT_EXPORT_FORMAT);
      expect(exportedParsed.title).toBe('Midterm Diagnostic');
      expect(exportedParsed.assessment.questions[0]?.header.text).toBe('What is $2 + 2$?');
    } finally {
      vi.useRealTimers();
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
    }

    // Inline Import JSON: malformed JSON shows role="alert", valid JSON updates row
    fireEvent.click(lessonScope.getByRole('button', { name: /Import JSON/i }));
    const pasteBox = lessonScope.getByLabelText(/Paste assessment JSON/i);
    fireEvent.change(pasteBox, { target: { value: '{not valid json' } });
    fireEvent.click(lessonScope.getByRole('button', { name: /Apply Import/i }));

    await waitFor(() => {
      expect(lessonScope.getByRole('alert')).toHaveTextContent(/Invalid JSON/i);
    });

    const validEnvelope = {
      format: ASSESSMENT_EXPORT_FORMAT,
      version: 1,
      title: 'Lab Quiz 1',
      kind: 'assignment',
      assessment: {
        mode: 'assignment',
        questions: [
          {
            id: 'q-1',
            type: 'true-false',
            header: { text: 'Arrays have $O(1)$ random access.' },
            options: ['True', 'False'],
            correctIndices: [0],
          },
          {
            id: 'q-2',
            type: 'short-answer',
            header: { text: 'Name the LIFO structure.' },
            acceptedAnswers: ['stack'],
          },
        ],
      },
    };
    fireEvent.change(pasteBox, { target: { value: JSON.stringify(validEnvelope) } });
    fireEvent.click(lessonScope.getByRole('button', { name: /Apply Import/i }));

    await waitFor(() => {
      expect(lessonScope.getByText(/Assignment · 2 questions/i)).toBeInTheDocument();
    });

    // Save course -> assessment persisted with 3-way XOR (no url, no file)
    const stickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));
    expect(screen.getByTestId('course-view-destination')).toBeInTheDocument();

    const savedCourses = loadCoursesCatalog();
    const created = savedCourses.find((c) => c.slug === 'cs101-new-college-course');
    const savedResource = created?.chapters[0]?.lessons[0]?.resources[0];
    expect(savedResource?.url).toBeUndefined();
    expect(savedResource?.file).toBeUndefined();
    expect(savedResource?.assessment?.mode).toBe('assignment');
    expect(savedResource?.assessment?.questions).toHaveLength(2);
  });

  it('clears interactive assessment when switching back to Link mode or changing kind away from exam/assignment', () => {
    renderEditor('/editor/new');
    expandChapter1AndLesson1();

    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    const lessonScope = within(lessonCard);

    fireEvent.click(lessonScope.getByRole('button', { name: /Add Material/i }));
    const kindSelect = lessonScope.getByLabelText(/Resource kind/i) as HTMLSelectElement;
    fireEvent.change(kindSelect, { target: { value: 'exam' } });
    fireEvent.click(lessonScope.getByRole('button', { name: /^Interactive$/i }));
    fireEvent.click(lessonScope.getByRole('button', { name: /Import JSON/i }));

    const validEnvelope = {
      format: ASSESSMENT_EXPORT_FORMAT,
      version: 1,
      assessment: {
        mode: 'exam',
        questions: [
          {
            id: 'q-1',
            type: 'true-false',
            header: { text: 'Is 1 prime?' },
            options: ['True', 'False'],
            correctIndices: [1],
          },
        ],
      },
    };
    fireEvent.change(lessonScope.getByLabelText(/Paste assessment JSON/i), {
      target: { value: JSON.stringify(validEnvelope) },
    });
    fireEvent.click(lessonScope.getByRole('button', { name: /Apply Import/i }));

    return waitFor(() => {
      expect(lessonScope.getByText(/Exam · 1 question/i)).toBeInTheDocument();
    }).then(() => {
      // Switch to Link -> clears assessment (after confirming), switching back to Interactive shows empty state
      fireEvent.click(lessonScope.getByRole('button', { name: /^Link$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Switch Mode$/i }));
      fireEvent.click(lessonScope.getByRole('button', { name: /^Interactive$/i }));
      expect(lessonScope.queryByText(/Exam · 1 question/i)).not.toBeInTheDocument();
      expect(
        lessonScope.getByText(/No interactive exam or assignment configured yet\./i)
      ).toBeInTheDocument();

      // Changing kind to 'video' hides Interactive tab and switches back to Link mode
      fireEvent.change(kindSelect, { target: { value: 'video' } });
      expect(lessonScope.queryByRole('button', { name: /^Interactive$/i })).not.toBeInTheDocument();
      expect(lessonScope.getByLabelText(/Material URL/i)).toBeInTheDocument();
    });
  });

  it('surfaces human-clear validation errors in EditorStickyBar, highlights offending field, and prompts before leaving with unsaved edits', () => {
    renderEditor('/editor/new');
    expandChapter1AndLesson1();

    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    const lessonScope = within(lessonCard);

    // Add a material row with a title but leave URL empty
    fireEvent.click(lessonScope.getByRole('button', { name: /Add Material/i }));
    fireEvent.change(lessonScope.getByLabelText(/Material title/i), {
      target: { value: 'Incomplete Lecture Link' },
    });

    const stickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));

    // Save is blocked, error is shown inside sticky bar with clear Ch1 / L1 and Material #1 context
    expect(screen.queryByTestId('course-view-destination')).not.toBeInTheDocument();
    expect(within(stickyBar).getByRole('alert')).toHaveTextContent(
      /Ch1 \/ L1 \("Course Introduction"\), Material #1 \("Incomplete Lecture Link"\): Please enter a valid URL/i
    );

    // Offending material row and URL input are highlighted
    expect(document.querySelectorAll('[data-field-error="true"]').length).toBeGreaterThanOrEqual(1);

    // Resolving the invalid URL immediately clears both inline field error and sticky error banner
    fireEvent.change(lessonScope.getByLabelText(/Material URL/i), {
      target: { value: 'https://example.edu/lecture-1' },
    });
    expect(within(stickyBar).queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-field-error="true"]')).toHaveLength(0);

    // Clicking Back link while dirty opens the Unsaved changes confirmation dialog
    fireEvent.click(screen.getByRole('link', { name: /All Courses/i }));
    const unsavedDialog = screen.getByRole('dialog', { name: /Unsaved changes/i });
    expect(unsavedDialog).toBeInTheDocument();

    // Keep Editing closes the dialog and stays in the editor
    fireEvent.click(within(unsavedDialog).getByRole('button', { name: /Keep Editing/i }));
    expect(screen.queryByRole('dialog', { name: /Unsaved changes/i })).not.toBeInTheDocument();

    // Clicking Back link again and choosing Discard Edits navigates away
    fireEvent.click(screen.getByRole('link', { name: /All Courses/i }));
    const unsavedDialog2 = screen.getByRole('dialog', { name: /Unsaved changes/i });
    fireEvent.click(within(unsavedDialog2).getByRole('button', { name: /Discard Edits/i }));
    expect(screen.getByTestId('catalog-destination')).toBeInTheDocument();
  });

  it('renders Live Tree Preview unframed (framed={false}) and uses 4-tier Light/Dark classes without legacy washes', () => {
    renderEditor('/editor/new');

    const mainEl = document.querySelector('main') as HTMLElement;
    expect(mainEl.className).toContain('bg-[var(--surface-canvas)]');
    expect(mainEl.className).toContain('text-[var(--text-primary)]');
    expect(mainEl.innerHTML).not.toContain('#fdff00');
    expect(mainEl.innerHTML).not.toContain('#ffe599');
    expect(mainEl.innerHTML).not.toContain('yellow-950');

    // Preview tab renders CourseTreeCanvas with framed={false} (no duplicate .roadmap-canvas-frame)
    fireEvent.click(screen.getByRole('tab', { name: /Live Tree Preview/i }));
    expect(document.querySelector('.roadmap-canvas-frame')).toBeNull();
    expect(document.querySelector('svg.roadmap-svg')).not.toBeNull();

    // ImportCourseDialog uses updated Light/Dark dialog & inset classes
    fireEvent.click(screen.getByRole('button', { name: /Import Course/i }));
    const dialog = screen.getByRole('dialog', { name: /Import Course/i });
    expect(dialog.className).toContain('bg-[var(--surface-1)]');
    expect(within(dialog).getByLabelText(/^Course JSON$/i).className).toContain(
      'bg-[var(--surface-inset)]'
    );
  });

  it('starts existing chapters and lessons collapsed, expands newly added chapters and lessons, and initializes optional/required fields properly', () => {
    renderEditor('/editor/new');

    // Optional fields start empty with placeholders
    const yearInput = screen.getByLabelText(/Year/i) as HTMLInputElement;
    const creditsInput = screen.getByLabelText(/Credits/i) as HTMLInputElement;
    expect(yearInput.value).toBe('');
    expect(yearInput.placeholder).toBe('e.g. 2');
    expect(creditsInput.value).toBe('');
    expect(creditsInput.placeholder).toBe('e.g. 3');

    // Required fields start with default values AND placeholders
    const codeInput = screen.getByLabelText(/Course Code/i) as HTMLInputElement;
    const titleInput = screen.getByLabelText(/Course Title/i) as HTMLInputElement;
    const slugInput = screen.getByLabelText(/URL Slug/i) as HTMLInputElement;
    const descInput = screen.getAllByLabelText(/Description/i)[0] as HTMLTextAreaElement;
    expect(codeInput.value).toBe('CS101');
    expect(codeInput.placeholder).toBe('e.g. MATH201');
    expect(titleInput.value).toBe('New College Course');
    expect(titleInput.placeholder).toBe('e.g. Linear Algebra');
    expect(slugInput.value).toBe('cs101-new-college-course');
    expect(slugInput.placeholder).toBe('e.g. cs101-new-college-course');
    expect(descInput.value).toContain('Course overview');
    expect(descInput.placeholder).toContain('Course overview');

    // New courses open Chapter 1 and its starter Lesson 1 expanded by default
    expect(screen.getByRole('button', { name: /Collapse Chapter 1/i })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByLabelText('Chapter 1 title')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Sub-Lesson Title')).toHaveLength(1);

    // Adding a new Sub-Lesson to Chapter 1 opens it expanded immediately
    fireEvent.click(screen.getByRole('button', { name: /Add Sub-Lesson to Chapter 1/i }));
    const lessonTitleInputs = screen.getAllByLabelText('Sub-Lesson Title') as HTMLInputElement[];
    expect(lessonTitleInputs).toHaveLength(2);
    expect(lessonTitleInputs[1].value).toBe('New Sub-Lesson 2');
    expect(lessonTitleInputs[1].placeholder).toBe('e.g. Course Introduction');
    const lessonSummaryInputs = screen.getAllByLabelText('Lesson Summary') as HTMLTextAreaElement[];
    expect(lessonSummaryInputs[1].placeholder).toContain('Brief summary');

    // Adding a new Chapter opens both the new chapter and its initial sub-lesson expanded
    fireEvent.click(within(screen.getByTestId('editor-sticky-bar')).getByRole('button', { name: /^Add$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add Chapter/i }));
    expect(screen.getByLabelText('Chapter 2 title')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Sub-Lesson Title')).toHaveLength(3);
  });

  it('formats From and To week range inputs (empty, single week, equal From/To, multi-week) and disables To when From is empty', () => {
    renderEditor('/editor/new');
    expandChapter1AndLesson1();

    const fromInput = screen.getByLabelText('Chapter 1 week from') as HTMLInputElement;
    const toInput = screen.getByLabelText('Chapter 1 week to') as HTMLInputElement;

    // Both start empty and To is disabled
    expect(fromInput.value).toBe('');
    expect(toInput.value).toBe('');
    expect(toInput).toBeDisabled();
    expect(
      screen.queryByText(/Hidden on syllabus views since it duplicates/i)
    ).not.toBeInTheDocument();

    // Reject non-positive integer (0 or negative)
    fireEvent.change(fromInput, { target: { value: '0' } });
    expect(fromInput.value).toBe('');
    expect(toInput).toBeDisabled();

    // From = 1, To = empty -> enables To and saves as "Week 1"
    fireEvent.change(fromInput, { target: { value: '1' } });
    expect(fromInput.value).toBe('1');
    expect(toInput).not.toBeDisabled();

    // From = 1, To = 2 -> formats as "Week 1-2"
    fireEvent.change(toInput, { target: { value: '2' } });
    expect(toInput.value).toBe('2');

    // Clearing From clears and disables To
    fireEvent.change(fromInput, { target: { value: '' } });
    expect(fromInput.value).toBe('');
    expect(toInput.value).toBe('');
    expect(toInput).toBeDisabled();

    // Set From = 3, To = 3 -> saves as "Week 3"
    fireEvent.change(fromInput, { target: { value: '3' } });
    fireEvent.change(toInput, { target: { value: '3' } });

    const stickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));
    expect(screen.getByTestId('course-view-destination')).toBeInTheDocument();

    const savedCourses = loadCoursesCatalog();
    const created = savedCourses.find((c) => c.slug === 'cs101-new-college-course');
    expect(created?.chapters[0]?.weekRange).toBe('Week 3');
  });

  it('displays live resource-count tags on sublessons (light blue after ID) and chapters (amber when > 0 resources)', () => {
    renderEditor('/editor/new');
    expandChapter1AndLesson1();

    const chapter1Card = document.querySelectorAll('[data-edit-chapter]')[0] as HTMLElement;
    const ch1Scope = within(chapter1Card);

    // Chapter starts with 0 resources -> chapter-resource-count-tag is not rendered
    expect(ch1Scope.queryByTestId('chapter-resource-count-tag')).not.toBeInTheDocument();

    // Sublesson starts with 0 materials -> lesson-resource-count-tag is rendered in burnt peach right after derived ID
    const lessonTag = ch1Scope.getByTestId('lesson-resource-count-tag');
    expect(lessonTag).toHaveTextContent('0 materials');
    expect(lessonTag.className).toContain('bg-[var(--tag-peach-bg)]');
    expect(lessonTag.className).toContain('text-[var(--tag-peach-text)]');
    expect(lessonTag.className).toContain('border-[var(--tag-peach-border)]');
    expect(lessonTag.previousElementSibling).toHaveTextContent('cs101-ch1-l1-course-introduction');

    // Add a material to Lesson 1 -> updates live to "1 material"
    const lessonCard = chapter1Card.querySelector('[data-edit-lesson]') as HTMLElement;
    fireEvent.click(within(lessonCard).getByRole('button', { name: /Add Material/i }));
    expect(ch1Scope.getByTestId('lesson-resource-count-tag')).toHaveTextContent('1 material');

    // Add a material to Chapter 1 -> chapter-resource-count-tag appears in amber with "1 material"
    const chapterMaterialsBtn = ch1Scope.getAllByRole('button', { name: /Add Material/i })[0];
    fireEvent.click(chapterMaterialsBtn);
    const chapterResTag = ch1Scope.getByTestId('chapter-resource-count-tag');
    expect(chapterResTag).toHaveTextContent('1 material');
    expect(chapterResTag.className).toContain('bg-[var(--tag-amber-bg)]');
    expect(chapterResTag.className).toContain('text-[var(--tag-amber-text)]');
    expect(chapterResTag.className).toContain('border-[var(--tag-amber-border)]');
  });

  it('removes the duplicate page-top error banner, offsets sticky headers below EditorStickyBar when error banner is visible, and strips top rounded corners when stuck', () => {
    renderEditor('/editor/new');
    expandChapter1AndLesson1();

    const mainEl = document.querySelector('main') as HTMLElement;
    const stickyBar = screen.getByTestId('editor-sticky-bar');
    const chapterHeader = document.querySelector('[data-sticky-header="chapter"]') as HTMLElement;
    const lessonHeader = document.querySelector('[data-sticky-header="lesson"]') as HTMLElement;

    // Before validation error: sticky bar height is 56px, chapter top offset is calc(64px + 56px)
    expect(mainEl.style.getPropertyValue('--editor-sticky-bar-height')).toBe('56px');
    expect(mainEl.style.getPropertyValue('--editor-chapter-sticky-top')).toBe('calc(64px + 56px)');
    expect(chapterHeader.className).toContain('top-[var(--editor-chapter-sticky-top,120px)]');
    expect(lessonHeader.className).toContain('top-[var(--editor-lesson-sticky-top,168px)]');

    // Trigger validation error by clearing Course Title
    fireEvent.change(screen.getByLabelText(/Course Title/i), { target: { value: '' } });
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));

    // 1 top-level banner alert inside EditorStickyBar + 1 inline field alert (no duplicate summary banner at top of page)
    const bannerAlerts = screen.getAllByText(/Course Metadata: Please enter a Course Title\./i);
    expect(bannerAlerts).toHaveLength(2);
    expect(within(stickyBar).getByText(/Course Metadata: Please enter a Course Title\./i)).toBeInTheDocument();

    // When sticky error banner is visible, --editor-sticky-bar-height increases to push sticky headers down
    expect(mainEl.style.getPropertyValue('--editor-sticky-bar-height')).toBe('92px');
    expect(mainEl.style.getPropertyValue('--editor-chapter-sticky-top')).toBe('calc(64px + 92px)');

    // Initially unstuck -> top rounded corners are present
    expect(chapterHeader).toHaveAttribute('data-stuck', 'false');
    expect(chapterHeader.className).toContain('rounded-t-lg');
    expect(lessonHeader).toHaveAttribute('data-stuck', 'false');
    expect(lessonHeader.className).toContain('rounded-t-md');

    // Simulate scrolling so chapter and lesson headers reach their sticky top threshold
    const originalScrollY = window.scrollY;
    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 300 });
    vi.spyOn(chapterHeader, 'getBoundingClientRect').mockReturnValue({
      top: 120,
      bottom: 168,
      left: 0,
      right: 800,
      width: 800,
      height: 48,
      x: 0,
      y: 120,
      toJSON: () => ({}),
    });
    vi.spyOn(lessonHeader, 'getBoundingClientRect').mockReturnValue({
      top: 168,
      bottom: 210,
      left: 0,
      right: 800,
      width: 800,
      height: 42,
      x: 0,
      y: 168,
      toJSON: () => ({}),
    });

    fireEvent.scroll(window);

    expect(chapterHeader).toHaveAttribute('data-stuck', 'true');
    expect(chapterHeader.className).toContain('rounded-t-none');
    expect(chapterHeader.className).not.toContain('rounded-t-lg');

    expect(lessonHeader).toHaveAttribute('data-stuck', 'true');
    expect(lessonHeader.className).toContain('rounded-t-none');
    expect(lessonHeader.className).not.toContain('rounded-t-md');

    // Unstick when scrolled back to top -> restores top rounded corners
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      writable: true,
      value: originalScrollY,
    });
    fireEvent.scroll(window);

    expect(chapterHeader).toHaveAttribute('data-stuck', 'false');
    expect(chapterHeader.className).toContain('rounded-t-lg');
    expect(lessonHeader).toHaveAttribute('data-stuck', 'false');
    expect(lessonHeader.className).toContain('rounded-t-md');
  });

  it('switches from Live Tree Preview to editor, expands collapsed chapter/lesson, scrolls into view, and focuses title on node click', () => {
    const scrollIntoViewMock = vi.fn();
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoViewMock,
    });

    renderEditor('/editor/new');

    // Collapse Chapter 1 and Lesson 1 first so we can verify Preview click re-expands them
    const stickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(stickyBar).getByRole('button', { name: /Collapse all/i }));
    expect(screen.queryByLabelText('Chapter 1 title')).not.toBeInTheDocument();

    // Switch to Live Tree Preview and click Lesson 1 node
    fireEvent.click(screen.getByRole('tab', { name: /Live Tree Preview/i }));
    const lessonNode = document.querySelector(
      'g[data-node-kind="lesson"]'
    ) as SVGGElement;
    expect(lessonNode).not.toBeNull();
    fireEvent.click(lessonNode);

    // Switches back to editor, expands Chapter 1 & Lesson 1, scrolls into view, and focuses Sub-Lesson Title
    const lessonTitleInput = screen.getByLabelText('Sub-Lesson Title') as HTMLInputElement;
    expect(lessonTitleInput).toBeInTheDocument();
    expect(document.activeElement).toBe(lessonTitleInput);
    expect(scrollIntoViewMock).toHaveBeenCalled();

    // Collapse all, switch to Live Tree Preview, and click Chapter 1 node
    fireEvent.click(within(stickyBar).getByRole('button', { name: /Collapse all/i }));
    fireEvent.click(screen.getByRole('tab', { name: /Live Tree Preview/i }));
    const chapterNode = document.querySelector(
      'g[data-node-kind="chapter"]'
    ) as SVGGElement;
    fireEvent.click(chapterNode);

    const chapterTitleInput = screen.getByLabelText('Chapter 1 title') as HTMLInputElement;
    expect(chapterTitleInput).toBeInTheDocument();
    expect(document.activeElement).toBe(chapterTitleInput);

    // Chapter and Lesson cards align scroll-mt-* to the stacked sticky header CSS variables
    const chCard = document.querySelector('[data-edit-chapter]') as HTMLElement;
    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    expect(chCard.className).toContain('scroll-mt-[var(--editor-chapter-sticky-top,120px)]');
    expect(lessonCard.className).toContain('scroll-mt-[var(--editor-lesson-sticky-top,168px)]');

    // Add a spine supplement, collapse all, click its node in Live Tree Preview -> jumps, expands, scrolls, and focuses Supplement Title
    const currentStickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(currentStickyBar).getByRole('button', { name: /^Add$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add Supplement/i }));
    fireEvent.click(within(currentStickyBar).getByRole('button', { name: /Collapse all/i }));
    expect(screen.queryByLabelText('Supplement Title')).not.toBeInTheDocument();

    scrollIntoViewMock.mockClear();
    fireEvent.click(screen.getByRole('tab', { name: /Live Tree Preview/i }));
    const supplementNode = document.querySelector(
      'g[data-node-kind="supplement"]'
    ) as SVGGElement;
    expect(supplementNode).not.toBeNull();
    fireEvent.click(supplementNode);

    const supplementTitleInput = screen.getByLabelText('Supplement Title') as HTMLInputElement;
    expect(supplementTitleInput).toBeInTheDocument();
    expect(document.activeElement).toBe(supplementTitleInput);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    const supCard = document.querySelector('[data-edit-supplement]') as HTMLElement;
    expect(supCard.className).toContain('scroll-mt-[var(--editor-chapter-sticky-top,120px)]');
  });

  it('toggles chapter and sublesson expand/collapse when clicking the outer header row side area without intercepting action buttons', () => {
    renderEditor('/editor/new');

    const chapterHeader = document.querySelector('[data-sticky-header="chapter"]') as HTMLElement;
    expect(screen.getByLabelText('Chapter 1 title')).toBeInTheDocument();

    // Clicking the outer chapter header container collapses Chapter 1, and clicking again expands it
    fireEvent.click(chapterHeader);
    expect(screen.queryByLabelText('Chapter 1 title')).not.toBeInTheDocument();
    fireEvent.click(chapterHeader);
    expect(screen.getByLabelText('Chapter 1 title')).toBeInTheDocument();

    // Clicking an interactive button inside the header (e.g. Move chapter down — disabled or Delete) does NOT collapse it
    const moveDownBtn = within(chapterHeader).getByRole('button', { name: /Move chapter down/i });
    fireEvent.click(moveDownBtn);
    expect(screen.getByLabelText('Chapter 1 title')).toBeInTheDocument();

    // Clicking the outer sublesson header row collapses Lesson 1, and clicking again expands it
    const lessonHeader = document.querySelector('[data-sticky-header="lesson"]') as HTMLElement;
    expect(screen.getByLabelText('Sub-Lesson Title')).toBeInTheDocument();
    fireEvent.click(lessonHeader);
    expect(screen.queryByLabelText('Sub-Lesson Title')).not.toBeInTheDocument();
    fireEvent.click(lessonHeader);
    expect(screen.getByLabelText('Sub-Lesson Title')).toBeInTheDocument();
  });

  it('validates duplicate slug, min-length fields, To < From week ranges, and guards beforeunload when dirty', () => {
    renderEditor('/editor/new');

    // Clean state: beforeunload does not preventDefault
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    // Dirty state: beforeunload calls preventDefault
    const titleInput = screen.getByLabelText(/Course Title/i);
    fireEvent.change(titleInput, { target: { value: 'A' } });
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);

    // Min-length + duplicate slug validation on Save
    const slugInput = screen.getByLabelText(/URL Slug/i);
    fireEvent.change(slugInput, { target: { value: 'guide101-quick-start' } });
    const stickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));
    expect(screen.getAllByText(/at least 2 characters/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/already exists/i).length).toBeGreaterThanOrEqual(1);

    // To < From week range validation
    const fromInput = screen.getByLabelText('Chapter 1 week from');
    const toInput = screen.getByLabelText('Chapter 1 week to');
    fireEvent.change(fromInput, { target: { value: '5' } });
    fireEvent.change(toInput, { target: { value: '2' } });
    expect(screen.getByText(/To week must be greater than or equal to From week/i)).toBeInTheDocument();
  });

  it('adds spine and lesson supplements via + Add menu, supports typed custom fields with DD/MM/YYYY date validation & reordering, disables colliding side, and saves cleanly', () => {
    renderEditor('/editor/new');

    // Add a child supplement to Lesson 1 (Lesson 1 is at index 0 -> auto-placed on left -> Right is disabled)
    fireEvent.click(screen.getByRole('button', { name: /Add Child Supplement$/i }));
    const supplementCard = document.querySelector('[data-edit-supplement]') as HTMLElement;
    const sideSelect = within(supplementCard).getByLabelText('Branch Side') as HTMLSelectElement;
    const rightOption = within(sideSelect).getByRole('option', {
      name: /Right/i,
    }) as HTMLOptionElement;
    expect(rightOption.disabled).toBe(true);

    // Add two typed custom fields (badge + date), reorder, and validate invalid date highlights exact field
    fireEvent.click(within(supplementCard).getByRole('button', { name: /Add Field/i }));
    fireEvent.change(within(supplementCard).getByLabelText('Custom field 1 label'), {
      target: { value: 'Weight' },
    });
    fireEvent.change(within(supplementCard).getByLabelText('Custom field 1 type'), {
      target: { value: 'badge' },
    });
    fireEvent.change(within(supplementCard).getByLabelText('Custom field 1 value'), {
      target: { value: '20%' },
    });

    fireEvent.click(within(supplementCard).getByRole('button', { name: /Add Field/i }));
    fireEvent.change(within(supplementCard).getByLabelText('Custom field 2 label'), {
      target: { value: 'Due Date' },
    });
    fireEvent.change(within(supplementCard).getByLabelText('Custom field 2 type'), {
      target: { value: 'date' },
    });
    fireEvent.change(within(supplementCard).getByLabelText('Custom field 2 day'), {
      target: { value: '31' },
    });
    fireEvent.change(within(supplementCard).getByLabelText('Custom field 2 month'), {
      target: { value: '02' },
    });
    fireEvent.change(within(supplementCard).getByLabelText('Custom field 2 year'), {
      target: { value: '2026' },
    });

    // Reorder field 2 up
    fireEvent.click(within(supplementCard).getByRole('button', { name: 'Move custom field 2 up' }));
    expect(
      (within(supplementCard).getByLabelText('Custom field 1 label') as HTMLInputElement).value
    ).toBe('Due Date');

    // Invalid date blocks Save and highlights field 1 value
    const stickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));
    expect(
      screen.getAllByText(/Please enter a valid date in DD\/MM\/YYYY format/i).length
    ).toBeGreaterThanOrEqual(2);

    // Fix date -> error clears live
    fireEvent.change(within(supplementCard).getByLabelText('Custom field 1 day'), {
      target: { value: '15' },
    });
    expect(
      screen.queryByText(/Please enter a valid date in DD\/MM\/YYYY format/i)
    ).not.toBeInTheDocument();

    // Add a spine supplement from the + Add toolbar menu and save
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Add$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add Supplement/i }));
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('matches Custom Fields container and neutral Add Field button to MaterialsEditor, and stacks child supplement sticky headers directly below parent supplement headers', () => {
    renderEditor('/editor/new');

    const stickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Add$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add Supplement/i }));

    const spineCard = document.querySelector('[data-edit-supplement]') as HTMLElement;
    const spineHeader = spineCard.querySelector(
      '[data-sticky-header="supplement-spine"]'
    ) as HTMLElement;

    // Default height matches min-h-12 (48px), and updates dynamically when header height changes
    expect(spineCard.style.getPropertyValue('--editor-supplement-header-height')).toBe('48px');
    vi.spyOn(spineHeader, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 52,
      left: 0,
      right: 800,
      width: 800,
      height: 52,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.change(within(spineCard).getByLabelText('Supplement Title'), {
      target: { value: 'Supplement 1 Updated' },
    });
    fireEvent.click(within(spineCard).getByRole('button', { name: /Add Field/i }));

    // Custom Fields header & Add Field button match MaterialsEditor's borderless layout and neutral button styling
    const addFieldBtn = within(spineCard).getByRole('button', { name: /Add Field/i });
    const addMaterialBtn = within(spineCard).getByRole('button', { name: /Add Material/i });
    expect(addFieldBtn.className).toBe(addMaterialBtn.className);
    expect(addFieldBtn.className).not.toContain('--tag-teal-bg');

    const customFieldsSection = addFieldBtn.closest('div')?.parentElement as HTMLElement;
    expect(customFieldsSection.className).toContain('border-t');
    expect(customFieldsSection.className).not.toContain('bg-[var(--surface-2)]');
    expect(customFieldsSection.className).not.toContain('rounded-md');

    const customFieldsContainer = within(spineCard).getByTestId(
      'editor-custom-fields-container'
    );
    expect(customFieldsContainer.className).toContain('rounded-lg');
    expect(customFieldsContainer.className).toContain('border-slate-200');
    expect(customFieldsContainer.className).toContain('dark:border-slate-700/80');
    expect(customFieldsContainer.className).toContain('dark:bg-[#121926]');

    // Add a child supplement to the spine supplement -> parent dynamically sets --editor-lesson-sticky-top
    fireEvent.click(within(spineCard).getByRole('button', { name: /Add Child Supplement/i }));
    expect(spineCard.style.getPropertyValue('--editor-supplement-header-height')).toBe('52px');
    expect(spineCard.style.getPropertyValue('--editor-lesson-sticky-top')).toBe(
      'calc(var(--editor-chapter-sticky-top, 120px) + var(--editor-supplement-header-height, 48px))'
    );

    const childHeader = spineCard.querySelector(
      '[data-sticky-header="supplement-child"]'
    ) as HTMLElement;
    expect(childHeader.className).toContain('top-[var(--editor-lesson-sticky-top,168px)]');
    expect(childHeader.className).toContain('z-10');

    // Lesson child supplement stacks below LessonEditorCard header via --editor-lesson-supplement-sticky-top
    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    expect(lessonCard.style.getPropertyValue('--editor-lesson-supplement-sticky-top')).toBe(
      'calc(var(--editor-lesson-sticky-top, 168px) + var(--editor-lesson-header-height, 42px))'
    );
    fireEvent.click(within(lessonCard).getByRole('button', { name: /Add Child Supplement$/i }));
    const lessonSupHeader = lessonCard.querySelector(
      '[data-sticky-header="supplement-child"]'
    ) as HTMLElement;
    expect(lessonSupHeader.className).toContain(
      'top-[var(--editor-lesson-supplement-sticky-top,210px)]'
    );

    // Spine supplement header matches chapter header padding; child supplement header matches lesson header padding
    const chapterHeader = document.querySelector('[data-sticky-header="chapter"]') as HTMLElement;
    expect(chapterHeader.className).toContain('min-h-12');
    expect(chapterHeader.className).toContain('px-4');
    expect(chapterHeader.className).toContain('py-2');
    expect(spineHeader.className).toContain('min-h-12');
    expect(spineHeader.className).toContain('px-4');
    expect(spineHeader.className).toContain('py-2');

    const lessonHeader = document.querySelector('[data-sticky-header="lesson"]') as HTMLElement;
    expect(lessonHeader.className).toContain('px-3');
    expect(lessonHeader.className).toContain('py-2');
    expect(childHeader.className).toContain('px-3');
    expect(childHeader.className).toContain('py-2');
    expect(lessonSupHeader.className).toContain('px-3');
    expect(lessonSupHeader.className).toContain('py-2');

    // Dashed add buttons have hover border-color classes
    const addSubLessonBtn = screen.getByRole('button', { name: /Add Sub-Lesson to Chapter 1/i });
    expect(addSubLessonBtn.className).toContain('hover:border-[var(--tag-peach-border)]');
    const addChildSupBtns = screen.getAllByRole('button', { name: /Add Child Supplement/i });
    for (const btn of addChildSupBtns) {
      expect(btn.className).toContain('hover:border-[var(--tag-teal-border)]');
    }

    // + Add dropdown menu is centered below the trigger button
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Add$/i }));
    const addMenu = screen.getByRole('menu', { name: /Add course item/i });
    expect(addMenu.className).toContain('left-1/2');
    expect(addMenu.className).toContain('-translate-x-1/2');
    expect(addMenu.className).not.toContain('right-0');
  });

  it('renders tag-colored ResourceKindSelect without duplicate badge, mobile-row material & custom-field layouts, accent focus tokens, and Prerequisites -> Custom Fields -> Materials order', () => {
    renderEditor('/editor/new');

    // Chapter fields use --border-focus (no hardcoded blue focus)
    const ch1Title = screen.getByLabelText('Chapter 1 title');
    const ch1WeekFrom = screen.getByLabelText('Chapter 1 week from');
    expect(ch1Title.className).toContain('focus:border-[var(--border-focus)]');
    expect(ch1Title.className).not.toContain('focus:border-blue-500');
    expect(ch1WeekFrom.className).toContain('focus:border-[var(--border-focus)]');
    expect(ch1WeekFrom.className).not.toContain('focus:border-blue-500');

    // Material row inside Lesson 1: tag-styled kind dropdown, no redundant badge, mobile ordering, --border-focus
    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    const lessonScope = within(lessonCard);
    fireEvent.click(lessonScope.getByRole('button', { name: /Add Material/i }));

    const kindSelect = lessonScope.getByLabelText(/Resource kind/i) as HTMLSelectElement;
    const kindWrapper = lessonScope.getByTestId('resource-kind-select-wrapper');
    expect(kindWrapper.className).toContain('bg-sky-200');
    expect(kindWrapper.parentElement?.querySelectorAll('span')).toHaveLength(0);
    expect(kindSelect.className).toContain('focus:border-[var(--border-focus)]');
    expect(kindSelect.className).not.toContain('focus:border-blue-500');

    fireEvent.change(kindSelect, { target: { value: 'video' } });
    expect(kindWrapper.className).toContain('bg-purple-300');

    const matTitle = lessonScope.getByLabelText(/Material title/i);
    const matUrl = lessonScope.getByLabelText(/Material URL/i);
    expect(matTitle.className).toContain('order-2');
    expect(matTitle.className).toContain('focus:border-[var(--border-focus)]');
    expect(matTitle.className).not.toContain('focus:border-blue-500');
    expect(matUrl.className).toContain('focus:border-[var(--border-focus)]');
    expect(matUrl.className).not.toContain('focus:border-blue-500');

    const sourceRow = lessonScope.getByTestId('material-source-row');
    expect(sourceRow.className).toContain('order-4');
    expect(sourceRow.className).toContain('flex');
    expect(sourceRow.className).toContain('w-full');
    expect(within(sourceRow).getByRole('group', { name: /Material source mode/i })).toBeInTheDocument();
    expect(within(sourceRow).getByLabelText(/Material URL/i)).toBeInTheDocument();

    // Switch to Upload mode -> Choose File sits inside material-source-row beside Link/Upload
    fireEvent.click(lessonScope.getByRole('button', { name: /^Upload$/i }));
    expect(within(sourceRow).getByLabelText(/Upload material file/i)).toBeInTheDocument();

    // Supplement section ordering & custom field layout
    const stickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Add$/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Add Supplement/i }));

    const spineCard = document.querySelector('[data-edit-supplement]') as HTMLElement;
    const spineScope = within(spineCard);
    fireEvent.click(spineScope.getByRole('button', { name: /Add Field/i }));

    // Prerequisites -> Custom Fields (with border-t) -> Course Materials (with border-t)
    const prereqEl = spineCard.querySelector('[data-prereq-for]') as HTMLElement;
    const customFieldsSection = spineScope.getByTestId('custom-fields-section');
    const materialsHeading = spineScope.getByText(/Course Materials \(0\)/i);
    const materialsSection = materialsHeading.closest('div')?.parentElement as HTMLElement;

    expect(prereqEl.className).not.toContain('border-t');
    expect(customFieldsSection.className).toContain('border-t');
    expect(materialsSection.className).toContain('border-t');
    expect(
      Boolean(prereqEl.compareDocumentPosition(customFieldsSection) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true);
    expect(
      Boolean(
        customFieldsSection.compareDocumentPosition(materialsSection) & Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);

    // Custom field order: Type (1st) -> Toolbar (order-2 mobile / order-4 sm) -> Label (without e.g. Weight) -> Value
    const typeSelect = spineScope.getByLabelText('Custom field 1 type');
    const labelInput = spineScope.getByLabelText('Custom field 1 label') as HTMLInputElement;
    const valueInput = spineScope.getByLabelText('Custom field 1 value') as HTMLInputElement;
    expect(labelInput.placeholder).toBe('Label');
    expect(labelInput.placeholder).not.toContain('Weight');
    expect(
      Boolean(typeSelect.compareDocumentPosition(labelInput) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true);
    expect(typeSelect.parentElement?.className).toContain('flex-1');
    expect(typeSelect.parentElement?.className).toContain('sm:col-span-2');
    expect(typeSelect.parentElement?.parentElement?.className).toContain('sm:contents');
    expect(labelInput.parentElement?.className).toContain('order-3');
    expect(labelInput.parentElement?.className).toContain('sm:order-2');
    expect(valueInput.parentElement?.className).toContain('order-4');
    expect(valueInput.parentElement?.className).toContain('sm:order-3');
  });
});
