import { describe, it, expect } from 'vitest';
import {
  startOfDay,
  endOfDay,
  addDays,
  getThreeDays,
  getWeekDays,
  roundToSlot,
  formatTimeSlot,
  addHourToTimeSlot,
} from './calendarDate';

describe('calendarDate utilities', () => {
  it('correctly returns start and end of day', () => {
    const d = new Date(2026, 9, 15, 14, 35, 20);
    const start = startOfDay(d);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getSeconds()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);

    const end = endOfDay(d);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
  });

  it('generates 3 days centered on target date', () => {
    const center = new Date(2026, 8, 24); // Sept 24
    const threeDays = getThreeDays(center);
    expect(threeDays).toHaveLength(3);
    expect(threeDays[0].getDate()).toBe(23);
    expect(threeDays[1].getDate()).toBe(24);
    expect(threeDays[2].getDate()).toBe(25);
  });

  it('generates 7 days of the week starting on Monday', () => {
    // 2026-09-24 is a Thursday
    const thursday = new Date(2026, 8, 24);
    const week = getWeekDays(thursday, true);
    expect(week).toHaveLength(7);
    // Monday = Sept 21
    expect(week[0].getDate()).toBe(21);
    expect(week[0].getDay()).toBe(1); // Monday
    // Sunday = Sept 27
    expect(week[6].getDate()).toBe(27);
    expect(week[6].getDay()).toBe(0); // Sunday
  });

  it('rounds times to 30-minute slots', () => {
    expect(roundToSlot(14, 5)).toEqual({ hour: 14, minute: 0 });
    expect(roundToSlot(14, 29)).toEqual({ hour: 14, minute: 0 });
    expect(roundToSlot(14, 30)).toEqual({ hour: 14, minute: 30 });
    expect(roundToSlot(14, 45)).toEqual({ hour: 14, minute: 30 });
    expect(roundToSlot(14, 59)).toEqual({ hour: 14, minute: 30 });
  });

  it('formats slot time and computes +1 hour end time', () => {
    expect(formatTimeSlot(9, 0)).toBe('09:00');
    expect(formatTimeSlot(14, 30)).toBe('14:30');
    expect(addHourToTimeSlot('14:30')).toBe('15:30');
    expect(addHourToTimeSlot('23:00')).toBe('23:00');
  });

  it('safely handles DST transition boundaries with local calendar math', () => {
    // Fall-back transition Sunday in autumn (e.g. October 25, 2026)
    const dstSunday = new Date(2026, 9, 25);
    const nextDay = addDays(dstSunday, 1);
    expect(nextDay.getDate()).toBe(26);
    expect(nextDay.getMonth()).toBe(9);

    const prevDay = addDays(dstSunday, -1);
    expect(prevDay.getDate()).toBe(24);
    expect(prevDay.getMonth()).toBe(9);
  });
});
