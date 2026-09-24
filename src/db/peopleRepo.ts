import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import type { Person } from '../types/person';
import type { CalendarEvent } from '../types/event';
import type { Task } from '../types/task';
import type { Note } from '../types/note';

export const peopleRepo = {
  /**
   * Create a new person.
   */
  async createPerson(draft: {
    name: string;
    photoBlob?: Blob | null;
    contactInfo?: string;
    notes?: string;
  }): Promise<Person> {
    const now = new Date();
    const newPerson: Person = {
      name: draft.name.trim(),
      photoBlob: draft.photoBlob || null,
      contactInfo: draft.contactInfo?.trim() || '',
      notes: draft.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
      trashedAt: null,
    };

    const id = await db.people.add(newPerson);
    return { ...newPerson, id: Number(id) };
  },

  /**
   * Fetch a single person by ID.
   */
  async getPersonById(id: number): Promise<Person | undefined> {
    return await db.people.get(id);
  },

  /**
   * Update fields on an existing person. Automatically bumps updatedAt.
   */
  async updatePerson(
    id: number,
    changes: Partial<Omit<Person, 'id' | 'createdAt'>>
  ): Promise<void> {
    await db.people.update(id, {
      ...changes,
      updatedAt: new Date(),
    });
  },

  /**
   * Soft-delete a person (sets trashedAt).
   */
  async trashPerson(id: number): Promise<void> {
    await db.people.update(id, {
      trashedAt: new Date(),
      updatedAt: new Date(),
    });
  },

  /**
   * Restore a soft-deleted person.
   */
  async restorePerson(id: number): Promise<void> {
    await db.people.update(id, {
      trashedAt: null,
      updatedAt: new Date(),
    });
  },

  /**
   * Permanently delete a person from IndexedDB.
   * Also cleans up person references across events, tasks, and notes.
   */
  async deletePermanently(id: number): Promise<void> {
    await db.transaction('rw', db.people, db.events, db.tasks, db.notes, async () => {
      // Unlink personId from related events
      const linkedEvents = await db.events.where('personId').equals(id).toArray();
      for (const ev of linkedEvents) {
        if (ev.id) await db.events.update(ev.id, { personId: null });
      }

      // Unlink personId from related tasks
      const linkedTasks = await db.tasks.where('personId').equals(id).toArray();
      for (const t of linkedTasks) {
        if (t.id) await db.tasks.update(t.id, { personId: null });
      }

      // Unlink personId from related notes
      const linkedNotes = await db.notes.where('personId').equals(id).toArray();
      for (const n of linkedNotes) {
        if (n.id) await db.notes.update(n.id, { personId: null });
      }

      // Delete the person record
      await db.people.delete(id);
    });
  },

  /**
   * Fetch all people for export (including trashed).
   */
  async getAllPeopleForExport(): Promise<Person[]> {
    return await db.people.toArray();
  },

  /**
   * Import people from backup.
   */
  async importPeople(
    people: Person[],
    strategy: 'merge' | 'replace' = 'merge'
  ): Promise<number> {
    return await db.transaction('rw', db.people, async () => {
      if (strategy === 'replace') {
        await db.people.clear();
      }

      let count = 0;
      for (const p of people) {
        const item: Person = {
          ...p,
          createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
          updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
          trashedAt: p.trashedAt ? new Date(p.trashedAt) : null,
        };

        if (strategy === 'replace' && typeof item.id === 'number') {
          await db.people.put(item);
          count++;
        } else {
          delete item.id;
          await db.people.add(item);
          count++;
        }
      }
      return count;
    });
  },

  /**
   * Purge all people (Danger zone).
   */
  async deleteAllPeople(): Promise<void> {
    await db.people.clear();
  },
};

/**
 * Reactive hook: active people list, optionally filtered by search query.
 * Sorted by name alphabetically.
 */
export function usePeople(searchQuery?: string): Person[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.people
          .filter((p) => p.trashedAt === null || p.trashedAt === undefined)
          .toArray();

        // Sort alphabetically by name
        let result = all.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

        if (searchQuery && searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          result = result.filter((p) => p.name.toLowerCase().includes(q));
        }

        return result;
      },
      [searchQuery],
      []
    ) ?? []
  );
}

/**
 * Reactive hook: get a single person by ID.
 */
export function usePerson(id?: number | null): Person | null | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return null;
      const person = await db.people.get(id);
      return person ?? null;
    },
    [id],
    undefined
  );
}

/**
 * Reactive hook: all active events associated with a person.
 */
export function usePersonEvents(personId?: number | null): CalendarEvent[] {
  return (
    useLiveQuery(
      async () => {
        if (!personId) return [];
        const events = await db.events
          .where('personId')
          .equals(personId)
          .filter((e) => !e.trashedAt)
          .toArray();

        return events.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      },
      [personId],
      []
    ) ?? []
  );
}

/**
 * Reactive hook: all active tasks associated with a person.
 * Sorted todo first, then by due date or updated time.
 */
export function usePersonTasks(personId?: number | null): Task[] {
  return (
    useLiveQuery(
      async () => {
        if (!personId) return [];
        const tasks = await db.tasks
          .where('personId')
          .equals(personId)
          .filter((t) => !t.trashedAt)
          .toArray();

        return tasks.sort((a, b) => {
          if (a.status !== b.status) {
            return a.status === 'todo' ? -1 : 1;
          }
          if (a.dueAt && b.dueAt) {
            return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
          }
          if (a.dueAt) return -1;
          if (b.dueAt) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
      },
      [personId],
      []
    ) ?? []
  );
}

/**
 * Reactive hook: all active notes associated with a person.
 * Sorted by updatedAt descending.
 */
export function usePersonNotes(personId?: number | null): Note[] {
  return (
    useLiveQuery(
      async () => {
        if (!personId) return [];
        const notes = await db.notes
          .where('personId')
          .equals(personId)
          .filter((n) => !n.trashedAt)
          .toArray();

        return notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      },
      [personId],
      []
    ) ?? []
  );
}

/**
 * Reactive hook: trashed people.
 */
export function useTrashPeople(): Person[] {
  return (
    useLiveQuery(
      async () => {
        const trashed = await db.people
          .filter((p) => p.trashedAt !== null && p.trashedAt !== undefined)
          .toArray();
        return trashed.sort(
          (a, b) => new Date(b.trashedAt!).getTime() - new Date(a.trashedAt!).getTime()
        );
      },
      [],
      []
    ) ?? []
  );
}
