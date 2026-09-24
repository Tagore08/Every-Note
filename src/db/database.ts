import Dexie, { type EntityTable } from 'dexie';
import type { Note } from '../types/note';
import type { Attachment } from '../types/attachment';

export class AppDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>;
  attachments!: EntityTable<Attachment, 'id'>;

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
  }
}

export const db = new AppDatabase();
