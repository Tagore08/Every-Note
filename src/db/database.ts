import Dexie, { type EntityTable } from 'dexie';
import type { Note } from '../types/note';
import type { Attachment } from '../types/attachment';
import type { Task } from '../types/task';
import type { CalendarEvent } from '../types/event';
import type { Person } from '../types/person';
import type { Habit, HabitLog } from '../types/habit';
import type { FocusSession } from '../types/focus';
import type { AppMeta } from '../types/meta';
import type { LifeArea } from '../types/area';
import type { Template } from '../types/template';

export class AppDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  events!: EntityTable<CalendarEvent, 'id'>;
  people!: EntityTable<Person, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitLogs!: EntityTable<HabitLog, 'id'>;
  focusSessions!: EntityTable<FocusSession, 'id'>;
  appMeta!: EntityTable<AppMeta, 'key'>;
  lifeAreas!: EntityTable<LifeArea, 'id'>;
  templates!: EntityTable<Template, 'id'>;

  constructor(dbName = 'NotesAppDatabase') {
    super(dbName);

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

    // Schema Version 5 (Stage 8: People, minimal)
    // Fields indexed:
    // - notes: added personId
    // - tasks: added personId
    // - events: added personId
    // - people: ++id, name, trashedAt, createdAt, updatedAt
    this.version(5).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, personId, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId, personId',
      events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, personId, *tags, trashedAt, createdAt',
      people: '++id, name, trashedAt, createdAt, updatedAt',
    });

    // Schema Version 6 (Stage 9: Habits)
    // Fields indexed:
    // - habits: ++id, name, archived, createdAt, updatedAt
    // - habitLogs: ++id, habitId, date, done, [habitId+date], createdAt
    this.version(6).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, personId, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId, personId',
      events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, personId, *tags, trashedAt, createdAt',
      people: '++id, name, trashedAt, createdAt, updatedAt',
      habits: '++id, name, archived, createdAt, updatedAt',
      habitLogs: '++id, habitId, date, done, [habitId+date], createdAt',
    });

    // Schema Version 7 (Stage 10: Focus Sessions)
    // Fields indexed:
    // - focusSessions: ++id, startedAt, taskId, createdAt
    this.version(7).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, personId, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId, personId',
      events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, personId, *tags, trashedAt, createdAt',
      people: '++id, name, trashedAt, createdAt, updatedAt',
      habits: '++id, name, archived, createdAt, updatedAt',
      habitLogs: '++id, habitId, date, done, [habitId+date], createdAt',
      focusSessions: '++id, startedAt, taskId, createdAt',
    });

    // Schema Version 8 (v2 Phase 0: Foundation - appMeta store for backup gate & last-seen schema)
    // All tables re-declared with complete index list per safety contract
    this.version(8).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, personId, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId, personId',
      events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, personId, *tags, trashedAt, createdAt',
      people: '++id, name, trashedAt, createdAt, updatedAt',
      habits: '++id, name, archived, createdAt, updatedAt',
      habitLogs: '++id, habitId, date, done, [habitId+date], createdAt',
      focusSessions: '++id, startedAt, taskId, createdAt',
      appMeta: 'key',
    }).upgrade(async (tx) => {
      const meta = tx.table('appMeta');
      await meta.put({
        key: 'schemaVersion',
        value: 8,
        updatedAt: Date.now(),
      });
    });

    // Schema Version 9 (v2 Phase 1: Life Areas, Templates, Subtasks & Area relationships)
    // All tables re-declared with complete index lists per safety contract
    this.version(9).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, personId, lifeAreaId, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId, personId, lifeAreaId, parentTaskId, routineRunId, sortOrder',
      events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, personId, lifeAreaId, *tags, trashedAt, createdAt',
      people: '++id, name, trashedAt, createdAt, updatedAt',
      habits: '++id, name, archived, createdAt, updatedAt',
      habitLogs: '++id, habitId, date, done, [habitId+date], createdAt',
      focusSessions: '++id, startedAt, taskId, createdAt',
      appMeta: 'key',
      lifeAreas: '++id, name, color, sortOrder, archived, createdAt',
      templates: '++id, kind, name, usageCount, createdAt',
    }).upgrade(async (tx) => {
      const meta = tx.table('appMeta');
      await meta.put({
        key: 'schemaVersion',
        value: 9,
        updatedAt: Date.now(),
      });
    });

    // Schema Version 10 (v2 Phase 2A: Journal entries with kind, journalDate, mood)
    // All tables re-declared with complete index lists per safety contract
    this.version(10).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, personId, lifeAreaId, kind, journalDate, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId, personId, lifeAreaId, parentTaskId, routineRunId, sortOrder',
      events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, personId, lifeAreaId, *tags, trashedAt, createdAt',
      people: '++id, name, trashedAt, createdAt, updatedAt',
      habits: '++id, name, archived, createdAt, updatedAt',
      habitLogs: '++id, habitId, date, done, [habitId+date], createdAt',
      focusSessions: '++id, startedAt, taskId, createdAt',
      appMeta: 'key',
      lifeAreas: '++id, name, color, sortOrder, archived, createdAt',
      templates: '++id, kind, name, usageCount, createdAt',
    }).upgrade(async (tx) => {
      // Set kind='note' where undefined per §4
      await tx.table('notes').toCollection().modify((note: any) => {
        if (!note.kind) {
          note.kind = 'note';
        }
      });

      const meta = tx.table('appMeta');
      await meta.put({
        key: 'schemaVersion',
        value: 10,
        updatedAt: Date.now(),
      });
    });
  }
}

export const db = new AppDatabase();
