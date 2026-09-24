import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import { attachmentsRepo } from './attachmentsRepo';
import type { Note } from '../types/note';

/**
 * Repository providing clean, isolated data access for Note entities.
 * Screens never call Dexie directly; all queries and mutations flow through this layer.
 * Serves as the single extension point for future cross-device sync.
 */
export const notesRepo = {
  /**
   * Fast 1-tap capture: creates an inbox note with zero friction.
   */
  async captureNote(content: string): Promise<Note> {
    const now = new Date();
    const newNote: Note = {
      title: '',
      content: content.trim(),
      tags: [],
      pinned: false,
      archived: false,
      trashedAt: null,
      inbox: true,
      createdAt: now,
      updatedAt: now,
    };
    const id = await db.notes.add(newNote);
    return { ...newNote, id: id as number };
  },

  /**
   * Standard note creation (e.g. from full editor or "New Note").
   */
  async createNote(draft: Partial<Note>): Promise<Note> {
    const now = new Date();
    const newNote: Note = {
      title: draft.title?.trim() ?? '',
      content: draft.content ?? '',
      tags: draft.tags ?? [],
      pinned: draft.pinned ?? false,
      archived: draft.archived ?? false,
      trashedAt: null,
      inbox: draft.inbox ?? false,
      scheduledAt: draft.scheduledAt ?? null,
      reminderAt: draft.reminderAt ?? null,
      personId: draft.personId ?? null,
      lifeAreaId: draft.lifeAreaId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    const id = await db.notes.add(newNote);
    return { ...newNote, id: id as number };
  },

  /**
   * Fetch a single note by ID.
   */
  async getNoteById(id: number): Promise<Note | undefined> {
    return await db.notes.get(id);
  },

  /**
   * Update fields on an existing note. Automatically bumps updatedAt.
   */
  async updateNote(id: number, changes: Partial<Omit<Note, 'id' | 'createdAt'>>): Promise<void> {
    await db.notes.update(id, {
      ...changes,
      updatedAt: new Date(),
    });
  },

  /**
   * File an inbox note into the permanent notes collection.
   */
  async fileInboxNote(id: number, title?: string): Promise<void> {
    const updateData: Partial<Note> = {
      inbox: false,
      updatedAt: new Date(),
    };
    if (typeof title === 'string') {
      updateData.title = title.trim();
    }
    await db.notes.update(id, updateData);
  },

  /**
   * Soft-delete a note (never hard-deletes, marks trashedAt).
   */
  async trashNote(id: number): Promise<void> {
    await db.notes.update(id, {
      trashedAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Restore a soft-deleted note.
   */
  async restoreNote(id: number): Promise<void> {
    await db.notes.update(id, {
      trashedAt: null,
      updatedAt: new Date(),
    });
  },

  /**
   * Toggle pinned status of a note.
   */
  async togglePin(id: number, pinned: boolean): Promise<void> {
    await db.notes.update(id, {
      pinned,
      updatedAt: new Date(),
    });
  },

  /**
   * Archive a note (hides from main active notes list).
   */
  async archiveNote(id: number): Promise<void> {
    await db.notes.update(id, {
      archived: true,
      updatedAt: new Date(),
    });
  },

  /**
   * Unarchive a note (moves back to active notes list).
   */
  async unarchiveNote(id: number): Promise<void> {
    await db.notes.update(id, {
      archived: false,
      updatedAt: new Date(),
    });
  },

  /**
   * Hard-delete a note permanently from IndexedDB (also purges its attachments).
   */
  async deletePermanently(id: number): Promise<void> {
    await db.notes.delete(id);
    await attachmentsRepo.deleteAttachmentsByNoteId(id);
  },

  /**
   * Empty trash: permanently delete all soft-deleted notes and their attachments.
   */
  async emptyTrash(): Promise<number> {
    const trashedNotes = await db.notes
      .filter((note) => note.trashedAt !== null)
      .toArray();

    const ids = trashedNotes.map((n) => n.id!).filter((id) => typeof id === 'number');
    if (ids.length > 0) {
      await db.notes.bulkDelete(ids);
      for (const id of ids) {
        await attachmentsRepo.deleteAttachmentsByNoteId(id);
      }
    }
    return ids.length;
  },

  /**
   * Automatically purge trashed notes older than specified days (default: 30 days).
   */
  async purgeOldTrash(days = 30): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const oldNotes = await db.notes
      .filter((note) => note.trashedAt !== null && new Date(note.trashedAt) < cutoff)
      .toArray();

    const ids = oldNotes.map((n) => n.id!).filter((id) => typeof id === 'number');
    if (ids.length > 0) {
      await db.notes.bulkDelete(ids);
      for (const id of ids) {
        await attachmentsRepo.deleteAttachmentsByNoteId(id);
      }
    }
    return ids.length;
  },

  /**
   * Returns all active inbox notes, newest first.
   */
  async getInboxNotes(): Promise<Note[]> {
    const notes = await db.notes
      .filter((note) => note.inbox === true && note.trashedAt === null)
      .toArray();

    return notes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Returns count of unprocessed inbox notes for navigation badges.
   */
  async getInboxCount(): Promise<number> {
    return await db.notes
      .filter((note) => note.inbox === true && note.trashedAt === null)
      .count();
  },

  /**
   * Returns all active notes (inbox=false, archived=false, trashedAt=null).
   * Sorted with pinned notes first, then newest updatedAt.
   * Optionally filtered by tag.
   */
  async getActiveNotes(tagFilter?: string): Promise<Note[]> {
    let collection = db.notes.filter(
      (note) => !note.inbox && !note.archived && note.trashedAt === null
    );

    if (tagFilter && tagFilter.trim()) {
      const cleanTag = tagFilter.trim().toLowerCase();
      collection = collection.filter((note) =>
        note.tags?.some((t) => t.toLowerCase() === cleanTag)
      );
    }

    const notes = await collection.toArray();

    return notes.sort((a, b) => {
      // Pinned notes always come first
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  },

  /**
   * Returns all archived notes (archived=true, trashedAt=null).
   * Sorted by newest updatedAt.
   */
  async getArchivedNotes(): Promise<Note[]> {
    const notes = await db.notes
      .filter((note) => note.archived === true && note.trashedAt === null)
      .toArray();

    return notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  /**
   * Returns all trashed notes (trashedAt !== null).
   * Sorted newest trashedAt first.
   */
  async getTrashNotes(): Promise<Note[]> {
    const notes = await db.notes
      .filter((note) => note.trashedAt !== null)
      .toArray();

    return notes.sort((a, b) => {
      const timeA = a.trashedAt ? new Date(a.trashedAt).getTime() : 0;
      const timeB = b.trashedAt ? new Date(b.trashedAt).getTime() : 0;
      return timeB - timeA;
    });
  },

  /**
   * Search notes across title, content, and tags using case-insensitive substring matching.
   * Only matches non-trashed notes.
   */
  async searchNotes(rawQuery: string): Promise<Note[]> {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return [];

    const notes = await db.notes
      .filter((note) => {
        if (note.trashedAt !== null) return false;

        const titleMatch = (note.title || '').toLowerCase().includes(query);
        const contentMatch = (note.content || '').toLowerCase().includes(query);
        const tagsMatch = (note.tags || []).some((tag) => tag.toLowerCase().includes(query));

        return titleMatch || contentMatch || tagsMatch;
      })
      .toArray();

    return notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  /**
   * Returns a breakdown of all unique tags with count of active notes containing each.
   */
  async getAllTagsWithCounts(): Promise<{ tag: string; count: number }[]> {
    const notes = await db.notes
      .filter((note) => note.trashedAt === null && !note.archived)
      .toArray();

    const counts = new Map<string, number>();

    for (const note of notes) {
      if (Array.isArray(note.tags)) {
        for (const tag of note.tags) {
          const trimmed = tag.trim();
          if (trimmed) {
            counts.set(trimmed, (counts.get(trimmed) || 0) + 1);
          }
        }
      }
    }

    const list = Array.from(counts.entries()).map(([tag, count]) => ({ tag, count }));
    return list.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  },

  /**
   * Retrieves all notes in the database for complete JSON backup export.
   */
  async getAllNotesForExport(): Promise<Note[]> {
    return await db.notes.toArray();
  },

  /**
   * Imports notes with support for 'merge' or 'replace' strategy.
   * Sanitizes date fields and preserves historical integrity.
   */
  async importNotes(
    rawNotes: Partial<Note>[],
    strategy: 'merge' | 'replace'
  ): Promise<{ importedCount: number; previousSnapshot?: Note[] }> {
    const previousSnapshot = await db.notes.toArray();

    const sanitizedNotes: Note[] = rawNotes.map((raw) => {
      const createdAt = raw.createdAt ? new Date(raw.createdAt) : new Date();
      const updatedAt = raw.updatedAt ? new Date(raw.updatedAt) : new Date();
      const trashedAt = raw.trashedAt ? new Date(raw.trashedAt) : null;
      const scheduledAt = raw.scheduledAt ? new Date(raw.scheduledAt) : null;
      const reminderAt = raw.reminderAt ? new Date(raw.reminderAt) : null;

      return {
        id: typeof raw.id === 'number' ? raw.id : undefined,
        title: typeof raw.title === 'string' ? raw.title : '',
        content: typeof raw.content === 'string' ? raw.content : '',
        tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
        pinned: Boolean(raw.pinned),
        archived: Boolean(raw.archived),
        trashedAt: isNaN(trashedAt?.getTime() ?? 0) ? null : trashedAt,
        inbox: Boolean(raw.inbox),
        scheduledAt: scheduledAt && !isNaN(scheduledAt.getTime()) ? scheduledAt : null,
        reminderAt: reminderAt && !isNaN(reminderAt.getTime()) ? reminderAt : null,
        personId: typeof raw.personId === 'number' ? raw.personId : null,
        lifeAreaId: typeof raw.lifeAreaId === 'number' ? raw.lifeAreaId : null,
        createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
        updatedAt: isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
      };
    });


    if (strategy === 'replace') {
      await db.notes.clear();
      if (sanitizedNotes.length > 0) {
        await db.notes.bulkAdd(sanitizedNotes);
      }
      return { importedCount: sanitizedNotes.length, previousSnapshot };
    }

    // Merge strategy:
    // If a note with the same ID already exists, newest updatedAt wins.
    // If no note exists or id is missing, insert.
    let importedCount = 0;
    for (const note of sanitizedNotes) {
      if (typeof note.id === 'number') {
        const existing = await db.notes.get(note.id);
        if (existing) {
          if (new Date(note.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
            await db.notes.put(note);
            importedCount++;
          }
        } else {
          await db.notes.put(note);
          importedCount++;
        }
      } else {
        await db.notes.add(note);
        importedCount++;
      }
    }

    return { importedCount, previousSnapshot };
  },

  /**
   * Sets or clears scheduledAt and reminderAt for a note.
   */
  async setNoteSchedule(id: number, scheduledAt: Date | null, reminderAt?: Date | null): Promise<void> {
    await db.notes.update(id, {
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      reminderAt: reminderAt ? new Date(reminderAt) : null,
      updatedAt: new Date(),
    });
  },

  /**
   * Retrieves notes scheduled within a date range [start, end].
   */
  async getScheduledNotesForRange(start: Date, end: Date): Promise<Note[]> {
    const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0).getTime();
    const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();

    return db.notes
      .filter((note) => {
        if (note.trashedAt || !note.scheduledAt) return false;
        const schedTime = new Date(note.scheduledAt).getTime();
        return schedTime >= startTime && schedTime <= endTime;
      })
      .toArray();
  },

  /**
   * Fetches all non-trashed notes with active reminders set.
   */
  async getActiveScheduledReminders(): Promise<Note[]> {
    return db.notes
      .filter((n) => !n.trashedAt && !!n.reminderAt)
      .toArray();
  },

  /**
   * Danger zone: wipes all notes and attachments permanently.
   */
  async deleteAllNotes(): Promise<void> {
    await db.notes.clear();
    await attachmentsRepo.deleteAllAttachments();
  },
};

/**
 * Reactive hooks wrapping useLiveQuery for easy, declarative view consumption.
 */
export function useInboxNotes(): Note[] | undefined {
  return useLiveQuery(() => notesRepo.getInboxNotes());
}

export function useInboxCount(): number {
  const count = useLiveQuery(() => notesRepo.getInboxCount());
  return count ?? 0;
}

export function useActiveNotes(tagFilter?: string): Note[] | undefined {
  return useLiveQuery(() => notesRepo.getActiveNotes(tagFilter), [tagFilter]);
}

export function useArchivedNotes(): Note[] | undefined {
  return useLiveQuery(() => notesRepo.getArchivedNotes());
}

export function useTrashNotes(): Note[] | undefined {
  return useLiveQuery(() => notesRepo.getTrashNotes());
}

export function useNote(id: number | null | undefined): Note | null | undefined {
  return useLiveQuery(async () => {
    if (typeof id !== 'number' || isNaN(id)) return null;
    const note = await notesRepo.getNoteById(id);
    return note ?? null;
  }, [id]);
}

export function useSearchNotes(query: string): Note[] | undefined {
  return useLiveQuery(() => notesRepo.searchNotes(query), [query]);
}

export function useTagsWithCounts(): { tag: string; count: number }[] | undefined {
  return useLiveQuery(() => notesRepo.getAllTagsWithCounts());
}

export function useScheduledNotesForRange(start: Date, end: Date): Note[] | undefined {
  const s = start.getTime();
  const e = end.getTime();
  return useLiveQuery(
    () => notesRepo.getScheduledNotesForRange(new Date(s), new Date(e)),
    [s, e]
  );
}

