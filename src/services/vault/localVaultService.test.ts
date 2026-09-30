import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { localVaultService } from './localVaultService';
import { db } from '../../db/database';
import JSZip from 'jszip';

describe('localVaultService', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(async () => {
    mockStore = {};
    const mockLocalStorage = {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStore[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    };
    (globalThis as any).localStorage = mockLocalStorage;
    if (typeof window !== 'undefined') {
      (window as any).localStorage = mockLocalStorage;
    }

    // Clear db tables used
    await db.notes.clear();
    await db.folders.clear();
    await db.canvases.clear();
  });

  it('returns default vault metadata when none is saved', () => {
    const active = localVaultService.getActiveVault();
    expect(active.name).toBe('Default Vault');
    expect(active.isLinked).toBe(false);
  });

  it('saves and unlinks active vault metadata', () => {
    localVaultService.saveActiveVault({
      name: 'Test Vault',
      isLinked: true,
      fileCount: 5,
      folderCount: 2,
    });
    expect(localVaultService.getActiveVault().name).toBe('Test Vault');
    expect(localVaultService.getActiveVault().isLinked).toBe(true);

    localVaultService.unlinkVault();
    expect(localVaultService.getActiveVault().name).toBe('Default Vault');
    expect(localVaultService.getActiveVault().isLinked).toBe(false);
  });

  it('extracts hashtags from markdown content', () => {
    const text = `# Welcome Note\nThis is a note with #work and #project/v1 tags. Also #idea!`;
    const tags = localVaultService.extractTagsFromContent(text);
    expect(tags).toContain('work');
    expect(tags).toContain('project/v1');
    expect(tags).toContain('idea');
  });

  it('imports files into vault with directory paths', async () => {
    const file1 = new File(['# Meeting Notes\nDiscussion about #roadmap'], 'meeting.md', {
      type: 'text/markdown',
    });
    Object.defineProperty(file1, 'webkitRelativePath', {
      value: 'MyVault/Work/meeting.md',
    });

    const file2 = new File(['# Quick Idea\nJust a test note'], 'idea.txt', {
      type: 'text/plain',
    });
    Object.defineProperty(file2, 'webkitRelativePath', {
      value: 'MyVault/Personal/idea.txt',
    });

    const result = await localVaultService.importFilesIntoVault([file1, file2]);
    expect(result.notesCount).toBe(2);
    expect(result.vaultName).toBe('MyVault');

    const notes = await db.notes.toArray();
    expect(notes.length).toBe(2);

    const meetingNote = notes.find((n) => n.title === 'meeting');
    expect(meetingNote).toBeDefined();
    expect(meetingNote?.tags).toContain('roadmap');

    const folders = await db.folders.toArray();
    expect(folders.some((f) => f.name === 'MyVault')).toBe(true);
    expect(folders.some((f) => f.name === 'Work')).toBe(true);
    expect(folders.some((f) => f.name === 'Personal')).toBe(true);
  });

  it('imports a ZIP archive of a vault preserving folder structure', async () => {
    const zip = new JSZip();
    zip.file('ObsidianVault/Daily/2026-09-28.md', '# Today\nDid some coding #journal');
    zip.file('ObsidianVault/Projects/NotesApp.md', '# Notes App\nLocal vault support completed #build');
    zip.file('ObsidianVault/readme.txt', 'Root level vault information');

    const blob = await zip.generateAsync({ type: 'blob' });
    const zipFile = new File([blob], 'ObsidianVault.zip', { type: 'application/zip' });

    const result = await localVaultService.importZipIntoVault(zipFile);
    expect(result.success).toBe(true);
    expect(result.vault?.name).toBe('ObsidianVault');
    expect(result.vault?.fileCount).toBe(3);

    const notes = await db.notes.toArray();
    expect(notes.length).toBe(3);

    const dailyNote = notes.find((n) => n.title === '2026-09-28');
    expect(dailyNote).toBeDefined();
    expect(dailyNote?.tags).toContain('journal');

    const projectNote = notes.find((n) => n.title === 'NotesApp');
    expect(projectNote).toBeDefined();
    expect(projectNote?.tags).toContain('build');
  });

  it('creates an app-managed vault successfully', async () => {
    const res = await localVaultService.createAppManagedVault('Custom Notes');
    expect(res.success).toBe(true);
    expect(res.vault.name).toBe('Custom Notes');
    expect(res.vault.storageType).toBe('app-managed');

    const active = localVaultService.getActiveVault();
    expect(active.name).toBe('Custom Notes');
    expect(active.isLinked).toBe(true);
  });

  it('imports Obsidian drawing and canvas files into native Canvas entities and linked notes', async () => {
    const zip = new JSZip();
    // 1. Regular note
    zip.file('MyObsidian/Ideas/Overview.md', '# Ideas\nSome thoughts');
    // 2. Obsidian Canvas file
    const canvasContent = JSON.stringify({
      nodes: [
        { id: '1', type: 'text', text: 'Canvas Node', x: 100, y: 100, width: 200, height: 100 },
      ],
      edges: [],
    });
    zip.file('MyObsidian/Drawings/SystemDiagram.canvas', canvasContent);
    // 3. Obsidian Excalidraw file
    const excalidrawContent = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [
        {
          id: 'stroke_1',
          type: 'freedraw',
          x: 50,
          y: 50,
          points: [[0, 0], [10, 10], [20, 20]],
        },
      ],
    });
    zip.file('MyObsidian/Drawings/Architecture.excalidraw.md', excalidrawContent);

    const blob = await zip.generateAsync({ type: 'blob' });
    const zipFile = new File([blob], 'MyObsidian.zip', { type: 'application/zip' });

    const result = await localVaultService.importZipIntoVault(zipFile);
    expect(result.success).toBe(true);
    expect(result.vault?.fileCount).toBe(3);

    // Verify notes table
    const notes = await db.notes.toArray();
    expect(notes.length).toBe(3);

    const canvasNote = notes.find((n) => n.title === 'SystemDiagram');
    expect(canvasNote).toBeDefined();
    expect(canvasNote?.tags).toContain('canvas');
    expect(canvasNote?.tags).toContain('drawing');

    const excalidrawNote = notes.find((n) => n.title === 'Architecture');
    expect(excalidrawNote).toBeDefined();
    expect(excalidrawNote?.tags).toContain('canvas');
    expect(excalidrawNote?.tags).toContain('drawing');

    // Verify canvases table
    const canvases = await db.canvases.toArray();
    expect(canvases.length).toBe(2);

    const systemCanvas = canvases.find((c) => c.title === 'SystemDiagram');
    expect(systemCanvas).toBeDefined();
    expect(systemCanvas?.linkedNoteId).toBe(canvasNote?.id);
    expect(systemCanvas?.doc.strokes.length).toBeGreaterThan(0);

    const archCanvas = canvases.find((c) => c.title === 'Architecture');
    expect(archCanvas).toBeDefined();
    expect(archCanvas?.linkedNoteId).toBe(excalidrawNote?.id);
    expect(archCanvas?.doc.strokes.length).toBeGreaterThan(0);
  });

  it('manages multiple vaults list, switching, and removal like Obsidian', async () => {
    // 1. Create two vaults
    await localVaultService.createAppManagedVault('Work Vault');
    await localVaultService.createAppManagedVault('Personal Vault');

    // 2. Verify both vaults are in the list
    const list = localVaultService.getVaultList();
    expect(list.some((v) => v.name === 'Work Vault')).toBe(true);
    expect(list.some((v) => v.name === 'Personal Vault')).toBe(true);
    expect(localVaultService.getActiveVault().name).toBe('Personal Vault');

    // 3. Switch back to Work Vault
    const switchRes = await localVaultService.switchVault('Work Vault');
    expect(switchRes.success).toBe(true);
    expect(localVaultService.getActiveVault().name).toBe('Work Vault');

    // 4. Remove Personal Vault from list
    localVaultService.removeVaultFromList('Personal Vault');
    const updatedList = localVaultService.getVaultList();
    expect(updatedList.some((v) => v.name === 'Personal Vault')).toBe(false);
    expect(localVaultService.getActiveVault().name).toBe('Work Vault');
  });

  it('collects errors and surfaces failure count when individual files fail', async () => {
    const validFile = new File(['# Good Note\nValid content'], 'good.md', { type: 'text/markdown' });
    const brokenFile = new File([''], 'broken.md', { type: 'text/markdown' });
    // Mock brokenFile.text() to reject
    brokenFile.text = () => Promise.reject(new Error('Simulated I/O disk error'));

    const res = await localVaultService.importFileList([validFile, brokenFile], 'PartialVault');

    expect(res.success).toBe(true);
    expect(res.failuresCount).toBe(1);
    expect(res.errors.length).toBe(1);
    expect(res.errors[0].file).toBe('broken.md');
    expect(res.errors[0].error).toContain('Simulated I/O disk error');
    expect(res.message).toContain('1 failed');
  });

  it('returns success: false when all files in import fail', async () => {
    const brokenFile1 = new File([''], 'bad1.md', { type: 'text/markdown' });
    brokenFile1.text = () => Promise.reject(new Error('Read error 1'));

    const brokenFile2 = new File([''], 'bad2.md', { type: 'text/markdown' });
    brokenFile2.text = () => Promise.reject(new Error('Read error 2'));

    const res = await localVaultService.importFileList([brokenFile1, brokenFile2], 'FailedVault');

    expect(res.success).toBe(false);
    expect(res.failuresCount).toBe(2);
    expect(res.errors.length).toBe(2);
    expect(res.message).toContain('all 2 file(s) failed');
  });
});

