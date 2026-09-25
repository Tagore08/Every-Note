/**
 * Calendar date utilities to safely handle local calendar boundaries
 * without UTC/DST drift.
 */

import { isSameDay } from '../../../utils/format';

/**
 * Returns a new Date set to 00:00:00.000 local time for the given date.
 */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Returns a new Date set to 23:59:59.999 local time for the given date.
 */
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Adds (or subtracts) days from a Date in local time.
 */
export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

/**
 * Returns an array of dates representing the 3-day view: [baseDate - 1, baseDate, baseDate + 1].
 */
export function getThreeDays(baseDate: Date): Date[] {
  return [
    addDays(baseDate, -1),
    new Date(baseDate),
    addDays(baseDate, 1),
  ];
}

/**
 * Returns the 7 days of the week containing baseDate.
 * Defaults to starting on Monday (ISO-8601).
 * If startOnMonday is false, starts on Sunday.
 */
export function getWeekDays(baseDate: Date, startOnMonday = true): Date[] {
  const currentDay = baseDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  let diffToStart: number;

  if (startOnMonday) {
    // 0 (Sun) -> -6, 1 (Mon) -> 0, 2 (Tue) -> -1, ..., 6 (Sat) -> -5
    diffToStart = (currentDay + 6) % 7;
  } else {
    // 0 (Sun) -> 0, 1 (Mon) -> -1, ..., 6 (Sat) -> -6
    diffToStart = currentDay;
  }

  const startDate = addDays(baseDate, -diffToStart);
  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    week.push(addDays(startDate, i));
  }
  return week;
}

/**
 * Rounds a time to the nearest slot (e.g. :00 or :30).
 */
export function roundToSlot(
  hours: number,
  minutes: number,
  slotMinutes = 30
): { hour: number; minute: number } {
  const totalMin = hours * 60 + minutes;
  const roundedMin = Math.floor(totalMin / slotMinutes) * slotMinutes;
  const clampedMin = Math.max(0, Math.min(23 * 60 + 30, roundedMin));

  return {
    hour: Math.floor(clampedMin / 60),
    minute: clampedMin % 60,
  };
}

/**
 * Formats hour and minute into "HH:MM".
 */
export function formatTimeSlot(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Calculates end time 60 minutes after given HH:MM string.
 */
export function addHourToTimeSlot(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const nextH = Math.min(23, h + 1);
  return `${String(nextH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Checks whether today is included in the given list of dates.
 */
export function isTodayInDays(days: Date[]): boolean {
  const now = new Date();
  return days.some((d) => isSameDay(d, now));
}
