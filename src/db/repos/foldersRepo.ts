import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database';
import type { Folder } from '../../types/folder';
import type { Note } from '../../types/note';

export const foldersRepo = {
  /**
   * Get all folders
   */
  async getAllFolders(): Promise<Folder[]> {
    return db.folders.toArray();
  },

  /**
   * Create a new folder
   */
  async createFolder(name: string, parentId: number | null = null): Promise<Folder> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Folder name cannot be empty');

    const now = new Date();
    const folder: Folder = {
      name: trimmed,
      parentId,
      createdAt: now,
      updatedAt: now,
    };

    const id = await db.folders.add(folder);
    return { ...folder, id: id as number };
  },

  /**
   * Rename a folder
   */
  async renameFolder(id: number, name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Folder name cannot be empty');

    await db.folders.update(id, {
      name: trimmed,
      updatedAt: new Date(),
    });
  },

  /**
   * Move a folder into another parent folder (or root)
   */
  async moveFolder(id: number, parentId: number | null): Promise<void> {
    if (id === parentId) throw new Error('Folder cannot be its own parent');
    await db.folders.update(id, {
      parentId,
      updatedAt: new Date(),
    });
  },

  /**
   * Delete a folder.
   * Also moves children folders and notes in this folder up to parentId (or root).
   */
  async deleteFolder(id: number): Promise<void> {
    const folder = await db.folders.get(id);
    const targetParentId = folder?.parentId ?? null;

    // Move direct child folders to parent
    await db.folders.where('parentId').equals(id).modify({
      parentId: targetParentId,
      updatedAt: new Date(),
    });

    // Move notes in this folder to parent
    await db.notes.where('folderId').equals(id).modify({
      folderId: targetParentId,
      updatedAt: new Date(),
    });

    await db.folders.delete(id);
  },

  /**
   * Set the folder of a note
   */
  async setNoteFolder(noteId: number, folderId: number | null): Promise<void> {
    await db.notes.update(noteId, {
      folderId,
      updatedAt: new Date(),
    });
  },

  /**
   * Import folders during restore
   */
  async importFolders(folders: Folder[], strategy: 'merge' | 'replace' = 'merge'): Promise<number> {
    if (strategy === 'replace') {
      await db.folders.clear();
    }
    if (folders.length === 0) return 0;

    await db.folders.bulkPut(folders);
    return folders.length;
  },
};

/**
 * React hook to observe all folders
 */
export function useFolders(): Folder[] {
  return useLiveQuery(() => db.folders.toArray(), []) || [];
}

/**
 * React hook to observe notes in a specific folder (or root)
 */
export function useNotesByFolder(folderId: number | null | undefined): Note[] {
  return (
    useLiveQuery(async () => {
      const active = await db.notes.filter((n) => n.trashedAt === null && !n.isScratchpad).toArray();
      if (folderId === undefined) {
        return active;
      }
      return active.filter((n) => (n.folderId ?? null) === folderId);
    }, [folderId]) || []
  );
}
