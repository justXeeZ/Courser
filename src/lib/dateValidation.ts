const DMY_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Validates that a string is strictly DD/MM/YYYY and represents a real calendar date.
 */
export function isValidDmyDate(value: string): boolean {
  const match = DMY_REGEX.exec(value.trim());
  if (!match) return false;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const probe = new Date(year, month - 1, day);
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  );
}

export function splitDmySegments(value: string): {
  day: string;
  month: string;
  year: string;
} {
  const parts = value.split('/');
  return {
    day: (parts[0] ?? '').replace(/\D/g, '').slice(0, 2),
    month: (parts[1] ?? '').replace(/\D/g, '').slice(0, 2),
    year: (parts[2] ?? '').replace(/\D/g, '').slice(0, 4),
  };
}

export function joinDmySegments(day: string, month: string, year: string): string {
  if (!day && !month && !year) return '';
  return `${day}/${month}/${year}`;
}
