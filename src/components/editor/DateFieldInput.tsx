import { useRef, type KeyboardEvent } from 'react';
import { joinDmySegments, splitDmySegments } from '@/lib/dateValidation';

interface DateFieldInputProps {
  value: string;
  onChange: (next: string) => void;
  ariaLabelPrefix: string;
  hasError?: boolean;
  errorKey?: string;
}

export function DateFieldInput({
  value,
  onChange,
  ariaLabelPrefix,
  hasError = false,
  errorKey,
}: DateFieldInputProps) {
  const dayRef = useRef<HTMLInputElement | null>(null);
  const monthRef = useRef<HTMLInputElement | null>(null);
  const yearRef = useRef<HTMLInputElement | null>(null);

  const { day, month, year } = splitDmySegments(value);

  const updateSegments = (nextDay: string, nextMonth: string, nextYear: string) => {
    onChange(joinDmySegments(nextDay, nextMonth, nextYear));
  };

  const handleSegmentKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    segment: 'day' | 'month' | 'year'
  ) => {
    if (e.key === 'Backspace') {
      if (segment === 'month' && month.length === 0) {
        dayRef.current?.focus();
      } else if (segment === 'year' && year.length === 0) {
        monthRef.current?.focus();
      }
    }
  };

  const segmentClass =
    'w-full bg-transparent text-center font-mono text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none';

  return (
    <div
      data-error-key={errorKey}
      data-field-error={hasError ? 'true' : undefined}
      aria-invalid={hasError || undefined}
      className={`flex items-center gap-1 rounded border bg-[var(--surface-1)] px-2 py-1 focus-within:border-[var(--border-focus)] focus-within:ring-2 focus-within:ring-[var(--border-focus)]/20 ${
        hasError
          ? 'border-[var(--status-danger-border)] ring-1 ring-[var(--status-danger-border)]/30'
          : 'border-[var(--border-strong)]'
      }`}
    >
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={day}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
          updateSegments(digits, month, year);
          if (digits.length === 2) {
            monthRef.current?.focus();
          }
        }}
        onKeyDown={(e) => handleSegmentKeyDown(e, 'day')}
        placeholder="DD"
        aria-label={`${ariaLabelPrefix} day`}
        className={`${segmentClass} max-w-7`}
      />
      <span className="select-none text-xs text-[var(--text-muted)]" aria-hidden="true">
        /
      </span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        value={month}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
          updateSegments(day, digits, year);
          if (digits.length === 2) {
            yearRef.current?.focus();
          }
        }}
        onKeyDown={(e) => handleSegmentKeyDown(e, 'month')}
        placeholder="MM"
        aria-label={`${ariaLabelPrefix} month`}
        className={`${segmentClass} max-w-7`}
      />
      <span className="select-none text-xs text-[var(--text-muted)]" aria-hidden="true">
        /
      </span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        maxLength={4}
        value={year}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
          updateSegments(day, month, digits);
        }}
        onKeyDown={(e) => handleSegmentKeyDown(e, 'year')}
        placeholder="YYYY"
        aria-label={`${ariaLabelPrefix} year`}
        className={`${segmentClass} max-w-11`}
      />
    </div>
  );
}
