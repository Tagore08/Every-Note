/**
 * Date utility module ensuring all journal and daily aggregations use
 * the client's LOCAL timezone rather than UTC.
 * 
 * Pitfall guard: new Date().toISOString().slice(0, 10) returns UTC,
 * which flips the date hours early/late for non-GMT users (e.g. 23:30 local).
 */

/**
 * Returns 'YYYY-MM-DD' in the user's local timezone.
 */
export function localDateStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a 'YYYY-MM-DD' string into a local Date instance anchored at midnight local time.
 */
export function parseLocalDateStr(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
}

/**
 * Offsets a 'YYYY-MM-DD' string by a given number of days (+1, -1, etc.).
 */
export function addDays(dateStr: string, offsetDays: number): string {
  const d = parseLocalDateStr(dateStr);
  d.setDate(d.getDate() + offsetDays);
  return localDateStr(d);
}

/**
 * Returns whether the given 'YYYY-MM-DD' is today in local time.
 */
export function isTodayStr(dateStr: string): boolean {
  return dateStr === localDateStr();
}

/**
 * Formats a 'YYYY-MM-DD' string for display headers.
 * e.g. { weekday: 'Wednesday', formattedDate: 'September 24, 2026', isToday: true }
 */
export function formatJournalDateHeader(dateStr: string): {
  weekday: string;
  formattedDate: string;
  relativeLabel?: string;
  isToday: boolean;
} {
  const date = parseLocalDateStr(dateStr);
  const todayStr = localDateStr();
  const yesterdayStr = addDays(todayStr, -1);
  const tomorrowStr = addDays(todayStr, 1);

  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
  const formattedDate = date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  let relativeLabel: string | undefined = undefined;
  if (dateStr === todayStr) relativeLabel = 'Today';
  else if (dateStr === yesterdayStr) relativeLabel = 'Yesterday';
  else if (dateStr === tomorrowStr) relativeLabel = 'Tomorrow';

  return {
    weekday,
    formattedDate,
    relativeLabel,
    isToday: dateStr === todayStr,
  };
}
