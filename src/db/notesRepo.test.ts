import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './database';
import { notesRepo } from './notesRepo';
import type { Note } from '../types/note';

describe('notesRepo - importNotes replace transaction and rollback', () => {
  beforeEach(async () => {
    await db.notes.clear();
  });

  it('successfully replaces all notes in transaction when valid payload provided', async () => {
    // Seed initial note
    await db.notes.add({
      title: 'Old Note 1',
      content: 'Original content',
      tags: ['seed'],
      pinned: false,
      archived: false,
      trashedAt: null,
      inbox: false,
      scheduledAt: null,
      reminderAt: null,
      personId: null,
      kind: 'note',
      journalDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(await db.notes.count()).toBe(1);

    const newNotes: Partial<Note>[] = [
      { id: 10, title: 'New Note A', content: 'A' },
      { id: 11, title: 'New Note B', content: 'B' },
    ];

    const result = await notesRepo.importNotes(newNotes, 'replace');

    expect(result.importedCount).toBe(2);
    expect(await db.notes.count()).toBe(2);
    const notesInDb = await db.notes.toArray();
    expect(notesInDb.map((n) => n.title)).toEqual(['New Note A', 'New Note B']);
  });

  it('rolls back clear() and preserves original data when import payload contains duplicate IDs', async () => {
    // Seed original note
    await db.notes.add({
      id: 1,
      title: 'Pre-existing Note',
      content: 'Must not be lost',
      tags: ['critical'],
      pinned: false,
      archived: false,
      trashedAt: null,
      inbox: false,
      scheduledAt: null,
      reminderAt: null,
      personId: null,
      kind: 'note',
      journalDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(await db.notes.count()).toBe(1);

    // Payload with duplicate explicit id=99
    const conflictingNotes: Partial<Note>[] = [
      { id: 99, title: 'Conflicting Note 1', content: 'First' },
      { id: 99, title: 'Conflicting Note 2', content: 'Duplicate' },
    ];

    await expect(
      notesRepo.importNotes(conflictingNotes, 'replace')
    ).rejects.toThrow(/Import failed due to note constraint conflict/);

    // CRITICAL: Original note must still exist in the database!
    expect(await db.notes.count()).toBe(1);
    const surviving = await db.notes.get(1);
    expect(surviving?.title).toBe('Pre-existing Note');
    expect(surviving?.content).toBe('Must not be lost');
  });

  it('preserves snapshot before import', async () => {
    await db.notes.add({
      id: 5,
      title: 'Snapshot Test',
      content: 'Content',
      tags: [],
      pinned: false,
      archived: false,
      trashedAt: null,
      inbox: false,
      scheduledAt: null,
      reminderAt: null,
      personId: null,
      kind: 'note',
      journalDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await notesRepo.importNotes(
      [{ id: 20, title: 'Replaced Note', content: 'New' }],
      'replace'
    );

    expect(result.previousSnapshot).toHaveLength(1);
    expect(result.previousSnapshot?.[0].title).toBe('Snapshot Test');
  });
});
