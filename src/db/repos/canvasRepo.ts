import { db } from '../database';
import type { CanvasDoc, CanvasEntity } from '../../types/canvas';

export function createDefaultCanvasDoc(bg = '#ffffff'): CanvasDoc {
  return {
    version: 1,
    width: 3000,
    height: 2000,
    bg,
    strokes: [],
  };
}

export const canvasRepo = {
  async createCanvas(data: Partial<CanvasEntity> = {}): Promise<CanvasEntity> {
    const now = Date.now();
    const doc = data.doc ?? createDefaultCanvasDoc();
    const entity: CanvasEntity = {
      title: data.title?.trim() || 'Untitled drawing',
      doc,
      thumbBlob: data.thumbBlob,
      linkedNoteId: data.linkedNoteId ?? null,
      tags: data.tags ?? [],
      lifeAreaId: data.lifeAreaId ?? null,
      createdAt: data.createdAt ?? now,
      updatedAt: data.updatedAt ?? now,
      trashedAt: null,
    };

    const id = await db.canvases.add(entity);
    return { ...entity, id };
  },

  async getCanvasById(id: number): Promise<CanvasEntity | undefined> {
    return await db.canvases.get(id);
  },

  async updateCanvasDoc(id: number, doc: CanvasDoc, thumbBlob?: Blob): Promise<void> {
    const patch: Partial<CanvasEntity> = {
      doc,
      updatedAt: Date.now(),
    };
    if (thumbBlob !== undefined) {
      patch.thumbBlob = thumbBlob;
    }
    await db.canvases.update(id, patch);
  },

  async updateCanvasMetadata(
    id: number,
    data: Partial<Pick<CanvasEntity, 'title' | 'tags' | 'lifeAreaId' | 'linkedNoteId'>>
  ): Promise<void> {
    await db.canvases.update(id, {
      ...data,
      updatedAt: Date.now(),
    });
  },

  async getAllCanvases(includeTrashed = false): Promise<CanvasEntity[]> {
    let items = await db.canvases.toArray();
    if (!includeTrashed) {
      items = items.filter((c) => !c.trashedAt);
    }
    return items.sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async getTrashedCanvases(): Promise<CanvasEntity[]> {
    const items = await db.canvases.toArray();
    return items
      .filter((c) => !!c.trashedAt)
      .sort((a, b) => (b.trashedAt || 0) - (a.trashedAt || 0));
  },

  async getCanvasesForNote(noteId: number): Promise<CanvasEntity[]> {
    const items = await db.canvases.where('linkedNoteId').equals(noteId).toArray();
    return items.filter((c) => !c.trashedAt).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async trashCanvas(id: number): Promise<void> {
    await db.canvases.update(id, {
      trashedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

  async restoreCanvas(id: number): Promise<void> {
    await db.canvases.update(id, {
      trashedAt: null,
      updatedAt: Date.now(),
    });
  },

  async deleteCanvasPermanently(id: number): Promise<void> {
    await db.canvases.delete(id);
  },

  async getAllCanvasesForExport(): Promise<CanvasEntity[]> {
    return await db.canvases.toArray();
  },

  async importCanvases(canvases: CanvasEntity[], strategy: 'merge' | 'replace'): Promise<number> {
    if (strategy === 'replace') {
      await db.canvases.clear();
    }
    for (const c of canvases) {
      if (strategy === 'replace' && c.id) {
        await db.canvases.put(c);
      } else {
        const { id: _, ...rest } = c;
        await db.canvases.add(rest as CanvasEntity);
      }
    }
    return canvases.length;
  },
};
