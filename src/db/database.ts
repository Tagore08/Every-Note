import Dexie, { type EntityTable } from 'dexie';
import type { Note } from '../types/note';
import type { Attachment } from '../types/attachment';
import type { Task } from '../types/task';
import type { CalendarEvent } from '../types/event';

export class AppDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  events!: EntityTable<CalendarEvent, 'id'>;


  constructor() {
    super('NotesAppDatabase');

    // Schema Version 1 (Baseline foundation: Notes)
    this.version(1).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, createdAt, updatedAt',
    });

    // Schema Version 2 (Stage 3: Attachments)
    // Fields indexed:
    // - id: primary key, autoincrementing
    // - noteId: parent note reference
    // - ownerType: generalized owner reference ('note', 'task', 'event')
    // - kind: 'image' | 'file' | 'link'
    // - createdAt: timestamp for ordering
    this.version(2).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
    });

    // Schema Version 3 (Stage 5: Tasks)
    this.version(3).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId',
    });

    // Schema Version 4 (Stage 6: Events & Calendar, Scheduled Notes)
    // Fields indexed:
    // - notes: added scheduledAt, reminderAt
    // - events: ++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, *tags, trashedAt, createdAt
    this.version(4).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId',
      events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, *tags, trashedAt, createdAt',
    });
  }
}


export const db = new AppDatabase();
