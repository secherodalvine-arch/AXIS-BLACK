/**
 * formatDate.ts
 * Formats dates and times in the user device's REAL local timezone.
 */

export const userTimeZone = typeof Intl !== 'undefined' && Intl.DateTimeFormat
  ? Intl.DateTimeFormat().resolvedOptions().timeZone
  : 'UTC';

export function toUtcDate(input: string | number | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') return new Date(input);

  let s = String(input).trim();
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // If date-only format YYYY-MM-DD, parse as local midday so timezone shifts never push it to wrong day
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [year, month, day] = s.split('-').map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month - 1, day, 12, 0, 0);
    }
  }

  // Treat missing timezone suffix as UTC by appending Z
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s)) {
    const d = new Date(s.replace(' ', 'T') + 'Z');
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDate(input: string | number | Date | null | undefined): string {
  const d = toUtcDate(input);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: userTimeZone,
  });
}

export function fmtTime(input: string | number | Date | null | undefined): string {
  const d = toUtcDate(input);
  if (!d) return '—';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: userTimeZone,
  });
}

export function fmtDateTime(input: string | number | Date | null | undefined): string {
  const d = toUtcDate(input);
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: userTimeZone,
  });
}

export function fmtRelative(input: string | number | Date | null | undefined): string {
  const d = toUtcDate(input);
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffSec < 15) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return fmtDate(d);
}
