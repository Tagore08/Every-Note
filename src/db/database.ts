import Dexie, { type EntityTable } from 'dexie';
import type { Note } from '../types/note';

export class AppDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>;

  constructor() {
    super('NotesAppDatabase');

    // Schema Version 1
    // Fields:
    // - id: primary key, autoincrementing
    // - title: indexed for search/sorting
    // - *tags: multiEntry index for fast querying by individual tag
    // - pinned: boolean indexed for filtering pinned notes
    // - archived: boolean indexed for filtering archived notes
    // - trashedAt: timestamp or null, indexed for filtering trashed notes
    // - inbox: boolean indexed for inbox view
    // - createdAt: timestamp indexed for chronological ordering
    // - updatedAt: timestamp indexed for recent edits ordering
    this.version(1).stores({
      notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, createdAt, updatedAt'
    });
  }
}

export const db = new AppDatabase();
