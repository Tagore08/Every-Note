import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import type { Attachment, AttachmentKind } from '../types/attachment';

export const attachmentsRepo = {
  /**
   * Requests persistent browser storage to prevent eviction under storage pressure.
   */
  async requestPersistentStorage(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
      try {
        return await navigator.storage.persist();
      } catch (err) {
        console.warn('Persistent storage request failed:', err);
      }
    }
    return false;
  },

  /**
   * Retrieves estimated storage quota, used bytes, and persistence status.
   */
  async getStorageEstimate(): Promise<{ usedBytes: number; quotaBytes: number; isPersisted: boolean }> {
    let usedBytes = 0;
    let quotaBytes = 0;
    let isPersisted = false;

    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (navigator.storage.estimate) {
        try {
          const estimate = await navigator.storage.estimate();
          usedBytes = estimate.usage ?? 0;
          quotaBytes = estimate.quota ?? 0;
        } catch (err) {
          console.warn('Storage estimate failed:', err);
        }
      }

      if (navigator.storage.persisted) {
        try {
          isPersisted = await navigator.storage.persisted();
        } catch {
          // Ignore
        }
      }
    }

    return { usedBytes, quotaBytes, isPersisted };
  },

  /**
   * Adds a file or image attachment directly to IndexedDB as a Blob.
   * Auto-requests persistent storage on creation.
   */
  async addFileAttachment(noteId: number, file: File): Promise<Attachment> {
    // Attempt persistent storage request on first attachment
    await this.requestPersistentStorage();

    const lowerName = file.name.toLowerCase();
    const isHeic =
      lowerName.endsWith('.heic') ||
      lowerName.endsWith('.heif') ||
      file.type === 'image/heic' ||
      file.type === 'image/heif';

    // HEIC is categorized as generic file (no thumbnail preview) per requirement
    const isImage = !isHeic && (file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|svg)$/i.test(file.name));
    const kind: AttachmentKind = isImage ? 'image' : 'file';

    const attachment: Attachment = {
      noteId,
      ownerType: 'note',
      kind,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: new Date(),
      data: file, // Store Blob directly in Dexie
    };

    const id = await db.attachments.add(attachment);
    return { ...attachment, id: id as number };
  },

  /**
   * Adds a generic Blob attachment (e.g. recorded audio, canvas snapshot)
   */
  async addBlobAttachment(
    noteId: number,
    blob: Blob,
    filename: string,
    mimeType: string,
    kind: AttachmentKind = 'file'
  ): Promise<Attachment> {
    await this.requestPersistentStorage();

    const attachment: Attachment = {
      noteId,
      ownerType: 'note',
      kind,
      name: filename,
      mimeType,
      size: blob.size,
      createdAt: new Date(),
      data: blob,
    };

    const id = await db.attachments.add(attachment);
    return { ...attachment, id: id as number };
  },

  /**
   * Adds a pure link attachment (URL + title) with zero remote fetching.
   */
  async addLinkAttachment(noteId: number, rawUrl: string, customTitle?: string): Promise<Attachment> {
    // Attempt persistent storage request on first attachment
    await this.requestPersistentStorage();

    let cleanUrl = rawUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    let derivedTitle = customTitle?.trim();
    if (!derivedTitle) {
      try {
        const parsed = new URL(cleanUrl);
        derivedTitle = parsed.hostname + (parsed.pathname !== '/' ? parsed.pathname : '');
      } catch {
        derivedTitle = cleanUrl;
      }
    }

    const attachment: Attachment = {
      noteId,
      ownerType: 'note',
      kind: 'link',
      name: derivedTitle,
      url: cleanUrl,
      mimeType: 'text/uri-list',
      size: 0,
      createdAt: new Date(),
    };

    const id = await db.attachments.add(attachment);
    return { ...attachment, id: id as number };
  },

  /**
   * Fetch all attachments for a specific note.
   */
  async getAttachmentsForNote(noteId: number): Promise<Attachment[]> {
    return await db.attachments
      .where('noteId')
      .equals(noteId)
      .sortBy('createdAt');
  },

  /**
   * Deletes a single attachment by ID.
   */
  async deleteAttachment(id: number): Promise<void> {
    await db.attachments.delete(id);
  },

  /**
   * Deletes all attachments belonging to a specific note.
   */
  async deleteAttachmentsByNoteId(noteId: number): Promise<void> {
    await db.attachments.where('noteId').equals(noteId).delete();
  },

  /**
   * Retrieves all attachments across all notes for JSON backup export.
   */
  async getAllAttachmentsForExport(): Promise<Attachment[]> {
    return await db.attachments.toArray();
  },

  /**
   * Imports attachments, replacing or merging.
   */
  async importAttachments(
    attachments: Attachment[],
    strategy: 'merge' | 'replace'
  ): Promise<number> {
    await this.requestPersistentStorage();

    if (strategy === 'replace') {
      await db.attachments.clear();
      if (attachments.length > 0) {
        await db.attachments.bulkAdd(attachments);
      }
      return attachments.length;
    }

    // Merge strategy
    let imported = 0;
    for (const att of attachments) {
      if (typeof att.id === 'number') {
        const existing = await db.attachments.get(att.id);
        if (existing) {
          if (new Date(att.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
            await db.attachments.put(att);
            imported++;
          }
        } else {
          await db.attachments.put(att);
          imported++;
        }
      } else {
        await db.attachments.add(att);
        imported++;
      }
    }
    return imported;
  },

  /**
   * Completely purges all attachments.
   */
  async deleteAllAttachments(): Promise<void> {
    await db.attachments.clear();
  },
};

/**
 * Reactive hook for live-updating note attachments.
 */
export function useAttachments(noteId: number | null | undefined): Attachment[] | undefined {
  return useLiveQuery(async () => {
    if (typeof noteId !== 'number' || isNaN(noteId)) return [];
    return await attachmentsRepo.getAttachmentsForNote(noteId);
  }, [noteId]);
}
