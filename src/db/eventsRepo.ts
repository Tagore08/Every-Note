import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import type { CalendarEvent, EventException, EventOccurrence } from '../types/event';
import { formatDateKey, parseDateKey } from '../utils/format';

/**
 * Computes all occurrences for a list of events across a specific date range [rangeStart, rangeEnd].
 * Evaluates recurrence patterns ('daily', 'weekly', 'monthly') and applies single-occurrence exceptions.
 */
export function computeOccurrencesForRange(
  rangeStart: Date,
  rangeEnd: Date,
  events: CalendarEvent[]
): EventOccurrence[] {
  const occurrences: EventOccurrence[] = [];

  const startBound = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate(), 0, 0, 0, 0);
  const endBound = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate(), 23, 59, 59, 999);

  for (const event of events) {
    if (event.trashedAt || !event.id) continue;

    const eventStart = new Date(event.startAt);
    const eventStartDateKey = formatDateKey(eventStart);
    const eventBaseDay = parseDateKey(eventStartDateKey);

    const durationMs = event.endAt
      ? new Date(event.endAt).getTime() - eventStart.getTime()
      : 0;

    const exceptionsMap = new Map<string, EventException>();
    if (event.exceptions && Array.isArray(event.exceptions)) {
      for (const ex of event.exceptions) {
        exceptionsMap.set(ex.date, ex);
      }
    }

    if (event.recurrence === 'none') {
      // Single event
      const dateKey = eventStartDateKey;
      const ex = exceptionsMap.get(dateKey);

      if (ex?.cancelled) continue;

      if (eventStart.getTime() >= startBound.getTime() && eventStart.getTime() <= endBound.getTime()) {
        occurrences.push({
          eventId: event.id,
          originalEvent: event,
          occurrenceDate: dateKey,
          title: ex?.title ?? event.title,
          description: ex?.description ?? event.description,
          startAt: ex?.startAt ? new Date(ex.startAt) : eventStart,
          endAt: ex?.endAt !== undefined ? (ex.endAt ? new Date(ex.endAt) : null) : (event.endAt ? new Date(event.endAt) : null),
          allDay: ex?.allDay ?? event.allDay,
          recurrence: event.recurrence,
          reminderAt: event.reminderAt ? new Date(event.reminderAt) : null,
          isException: !!ex,
          tags: event.tags || [],
        });
      }
      continue;
    }

    if (event.recurrence === 'daily') {
      // Daily recurrence from eventStart onwards
      const cursor = new Date(Math.max(eventBaseDay.getTime(), startBound.getTime()));

      while (cursor.getTime() <= endBound.getTime()) {
        const dateKey = formatDateKey(cursor);
        const ex = exceptionsMap.get(dateKey);

        if (!ex?.cancelled) {
          const occStart = ex?.startAt
            ? new Date(ex.startAt)
            : new Date(
                cursor.getFullYear(),
                cursor.getMonth(),
                cursor.getDate(),
                eventStart.getHours(),
                eventStart.getMinutes(),
                eventStart.getSeconds()
              );

          const occEnd = ex?.endAt !== undefined
            ? (ex.endAt ? new Date(ex.endAt) : null)
            : durationMs > 0
              ? new Date(occStart.getTime() + durationMs)
              : null;

          occurrences.push({
            eventId: event.id,
            originalEvent: event,
            occurrenceDate: dateKey,
            title: ex?.title ?? event.title,
            description: ex?.description ?? event.description,
            startAt: occStart,
            endAt: occEnd,
            allDay: ex?.allDay ?? event.allDay,
            recurrence: event.recurrence,
            reminderAt: event.reminderAt ? new Date(event.reminderAt) : null,
            isException: !!ex,
            tags: event.tags || [],
          });
        }

        // Advance 1 day
        cursor.setDate(cursor.getDate() + 1);
      }
      continue;
    }

    if (event.recurrence === 'weekly') {
      // Weekly recurrence on same day-of-week as eventStart
      const targetDayOfWeek = eventStart.getDay();
      const cursor = new Date(Math.max(eventBaseDay.getTime(), startBound.getTime()));

      // Align cursor to next matching day-of-week
      const diff = (targetDayOfWeek - cursor.getDay() + 7) % 7;
      cursor.setDate(cursor.getDate() + diff);

      while (cursor.getTime() <= endBound.getTime()) {
        const dateKey = formatDateKey(cursor);
        const ex = exceptionsMap.get(dateKey);

        if (!ex?.cancelled) {
          const occStart = ex?.startAt
            ? new Date(ex.startAt)
            : new Date(
                cursor.getFullYear(),
                cursor.getMonth(),
                cursor.getDate(),
                eventStart.getHours(),
                eventStart.getMinutes(),
                eventStart.getSeconds()
              );

          const occEnd = ex?.endAt !== undefined
            ? (ex.endAt ? new Date(ex.endAt) : null)
            : durationMs > 0
              ? new Date(occStart.getTime() + durationMs)
              : null;

          occurrences.push({
            eventId: event.id,
            originalEvent: event,
            occurrenceDate: dateKey,
            title: ex?.title ?? event.title,
            description: ex?.description ?? event.description,
            startAt: occStart,
            endAt: occEnd,
            allDay: ex?.allDay ?? event.allDay,
            recurrence: event.recurrence,
            reminderAt: event.reminderAt ? new Date(event.reminderAt) : null,
            isException: !!ex,
            tags: event.tags || [],
          });
        }

        // Advance 7 days
        cursor.setDate(cursor.getDate() + 7);
      }
      continue;
    }

    if (event.recurrence === 'monthly') {
      // Monthly recurrence on same date-of-month
      const targetDayOfMonth = eventStart.getDate();
      const startYear = Math.max(eventStart.getFullYear(), startBound.getFullYear());
      const endYear = endBound.getFullYear();

      for (let y = startYear; y <= endYear; y++) {
        const startMonth = y === eventStart.getFullYear() ? eventStart.getMonth() : 0;
        const endMonth = y === endBound.getFullYear() ? endBound.getMonth() : 11;

        for (let m = startMonth; m <= endMonth; m++) {
          const daysInMonth = new Date(y, m + 1, 0).getDate();
          const day = Math.min(targetDayOfMonth, daysInMonth);
          const cursor = new Date(y, m, day, 0, 0, 0, 0);

          if (cursor.getTime() < eventBaseDay.getTime()) continue;
          if (cursor.getTime() < startBound.getTime() || cursor.getTime() > endBound.getTime()) continue;

          const dateKey = formatDateKey(cursor);
          const ex = exceptionsMap.get(dateKey);

          if (!ex?.cancelled) {
            const occStart = ex?.startAt
              ? new Date(ex.startAt)
              : new Date(
                  cursor.getFullYear(),
                  cursor.getMonth(),
                  cursor.getDate(),
                  eventStart.getHours(),
                  eventStart.getMinutes(),
                  eventStart.getSeconds()
                );

            const occEnd = ex?.endAt !== undefined
              ? (ex.endAt ? new Date(ex.endAt) : null)
              : durationMs > 0
                ? new Date(occStart.getTime() + durationMs)
                : null;

            occurrences.push({
              eventId: event.id,
              originalEvent: event,
              occurrenceDate: dateKey,
              title: ex?.title ?? event.title,
              description: ex?.description ?? event.description,
              startAt: occStart,
              endAt: occEnd,
              allDay: ex?.allDay ?? event.allDay,
              recurrence: event.recurrence,
              reminderAt: event.reminderAt ? new Date(event.reminderAt) : null,
              isException: !!ex,
              tags: event.tags || [],
            });
          }
        }
      }
      continue;
    }
  }

  // Sort occurrences chronologically
  return occurrences.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

export const eventsRepo = {
  async createEvent(data: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<CalendarEvent> {
    const now = new Date();
    const event: CalendarEvent = {
      ...data,
      createdAt: now,
      updatedAt: now,
      tags: data.tags || [],
      exceptions: data.exceptions || [],
      trashedAt: null,
    };
    const id = await db.events.add(event);
    return { ...event, id: Number(id) };
  },

  async getEventById(id: number): Promise<CalendarEvent | undefined> {
    return db.events.get(id);
  },

  async updateEvent(id: number, changes: Partial<CalendarEvent>): Promise<void> {
    await db.events.update(id, {
      ...changes,
      updatedAt: new Date(),
    });
  },

  /**
   * Adds or updates a single-occurrence exception (override or cancellation).
   */
  async addEventException(id: number, exception: EventException): Promise<void> {
    const event = await db.events.get(id);
    if (!event) return;

    const existingExceptions = event.exceptions ? [...event.exceptions] : [];
    const index = existingExceptions.findIndex((e) => e.date === exception.date);

    if (index >= 0) {
      existingExceptions[index] = { ...existingExceptions[index], ...exception };
    } else {
      existingExceptions.push(exception);
    }

    await db.events.update(id, {
      exceptions: existingExceptions,
      updatedAt: new Date(),
    });
  },

  async trashEvent(id: number): Promise<void> {
    await db.events.update(id, {
      trashedAt: new Date(),
      updatedAt: new Date(),
    });
  },

  async restoreEvent(id: number): Promise<void> {
    await db.events.update(id, {
      trashedAt: null,
      updatedAt: new Date(),
    });
  },

  async deletePermanently(id: number): Promise<void> {
    await db.events.delete(id);
  },

  async deleteAllEvents(): Promise<void> {
    await db.events.clear();
  },

  async getAllEventsForExport(): Promise<CalendarEvent[]> {
    return db.events.toArray();
  },

  async importEvents(events: CalendarEvent[]): Promise<void> {
    const processed = events.map((e) => ({
      ...e,
      startAt: new Date(e.startAt),
      endAt: e.endAt ? new Date(e.endAt) : null,
      reminderAt: e.reminderAt ? new Date(e.reminderAt) : null,
      createdAt: new Date(e.createdAt),
      updatedAt: new Date(e.updatedAt),
      trashedAt: e.trashedAt ? new Date(e.trashedAt) : null,
      exceptions: e.exceptions
        ? e.exceptions.map((ex) => ({
            ...ex,
            startAt: ex.startAt ? new Date(ex.startAt) : undefined,
            endAt: ex.endAt ? new Date(ex.endAt) : undefined,
          }))
        : [],
    }));
    await db.events.bulkAdd(processed);
  },

  /**
   * Fetches all non-trashed events that have reminders set and not yet trashed.
   */
  async getActiveReminders(): Promise<CalendarEvent[]> {
    return db.events
      .filter((e) => !e.trashedAt && !!e.reminderAt)
      .toArray();
  },
};

/**
 * Reactive hook returning computed occurrences for a date range.
 */
export function useOccurrencesForRange(start: Date, end: Date): EventOccurrence[] | undefined {
  const startTime = start.getTime();
  const endTime = end.getTime();

  return useLiveQuery(
    async () => {
      // Query all active events
      const events = await db.events
        .filter((e) => !e.trashedAt)
        .toArray();

      return computeOccurrencesForRange(new Date(startTime), new Date(endTime), events);
    },
    [startTime, endTime]
  );
}

/**
 * Reactive hook for a single event.
 */
export function useEvent(id: number | null | undefined): CalendarEvent | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    return (await db.events.get(id)) ?? null;
  }, [id]);
}
