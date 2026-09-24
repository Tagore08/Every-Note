export type EventRecurrence = 'none' | 'daily' | 'weekly' | 'monthly';

export interface EventException {
  date: string; // 'YYYY-MM-DD' key for the occurrence being modified
  cancelled?: boolean;
  title?: string;
  startAt?: Date;
  endAt?: Date;
  description?: string;
  allDay?: boolean;
}

export interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  startAt: Date;
  endAt?: Date | null;
  allDay: boolean;
  recurrence: EventRecurrence;
  reminderAt?: Date | null;
  personId?: number | null;
  relatedTaskId?: number | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  trashedAt?: Date | null;
  exceptions?: EventException[];
}

export interface EventOccurrence {
  eventId: number;
  originalEvent: CalendarEvent;
  occurrenceDate: string; // 'YYYY-MM-DD'
  title: string;
  description?: string;
  startAt: Date;
  endAt?: Date | null;
  allDay: boolean;
  recurrence: EventRecurrence;
  reminderAt?: Date | null;
  isException: boolean;
  tags: string[];
}
