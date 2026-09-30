import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database';
import { notesRepo } from '../notesRepo';
import type { StickyNote, StickyColor } from '../../types/sticky';
import type { Note } from '../../types/note';

export const stickyNotesRepo = {
  async getAllStickyNotes(): Promise<StickyNote[]> {
    return db.stickyNotes.toArray();
  },

  async createStickyNote(partial?: Partial<StickyNote>): Promise<StickyNote> {
    const now = new Date();
    const count = await db.stickyNotes.count();
    
    // Stagger default placement nicely across canvas
    const col = count % 4;
    const row = Math.floor(count / 4) % 3;
    const defaultX = 40 + col * 280;
    const defaultY = 40 + row * 260;

    const colors: StickyColor[] = ['yellow', 'peach', 'mint', 'blue', 'lavender', 'pink'];
    const chosenColor = partial?.color || colors[count % colors.length];

    const note: StickyNote = {
      x: partial?.x ?? defaultX,
      y: partial?.y ?? defaultY,
      width: partial?.width ?? 260,
      height: partial?.height ?? 240,
      color: chosenColor,
      textColor: partial?.textColor,
      fontFamily: partial?.fontFamily ?? 'sans',
      fontSize: partial?.fontSize ?? 'md',
      content: partial?.content ?? '',
      showTimestamp: partial?.showTimestamp ?? true,
      drawingSvg: partial?.drawingSvg,
      drawingStrokes: partial?.drawingStrokes,
      zIndex: partial?.zIndex ?? count + 1,
      createdAt: now,
      updatedAt: now,
    };

    const id = await db.stickyNotes.add(note);
    return { ...note, id: id as number };
  },

  async updateStickyNote(id: number, changes: Partial<StickyNote>): Promise<void> {
    await db.stickyNotes.update(id, {
      ...changes,
      updatedAt: new Date(),
    });
  },

  async bringToFront(id: number): Promise<void> {
    const all = await db.stickyNotes.toArray();
    const maxZ = all.reduce((max, n) => Math.max(max, n.zIndex ?? 0), 0);
    await db.stickyNotes.update(id, {
      zIndex: maxZ + 1,
      updatedAt: new Date(),
    });
  },

  async deleteStickyNote(id: number): Promise<void> {
    await db.stickyNotes.delete(id);
  },

  async clearAllStickyNotes(): Promise<void> {
    await db.stickyNotes.clear();
  },

  async exportToNote(sticky: StickyNote, inbox: boolean): Promise<Note> {
    const lines = sticky.content.trim().split('\n');
    const title = lines[0]?.replace(/^#+\s*/, '').slice(0, 40) || 'Sticky Note';
    let fullContent = sticky.content;
    if (sticky.drawingSvg) {
      fullContent += `\n\n![Drawing](${sticky.drawingSvg})`;
    }
    return notesRepo.createNote({
      title,
      content: fullContent,
      inbox,
    });
  },

  async getAllForExport(): Promise<StickyNote[]> {
    return db.stickyNotes.toArray();
  },

  async importStickyNotes(stickyNotes: StickyNote[], strategy: 'merge' | 'replace' = 'merge'): Promise<number> {
    if (strategy === 'replace') {
      await db.stickyNotes.clear();
    }
    if (stickyNotes.length === 0) return 0;
    const sanitized = stickyNotes.map((s) => ({
      ...s,
      createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
      updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
    }));
    await db.stickyNotes.bulkPut(sanitized);
    return sanitized.length;
  },
};

export function useStickyNotes(): StickyNote[] {
  return useLiveQuery(() => db.stickyNotes.toArray(), []) || [];
}
