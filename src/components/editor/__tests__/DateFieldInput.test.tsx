import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DateFieldInput } from '@/components/editor/DateFieldInput';
import { isValidDmyDate } from '@/lib/dateValidation';

describe('isValidDmyDate', () => {
  it('validates real DD/MM/YYYY calendar dates including leap years', () => {
    expect(isValidDmyDate('30/11/2026')).toBe(true);
    expect(isValidDmyDate('29/02/2024')).toBe(true);
    expect(isValidDmyDate('29/02/2025')).toBe(false);
    expect(isValidDmyDate('31/02/2026')).toBe(false);
    expect(isValidDmyDate('00/12/2026')).toBe(false);
    expect(isValidDmyDate('2026-11-30')).toBe(false);
  });
});

describe('DateFieldInput', () => {
  it('renders DD / MM / YYYY inputs and auto-advances on 2-digit entry', () => {
    const onChange = vi.fn();
    render(
      <DateFieldInput value="" onChange={onChange} ariaLabelPrefix="Exam date" />
    );

    const dayInput = screen.getByLabelText('Exam date day') as HTMLInputElement;
    const monthInput = screen.getByLabelText('Exam date month') as HTMLInputElement;
    const yearInput = screen.getByLabelText('Exam date year') as HTMLInputElement;

    dayInput.focus();
    fireEvent.change(dayInput, { target: { value: '15' } });
    expect(onChange).toHaveBeenCalledWith('15//');
    expect(document.activeElement).toBe(monthInput);

    fireEvent.change(monthInput, { target: { value: '04' } });
    expect(onChange).toHaveBeenCalledWith('/04/');
    expect(document.activeElement).toBe(yearInput);
  });
});
