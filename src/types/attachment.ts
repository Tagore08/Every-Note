export type AttachmentKind = 'image' | 'file' | 'link';

export interface Attachment {
  id?: number;
  noteId: number;
  ownerType?: 'note' | 'task' | 'event'; // Generalized owner entity for future extensibility (defaults to 'note')
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size: number; // in bytes (0 for links)
  createdAt: Date;
  data?: Blob;  // Native IndexedDB Blob storage (for image and file kinds)
  url?: string; // Stored URL for links
}
