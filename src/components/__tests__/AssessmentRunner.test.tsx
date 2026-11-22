import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssessmentRunnerModal } from '@/components/assessment/AssessmentRunnerModal';
import { deleteFile, listFileIds, putFile } from '@/lib/fileStore';
import { ProgressProvider, PROGRESS_STORAGE_KEY } from '@/store/useProgressStore';
import type { LessonResource } from '@/types/course';

function renderWithProgress(ui: React.ReactElement) {
  return render(<ProgressProvider>{ui}</ProgressProvider>);
}

describe('AssessmentRunnerModal', () => {
  let origCreateObjectURL: typeof URL.createObjectURL;
  let origRevokeObjectURL: typeof URL.revokeObjectURL;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    localStorage.clear();
    const ids = await listFileIds();
    await Promise.all(ids.map((id) => deleteFile(id)));

    origCreateObjectURL = URL.createObjectURL;
    origRevokeObjectURL = URL.revokeObjectURL;
    let urlCounter = 0;
    createObjectURLSpy = vi.fn(() => `blob:runner-${++urlCounter}`);
    revokeObjectURLSpy = vi.fn();

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectURLSpy,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectURLSpy,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: origCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: origRevokeObjectURL,
    });
  });

  it('renders header imageFile & https imageUrl, renders KaTeX safely, and revokes object URLs on switch & unmount', async () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    await putFile(
      'math101-file-img00001',
      new Blob([pngBytes], { type: 'image/png' }),
      'triangle.png',
      'image/png'
    );

    const resource: LessonResource = {
      title: 'Geometry Quiz',
      kind: 'assignment',
      assessment: {
        mode: 'assignment',
        questions: [
          {
            id: 'q1',
            type: 'true-false',
            header: {
              text: 'Triangle $ABC$ has $<script>alert(1)</script>$',
              imageFile: {
                id: 'math101-file-img00001',
                name: 'triangle.png',
                mimeType: 'image/png',
                sizeBytes: pngBytes.byteLength,
              },
            },
            correctIndices: [0],
          },
          {
            id: 'q2',
            type: 'true-false',
            header: {
              text: 'External diagram',
              imageUrl: 'https://example.com/diagram.png',
            },
            correctIndices: [1],
          },
        ],
      },
    };

    const { unmount } = renderWithProgress(
      <AssessmentRunnerModal
        isOpen
        courseSlug="math101"
        itemId="math101-ch1-intro"
        resource={resource}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByAltText('triangle.png')).toHaveAttribute('src', 'blob:runner-1');
    });
    expect(document.querySelector('.katex')).not.toBeNull();
    expect(document.querySelector('script')).toBeNull();

    // Switching to q2 revokes q1's blob URL and renders https imageUrl
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:runner-1');
    expect(screen.getByAltText('Question illustration')).toHaveAttribute(
      'src',
      'https://example.com/diagram.png'
    );

    // Jump back to q1 then unmount -> revokes newly created URL
    fireEvent.click(screen.getByRole('button', { name: 'Jump to question 1' }));
    await waitFor(() => {
      expect(screen.getByAltText('triangle.png')).toHaveAttribute('src', 'blob:runner-2');
    });
    unmount();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:runner-2');
  });

  it('runs Assignment mode with Show Hint, Check Answer instant feedback, explanation, and score persistence', () => {
    const resource: LessonResource = {
      title: 'Calculus Practice',
      kind: 'assignment',
      assessment: {
        mode: 'assignment',
        passingScorePercent: 50,
        questions: [
          {
            id: 'q1',
            type: 'mcq',
            header: { text: 'Derivative of $x^2$?' },
            options: ['$x$', '$2x$'],
            correctIndices: [1],
            hint: 'Use the power rule $nx^{n-1}$.',
            explanation: '$\\frac{d}{dx}x^2 = 2x$.',
          },
        ],
      },
    };

    renderWithProgress(
      <AssessmentRunnerModal
        isOpen
        courseSlug="math101"
        itemId="math101-deriv"
        resource={resource}
        onClose={vi.fn()}
      />
    );

    const checkBtn = screen.getByRole('button', { name: 'Check Answer' });
    expect(checkBtn).toBeDisabled();

    // Toggle hint
    fireEvent.click(screen.getByRole('button', { name: 'Show Hint' }));
    expect(screen.getByText(/power rule/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide Hint' }));
    expect(screen.queryByText(/power rule/i)).not.toBeInTheDocument();

    // Select answer & check
    fireEvent.click(screen.getAllByRole('radio')[1]);
    expect(checkBtn).toBeEnabled();
    fireEvent.click(checkBtn);

    expect(screen.getByText('Correct')).toBeInTheDocument();
    expect(screen.getByText(/Explanation:/)).toBeInTheDocument();

    // Finish Assignment records score once
    fireEvent.click(screen.getByRole('button', { name: 'Finish Assignment' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();

    const stored = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || '{}');
    expect(stored.assessmentScores.math101['math101-deriv::Calculus Practice']).toMatchObject({
      bestScorePercent: 100,
      latestScorePercent: 100,
      attempts: 1,
      passed: true,
    });
  });

  it('runs Exam mode with flagging, jumpable navigator, weighted grading across all 4 types, review, and retake', () => {
    const resource: LessonResource = {
      title: 'Midterm Exam',
      kind: 'exam',
      assessment: {
        mode: 'exam',
        passingScorePercent: 70,
        questions: [
          {
            id: 'q1',
            type: 'mcq',
            header: { text: 'Q1 MCQ' },
            options: ['Wrong', 'Right'],
            correctIndices: [1],
            points: 2,
            explanation: 'Because Right is correct.',
          },
          {
            id: 'q2',
            type: 'multi-select',
            header: { text: 'Q2 Multi' },
            options: ['A', 'B', 'C'],
            correctIndices: [0, 2],
            points: 2,
          },
          {
            id: 'q3',
            type: 'true-false',
            header: { text: 'Q3 TF' },
            correctIndices: [0],
            points: 1,
          },
          {
            id: 'q4',
            type: 'short-answer',
            header: { text: 'Q4 Short' },
            acceptedAnswers: ['Euler'],
            caseSensitive: true,
            points: 5,
          },
        ],
      },
    };

    renderWithProgress(
      <AssessmentRunnerModal
        isOpen
        courseSlug="cs201"
        itemId="cs201-midterm"
        resource={resource}
        onClose={vi.fn()}
      />
    );

    // Exam mode hides hints & Check Answer before submission
    expect(screen.queryByRole('button', { name: 'Check Answer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show Hint/i })).not.toBeInTheDocument();

    // Answer Q1 correctly (2 pts) and flag it
    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getByRole('button', { name: /Flag for review/i }));
    expect(screen.getByRole('button', { name: 'Jump to question 1 (flagged)' })).toBeInTheDocument();

    // Jump to Q2 and answer partially (only A -> 0 pts for exact-set multi-select)
    fireEvent.click(screen.getByRole('button', { name: 'Jump to question 2' }));
    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    // Jump to Q3 and answer correctly (1 pt)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getAllByRole('radio')[0]);

    // Jump to Q4 and answer with exact case 'Euler' (5 pts)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'Euler' } });

    // Submit Exam -> 8 / 10 pts = 80% -> Passed (>= 70%)
    fireEvent.click(screen.getByRole('button', { name: 'Submit Exam' }));
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText(/Score: 8 \/ 10 pts/)).toBeInTheDocument();
    expect(screen.getByText(/Because Right is correct/)).toBeInTheDocument();

    let stored = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || '{}');
    expect(stored.assessmentScores.cs201['cs201-midterm::Midterm Exam']).toMatchObject({
      bestScorePercent: 80,
      latestScorePercent: 80,
      attempts: 1,
      passed: true,
    });

    // Retake -> submit empty (0%) -> best stays 80, latest becomes 0, attempts becomes 2, passed remains sticky true
    fireEvent.click(screen.getByRole('button', { name: 'Retake' }));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Exam' }));
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Not Passed')).toBeInTheDocument();

    stored = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || '{}');
    expect(stored.assessmentScores.cs201['cs201-midterm::Midterm Exam']).toMatchObject({
      bestScorePercent: 80,
      latestScorePercent: 0,
      attempts: 2,
      passed: true,
    });
  });

  it('auto-submits Exam at 00:00 with already-entered answers (no stale closure)', () => {
    vi.useFakeTimers();
    const resource: LessonResource = {
      title: 'Timed Quiz',
      kind: 'exam',
      assessment: {
        mode: 'exam',
        timeLimitMinutes: 1,
        passingScorePercent: 70,
        questions: [
          {
            id: 'q1',
            type: 'true-false',
            header: { text: 'Timed Q' },
            correctIndices: [0],
          },
        ],
      },
    };

    renderWithProgress(
      <AssessmentRunnerModal
        isOpen
        courseSlug="phys101"
        itemId="phys101-q1"
        resource={resource}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Time remaining')).toHaveTextContent('01:00');
    fireEvent.click(screen.getAllByRole('radio')[0]);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Passed')).toBeInTheDocument();
    const stored = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || '{}');
    expect(stored.assessmentScores.phys101['phys101-q1::Timed Quiz']).toMatchObject({
      bestScorePercent: 100,
      attempts: 1,
      passed: true,
    });
  });

  it('grades shuffled questions accurately by question id', () => {
    const resource: LessonResource = {
      title: 'Shuffled Test',
      kind: 'exam',
      assessment: {
        mode: 'exam',
        shuffleQuestions: true,
        questions: [
          {
            id: 'q-alpha',
            type: 'short-answer',
            header: { text: 'Alpha?' },
            acceptedAnswers: ['alpha'],
          },
          {
            id: 'q-beta',
            type: 'short-answer',
            header: { text: 'Beta?' },
            acceptedAnswers: ['beta'],
          },
        ],
      },
    };

    renderWithProgress(
      <AssessmentRunnerModal
        isOpen
        courseSlug="cs101"
        itemId="cs101-shuf"
        resource={resource}
        onClose={vi.fn()}
      />
    );

    // Answer whichever question appeared first
    const firstHeader = screen.getByText(/Alpha\?|Beta\?/).textContent;
    fireEvent.change(screen.getByLabelText('Your answer'), {
      target: { value: firstHeader?.includes('Alpha') ? 'alpha' : 'beta' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const secondHeader = screen.getByText(/Alpha\?|Beta\?/).textContent;
    fireEvent.change(screen.getByLabelText('Your answer'), {
      target: { value: secondHeader?.includes('Alpha') ? 'alpha' : 'beta' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit Exam' }));
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
