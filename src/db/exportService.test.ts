import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from './database';
import {
  buildFullBackupEnvelope,
  blobToBase64,
  base64ToBlob,
} from './exportService';
import type { Note } from '../types/note';
import type { Task } from '../types/task';
import type { Folder } from '../types/folder';
import type { Snippet } from '../types/snippet';
import type { StickyNote } from '../types/sticky';

describe('Export Service & Backup Envelope Engine', () => {
  beforeEach(async () => {
    await db.notes.clear();
    await db.folders.clear();
    await db.tasks.clear();
    await db.events.clear();
    await db.people.clear();
    await db.habits.clear();
    await db.habitLogs.clear();
    await db.focusSessions.clear();
    await db.attachments.clear();
    await db.templates.clear();
    await db.links.clear();
    await db.routines.clear();
    await db.routineRuns.clear();
    await db.canvases.clear();
    await db.timerPresets.clear();
    await db.snippets.clear();
    await db.stickyNotes.clear();
  });

  describe('buildFullBackupEnvelope', () => {
    it('queries all Dexie tables and constructs a specification-compliant v18 BackupEnvelope', async () => {
      // 1. Seed database records
      const sampleFolder: Folder = {
        name: 'Architecture',
        parentId: null,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const folderId = await db.folders.add(sampleFolder);

      const sampleNote: Note = {
        title: 'Project Roadmap',
        content: 'System architecture diagram and roadmap.',
        tags: ['planning', 'arch'],
        pinned: true,
        archived: false,
        trashedAt: null,
        inbox: false,
        folderId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.notes.add(sampleNote);

      const sampleTask: Task = {
        title: 'Complete Stage 5',
        status: 'todo',
        priority: 'high',
        dueAt: new Date(),
        completedAt: null,
        parentTaskId: null,
        routineRunId: null,
        importance: true,
        urgency: true,
        tags: ['qa', 'build'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.tasks.add(sampleTask);

      const sampleSnippet: Snippet = {
        trigger: '#addr',
        expansion: '100 Innovation Way',
        tags: ['work'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.snippets.add(sampleSnippet);

      const sampleSticky: StickyNote = {
        x: 50,
        y: 80,
        width: 200,
        height: 180,
        color: 'yellow',
        content: 'Remember to verify tests',
        zIndex: 1,
        showTimestamp: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.stickyNotes.add(sampleSticky);

      // 2. Build envelope
      const envelope = await buildFullBackupEnvelope();

      // 3. Verify envelope metadata and table contents
      expect(envelope.version).toBe(18);
      expect(envelope.app).toBe('notes-app');
      expect(envelope.exportedAt).toBeDefined();

      expect(envelope.folders).toHaveLength(1);
      expect(envelope.folders![0].name).toBe('Architecture');

      expect(envelope.notes).toHaveLength(1);
      expect(envelope.notes[0].title).toBe('Project Roadmap');
      expect(envelope.notes[0].pinned).toBe(true);

      expect(envelope.tasks).toHaveLength(1);
      expect(envelope.tasks![0].title).toBe('Complete Stage 5');
      expect(envelope.tasks![0].priority).toBe('high');

      expect(envelope.snippets).toHaveLength(1);
      expect(envelope.snippets![0].trigger).toBe('#addr');

      expect(envelope.stickyNotes).toHaveLength(1);
      expect(envelope.stickyNotes![0].content).toBe('Remember to verify tests');

      expect(envelope.settings?.flags?.canvas).toBe(true);
      expect(envelope.settings?.flags?.journal).toBe(true);
    });
  });

  describe('Binary Blob <-> Base64 Serialization', () => {
    it('performs lossless round-trip serialization between Blob and Base64', async () => {
      const originalText = 'Hello binary world! 🚀 12345';
      const originalBlob = new Blob([originalText], { type: 'text/plain' });

      // Convert Blob to Base64
      const base64 = await blobToBase64(originalBlob);
      expect(typeof base64).toBe('string');
      expect(base64.startsWith('data:text/plain;base64,')).toBe(true);

      // Convert Base64 back to Blob
      const restoredBlob = base64ToBlob(base64, 'text/plain');
      expect(restoredBlob).toBeInstanceOf(Blob);
      expect(restoredBlob.type).toBe('text/plain');

      // Verify reconstructed text matches original
      const restoredText = await restoredBlob.text();
      expect(restoredText).toBe(originalText);
    });

    it('handles malformed base64 strings gracefully without throwing', () => {
      const invalidBase64 = '@@@invalid-not-base64@@@';
      const fallbackBlob = base64ToBlob(invalidBase64, 'application/octet-stream');
      expect(fallbackBlob).toBeInstanceOf(Blob);
      expect(fallbackBlob.size).toBe(0);
    });
  });
});
