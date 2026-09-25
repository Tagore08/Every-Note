import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database';
import { extractWikilinks, normalizeTitle, extractContextSnippet } from '../../lib/wikilinks';
import type { Note } from '../../types/note';
import type { NoteLink } from '../../types/link';

export interface BacklinkItem {
  link: NoteLink;
  sourceNote?: Note;
}

export interface OutgoingLinkItem {
  link: NoteLink;
  targetNote?: Note;
}

export const linksRepo = {
  /**
   * Re-indexes all wikilinks originating from a specific note.
   * Resolves rawTitles to note IDs where a match exists.
   */
  async reindexNote(noteId: number): Promise<NoteLink[]> {
    // 1. Delete previous outgoing links from this note
    await db.links.where('sourceId').equals(noteId).delete();

    // 2. Fetch the source note
    const note = await db.notes.get(noteId);
    if (!note || note.trashedAt !== null) {
      return [];
    }

    // 3. Extract wikilinks from content
    const extracted = extractWikilinks(note.content || '');
    if (extracted.length === 0) {
      return [];
    }

    // 4. Resolve each extracted wikilink against existing active notes
    const allActiveNotes = await db.notes
      .filter((n) => n.trashedAt === null)
      .toArray();

    const normalizedMap = new Map<string, Note[]>();
    for (const n of allActiveNotes) {
      // Index by title
      const normTitle = normalizeTitle(n.title || '');
      if (normTitle) {
        if (!normalizedMap.has(normTitle)) normalizedMap.set(normTitle, []);
        normalizedMap.get(normTitle)!.push(n);
      }
      // Index by journalDate if applicable
      if (n.journalDate) {
        const normJournal = normalizeTitle(n.journalDate);
        if (!normalizedMap.has(normJournal)) normalizedMap.set(normJournal, []);
        normalizedMap.get(normJournal)!.push(n);
      }
    }

    const createdLinks: NoteLink[] = [];
    const now = Date.now();

    for (const item of extracted) {
      const normTarget = normalizeTitle(item.rawTitle);
      const candidates = normalizedMap.get(normTarget) || [];

      let resolvedId: number | null = null;
      if (candidates.length > 0) {
        // Preferred candidate: kind === 'note' > journal, exact title match wins ties
        const sorted = [...candidates].sort((a, b) => {
          if (a.kind !== b.kind) {
            return a.kind === 'note' ? -1 : 1;
          }
          if (a.title === item.rawTitle) return -1;
          if (b.title === item.rawTitle) return 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        resolvedId = sorted[0].id || null;
      }

      const context = extractContextSnippet(note.content || '', item.index, item.length, 60);

      createdLinks.push({
        sourceId: noteId,
        targetId: resolvedId,
        targetTitle: item.rawTitle,
        context,
        createdAt: now,
      });
    }

    if (createdLinks.length > 0) {
      await db.links.bulkAdd(createdLinks);
    }

    return createdLinks;
  },

  /**
   * Re-indexes links across all notes in chunked batches of 50.
   * Yields execution to the event loop so the UI remains responsive.
   */
  async reindexAllLinks(
    onProgress?: (done: number, total: number) => void
  ): Promise<{ processedNotes: number; createdLinks: number }> {
    await db.links.clear();

    const activeNotes = await db.notes
      .filter((n) => n.trashedAt === null)
      .toArray();

    const total = activeNotes.length;
    let done = 0;
    let createdLinksCount = 0;
    const batchSize = 50;

    for (let i = 0; i < total; i += batchSize) {
      const batch = activeNotes.slice(i, i + batchSize);
      for (const note of batch) {
        if (typeof note.id === 'number') {
          const links = await linksRepo.reindexNote(note.id);
          createdLinksCount += links.length;
        }
      }
      done = Math.min(total, i + batchSize);
      onProgress?.(done, total);
      // Yield to avoid blocking browser main thread
      await new Promise((r) => setTimeout(r, 0));
    }

    return { processedNotes: total, createdLinks: createdLinksCount };
  },

  /**
   * Automatically runs reindexAllLinks on first launch after Schema v11 upgrade.
   */
  async ensureInitialReindex(): Promise<boolean> {
    const meta = await db.appMeta.get('links_reindexed_v11');
    if (!meta) {
      await linksRepo.reindexAllLinks();
      await db.appMeta.put({
        key: 'links_reindexed_v11',
        value: true,
        updatedAt: Date.now(),
      });
      return true;
    }
    return false;
  },

  /**
   * Claims unresolved links when a note is created or renamed to match targetTitle.
   */
  async claimUnresolvedLinks(noteId: number, noteTitle: string): Promise<number> {
    const norm = normalizeTitle(noteTitle);
    if (!norm) return 0;

    const unresolved = await db.links
      .filter((l) => l.targetId === null && normalizeTitle(l.targetTitle) === norm)
      .toArray();

    if (unresolved.length === 0) return 0;

    for (const link of unresolved) {
      if (link.id) {
        await db.links.update(link.id, { targetId: noteId });
      }
    }

    return unresolved.length;
  },

  /**
   * Fetches incoming backlinks for a given note.
   */
  async getBacklinks(noteId: number): Promise<BacklinkItem[]> {
    const links = await db.links
      .where('targetId')
      .equals(noteId)
      .toArray();

    const results: BacklinkItem[] = [];
    for (const link of links) {
      const source = await db.notes.get(link.sourceId);
      if (source && source.trashedAt === null) {
        results.push({ link, sourceNote: source });
      }
    }

    return results;
  },

  /**
   * Fetches unresolved links where targetTitle matches the provided title.
   */
  async getUnresolvedBacklinksForTitle(title: string): Promise<BacklinkItem[]> {
    const norm = normalizeTitle(title);
    if (!norm) return [];

    const links = await db.links
      .filter((l) => l.targetId === null && normalizeTitle(l.targetTitle) === norm)
      .toArray();

    const results: BacklinkItem[] = [];
    for (const link of links) {
      const source = await db.notes.get(link.sourceId);
      if (source && source.trashedAt === null) {
        results.push({ link, sourceNote: source });
      }
    }

    return results;
  },

  /**
   * Fetches outgoing links from a given note.
   */
  async getOutgoingLinks(noteId: number): Promise<OutgoingLinkItem[]> {
    const links = await db.links
      .where('sourceId')
      .equals(noteId)
      .toArray();

    const results: OutgoingLinkItem[] = [];
    for (const link of links) {
      let targetNote: Note | undefined = undefined;
      if (typeof link.targetId === 'number') {
        targetNote = await db.notes.get(link.targetId);
        if (targetNote?.trashedAt !== null) {
          targetNote = undefined;
        }
      }
      results.push({ link, targetNote });
    }

    return results;
  },

  /**
   * Fetches graph dataset: all active notes + all resolved links.
   */
  
  async getAllLinksForExport(): Promise<NoteLink[]> {
    return db.links.toArray();
  },

  async deleteAllLinks(): Promise<void> {
    await db.links.clear();
  },

  async getAllGraphData(): Promise<{ notes: Note[]; links: NoteLink[] }> {
    const notes = await db.notes
      .filter((n) => n.trashedAt === null)
      .toArray();

    const links = await db.links
      .filter((l) => l.targetId !== null)
      .toArray();

    return { notes, links };
  },
};

/**
 * Reactive hook for incoming backlinks to a note.
 */
export function useBacklinks(noteId?: number): BacklinkItem[] | undefined {
  return useLiveQuery(
    () => (typeof noteId === 'number' ? linksRepo.getBacklinks(noteId) : Promise.resolve([])),
    [noteId]
  );
}

/**
 * Reactive hook for unresolved incoming links targeting a note title.
 */
export function useUnresolvedBacklinks(title?: string): BacklinkItem[] | undefined {
  return useLiveQuery(
    () => (title ? linksRepo.getUnresolvedBacklinksForTitle(title) : Promise.resolve([])),
    [title]
  );
}

/**
 * Reactive hook for outgoing links from a note.
 */
export function useOutgoingLinks(noteId?: number): OutgoingLinkItem[] | undefined {
  return useLiveQuery(
    () => (typeof noteId === 'number' ? linksRepo.getOutgoingLinks(noteId) : Promise.resolve([])),
    [noteId]
  );
}

/**
 * Reactive hook for entire graph dataset.
 */
export function useAllGraphData(): { notes: Note[]; links: NoteLink[] } | undefined {
  return useLiveQuery(() => linksRepo.getAllGraphData());
}
