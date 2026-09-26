/**
 * Centralized, calendar-accurate date and time utilities for Axis.
 * Handles ISO strings, timestamps, legacy "Just now" strings, and relative formatting.
 */

/**
 * Extracts a valid Date from an ISO string, timestamp number, or ID with embedded epoch (e.g., session-1727374829102).
 */
export function extractValidDate(
  dateOrLegacy?: string | number | null,
  fallbackId?: string,
  fallbackItems?: Array<{ id?: string; timestamp?: string }>
): Date | null {
  if (typeof dateOrLegacy === 'number' && !isNaN(dateOrLegacy)) {
    const d = new Date(dateOrLegacy);
    if (!isNaN(d.getTime())) return d;
  }

  if (typeof dateOrLegacy === 'string' && dateOrLegacy.trim()) {
    const trimmed = dateOrLegacy.trim();
    // Try standard date parsing if it's not a legacy string like "Just now"
    if (trimmed !== 'Just now' && trimmed !== 'Recent' && trimmed !== 'Warning' && trimmed !== 'Insight') {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) return d;
    }
  }

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
        const d = new Date(item.timestamp);
        if (!isNaN(d.getTime())) return d;
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

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
    const weekday = date.toLocaleDateString([], { weekday: 'short' });
    return options?.showTime === false ? weekday : `${weekday} ${timeStr}`;
  }

  // Check if same year
  if (date.getFullYear() === now.getFullYear()) {
    const monthDay = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return options?.showTime === false ? monthDay : `${monthDay} ${timeStr}`;
  }

  // Different year
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Compact relative label for notification cards (e.g. "Just now", "5m ago", "Today", "Yesterday", "Sep 25")
 */
export function formatNotificationTime(timeStr?: string): string {
  if (!timeStr) return 'Just now';
  // If explicitly custom label like 'Insight' or 'Warning' without date
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
  const timePart = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return `Today at ${timePart}`;
  if (isYesterday) return `Yesterday at ${timePart}`;

  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${timePart}`;
}

/**
 * Format chat message timestamps nicely
 */
export function formatMessageTime(timestampStr?: string): string {
  if (!timestampStr) return '';
  const date = extractValidDate(timestampStr);
  if (!date) return timestampStr;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
