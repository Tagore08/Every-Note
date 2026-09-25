import { localDateStr, addDays } from './date';

/**
 * Computes the consecutive active daily journal streak.
 * 
 * Rules:
 * - If today has an entry, streak starts at 1 and counts backwards.
 * - If today does NOT yet have an entry, streak checks yesterday so the streak
 *   doesn't break early in the morning before writing.
 * - Continues backwards day by day as long as dates are present.
 */
export function computeJournalStreak(
  entryDates: string[],
  todayStr: string = localDateStr()
): number {
  if (!entryDates || entryDates.length === 0) return 0;

  const dateSet = new Set(entryDates);
  let streak = 0;
  let curr = todayStr;

  if (dateSet.has(curr)) {
    while (dateSet.has(curr)) {
      streak++;
      curr = addDays(curr, -1);
    }
  } else {
    // Check yesterday
    curr = addDays(todayStr, -1);
    while (dateSet.has(curr)) {
      streak++;
      curr = addDays(curr, -1);
    }
  }

  return streak;
}

/**
 * Filters entries to those matching the exact same calendar month and day
 * from previous years (year < currentYear).
 */
export function filterOnThisDay<T extends { journalDate?: string | null }>(
  entries: T[],
  currentDateStr: string = localDateStr()
): T[] {
  if (!entries || entries.length === 0) return [];

  const [currYearStr, currMonthStr, currDayStr] = currentDateStr.split('-');
  const currentYear = Number(currYearStr);
  const targetSuffix = `-${currMonthStr}-${currDayStr}`;

  return entries
    .filter((entry) => {
      if (!entry.journalDate) return false;
      if (!entry.journalDate.endsWith(targetSuffix)) return false;
      const entryYear = Number(entry.journalDate.split('-')[0]);
      return entryYear < currentYear;
    })
    .sort((a, b) => (b.journalDate || '').localeCompare(a.journalDate || ''));
}
