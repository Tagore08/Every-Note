import { describe, it, expect } from 'vitest';
import { layoutDayEvents, HOUR_HEIGHT, MIN_CHIP_HEIGHT } from './layoutEvents';
import type { EventOccurrence } from '../../../types/event';

function createMockOccurrence(overrides: Partial<EventOccurrence>): EventOccurrence {
  const start = overrides.startAt || new Date(2026, 8, 24, 10, 0);
  const end = overrides.endAt !== undefined ? overrides.endAt : new Date(start.getTime() + 60 * 60 * 1000);

  return {
    eventId: overrides.eventId || 1,
    originalEvent: {
      id: overrides.eventId || 1,
      title: overrides.title || 'Test Event',
      startAt: start,
      endAt: end,
      allDay: overrides.allDay || false,
      recurrence: 'none',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    occurrenceDate: '2026-09-24',
    title: overrides.title || 'Test Event',
    startAt: start,
    endAt: end,
    allDay: overrides.allDay || false,
    recurrence: 'none',
    reminderAt: null,
    isException: false,
    tags: [],
    ...overrides,
  };
}

describe('layoutDayEvents', () => {
  const targetDate = new Date(2026, 8, 24);

  it('separates allDay events from timed events', () => {
    const allDayEvent = createMockOccurrence({
      eventId: 1,
      title: 'Company Holiday',
      allDay: true,
    });
    const timedEvent = createMockOccurrence({
      eventId: 2,
      title: 'Standup',
      allDay: false,
      startAt: new Date(2026, 8, 24, 9, 0),
      endAt: new Date(2026, 8, 24, 9, 30),
    });

    const result = layoutDayEvents([allDayEvent, timedEvent], targetDate);
    expect(result.allDayEvents).toHaveLength(1);
    expect(result.allDayEvents[0].title).toBe('Company Holiday');
    expect(result.timedEvents).toHaveLength(1);
    expect(result.timedEvents[0].occurrence.title).toBe('Standup');
  });

  it('calculates vertical position and enforces minimum 44px tap target height', () => {
    // 15-minute event from 10:00 to 10:15
    // Normal height would be (15/60)*60 = 15px, but should clamp to MIN_CHIP_HEIGHT (44px)
    const shortEvent = createMockOccurrence({
      eventId: 3,
      startAt: new Date(2026, 8, 24, 10, 0),
      endAt: new Date(2026, 8, 24, 10, 15),
    });

    const result = layoutDayEvents([shortEvent], targetDate);
    expect(result.timedEvents).toHaveLength(1);
    const positioned = result.timedEvents[0];
    expect(positioned.top).toBe(10 * HOUR_HEIGHT); // 600px
    expect(positioned.height).toBe(MIN_CHIP_HEIGHT); // 44px
    expect(positioned.leftPercent).toBe(0);
    expect(positioned.widthPercent).toBe(100);
  });

  it('splits overlapping events into side-by-side columns', () => {
    // Two events overlapping between 14:00 and 15:00
    const ev1 = createMockOccurrence({
      eventId: 10,
      title: 'Meeting 1',
      startAt: new Date(2026, 8, 24, 14, 0),
      endAt: new Date(2026, 8, 24, 15, 0),
    });
    const ev2 = createMockOccurrence({
      eventId: 11,
      title: 'Meeting 2',
      startAt: new Date(2026, 8, 24, 14, 30),
      endAt: new Date(2026, 8, 24, 15, 30),
    });

    const result = layoutDayEvents([ev1, ev2], targetDate);
    expect(result.timedEvents).toHaveLength(2);

    const first = result.timedEvents[0];
    const second = result.timedEvents[1];

    expect(first.widthPercent).toBe(50);
    expect(second.widthPercent).toBe(50);
    expect(first.leftPercent).toBe(0);
    expect(second.leftPercent).toBe(50);
  });

  it('handles 3 concurrent overlapping events with 33.33% column split', () => {
    const ev1 = createMockOccurrence({
      eventId: 20,
      startAt: new Date(2026, 8, 24, 11, 0),
      endAt: new Date(2026, 8, 24, 12, 0),
    });
    const ev2 = createMockOccurrence({
      eventId: 21,
      startAt: new Date(2026, 8, 24, 11, 15),
      endAt: new Date(2026, 8, 24, 12, 0),
    });
    const ev3 = createMockOccurrence({
      eventId: 22,
      startAt: new Date(2026, 8, 24, 11, 30),
      endAt: new Date(2026, 8, 24, 12, 0),
    });

    const result = layoutDayEvents([ev1, ev2, ev3], targetDate);
    expect(result.timedEvents).toHaveLength(3);
    for (const p of result.timedEvents) {
      expect(p.widthPercent).toBeCloseTo(100 / 3, 2);
    }
  });

  it('keeps sequential non-overlapping events at 100% width', () => {
    const ev1 = createMockOccurrence({
      eventId: 30,
      startAt: new Date(2026, 8, 24, 9, 0),
      endAt: new Date(2026, 8, 24, 10, 0),
    });
    const ev2 = createMockOccurrence({
      eventId: 31,
      startAt: new Date(2026, 8, 24, 10, 0),
      endAt: new Date(2026, 8, 24, 11, 0),
    });

    const result = layoutDayEvents([ev1, ev2], targetDate);
    expect(result.timedEvents).toHaveLength(2);
    expect(result.timedEvents[0].widthPercent).toBe(100);
    expect(result.timedEvents[0].leftPercent).toBe(0);
    expect(result.timedEvents[1].widthPercent).toBe(100);
    expect(result.timedEvents[1].leftPercent).toBe(0);
  });
});
