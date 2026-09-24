/**
 * Utility functions for text formatting, relative timestamps, snippet extraction, and file sizes.
 */

export function formatRelativeTime(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 5) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;

  // Format as short date (e.g. "Oct 12" or "Oct 12, 2025")
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  };
  return date.toLocaleDateString(undefined, options);
}

/**
 * Returns a clean display title:
 * If title is present and non-empty, returns it.
 * Otherwise, derives a title from the first non-empty line of content truncated to 60 characters.
 * Defaults to "Untitled Note" if neither exists.
 */
export function getDisplayTitle(note: { title?: string; content?: string }): string {
  if (note.title && note.title.trim().length > 0) {
    return note.title.trim();
  }

  if (note.content && note.content.trim().length > 0) {
    const firstLine = note.content.trim().split('\n')[0].trim();
    if (firstLine.length > 60) {
      return firstLine.slice(0, 57) + '...';
    }
    return firstLine;
  }

  return 'Untitled Note';
}

/**
 * Extracts a 2-line snippet from note content.
 */
export function getContentSnippet(content: string, maxLines = 2, maxChars = 140): string {
  if (!content) return '';
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const snippet = lines.slice(0, maxLines).join(' ');
  if (snippet.length > maxChars) {
    return snippet.slice(0, maxChars - 3) + '...';
  }
  return snippet;
}

/**
 * Extracts a snippet centered around the query match.
 */
export function getSearchSnippet(content: string, query: string, snippetLength = 120): string {
  if (!content || !query) return getContentSnippet(content);

  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerContent.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return getContentSnippet(content);
  }

  const start = Math.max(0, matchIndex - Math.floor(snippetLength / 3));
  const end = Math.min(content.length, start + snippetLength);

  let snippet = content.slice(start, end).replace(/\n+/g, ' ');
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Formats a file size in bytes to a human-readable string (B, KB, MB, GB).
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const formatted = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${formatted} ${units[i] || 'GB'}`;
}

/**
 * Checks whether a due date is in the past compared to current time.
 */
export function isOverdue(dateInput: Date | string | number | null | undefined): boolean {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  return !isNaN(d.getTime()) && d.getTime() < Date.now();
}

/**
 * Formats a due date into a human-friendly string (e.g. "Today", "Tomorrow", "Yesterday", or "Oct 24").
 */
export function formatDueDate(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  }

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

/**
 * Returns 'YYYY-MM-DD' in local time for a Date.
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses 'YYYY-MM-DD' into a local Date at 00:00:00.
 */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Checks if two dates fall on the exact same local calendar day.
 */
export function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * Formats a Date into a long header (e.g. "Tuesday, September 24, 2026").
 */
export function formatDayHeader(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats event time block (e.g. "All day", "9:00 AM - 10:30 AM", or "9:00 AM").
 */
export function formatEventTime(startAt: Date, endAt?: Date | null, allDay?: boolean): string {
  if (allDay) return 'All day';

  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
  };

  const startTimeStr = new Date(startAt).toLocaleTimeString(undefined, timeOptions);
  if (!endAt) return startTimeStr;

  const endTimeStr = new Date(endAt).toLocaleTimeString(undefined, timeOptions);
  return `${startTimeStr} - ${endTimeStr}`;
}

