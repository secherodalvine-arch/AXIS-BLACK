/**
 * Centralized, calendar-accurate date and time utilities for Axis.
 * Handles ISO strings, timestamps, legacy strings, and formats in the user device's REAL local time.
 */

import { getDeviceLocalDateString, getDeviceLocalTimeString } from './captureInfo';

export const userTimeZone = typeof Intl !== 'undefined' && Intl.DateTimeFormat
  ? Intl.DateTimeFormat().resolvedOptions().timeZone
  : 'UTC';

/**
 * Normalizes input string/number/Date to ensure UTC interpretation when timezone is absent,
 * so the browser accurately converts it to user's device local timezone.
 */
export function toUtcDate(input?: string | number | Date | null): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  let s = String(input).trim();
  if (!s || s === 'Just now' || s === 'Recent' || s === 'Warning' || s === 'Insight') {
    return null;
  }

  // If date-only format YYYY-MM-DD, parse as local midday so timezone shifts never shift it to yesterday/tomorrow
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [year, month, day] = s.split('-').map(Number);
    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      return new Date(year, month - 1, day, 12, 0, 0);
    }
  }

  // If already has timezone indicator (ends with Z or +/-HH:MM)
  if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }

  // If standard ISO without timezone (e.g. "2026-10-01T19:40:24" or "2026-10-01 19:40:24")
  // Replace space with T and append Z to treat as UTC
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s)) {
    const isoUtc = s.replace(' ', 'T') + 'Z';
    const d = new Date(isoUtc);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback direct parse
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Extracts a valid Date from an ISO string, timestamp number, or ID with embedded epoch (e.g., session-1727374829102).
 */
export function extractValidDate(
  dateOrLegacy?: string | number | null,
  fallbackId?: string,
  fallbackItems?: Array<{ id?: string; timestamp?: string }>
): Date | null {
  const direct = toUtcDate(dateOrLegacy);
  if (direct) return direct;

  // Fallback 1: Extract epoch timestamp from fallbackId (e.g. "session-1758920123456" or "notif-txn-1758...")
  if (fallbackId) {
    const match = fallbackId.match(/(\d{12,14})/);
    if (match) {
      const epoch = Number(match[1]);
      if (!isNaN(epoch) && epoch > 1000000000000 && epoch < 2500000000000) {
        return new Date(epoch);
      }
    }
  }

  // Fallback 2: Check messages or nested items for embedded epoch IDs
  if (fallbackItems && fallbackItems.length > 0) {
    for (const item of fallbackItems) {
      if (item.timestamp && item.timestamp !== 'Just now') {
        const d = toUtcDate(item.timestamp);
        if (d && !isNaN(d.getTime())) return d;
      }
      if (item.id) {
        const match = item.id.match(/(\d{12,14})/);
        if (match) {
          const epoch = Number(match[1]);
          if (!isNaN(epoch) && epoch > 1000000000000 && epoch < 2500000000000) {
            return new Date(epoch);
          }
        }
      }
    }
  }

  return null;
}

/**
 * Returns today's date in YYYY-MM-DD format in user's device local timezone.
 */
export function getLocalDateString(date: Date = new Date()): string {
  return getDeviceLocalDateString(date);
}

/**
 * Returns current time in HH:mm:ss in user's device local timezone.
 */
export function getLocalTimeString(date: Date = new Date()): string {
  return getDeviceLocalTimeString(date);
}

/**
 * Formats a date into a human-friendly relative label with calendar-accurate boundaries:
 * - "Just now" (< 1 min)
 * - "5m ago" (< 60 min)
 * - "2h ago" (< 6 hrs, same day)
 * - "Today 2:30 PM"
 * - "Yesterday 10:15 AM"
 * - "Mon 4:20 PM" (within past 7 days)
 * - "Sep 25 3:45 PM" (same year)
 * - "Sep 25, 2025" (earlier years)
 */
export function formatRelativeTime(
  input?: string | number | Date | null,
  options?: { fallbackId?: string; fallbackItems?: any[]; showTime?: boolean }
): string {
  if (!input && !options?.fallbackId) return 'Recently';

  let date: Date | null = null;
  if (input instanceof Date && !isNaN(input.getTime())) {
    date = input;
  } else {
    date = extractValidDate(typeof input === 'string' || typeof input === 'number' ? input : null, options?.fallbackId, options?.fallbackItems);
  }

  // If unparseable and input was a non-empty string other than "Just now", return input
  if (!date) {
    if (typeof input === 'string' && input.trim() && input !== 'Just now') {
      return input.trim();
    }
    return 'Just now';
  }

  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: userTimeZone });

  // Compare calendar days
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 6) return `${diffHours}h ago`;
    return `Today ${timeStr}`;
  }

  if (isYesterday) {
    return options?.showTime === false ? 'Yesterday' : `Yesterday ${timeStr}`;
  }

  // Check if within 6 calendar days
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays >= 0 && diffDays < 7) {
    const weekday = date.toLocaleDateString([], { weekday: 'short', timeZone: userTimeZone });
    return options?.showTime === false ? weekday : `${weekday} ${timeStr}`;
  }

  // Check if same year
  if (date.getFullYear() === now.getFullYear()) {
    const monthDay = date.toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: userTimeZone });
    return options?.showTime === false ? monthDay : `${monthDay} ${timeStr}`;
  }

  // Different year
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: userTimeZone });
}

/**
 * Compact relative label for notification cards (e.g. "Just now", "5m ago", "Today", "Yesterday", "Sep 25")
 */
export function formatNotificationTime(timeStr?: string): string {
  if (!timeStr) return 'Just now';
  if (timeStr === 'Insight' || timeStr === 'Warning') return timeStr;
  return formatRelativeTime(timeStr, { showTime: true });
}

/**
 * Full detailed date & time for notification modal dialog
 */
export function formatNotificationDetailTime(timeStr?: string): string {
  if (!timeStr) return 'Just now';
  const date = extractValidDate(timeStr);
  if (!date) return timeStr;

  const now = new Date();
  const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: userTimeZone });
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return `Today at ${timePart}`;
  if (isYesterday) return `Yesterday at ${timePart}`;

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', timeZone: userTimeZone })} at ${timePart}`;
}

/**
 * Format chat message timestamps nicely in device local time
 */
export function formatMessageTime(timestampStr?: string): string {
  if (!timestampStr) return '';
  const date = extractValidDate(timestampStr);
  if (!date) return timestampStr;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: userTimeZone });
}

/**
 * Format standard local date (e.g. "Oct 1, 2026")
 */
export function formatDeviceDate(input?: string | number | Date | null): string {
  const d = toUtcDate(input);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: userTimeZone,
  });
}

/**
 * Format standard local date & time (e.g. "Oct 1, 2026, 10:40 PM")
 */
export function formatDeviceDateTime(input?: string | number | Date | null, options?: Intl.DateTimeFormatOptions): string {
  const d = toUtcDate(input);
  if (!d) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: userTimeZone,
    ...options
  });
}

export const fmtDate = formatDeviceDate;
export const fmtDateTime = formatDeviceDateTime;
export const fmtTime = formatMessageTime;
