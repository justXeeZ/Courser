import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MaterialList } from '@/components/MaterialList';
import { ResourceBadge } from '@/components/ResourceBadge';
import { putFile } from '@/lib/fileStore';
import { ProgressProvider, saveProgressState } from '@/store/useProgressStore';
import type { LessonResource, ResourceKind } from '@/types/course';

describe('ResourceBadge & MaterialList', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders all 9 ResourceBadge kinds with distinct Light & Dark palette classes', () => {
    const kinds: ResourceKind[] = [
      'document',
      'course',
      'textbook',
      'official',
      'slides',
      'video',
      'lab',
      'exam',
      'assignment',
    ];

    render(
      <div>
        {kinds.map((kind) => (
          <ResourceBadge key={kind} kind={kind} />
        ))}
      </div>
    );

    expect(screen.getByText('Document')).toHaveClass('bg-sky-200');
    expect(screen.getByText('Course')).toHaveClass('bg-red-600');
    expect(screen.getByText('Textbook')).toHaveClass('bg-teal-600');
    expect(screen.getByText('Official')).toHaveClass('bg-blue-600');
    expect(screen.getByText('Slides')).toHaveClass('bg-amber-300');
    expect(screen.getByText('Video')).toHaveClass('bg-purple-300');
    expect(screen.getByText('Lab')).toHaveClass('bg-emerald-400');
    expect(screen.getByText('Exam')).toHaveClass('bg-slate-900');
    expect(screen.getByText('Assignment')).toHaveClass('bg-indigo-600');
  });

  it('groups recommended materials inside a purple-accented container labeled Recommended while preserving order', () => {
    const resources: LessonResource[] = [
      { title: 'Normal One', kind: 'document', url: 'https://example.com/1' },
      { title: 'Pinned First', kind: 'slides', recommended: true, url: 'https://example.com/2' },
      { title: 'Normal Two', kind: 'official', url: 'https://example.com/3' },
      { title: 'Pinned Second', kind: 'textbook', recommended: true, url: 'https://example.com/4' },
    ];

    const { container } = render(<MaterialList resources={resources} />);
    const recBox = screen.getByTestId('recommended-resources-container');
    expect(recBox).toHaveClass('recommended-group-box');
    expect(within(recBox).getByRole('heading', { name: 'Recommended' })).toBeInTheDocument();
    expect(screen.getByTestId('materials-card')).toContainElement(recBox);

    const recItems = Array.from(recBox.querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(recItems).toHaveLength(2);
    expect(recItems[0]).toContain('Pinned First');
    expect(recItems[0]).not.toContain('Recommended');
    expect(recItems[1]).toContain('Pinned Second');

    const allItems = Array.from(container.querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(allItems[2]).toContain('Normal One');
    expect(allItems[3]).toContain('Normal Two');
  });

  it('blocks unsafe javascript: and data: URLs from rendering links or opening the viewer', () => {
    const onOpenMaterialViewer = vi.fn();
    const unsafeResources: LessonResource[] = [
      { title: 'XSS Script', kind: 'document', url: 'javascript:alert(1)' },
      { title: 'Data Payload', kind: 'document', url: 'data:text/html,<script>alert(1)</script>' },
    ];

    const { container } = render(
      <MaterialList
        resources={unsafeResources}
        onOpenMaterialViewer={onOpenMaterialViewer}
      />
    );

    expect(container.querySelectorAll('a')).toHaveLength(0);
    expect(screen.getAllByText('Invalid or unsupported URL')).toHaveLength(2);
    expect(onOpenMaterialViewer).not.toHaveBeenCalled();
  });

  it('routes all external URLs and uploaded files to onOpenMaterialViewer, displays truncated URLs and inline file details with ExternalLink vs Eye icons', async () => {
    const onOpenMaterialViewer = vi.fn();
    const resources: LessonResource[] = [
      {
        title: 'Lecture Video',
        kind: 'video',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      },
      {
        title: 'OneDrive Share',
        kind: 'slides',
        url: 'https://1drv.ms/p/s!exampleShareToken',
      },
      {
        title: 'Notion Notes',
        kind: 'document',
        url: 'https://www.notion.so/study-guide-123456',
      },
      {
        title: 'Uploaded PDF',
        kind: 'slides',
        file: {
          id: 'cs101-file-abcd1234',
          name: 'notes.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
        },
      },
    ];

    render(
      <MaterialList
        resources={resources}
        onOpenMaterialViewer={onOpenMaterialViewer}
      />
    );

    const ytBtn = screen.getByRole('button', { name: /Lecture Video/i });
    fireEvent.click(ytBtn);
    expect(onOpenMaterialViewer).toHaveBeenCalledWith(resources[0]);
    expect(within(ytBtn).getByTestId('external-resource-url')).toHaveTextContent(
      'youtube.com/watch?v=dQw4w9WgXcQ'
    );
    expect(within(ytBtn).getByTestId('external-resource-url')).toHaveAttribute(
      'title',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    );
    expect(within(ytBtn).getByTestId('external-resource-icon')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /OneDrive Share/i }));
    expect(onOpenMaterialViewer).toHaveBeenCalledWith(resources[1]);

    // External webpage URLs also open in the in-app viewer when onOpenMaterialViewer is provided
    fireEvent.click(screen.getByRole('button', { name: /Notion Notes/i }));
    expect(onOpenMaterialViewer).toHaveBeenCalledWith(resources[2]);

    const pdfBtn = screen.getByRole('button', { name: /Uploaded PDF/i });
    expect(within(pdfBtn).getByTestId('uploaded-file-details')).toHaveTextContent('notes.pdf');
    expect(within(pdfBtn).getByTestId('uploaded-viewer-icon')).toBeInTheDocument();
    expect(within(pdfBtn).queryByText('Viewer')).not.toBeInTheDocument();
    fireEvent.click(pdfBtn);
    expect(onOpenMaterialViewer).toHaveBeenCalledWith(resources[3]);
  });

  it('falls back to openStoredFile for file resources when onOpenMaterialViewer is omitted', async () => {
    const fileId = 'cs102-file-11223344';
    await putFile(fileId, new Blob(['abc'], { type: 'text/plain' }), 'readme.txt', 'text/plain');
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    if (!URL.createObjectURL) {
      URL.createObjectURL = vi.fn(() => 'blob:mock-file');
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-file');
    }

    render(
      <MaterialList
        resources={[
          {
            title: 'Readme File',
            kind: 'document',
            file: { id: fileId, name: 'readme.txt', mimeType: 'text/plain', sizeBytes: 3 },
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Readme File/i }));
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });
  });

  it('renders interactive assessment metadata, Best score pill via prop or ProgressProvider, and disabled state without callback', () => {
    const onOpenAssessment = vi.fn();
    const resources: LessonResource[] = [
      {
        title: 'Midterm Exam',
        kind: 'exam',
        assessment: {
          mode: 'exam',
          timeLimitMinutes: 45,
          questions: [
            {
              id: 'q1',
              type: 'mcq',
              header: { text: 'Pick A' },
              options: ['A', 'B'],
              correctIndices: [0],
            },
            {
              id: 'q2',
              type: 'true-false',
              header: { text: 'True?' },
              options: ['True', 'False'],
              correctIndices: [0],
            },
          ],
        },
      },
    ];

    const { rerender } = render(
      <MaterialList
        resources={resources}
        onOpenAssessment={onOpenAssessment}
        getAssessmentScore={() => ({
          bestScorePercent: 92,
          latestScorePercent: 85,
          attempts: 2,
          passed: true,
          updatedAt: '2026-11-22T00:00:00.000Z',
        })}
      />
    );

    const examBtn = screen.getByRole('button', { name: /Midterm Exam/i });
    expect(within(examBtn).getAllByText('Exam')).toHaveLength(2);
    expect(within(examBtn).getByText('2 questions')).toBeInTheDocument();
    expect(within(examBtn).getByText('45 min')).toBeInTheDocument();
    expect(within(examBtn).getByText('Best: 92%')).toHaveClass('bg-emerald-100');
    fireEvent.click(examBtn);
    expect(onOpenAssessment).toHaveBeenCalledWith(resources[0]);

    // Without onOpenAssessment, button is disabled and shows hint
    rerender(<MaterialList resources={resources} />);
    const disabledBtn = screen.getByRole('button', { name: /Midterm Exam/i });
    expect(disabledBtn).toBeDisabled();
    expect(within(disabledBtn).getByText('Available in course view')).toBeInTheDocument();

    // Reactive ProgressProvider integration
    saveProgressState({
      version: 1,
      statuses: {},
      bookmarks: [],
      assessmentScores: {
        cs201: {
          'cs201-lesson-1::Midterm Exam': {
            bestScorePercent: 55,
            latestScorePercent: 55,
            attempts: 1,
            passed: false,
            updatedAt: '2026-11-22T00:00:00.000Z',
          },
        },
      },
    });

    rerender(
      <ProgressProvider>
        <MaterialList
          resources={resources}
          courseSlug="cs201"
          itemId="cs201-lesson-1"
          onOpenAssessment={onOpenAssessment}
        />
      </ProgressProvider>
    );

    expect(screen.getByText('Best: 55%')).toHaveClass('bg-amber-100');
  });
});
