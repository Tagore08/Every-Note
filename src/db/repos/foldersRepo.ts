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
   * Ensure default 'Vault' folder exists and is pinned to the top
   */
  async ensureDefaultVaultFolder(): Promise<Folder> {
    const existing = await db.folders
      .filter((f) => f.name.toLowerCase() === 'vault' && (f.parentId === null || f.parentId === undefined))
      .first();
    if (!existing) {
      const now = new Date();
      const vaultFolder: Folder = {
        name: 'Vault',
        parentId: null,
        pinned: true,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      };
      const id = await db.folders.add(vaultFolder);
      return { ...vaultFolder, id: id as number };
    }
    if (!existing.pinned) {
      await db.folders.update(existing.id!, { pinned: true, updatedAt: new Date() });
      return { ...existing, pinned: true };
    }
    return existing;
  },

  /**
   * Toggle pinned state of a folder
   */
  async togglePinFolder(id: number, pinned: boolean): Promise<void> {
    await db.folders.update(id, {
      pinned,
      updatedAt: new Date(),
    });
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
   * Get all descendant folder IDs for a given folder
   */
  getSubtreeFolderIds(folderId: number, folders: Folder[]): Set<number> {
    const result = new Set<number>();
    const queue = [folderId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const f of folders) {
        if (f.parentId === current && f.id) {
          result.add(f.id);
          queue.push(f.id);
        }
      }
    }
    return result;
  },

  /**
   * Get ancestral path of folders from root down to folderId
   */
  getFolderPath(folderId: number | null, folders: Folder[]): Folder[] {
    if (folderId === null || folderId === undefined) return [];
    const path: Folder[] = [];
    let currentId: number | null = folderId;
    const visited = new Set<number>();

    while (currentId !== null && !visited.has(currentId)) {
      visited.add(currentId);
      const findId: number = currentId;
      const f = folders.find((item: Folder) => item.id === findId);
      if (!f) break;
      path.unshift(f);
      currentId = f.parentId ?? null;
    }
    return path;
  },

  /**
   * Get formatted folder path string (e.g. "Vault / Work / Frontend")
   */
  getFolderPathString(folderId: number | null, folders: Folder[]): string {
    const chain = foldersRepo.getFolderPath(folderId, folders);
    return chain.map((f) => f.name).join(' / ');
  },

  /**
   * Move a folder into another parent folder (or root) with cycle prevention
   */
  async moveFolder(id: number, targetParentId: number | null): Promise<void> {
    if (id === targetParentId) throw new Error('Folder cannot be its own parent');
    if (targetParentId !== null) {
      const allFolders = await db.folders.toArray();
      const descendants = foldersRepo.getSubtreeFolderIds(id, allFolders);
      if (descendants.has(targetParentId)) {
        throw new Error('Cannot move a folder into its own subfolder');
      }
    }
    await db.folders.update(id, {
      parentId: targetParentId,
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
