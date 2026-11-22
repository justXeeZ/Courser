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

    // 3) Switching Link <-> Upload clears opposite field
    fireEvent.click(lessonScope.getByRole('button', { name: /^Link$/i }));
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
    fireEvent.click(screen.getByRole('button', { name: /Add Chapter/i }));

    const chapterCards = document.querySelectorAll('[data-edit-chapter]');
    expect(chapterCards).toHaveLength(2);

    const chapter2Card = chapterCards[1] as HTMLElement;
    const ch2Id = chapter2Card.getAttribute('data-edit-chapter')!;
    const ch2PrereqPicker = chapter2Card.querySelector(
      `[data-prereq-for="${ch2Id}"]`
    ) as HTMLElement;
    const ch2PrereqScope = within(ch2PrereqPicker);

    // Chapter 2's PrerequisitePicker excludes itself ("Ch 2: 2. New Chapter") and its own lesson ("Topic 2.1")
    expect(
      ch2PrereqScope.queryByRole('button', { name: /Ch 2: 2\. New Chapter/i })
    ).not.toBeInTheDocument();
    expect(ch2PrereqScope.queryByRole('button', { name: 'Topic 2.1' })).not.toBeInTheDocument();

    // Chapter 1 and its lesson are available in Chapter 2's PrerequisitePicker
    const ch1PrereqBtn = ch2PrereqScope.getByRole('button', {
      name: /Ch 1: 1\. Foundations/i,
    });
    expect(ch1PrereqBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(ch1PrereqBtn);
    expect(ch1PrereqBtn).toHaveAttribute('aria-pressed', 'true');

    // Toggle back off
    fireEvent.click(ch1PrereqBtn);
    expect(ch1PrereqBtn).toHaveAttribute('aria-pressed', 'false');

    // Delete Chapter 2's only lesson -> becomes 0-lesson chapter with hint
    const ch2Scope = within(chapter2Card);
    fireEvent.click(ch2Scope.getByRole('button', { name: /Delete Topic 2\.1/i }));
    expect(
      ch2Scope.getByText('No sub-lessons — students can check off this chapter directly.')
    ).toBeInTheDocument();
  });

  it('updates the sticky bar breadcrumb when focusing chapter or lesson fields and falls back on metadata focus', () => {
    renderEditor('/editor/new');

    const stickyBar = screen.getByTestId('editor-sticky-bar');
    expect(within(stickyBar).getByText('CS101')).toBeInTheDocument();
    expect(within(stickyBar).getByText('Course Overview')).toBeInTheDocument();

    // Focus chapter title input inside Chapter 1
    const ch1TitleInput = screen.getByLabelText('Chapter 1 title');
    fireEvent.focus(ch1TitleInput);
    expect(within(stickyBar).getByText('Ch 1: 1. Foundations')).toBeInTheDocument();

    // Focus lesson title input inside Lesson 1 -> shows Ch 1 - L 1 position tag and lesson title
    const lessonTitleInput = screen.getByLabelText('Sub-Lesson Title');
    fireEvent.focus(lessonTitleInput);
    expect(within(stickyBar).getByText('Ch 1: 1. Foundations')).toBeInTheDocument();
    expect(within(stickyBar).getByText('Ch 1 - L 1')).toBeInTheDocument();
    expect(within(stickyBar).getByText('Course Introduction')).toBeInTheDocument();

    // Focus metadata input -> falls back cleanly to Course Overview
    fireEvent.focus(screen.getByLabelText(/Course Code/i));
    expect(within(stickyBar).getByText('Course Overview')).toBeInTheDocument();
    expect(within(stickyBar).queryByText('Course Introduction')).not.toBeInTheDocument();
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

    // Add a second lesson inside Chapter 1 and a second chapter
    fireEvent.click(screen.getByRole('button', { name: /Add Sub-Lesson to Chapter 1/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add Chapter/i }));

    const chapter1Card = document.querySelectorAll('[data-edit-chapter]')[0] as HTMLElement;
    const ch1Lessons = chapter1Card.querySelectorAll('[data-edit-lesson]');
    expect(ch1Lessons).toHaveLength(2);

    const firstLessonCard = ch1Lessons[0] as HTMLElement;
    const firstLessonId = firstLessonCard.getAttribute('data-edit-lesson')!;
    const lessonPrereqPicker = firstLessonCard.querySelector(
      `[data-prereq-for="${firstLessonId}"]`
    ) as HTMLElement;
    const lessonPrereqScope = within(lessonPrereqPicker);

    // Excludes self ("Course Introduction") and own parent chapter ("Ch 1: 1. Foundations")
    expect(
      lessonPrereqScope.queryByRole('button', { name: 'Course Introduction' })
    ).not.toBeInTheDocument();
    expect(
      lessonPrereqScope.queryByRole('button', { name: /Ch 1: 1\. Foundations/i })
    ).not.toBeInTheDocument();

    // Allows sibling lesson ("New Sub-Lesson 2") and Chapter 2 ("Ch 2: 2. New Chapter")
    expect(
      lessonPrereqScope.getByRole('button', { name: 'New Sub-Lesson 2' })
    ).toBeInTheDocument();
    expect(
      lessonPrereqScope.getByRole('button', { name: /Ch 2: 2\. New Chapter/i })
    ).toBeInTheDocument();

    // Collapse all collapses expanded lessons
    const stickyBar = screen.getByTestId('editor-sticky-bar');
    expect(screen.getAllByLabelText('Sub-Lesson Title').length).toBeGreaterThan(0);
    fireEvent.click(within(stickyBar).getByRole('button', { name: /Collapse all/i }));
    expect(screen.queryByLabelText('Sub-Lesson Title')).not.toBeInTheDocument();
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
    const addChapterButtons = screen.getAllByRole('button', { name: /Add Chapter/i });
    expect(addChapterButtons).toHaveLength(1);
    expect(within(stickyBar).getByRole('button', { name: /Add Chapter/i })).toBe(
      addChapterButtons[0]
    );

    fireEvent.click(addChapterButtons[0]);

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

    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    const toggleBtn = lessonCard.querySelector('button[aria-expanded]') as HTMLButtonElement;
    const headerRow = toggleBtn.parentElement as HTMLElement;

    expect(toggleBtn).toHaveAttribute('aria-expanded', 'true');
    const expandedClasses = headerRow.className;
    expect(expandedClasses).toContain('bg-slate-100');
    expect(expandedClasses).toContain('dark:bg-[#1b2436]');
    expect(expandedClasses).toContain('border-slate-200');
    expect(expandedClasses).toContain('dark:border-slate-700');
    expect(expandedClasses).not.toContain('#ffe599');

    fireEvent.click(toggleBtn);
    expect(toggleBtn).toHaveAttribute('aria-expanded', 'false');
    const collapsedClasses = headerRow.className;

    expect(collapsedClasses).toContain('bg-slate-100');
    expect(collapsedClasses).toContain('dark:bg-[#1b2436]');
    expect(collapsedClasses).toContain('border-slate-200');
    expect(collapsedClasses).toContain('dark:border-slate-700');
    expect(collapsedClasses).not.toContain('#ffe599');
  });

  it('toggles Pin as Recommended on a material row and persists recommended: true on Save', () => {
    renderEditor('/editor/new');

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
    expect(
      lessonScope.getByRole('button', { name: /Unpin recommended material/i })
    ).toHaveAttribute('aria-pressed', 'true');

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
      // Switch to Link -> clears assessment, switching back to Interactive shows empty state
      fireEvent.click(lessonScope.getByRole('button', { name: /^Link$/i }));
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

    const lessonCard = document.querySelector('[data-edit-lesson]') as HTMLElement;
    const lessonScope = within(lessonCard);

    // Add a material row with a title but leave URL empty
    fireEvent.click(lessonScope.getByRole('button', { name: /Add Material/i }));
    fireEvent.change(lessonScope.getByLabelText(/Material title/i), {
      target: { value: 'Incomplete Lecture Link' },
    });

    const stickyBar = screen.getByTestId('editor-sticky-bar');
    fireEvent.click(within(stickyBar).getByRole('button', { name: /^Save$/i }));

    // Save is blocked, error is shown inside sticky bar with clear Ch 1 - L 1 and Material #1 context
    expect(screen.queryByTestId('course-view-destination')).not.toBeInTheDocument();
    expect(within(stickyBar).getByRole('alert')).toHaveTextContent(
      /Ch 1 - L 1 \("Course Introduction"\), Material #1 \("Incomplete Lecture Link"\): Please enter a valid URL/i
    );

    // Offending material row and URL input are highlighted
    expect(document.querySelectorAll('[data-field-error="true"]').length).toBeGreaterThanOrEqual(1);

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
    expect(mainEl.className).toContain('bg-slate-50');
    expect(mainEl.className).toContain('dark:bg-[#0b0f17]');
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
    expect(dialog.className).toContain('dark:bg-[#121926]');
    expect(within(dialog).getByLabelText(/^Course JSON$/i).className).toContain(
      'dark:bg-[#0d131f]'
    );
  });
});
