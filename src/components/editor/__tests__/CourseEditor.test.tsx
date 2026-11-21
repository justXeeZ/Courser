import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CourseProvider } from '@/store/useCourseStore';
import {
  PROGRESS_STORAGE_KEY,
  ProgressProvider,
  loadProgressState,
  saveProgressState,
} from '@/store/useProgressStore';
import { deleteFile, getFile, listFileIds } from '@/lib/fileStore';
import { EXAMPLE_COURSE_EXPORT } from '@/data/exampleCourseExport';
import { CourseEditorPage } from '@/pages/CourseEditorPage';
import { SEMESTER_OPTIONS } from '@/types/course';

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

  it('renders active Department defaulting to Preparatory, 8-option Semester dropdown + unscheduled, and no estimated time inputs', () => {
    renderEditor('/editor/new');

    const deptInput = screen.getByLabelText(/Department/i) as HTMLInputElement;
    expect(deptInput).toBeVisible();
    expect(deptInput.value).toBe('Preparatory');

    const semesterSelect = screen.getByLabelText(/Semester/i) as HTMLSelectElement;
    expect(semesterSelect.value).toBe('');
    const options = Array.from(semesterSelect.options).map((o) => o.value);
    expect(options).toEqual(['', ...SEMESTER_OPTIONS]);
    expect(screen.getByRole('option', { name: '— Not scheduled —' })).toBeInTheDocument();

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

    // Shows expected extensions hint for current kind (slides)
    expect(lessonScope.getByText(/Expected for/i)).toBeInTheDocument();
    expect(lessonScope.getByText(/\.pdf, \.ppt, \.pptx/i)).toBeInTheDocument();

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

    // Clicking "Use reading" applies suggested kind and clears warning
    fireEvent.click(lessonScope.getByRole('button', { name: /Use reading/i }));
    expect(kindSelect.value).toBe('reading');
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

  it('toggles chapter prerequisites while excluding self and own lessons, and displays standalone hint when 0 lessons', () => {
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

    // Delete Chapter 2's only lesson -> becomes standalone chapter with hint
    const ch2Scope = within(chapter2Card);
    fireEvent.click(ch2Scope.getByRole('button', { name: /Delete Topic 2\.1/i }));
    expect(
      ch2Scope.getByText('Standalone chapter — students can check it off directly')
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

    // Focus lesson title input inside Lesson 1
    const lessonTitleInput = screen.getByLabelText('Sub-Lesson Title');
    fireEvent.focus(lessonTitleInput);
    expect(within(stickyBar).getByText('Ch 1: 1. Foundations')).toBeInTheDocument();
    expect(within(stickyBar).getByText('Course Introduction')).toBeInTheDocument();

    // Focus metadata input -> falls back cleanly to Course Overview
    fireEvent.focus(screen.getByLabelText(/Course Code/i));
    expect(within(stickyBar).getByText('Course Overview')).toBeInTheDocument();
    expect(within(stickyBar).queryByText('Course Introduction')).not.toBeInTheDocument();
  });

  it('remaps saved progress and bookmarks when renaming a lesson and course code on save', () => {
    // Seed existing progress on GUIDE101's first lesson ("guide101-browsing-bookmarks")
    saveProgressState({
      version: 1,
      statuses: {
        'guide101-quick-start': {
          'guide101-browsing-bookmarks': 'done',
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
      'guide102-catalog-navigation': 'done',
    });
    expect(updatedProgress.bookmarks).toEqual(['guide102-quick-start']);
    expect(window.localStorage.getItem(PROGRESS_STORAGE_KEY)).toContain(
      'guide102-catalog-navigation'
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
          'guide101-browsing-bookmarks': 'done',
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
});
