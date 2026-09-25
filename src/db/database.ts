import Dexie, { type EntityTable } from 'dexie';
import type { Note } from '../types/note';
import type { Attachment } from '../types/attachment';
import type { Task } from '../types/task';
import type { CalendarEvent } from '../types/event';
import type { Person } from '../types/person';
import type { Habit, HabitLog } from '../types/habit';
import type { FocusSession, TimerPreset } from '../types/focus';
import type { AppMeta } from '../types/meta';
import type { Template } from '../types/template';
import type { NoteLink } from '../types/link';
import type { Routine, RoutineRun } from '../types/routine';
import type { CanvasEntity } from '../types/canvas';
import type { Folder } from '../types/folder';
import type { Snippet } from '../types/snippet';

export class AppDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>;
  folders!: EntityTable<Folder, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  events!: EntityTable<CalendarEvent, 'id'>;
  people!: EntityTable<Person, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  habitLogs!: EntityTable<HabitLog, 'id'>;
  focusSessions!: EntityTable<FocusSession, 'id'>;
  appMeta!: EntityTable<AppMeta, 'key'>;
  templates!: EntityTable<Template, 'id'>;
  links!: EntityTable<NoteLink, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routineRuns!: EntityTable<RoutineRun, 'id'>;
  canvases!: EntityTable<CanvasEntity, 'id'>;
  timerPresets!: EntityTable<TimerPreset, 'id'>;
  snippets!: EntityTable<Snippet, 'id'>;

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

    // Schema Version 11 (v2 Phase 2B: Wikilinks, Backlinks & Graph - links table)
    // All tables re-declared with complete index lists per safety contract
    this.version(11).stores({
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
      links: '++id, sourceId, targetId, targetTitle',
    }).upgrade(async (tx) => {
      const meta = tx.table('appMeta');
      await meta.put({
        key: 'schemaVersion',
        value: 11,
        updatedAt: Date.now(),
      });
    });

    // Schema Version 12 (v2 Phase 4: Routines & Today Dashboard - routines & routineRuns tables)
    // All tables re-declared with complete index lists per safety contract
    this.version(12).stores({
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
      links: '++id, sourceId, targetId, targetTitle',
      routines: '++id, name, timeOfDay, *daysOfWeek, active, createdAt, updatedAt',
      routineRuns: '++id, &[routineId+date], routineId, date, createdAt',
    }).upgrade(async (tx) => {
      const meta = tx.table('appMeta');
      await meta.put({
        key: 'schemaVersion',
        value: 12,
        updatedAt: Date.now(),
      });
    });

    // Schema Version 13 (v2 Phase 5: Canvas & Ink - canvases table)
    // All tables re-declared with complete index lists per safety contract §0
    this.version(13).stores({
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
      links: '++id, sourceId, targetId, targetTitle',
      routines: '++id, name, timeOfDay, *daysOfWeek, active, createdAt, updatedAt',
      routineRuns: '++id, &[routineId+date], routineId, date, createdAt',
      canvases: '++id, title, *tags, lifeAreaId, linkedNoteId, trashedAt, updatedAt',
    }).upgrade(async (tx) => {
      const meta = tx.table('appMeta');
      await meta.put({
        key: 'schemaVersion',
        value: 13,
        updatedAt: Date.now(),
      });
    });

    // Schema Version 14 (v2 Phase 6: Focus Pro & Analytics - timerPresets table + focusSessions presetId/kind)
    // All tables re-declared with complete index lists per safety contract §0
    this.version(14).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, personId, lifeAreaId, kind, journalDate, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId, personId, lifeAreaId, parentTaskId, routineRunId, sortOrder',
      events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, personId, lifeAreaId, *tags, trashedAt, createdAt',
      people: '++id, name, trashedAt, createdAt, updatedAt',
      habits: '++id, name, archived, createdAt, updatedAt',
      habitLogs: '++id, habitId, date, done, [habitId+date], createdAt',
      focusSessions: '++id, startedAt, taskId, presetId, kind, createdAt',
      appMeta: 'key',
      lifeAreas: '++id, name, color, sortOrder, archived, createdAt',
      templates: '++id, kind, name, usageCount, createdAt',
      links: '++id, sourceId, targetId, targetTitle',
      routines: '++id, name, timeOfDay, *daysOfWeek, active, createdAt, updatedAt',
      routineRuns: '++id, &[routineId+date], routineId, date, createdAt',
      canvases: '++id, title, *tags, lifeAreaId, linkedNoteId, trashedAt, updatedAt',
      timerPresets: '++id, name, isDefault',
    }).upgrade(async (tx) => {
      const meta = tx.table('appMeta');
      await meta.put({
        key: 'schemaVersion',
        value: 14,
        updatedAt: Date.now(),
      });
    });

    // Schema Version 15 (vNext Phase 0: Hard delete of Life Areas, map to tags)
    // All tables re-declared with complete index lists; lifeAreaId dropped from indexes and lifeAreas dropped.
    this.version(15).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, personId, kind, journalDate, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId, personId, parentTaskId, routineRunId, sortOrder',
      events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, personId, *tags, trashedAt, createdAt',
      people: '++id, name, trashedAt, createdAt, updatedAt',
      habits: '++id, name, archived, createdAt, updatedAt',
      habitLogs: '++id, habitId, date, done, [habitId+date], createdAt',
      focusSessions: '++id, startedAt, taskId, presetId, kind, createdAt',
      appMeta: 'key',
      lifeAreas: null,
      templates: '++id, kind, name, usageCount, createdAt',
      links: '++id, sourceId, targetId, targetTitle',
      routines: '++id, name, timeOfDay, *daysOfWeek, active, createdAt, updatedAt',
      routineRuns: '++id, &[routineId+date], routineId, date, createdAt',
      canvases: '++id, title, *tags, linkedNoteId, trashedAt, updatedAt',
      timerPresets: '++id, name, isDefault',
    }).upgrade(async (tx) => {
      const areaNameMap = new Map<number, string>([
        [1, 'health'],
        [2, 'work'],
        [3, 'personal'],
        [4, 'finance'],
        [5, 'learning'],
        [6, 'home'],
        [7, 'relationships'],
        [8, 'other'],
      ]);

      try {
        const areaTable = tx.table('lifeAreas');
        if (areaTable) {
          const areas = await areaTable.toArray();
          for (const area of areas) {
            if (area?.id && area?.name) {
              const sanitized = area.name.trim().toLowerCase().replace(/\s+/g, '-');
              if (sanitized) areaNameMap.set(area.id, sanitized);
            }
          }
        }
      } catch (err) {
        console.debug('lifeAreas table not directly queryable in upgrade; using defaults:', err);
      }

      const appendAreaTag = (record: any) => {
        if (record && record.lifeAreaId != null) {
          const tagName = areaNameMap.get(record.lifeAreaId) || `area-${record.lifeAreaId}`;
          const tags: string[] = Array.isArray(record.tags) ? [...record.tags] : [];
          if (!tags.includes(tagName)) {
            tags.push(tagName);
          }
          record.tags = tags;
          delete record.lifeAreaId;
        }
      };

      // 1. Migrate notes
      await tx.table('notes').toCollection().modify((note: any) => {
        appendAreaTag(note);
      });

      // 2. Migrate tasks
      await tx.table('tasks').toCollection().modify((task: any) => {
        appendAreaTag(task);
      });

      // 3. Migrate events
      await tx.table('events').toCollection().modify((event: any) => {
        appendAreaTag(event);
      });

      // 4. Migrate canvases
      await tx.table('canvases').toCollection().modify((canvas: any) => {
        appendAreaTag(canvas);
      });

      // 5. Migrate templates
      await tx.table('templates').toCollection().modify((tpl: any) => {
        if (tpl?.body && tpl.body.lifeAreaId != null) {
          const tagName = areaNameMap.get(tpl.body.lifeAreaId) || `area-${tpl.body.lifeAreaId}`;
          const tags: string[] = Array.isArray(tpl.body.tags) ? [...tpl.body.tags] : [];
          if (!tags.includes(tagName)) {
            tags.push(tagName);
          }
          tpl.body.tags = tags;
          delete tpl.body.lifeAreaId;
        }
      });

      // 6. Update schemaVersion
      const meta = tx.table('appMeta');
      await meta.put({
        key: 'schemaVersion',
        value: 15,
        updatedAt: Date.now(),
      });
    });

    // Schema Version 16 (Phase 1: Knowledge System - Folders & Scratchpad)
    this.version(16).stores({
      notes: '++id, title, *tags, folderId, isScratchpad, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, personId, kind, journalDate, createdAt, updatedAt',
      folders: '++id, name, parentId, sortOrder, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId, personId, parentTaskId, routineRunId, sortOrder',
      events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, personId, *tags, trashedAt, createdAt',
      people: '++id, name, trashedAt, createdAt, updatedAt',
      habits: '++id, name, archived, createdAt, updatedAt',
      habitLogs: '++id, habitId, date, done, [habitId+date], createdAt',
      focusSessions: '++id, startedAt, taskId, presetId, kind, createdAt',
      appMeta: 'key',
      lifeAreas: null,
      templates: '++id, kind, name, usageCount, createdAt',
      links: '++id, sourceId, targetId, targetTitle',
      routines: '++id, name, timeOfDay, *daysOfWeek, active, createdAt, updatedAt',
      routineRuns: '++id, &[routineId+date], routineId, date, createdAt',
      canvases: '++id, title, *tags, linkedNoteId, trashedAt, updatedAt',
      timerPresets: '++id, name, isDefault',
    }).upgrade(async (tx) => {
      const meta = tx.table('appMeta');
      await meta.put({
        key: 'schemaVersion',
        value: 16,
        updatedAt: Date.now(),
      });
    });

    // Schema Version 17 (Phase 6: Smart Snippets / Text Expansion)
    this.version(17).stores({
      notes: '++id, title, *tags, folderId, isScratchpad, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, personId, kind, journalDate, createdAt, updatedAt',
      folders: '++id, name, parentId, sortOrder, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId, personId, parentTaskId, routineRunId, sortOrder',
      events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, personId, *tags, trashedAt, createdAt',
      people: '++id, name, trashedAt, createdAt, updatedAt',
      habits: '++id, name, archived, createdAt, updatedAt',
      habitLogs: '++id, habitId, date, done, [habitId+date], createdAt',
      focusSessions: '++id, startedAt, taskId, presetId, kind, createdAt',
      appMeta: 'key',
      lifeAreas: null,
      templates: '++id, kind, name, usageCount, createdAt',
      links: '++id, sourceId, targetId, targetTitle',
      routines: '++id, name, timeOfDay, *daysOfWeek, active, createdAt, updatedAt',
      routineRuns: '++id, &[routineId+date], routineId, date, createdAt',
      canvases: '++id, title, *tags, linkedNoteId, trashedAt, updatedAt',
      timerPresets: '++id, name, isDefault',
      snippets: '++id, trigger, createdAt, updatedAt',
    }).upgrade(async (tx) => {
      const meta = tx.table('appMeta');
      await meta.put({
        key: 'schemaVersion',
        value: 17,
        updatedAt: Date.now(),
      });
    });
  }
}

export const db = new AppDatabase();
