import Dexie, { type EntityTable } from 'dexie';
import type { Note } from '../types/note';
import type { Attachment } from '../types/attachment';
import type { Task } from '../types/task';

export class AppDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;
  tasks!: EntityTable<Task, 'id'>;

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
    // Fields indexed:
    // - id: primary key, autoincrementing
    // - status: 'todo' | 'done'
    // - priority: 'none' | 'low' | 'medium' | 'high'
    // - dueAt: timestamp for due dates
    // - completedAt: timestamp when marked done
    // - createdAt, updatedAt: ordering and recency
    // - importance, urgency: boolean flags for Eisenhower matrix
    // - *tags: multi-entry index for tag queries
    // - trashedAt: soft delete timestamp
    // - sourceNoteId: parent note reference
    this.version(3).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, createdAt, updatedAt',
      attachments: '++id, noteId, ownerType, kind, createdAt',
      tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId',
    });
  }
}

export const db = new AppDatabase();
