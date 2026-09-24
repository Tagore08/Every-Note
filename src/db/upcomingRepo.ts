import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { computeOccurrencesForRange } from './eventsRepo';
import type { EventOccurrence } from '../types/event';
import type { Task } from '../types/task';
import type { Note } from '../types/note';
import { formatDateKey, formatEventTime, isOverdue } from '../utils/format';

export type UpcomingItemType = 'event' | 'task' | 'note';

export interface UpcomingItem {
  id: string; // Unique row key: `event-${eventId}-${dateStr}`, `task-${taskId}`, `note-${noteId}`
  type: UpcomingItemType;
  title: string;
  timeLabel: string;
  dateLabel?: string;
  sortTimestamp: number;
  isOverdue?: boolean;
  eventOccurrence?: EventOccurrence;
  task?: Task;
  note?: Note;
}

export interface UpcomingSections {
  today: UpcomingItem[];
  tomorrow: UpcomingItem[];
  next7Days: UpcomingItem[];
  later: UpcomingItem[];
  counts: {
    todayEvents: number;
    todayTasks: number;
    todayNotes: number;
    overdueTasks: number;
  };
}

export const upcomingRepo = {
  async getUpcomingSections(): Promise<UpcomingSections> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(todayEnd);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const next7DaysStart = new Date(tomorrowStart);
    next7DaysStart.setDate(next7DaysStart.getDate() + 1);
    const next7DaysEnd = new Date(todayEnd);
    next7DaysEnd.setDate(next7DaysEnd.getDate() + 7);

    // Horizon for computing upcoming recurring occurrences (e.g. 90 days out)
    const laterHorizonEnd = new Date(todayEnd);
    laterHorizonEnd.setDate(laterHorizonEnd.getDate() + 90);

    const todayDateKey = formatDateKey(todayStart);
    const tomorrowDateKey = formatDateKey(tomorrowStart);

    // 1. Fetch data from IndexedDB
    const [allTasks, allNotes, allEvents] = await Promise.all([
      db.tasks
        .filter((t) => t.status === 'todo' && !t.trashedAt && !!t.dueAt)
        .toArray(),
      db.notes
        .filter((n) => !n.trashedAt && !!n.scheduledAt)
        .toArray(),
      db.events
        .filter((e) => !e.trashedAt)
        .toArray(),
    ]);

    // 2. Expand event occurrences across [todayStart, laterHorizonEnd]
    const occurrences = computeOccurrencesForRange(todayStart, laterHorizonEnd, allEvents);

    const today: UpcomingItem[] = [];
    const tomorrow: UpcomingItem[] = [];
    const next7Days: UpcomingItem[] = [];
    const later: UpcomingItem[] = [];

    let overdueTasksCount = 0;

    // Helper for date labels in 'next7Days' and 'later'
    const formatDateHeader = (d: Date): string => {
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    };

    // 3. Process Tasks
    for (const task of allTasks) {
      if (!task.dueAt) continue;
      const dueDate = new Date(task.dueAt);
      const dueTime = dueDate.getTime();
      const taskOverdue = isOverdue(task.dueAt) && dueTime < todayStart.getTime();

      let timeLabel = 'Due today';
      if (taskOverdue) {
        timeLabel = 'Overdue';
        overdueTasksCount++;
      } else {
        const hasSpecificTime = dueDate.getHours() !== 0 || dueDate.getMinutes() !== 0;
        if (hasSpecificTime) {
          timeLabel = `Due ${dueDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
        }
      }

      const item: UpcomingItem = {
        id: `task-${task.id}`,
        type: 'task',
        title: task.title,
        timeLabel,
        dateLabel: formatDateHeader(dueDate),
        sortTimestamp: dueTime,
        isOverdue: taskOverdue,
        task,
      };

      if (taskOverdue || (dueTime >= todayStart.getTime() && dueTime <= todayEnd.getTime())) {
        today.push(item);
      } else if (dueTime >= tomorrowStart.getTime() && dueTime <= tomorrowEnd.getTime()) {
        tomorrow.push(item);
      } else if (dueTime >= next7DaysStart.getTime() && dueTime <= next7DaysEnd.getTime()) {
        next7Days.push(item);
      } else {
        later.push(item);
      }
    }

    // 4. Process Notes
    for (const note of allNotes) {
      if (!note.scheduledAt) continue;
      const schedDate = new Date(note.scheduledAt);
      const schedTime = schedDate.getTime();

      let timeLabel = 'Scheduled';
      if (note.reminderAt) {
        const remDate = new Date(note.reminderAt);
        timeLabel = `Scheduled ${remDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
      }

      const item: UpcomingItem = {
        id: `note-${note.id}`,
        type: 'note',
        title: note.title || 'Untitled Note',
        timeLabel,
        dateLabel: formatDateHeader(schedDate),
        sortTimestamp: schedTime,
        note,
      };

      if (schedTime <= todayEnd.getTime()) {
        today.push(item);
      } else if (schedTime >= tomorrowStart.getTime() && schedTime <= tomorrowEnd.getTime()) {
        tomorrow.push(item);
      } else if (schedTime >= next7DaysStart.getTime() && schedTime <= next7DaysEnd.getTime()) {
        next7Days.push(item);
      } else {
        later.push(item);
      }
    }

    // 5. Process Event Occurrences
    for (const occ of occurrences) {
      const occStart = new Date(occ.startAt);
      const occStartTime = occStart.getTime();
      const timeLabel = formatEventTime(occ.startAt, occ.endAt, occ.allDay);

      const item: UpcomingItem = {
        id: `event-${occ.eventId}-${occ.occurrenceDate}`,
        type: 'event',
        title: occ.title,
        timeLabel,
        dateLabel: formatDateHeader(occStart),
        sortTimestamp: occ.allDay ? new Date(occStart.getFullYear(), occStart.getMonth(), occStart.getDate(), 0, 0, 0).getTime() : occStartTime,
        eventOccurrence: occ,
      };

      if (occ.occurrenceDate === todayDateKey || occStartTime <= todayEnd.getTime()) {
        today.push(item);
      } else if (occ.occurrenceDate === tomorrowDateKey || (occStartTime >= tomorrowStart.getTime() && occStartTime <= tomorrowEnd.getTime())) {
        tomorrow.push(item);
      } else if (occStartTime >= next7DaysStart.getTime() && occStartTime <= next7DaysEnd.getTime()) {
        next7Days.push(item);
      } else {
        later.push(item);
      }
    }

    // 6. Sort sections
    // Today: Overdue tasks pinned at top, then chronological
    today.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.sortTimestamp - b.sortTimestamp;
    });

    tomorrow.sort((a, b) => a.sortTimestamp - b.sortTimestamp);
    next7Days.sort((a, b) => a.sortTimestamp - b.sortTimestamp);
    later.sort((a, b) => a.sortTimestamp - b.sortTimestamp);

    // Compute today counts
    const todayEvents = today.filter((i) => i.type === 'event').length;
    const todayTasks = today.filter((i) => i.type === 'task').length;
    const todayNotes = today.filter((i) => i.type === 'note').length;

    return {
      today,
      tomorrow,
      next7Days,
      later,
      counts: {
        todayEvents,
        todayTasks,
        todayNotes,
        overdueTasks: overdueTasksCount,
      },
    };
  },
};

/**
 * Reactive hook for live-queried upcoming items.
 */
export function useUpcomingData(): UpcomingSections | undefined {
  return useLiveQuery(() => upcomingRepo.getUpcomingSections());
}
