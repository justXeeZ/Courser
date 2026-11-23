import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { COURSES } from '@/data/courses';
import { putFile } from '@/lib/fileStore';
import { LessonDrawer } from '@/components/LessonDrawer';
import { ProgressProvider, saveProgressState } from '@/store/useProgressStore';
import type { CourseTree } from '@/types/course';

describe('LessonDrawer', () => {
  const course = COURSES[0]; // GUIDE101
  const chapter = course.chapters[0];
  const lesson = chapter.lessons[1]; // Searching with Ctrl+K (has prerequisite guide101-ch1-l1-browsing-bookmarks)

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders lesson details, prerequisites, color-coded resources, and Study Notes tab when lesson has notes', () => {
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
    const lessonTag = screen.getByTestId('lesson-position-tag');
    expect(lessonTag).toHaveTextContent('Ch1 / L2');
    expect(lessonTag).toHaveClass('ml-auto');
    expect(screen.getByText(lesson.summary)).toBeInTheDocument();
    expect(screen.getByText('Document')).toBeInTheDocument();
    expect(screen.getByText('Official')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /Browsing & Bookmarks/i }).length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('tab', { name: /Study Notes/i })).toBeInTheDocument();
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

    fireEvent.click(screen.getAllByRole('button', { name: /Browsing & Bookmarks/i })[0]);
    expect(onNavigateLesson).toHaveBeenCalledWith('guide101-ch1-l1-browsing-bookmarks');
  });

  it('resolves and navigates to chapter prerequisites via onSelectItem', () => {
    const demoCourse = COURSES[1]; // DEMO201
    const ch2 = demoCourse.chapters[1];
    const ch2Lesson1 = ch2.lessons[0]; // has prerequisite demo201-ch1-foundations-core-layouts
    const onSelectItem = vi.fn();

    render(
      <LessonDrawer
        course={demoCourse}
        chapter={ch2}
        lesson={ch2Lesson1}
        status="todo"
        statuses={{}}
        onChangeStatus={vi.fn()}
        onSelectItem={onSelectItem}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /1\. Foundations & Core Layouts/i })
    );
    expect(onSelectItem).toHaveBeenCalledWith('demo201-ch1-foundations-core-layouts');
  });

  it('uses slate gray styling on the Skip control (no teal) and renders uploaded file materials safely', async () => {
    const fileId = 'test101-file-abcd1234';
    await putFile(
      fileId,
      new Blob(['hello pdf'], { type: 'application/pdf' }),
      'lecture-notes.pdf',
      'application/pdf'
    );

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    }
    if (!URL.revokeObjectURL) {
      URL.revokeObjectURL = vi.fn();
    }

    const customCourse: CourseTree = {
      slug: 'test101-files',
      code: 'TEST101',
      title: 'File Materials Test',
      department: 'Preparatory',
      description: 'Test course',
      chapters: [
        {
          id: 'test101-ch1-intro',
          order: 1,
          title: 'Intro',
          description: 'Intro desc',
          lessons: [
            {
              id: 'test101-lesson-1',
              title: 'Lesson One',
              summary: 'Summary one',
              resources: [
                {
                  title: 'Lecture Notes PDF',
                  kind: 'slides',
                  file: {
                    id: fileId,
                    name: 'lecture-notes.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 2048,
                  },
                },
                {
                  title: 'Missing File',
                  kind: 'document',
                  file: {
                    id: 'test101-file-missing0',
                    name: 'missing.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 512,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    render(
      <LessonDrawer
        course={customCourse}
        chapter={customCourse.chapters[0]}
        lesson={customCourse.chapters[0].lessons[0]}
        status="skipped"
        statuses={{ 'test101-lesson-1': 'skipped' }}
        onChangeStatus={vi.fn()}
        onSelectItem={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const skipButton = screen.getByRole('button', { name: /Skip/i });
    expect(skipButton.className).toContain('bg-slate-100');
    expect(skipButton.className).not.toContain('teal');

    expect(screen.getAllByText('File').length).toBe(2);
    expect(screen.getByText('2 KB')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Lecture Notes PDF/i }));
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Missing File/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/missing\.pdf/i);
    });
  });

  it('renders a skipped leaf chapter prerequisite chip in slate gray with Ban icon only (not emerald Done)', () => {
    const customCourse: CourseTree = {
      slug: 'test103-lesson-prereq',
      code: 'TEST103',
      title: 'Lesson Prereq Display',
      department: 'Preparatory',
      description: 'Test course',
      chapters: [
        {
          id: 'test103-ch1-leaf-prereq',
          order: 1,
          title: '1. Skipped Milestone Prereq',
          description: 'Leaf milestone chapter',
          lessons: [],
        },
        {
          id: 'test103-ch2-core',
          order: 2,
          title: '2. Core Lessons',
          description: 'Core chapter',
          lessons: [
            {
              id: 'test103-ch2-l1-target-lesson',
              title: 'Target Lesson',
              summary: 'Depends on skipped leaf chapter',
              prerequisites: ['test103-ch1-leaf-prereq'],
              resources: [],
            },
          ],
        },
      ],
    };

    render(
      <LessonDrawer
        course={customCourse}
        chapter={customCourse.chapters[1]}
        lesson={customCourse.chapters[1].lessons[0]}
        status="todo"
        statuses={{ 'test103-ch1-leaf-prereq': 'skipped' }}
        onChangeStatus={vi.fn()}
        onSelectItem={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const prereqHeading = screen.getByText(/Recommended Prerequisites/i);
    const prereqSection = prereqHeading.parentElement!;
    const prereqChip = within(prereqSection).getByRole('button', {
      name: /1\. Skipped Milestone Prereq/i,
    });
    expect(prereqChip).toHaveClass('border-slate-300', 'bg-slate-100', 'text-slate-700');
    expect(prereqChip).not.toHaveClass('border-emerald-300', 'bg-emerald-50');
    expect(prereqChip.querySelectorAll('svg')).toHaveLength(1);
    expect(prereqChip.querySelector('svg')).toHaveClass('lucide-ban');
  });

  it('keeps empty resources message on sub-lessons and forwards viewer/assessment callbacks with Best score', () => {
    localStorage.clear();
    const onOpenMaterialViewer = vi.fn();
    const onOpenAssessment = vi.fn();

    const customCourse: CourseTree = {
      slug: 'test106-lesson-callbacks',
      code: 'TEST106',
      title: 'Lesson Callbacks',
      department: 'Preparatory',
      description: 'Test',
      chapters: [
        {
          id: 'test106-ch1-core',
          order: 1,
          title: '1. Core',
          description: 'Core desc',
          lessons: [
            {
              id: 'test106-empty-lesson',
              title: 'Empty Lesson',
              summary: 'No materials',
              resources: [],
            },
            {
              id: 'test106-rich-lesson',
              title: 'Rich Lesson',
              summary: 'Has viewer & assignment',
              resources: [
                {
                  title: 'Slides PDF',
                  kind: 'slides',
                  file: {
                    id: 'test106-file-1234abcd',
                    name: 'slides.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: 1024,
                  },
                },
                {
                  title: 'Homework 1',
                  kind: 'assignment',
                  assessment: {
                    mode: 'assignment',
                    questions: [
                      {
                        id: 'q1',
                        type: 'short-answer',
                        header: { text: '2+2?' },
                        acceptedAnswers: ['4'],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const { rerender } = render(
      <LessonDrawer
        course={customCourse}
        chapter={customCourse.chapters[0]}
        lesson={customCourse.chapters[0].lessons[0]}
        status="todo"
        statuses={{}}
        onChangeStatus={vi.fn()}
        onSelectItem={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('No resources linked for this sub-lesson yet.')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Study Notes/i })).not.toBeInTheDocument();

    saveProgressState({
      version: 1,
      statuses: {},
      bookmarks: [],
      assessmentScores: {
        'test106-lesson-callbacks': {
          'test106-rich-lesson::Homework 1': {
            bestScorePercent: 88,
            latestScorePercent: 88,
            attempts: 1,
            passed: true,
            updatedAt: '2026-11-22T00:00:00.000Z',
          },
        },
      },
    });

    rerender(
      <ProgressProvider>
        <LessonDrawer
          course={customCourse}
          chapter={customCourse.chapters[0]}
          lesson={customCourse.chapters[0].lessons[1]}
          status="todo"
          statuses={{}}
          onChangeStatus={vi.fn()}
          onSelectItem={vi.fn()}
          onOpenMaterialViewer={onOpenMaterialViewer}
          onOpenAssessment={onOpenAssessment}
          onClose={vi.fn()}
        />
      </ProgressProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: /Slides PDF/i }));
    expect(onOpenMaterialViewer).toHaveBeenCalledTimes(1);

    const hwBtn = screen.getByRole('button', { name: /Homework 1/i });
    expect(within(hwBtn).getByText('Best: 88%')).toBeInTheDocument();
    fireEvent.click(hwBtn);
    expect(onOpenAssessment).toHaveBeenCalledTimes(1);
  });
});
