import { describe, it, expect } from 'vitest';
import { localDateStr, parseLocalDateStr, addDays, isTodayStr, formatJournalDateHeader } from './date';

describe('localDateStr and timezone safety', () => {
  it('formats dates using local calendar date rather than UTC', () => {
    // Construct a date at 23:30 local time
    const lateNight = new Date(2026, 8, 24, 23, 30, 0); // Sep 24, 2026 23:30
    expect(localDateStr(lateNight)).toBe('2026-09-24');
  });

  it('formats dates at 00:15 local time without falling back', () => {
    const earlyMorning = new Date(2026, 8, 25, 0, 15, 0); // Sep 25, 2026 00:15
    expect(localDateStr(earlyMorning)).toBe('2026-09-25');
  });

  it('correctly parses localDateStr back to a midnight Date instance', () => {
    const parsed = parseLocalDateStr('2026-09-24');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8); // 0-indexed September
    expect(parsed.getDate()).toBe(24);
    expect(parsed.getHours()).toBe(0);
  });

  it('adds and subtracts days correctly across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('detects today correctly', () => {
    const today = localDateStr();
    expect(isTodayStr(today)).toBe(true);
    expect(isTodayStr('2020-01-01')).toBe(false);
  });

  it('formats header labels appropriately', () => {
    const today = localDateStr();
    const info = formatJournalDateHeader(today);
    expect(info.isToday).toBe(true);
    expect(info.relativeLabel).toBe('Today');
    expect(info.weekday.length).toBeGreaterThan(0);
    expect(info.formattedDate.length).toBeGreaterThan(0);
  });
});
