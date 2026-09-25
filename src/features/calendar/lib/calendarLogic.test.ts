import { describe, it, expect } from 'vitest';
import { computeOccurrencesForRange } from '../../../db/eventsRepo';
import type { CalendarEvent } from '../../../types/event';
import { layoutDayEvents, HOUR_HEIGHT } from './layoutEvents';
import {
  roundToSlot,
  formatTimeSlot,
  addHourToTimeSlot,
} from './calendarDate';

describe('Calendar Pro Logic & Recurrence Verification', () => {
  it('weekly recurring event shows in each of the next 4 weeks', () => {
    const weeklyEvent: CalendarEvent = {
      id: 101,
      title: 'Weekly Team Sync',
      startAt: new Date(2026, 9, 6, 10, 0), // Tuesday Oct 6
      endAt: new Date(2026, 9, 6, 11, 0),
      allDay: false,
      recurrence: 'weekly',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const rangeStart = new Date(2026, 9, 1);
    const rangeEnd = new Date(2026, 9, 31); // 4 full weeks

    const occurrences = computeOccurrencesForRange(rangeStart, rangeEnd, [weeklyEvent]);
    // Should occur on Oct 6, 13, 20, 27 (4 occurrences)
    expect(occurrences).toHaveLength(4);
    expect(occurrences.map((o) => o.occurrenceDate)).toEqual([
      '2026-10-06',
      '2026-10-13',
      '2026-10-20',
      '2026-10-27',
    ]);
  });

  it('a cancelled occurrence stays hidden everywhere', () => {
    const weeklyEventWithCancellation: CalendarEvent = {
      id: 102,
      title: 'Weekly Standup',
      startAt: new Date(2026, 9, 6, 9, 30),
      endAt: new Date(2026, 9, 6, 10, 0),
      allDay: false,
      recurrence: 'weekly',
      tags: [],
      exceptions: [
        {
          date: '2026-10-13',
          cancelled: true,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const rangeStart = new Date(2026, 9, 1);
    const rangeEnd = new Date(2026, 9, 31);

    const occurrences = computeOccurrencesForRange(rangeStart, rangeEnd, [weeklyEventWithCancellation]);
    // Oct 13 must be cancelled, leaving Oct 6, Oct 20, Oct 27 (3 occurrences)
    expect(occurrences).toHaveLength(3);
    expect(occurrences.map((o) => o.occurrenceDate)).toEqual([
      '2026-10-06',
      '2026-10-20',
      '2026-10-27',
    ]);
  });

  it('slot-tap calculates :00 or :30 rounded start and +60min end time', () => {
    // Tap at 15:12
    const slot1 = roundToSlot(15, 12, 30);
    const startStr1 = formatTimeSlot(slot1.hour, slot1.minute);
    const endStr1 = addHourToTimeSlot(startStr1);
    expect(startStr1).toBe('15:00');
    expect(endStr1).toBe('16:00');

    // Tap at 15:42
    const slot2 = roundToSlot(15, 42, 30);
    const startStr2 = formatTimeSlot(slot2.hour, slot2.minute);
    const endStr2 = addHourToTimeSlot(startStr2);
    expect(startStr2).toBe('15:30');
    expect(endStr2).toBe('16:30');
  });

  it('all-day events are separated and pinned to the all-day band', () => {
    const targetDate = new Date(2026, 9, 14);
    const allDayOcc = {
      eventId: 201,
      originalEvent: {
        id: 201,
        title: 'Full Day Workshop',
        startAt: targetDate,
        endAt: null,
        allDay: true,
        recurrence: 'none' as const,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      occurrenceDate: '2026-10-14',
      title: 'Full Day Workshop',
      startAt: targetDate,
      endAt: null,
      allDay: true,
      recurrence: 'none' as const,
      reminderAt: null,
      isException: false,
      tags: [],
    };

    const timedOcc = {
      eventId: 202,
      originalEvent: {
        id: 202,
        title: 'Quick Checkin',
        startAt: new Date(2026, 9, 14, 14, 0),
        endAt: new Date(2026, 9, 14, 14, 30),
        allDay: false,
        recurrence: 'none' as const,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      occurrenceDate: '2026-10-14',
      title: 'Quick Checkin',
      startAt: new Date(2026, 9, 14, 14, 0),
      endAt: new Date(2026, 9, 14, 14, 30),
      allDay: false,
      recurrence: 'none' as const,
      reminderAt: null,
      isException: false,
      tags: [],
    };

    const layout = layoutDayEvents([allDayOcc, timedOcc], targetDate);
    expect(layout.allDayEvents).toHaveLength(1);
    expect(layout.allDayEvents[0].title).toBe('Full Day Workshop');
    expect(layout.timedEvents).toHaveLength(1);
    expect(layout.timedEvents[0].top).toBe(14 * HOUR_HEIGHT);
  });
});
