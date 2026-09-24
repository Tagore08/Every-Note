import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
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
    // Sort descending by count, then alphabetically by tag name
    return list.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
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
