import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssessmentBuilderModal } from '@/components/assessment/AssessmentBuilderModal';
import { ASSESSMENT_EXPORT_FORMAT, ASSESSMENT_EXPORT_VERSION } from '@/lib/assessmentExchange';
import { deleteFile, listFileIds } from '@/lib/fileStore';
import type { AssessmentData } from '@/types/course';

describe('AssessmentBuilderModal', () => {
  let origCreateObjectURL: typeof URL.createObjectURL;
  let origRevokeObjectURL: typeof URL.revokeObjectURL;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let anchorClickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    localStorage.clear();
    const ids = await listFileIds();
    await Promise.all(ids.map((id) => deleteFile(id)));

    origCreateObjectURL = URL.createObjectURL;
    origRevokeObjectURL = URL.revokeObjectURL;
    let urlCounter = 0;
    createObjectURLSpy = vi.fn(() => `blob:builder-${++urlCounter}`);
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

    anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    anchorClickSpy.mockRestore();
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

  it('renders nothing when closed, loads initialAssessment when open, and dismisses via Cancel or Escape', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { rerender } = render(
      <AssessmentBuilderModal
        isOpen={false}
        courseCode="CS101"
        onSave={onSave}
        onClose={onClose}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const initialAssessment: AssessmentData = {
      mode: 'assignment',
      instructions: 'Solve $x^2 = 9$.',
      timeLimitMinutes: 25,
      passingScorePercent: 80,
      shuffleQuestions: true,
      questions: [
        {
          id: 'q-init',
          type: 'true-false',
          header: { text: 'Initial statement' },
          options: ['True', 'False'],
          correctIndices: [0],
          points: 2,
        },
      ],
    };

    rerender(
      <AssessmentBuilderModal
        isOpen
        initialTitle="Homework 1"
        initialKind="assignment"
        initialAssessment={initialAssessment}
        courseCode="CS101"
        onSave={onSave}
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog.className).toContain('dark:bg-[#121926]');
    expect(screen.getByLabelText('Assessment title')).toHaveValue('Homework 1');
    expect(screen.getByLabelText('Assessment mode')).toHaveValue('assignment');
    expect(screen.getByLabelText('Time limit (minutes)')).toHaveValue(25);
    expect(screen.getByLabelText('Passing score (%)')).toHaveValue(80);
    expect(screen.getByLabelText('Shuffle questions')).toBeChecked();
    expect(screen.getByLabelText('Question text')).toHaveValue('Initial statement');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('updates settings and renders live KaTeX preview for instructions, question text, and choices', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <AssessmentBuilderModal
        isOpen
        courseCode="MATH101"
        onSave={onSave}
        onClose={onClose}
      />
    );

    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'Compute $\\alpha + \\beta$.' },
    });
    fireEvent.change(screen.getByLabelText('Question text'), {
      target: { value: 'Integrate $\\int_0^1 x^2 dx$.' },
    });
    fireEvent.change(screen.getByLabelText('Option 1'), {
      target: { value: '$\\frac{1}{3}$' },
    });

    fireEvent.change(screen.getByLabelText('Assessment mode'), {
      target: { value: 'assignment' },
    });
    fireEvent.change(screen.getByLabelText('Time limit (minutes)'), {
      target: { value: '40' },
    });
    fireEvent.change(screen.getByLabelText('Passing score (%)'), {
      target: { value: '75' },
    });
    fireEvent.click(screen.getByLabelText('Shuffle questions'));

    expect(document.querySelectorAll('.katex').length).toBeGreaterThanOrEqual(3);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.assessment.mode).toBe('assignment');
    expect(saved.assessment.timeLimitMinutes).toBe(40);
    expect(saved.assessment.passingScorePercent).toBe(75);
    expect(saved.assessment.shuffleQuestions).toBe(true);
    expect(saved.suggestedKind).toBe('assignment');
  });

  it('supports adding, duplicating, reordering up/down, and deleting questions (protecting last question)', () => {
    render(
      <AssessmentBuilderModal
        isOpen
        courseCode="CS201"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const deleteFirst = screen.getByRole('button', { name: 'Delete question 1' });
    expect(deleteFirst).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Question text'), {
      target: { value: 'First Q' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Question/i }));

    expect(screen.getByLabelText('Question text')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Question text'), {
      target: { value: 'Second Q' },
    });

    // Duplicate question 2
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate question 2' }));
    expect(screen.getByLabelText('Question text')).toHaveValue('Second Q');

    // Move question 1 down
    fireEvent.click(screen.getByRole('button', { name: 'Move question 1 down' }));
    expect(screen.getAllByText('Second Q').length).toBeGreaterThanOrEqual(1);

    // Delete question 3
    fireEvent.click(screen.getByRole('button', { name: 'Delete question 3' }));
    expect(screen.queryByRole('button', { name: 'Delete question 3' })).not.toBeInTheDocument();
  });

  it('switches across all 4 question types, validates header images, and revokes blob URLs cleanly', async () => {
    const { unmount } = render(
      <AssessmentBuilderModal
        isOpen
        courseCode="PHYS101"
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    // Switch to multi-select, true-false, short-answer
    const typeSelect = screen.getByLabelText('Question type');
    fireEvent.change(typeSelect, { target: { value: 'multi-select' } });
    expect(screen.getByLabelText('Mark option 1 as correct')).toHaveAttribute(
      'type',
      'checkbox'
    );

    fireEvent.change(typeSelect, { target: { value: 'true-false' } });
    expect(screen.getByLabelText('Option 1')).toHaveValue('True');
    expect(screen.getByLabelText('Option 2')).toHaveValue('False');

    fireEvent.change(typeSelect, { target: { value: 'short-answer' } });
    fireEvent.change(screen.getByLabelText('Accepted answer 1'), {
      target: { value: 'Newton' },
    });
    fireEvent.click(screen.getByLabelText('Case-sensitive'));

    // Reject dangerous .svg header image
    const fileInput = screen.getByLabelText('Upload question image') as HTMLInputElement;
    const svgFile = new File(['<svg></svg>'], 'bad.svg', { type: 'image/svg+xml' });
    fireEvent.change(fileInput, { target: { files: [svgFile] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/blocked/i);
    expect(await listFileIds()).toEqual([]);

    // Reject 0-byte image
    const emptyFile = new File([], 'empty.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [emptyFile] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Empty files/i);

    // Reject non-http(s) imageUrl
    fireEvent.change(screen.getByLabelText('Question image URL'), {
      target: { value: 'javascript:alert(1)' },
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/http:\/\/ or https:\/\//i);

    // Upload valid PNG image
    const pngFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1])], 'diagram.png', {
      type: 'image/png',
    });
    fireEvent.change(fileInput, { target: { files: [pngFile] } });

    await waitFor(async () => {
      const ids = await listFileIds();
      expect(ids).toHaveLength(1);
      expect(ids[0]).toMatch(/^phys101-file-[0-9a-f]{8}$/);
    });

    await waitFor(() => {
      expect(screen.getByAltText('diagram.png')).toHaveAttribute('src', 'blob:builder-1');
    });

    // Removing image revokes object URL
    fireEvent.click(screen.getByRole('button', { name: /Remove Image/i }));
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:builder-1');

    // Re-upload and verify unmount revokes URL
    fireEvent.change(fileInput, { target: { files: [pngFile] } });
    await waitFor(() => {
      expect(screen.getByAltText('diagram.png')).toHaveAttribute('src', 'blob:builder-2');
    });
    unmount();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:builder-2');
  });

  it('blocks invalid drafts before onSave and supports Import JSON and Export JSON', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <AssessmentBuilderModal
        isOpen
        courseCode="CS301"
        onSave={onSave}
        onClose={onClose}
      />
    );

    // Empty header should block Save
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Import valid .assessment.json
    fireEvent.click(screen.getByRole('button', { name: /Import JSON/i }));
    const importPayload = JSON.stringify({
      format: ASSESSMENT_EXPORT_FORMAT,
      version: ASSESSMENT_EXPORT_VERSION,
      title: 'Imported Quiz',
      kind: 'assignment',
      assessment: {
        mode: 'assignment',
        questions: [
          {
            id: 'q-imp',
            type: 'mcq',
            header: { text: 'What is $2+2$?' },
            options: ['3', '4'],
            correctIndices: [1],
          },
        ],
      },
    });
    fireEvent.change(screen.getByLabelText('Paste assessment JSON'), {
      target: { value: importPayload },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Import' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Assessment title')).toHaveValue('Imported Quiz');
    });
    expect(screen.getByLabelText('Question text')).toHaveValue('What is $2+2$?');

    // Export JSON triggers download and revokes URL
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /Export JSON/i }));
    await vi.waitFor(() => {
      expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    });
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:builder-1');
    vi.useRealTimers();

    // Save succeeds
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({
      assessment: expect.objectContaining({
        mode: 'assignment',
        questions: [
          expect.objectContaining({
            id: 'q-imp',
            header: { text: 'What is $2+2$?' },
          }),
        ],
      }),
      suggestedTitle: 'Imported Quiz',
      suggestedKind: 'assignment',
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
