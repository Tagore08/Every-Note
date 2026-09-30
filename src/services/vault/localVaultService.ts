import { db } from '../../db/database';
import { foldersRepo } from '../../db/repos/foldersRepo';
import { notesRepo } from '../../db/notesRepo';
import { linksRepo } from '../../db/repos/linksRepo';
import { canvasRepo } from '../../db/repos/canvasRepo';
import { getStoredFlags, saveFlags } from '../../app/flags';
import { isDrawingFile, cleanDrawingTitle, parseDrawingToCanvasDoc } from './drawingConverter';
import { Capacitor } from '@capacitor/core';
import JSZip from 'jszip';
import { extractTagsFromText } from '../../lib/tags';

export interface LocalVaultMetadata {
  id?: string;
  name: string;
  isLinked: boolean;
  linkedAt?: string;
  lastSyncedAt?: string;
  lastOpenedAt?: string;
  fileCount: number;
  folderCount: number;
  rootPath?: string;
  storageType?: 'filesystem' | 'app-managed';
  folderId?: number;
}

const VAULT_STORAGE_KEY = 'notes_active_local_vault';
const VAULTS_LIST_KEY = 'notes_vault_list';

function isSupportedVaultFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith('.md') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.markdown') ||
    lower.endsWith('.canvas') ||
    lower.endsWith('.excalidraw') ||
    lower.endsWith('.excalidraw.md') ||
    lower.endsWith('.drawing') ||
    lower.endsWith('.drawing.md') ||
    lower.endsWith('.ink')
  );
}

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      return window.localStorage.getItem(key);
    }
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch {
    return null;
  }
  return null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
      window.localStorage.setItem(key, value);
      return;
    }
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
      return;
    }
  } catch {
    // ignore
  }
}

// In-memory directory handle reference for current session (File System Access API)
let currentDirHandle: any = null;

export const localVaultService = {
  /**
   * Check if running inside mobile or Capacitor environment
   */
  isNativeOrMobile(): boolean {
    if (typeof window === 'undefined') return false;
    if (Capacitor.isNativePlatform()) return true;
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  },

  /**
   * Check if File System Access API is supported (desktop Chromium browsers only)
   */
  isFileSystemSupported(): boolean {
    if (typeof window === 'undefined') return false;
    if (this.isNativeOrMobile()) return false;
    return typeof (window as any).showDirectoryPicker === 'function';
  },

  /**
   * Get metadata for the currently active vault
   */
  getActiveVault(): LocalVaultMetadata {
    const raw = safeGetItem(VAULT_STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // fallback
      }
    }
    return {
      name: 'Default Vault',
      isLinked: false,
      fileCount: 0,
      folderCount: 0,
    };
  },

  /**
   * Save active vault metadata and automatically register in vault list
   */
  saveActiveVault(meta: LocalVaultMetadata): void {
    safeSetItem(VAULT_STORAGE_KEY, JSON.stringify(meta));
    this.upsertVaultInList(meta);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vault-changed', { detail: meta }));
    }
  },

  /**
   * Get all registered vaults in the system
   */
  getVaultList(): LocalVaultMetadata[] {
    const raw = safeGetItem(VAULTS_LIST_KEY);
    let list: LocalVaultMetadata[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }

    const active = this.getActiveVault();
    if (!Array.isArray(list) || list.length === 0) {
      list = [
        {
          name: 'Default Vault',
          isLinked: false,
          fileCount: 0,
          folderCount: 0,
          lastOpenedAt: new Date().toISOString(),
          storageType: 'app-managed',
        },
      ];
    }

    // Ensure active vault is present in the list
    if (active && active.name && !list.some((v) => v.name.toLowerCase() === active.name.toLowerCase())) {
      list.unshift(active);
    }

    return list;
  },

  /**
   * Save vault list to local storage and broadcast event
   */
  saveVaultList(list: LocalVaultMetadata[]): void {
    safeSetItem(VAULTS_LIST_KEY, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vault-list-changed', { detail: list }));
    }
  },

  /**
   * Insert or update vault in vault list
   */
  upsertVaultInList(vault: LocalVaultMetadata): void {
    const raw = safeGetItem(VAULTS_LIST_KEY);
    let list: LocalVaultMetadata[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }
    if (!Array.isArray(list)) list = [];

    const updated: LocalVaultMetadata = {
      ...vault,
      lastOpenedAt: vault.lastOpenedAt || new Date().toISOString(),
    };

    const idx = list.findIndex((v) => v.name.toLowerCase() === vault.name.toLowerCase());
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updated };
    } else {
      list.unshift(updated);
    }

    this.saveVaultList(list);
  },

  /**
   * Switch the active workspace to another vault (like Obsidian vault switcher)
   */
  async switchVault(vaultName: string): Promise<{ success: boolean; message: string; vault: LocalVaultMetadata }> {
    const list = this.getVaultList();
    let target = list.find((v) => v.name.toLowerCase() === vaultName.toLowerCase());

    if (!target) {
      if (vaultName.toLowerCase() === 'default vault') {
        target = {
          name: 'Default Vault',
          isLinked: false,
          fileCount: 0,
          folderCount: 0,
          lastOpenedAt: new Date().toISOString(),
          storageType: 'app-managed',
        };
      } else {
        return {
          success: false,
          message: `Vault "${vaultName}" not found.`,
          vault: this.getActiveVault(),
        };
      }
    }

    // Query folder ID and active notes count for this vault
    let fileCount = target.fileCount;
    let folderId = target.folderId;
    try {
      const folder = await db.folders
        .filter((f) => f.name.toLowerCase() === target!.name.toLowerCase() && !f.parentId)
        .first();
      if (folder && folder.id) {
        folderId = folder.id;
        fileCount = await db.notes
          .filter((n) => n.folderId === folder.id && n.trashedAt === null)
          .count();
      }
    } catch {
      // ignore
    }

    const updatedTarget: LocalVaultMetadata = {
      ...target,
      fileCount,
      folderId,
      lastOpenedAt: new Date().toISOString(),
    };

    safeSetItem(VAULT_STORAGE_KEY, JSON.stringify(updatedTarget));
    this.upsertVaultInList(updatedTarget);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vault-changed', { detail: updatedTarget }));
    }

    await linksRepo.reindexAllLinks().catch(() => {});

    return {
      success: true,
      message: `Active vault switched to "${updatedTarget.name}".`,
      vault: updatedTarget,
    };
  },

  /**
   * Remove a vault from the vault switcher list
   */
  removeVaultFromList(vaultName: string): void {
    let list = this.getVaultList();
    list = list.filter((v) => v.name.toLowerCase() !== vaultName.toLowerCase());
    this.saveVaultList(list);

    const active = this.getActiveVault();
    if (active.name.toLowerCase() === vaultName.toLowerCase()) {
      this.switchVault('Default Vault');
    }
  },

  /**
   * Unlink currently linked local folder vault
   */
  unlinkVault(): void {
    currentDirHandle = null;
    this.saveActiveVault({
      name: 'Default Vault',
      isLinked: false,
      fileCount: 0,
      folderCount: 0,
    });
  },

  /**
   * Unified processor to save an imported file as a Note and/or Canvas drawing.
   */
  async saveFileToNoteOrCanvas(
    fileName: string,
    text: string,
    targetFolderId: number
  ): Promise<{ isDrawing: boolean; isNew: boolean }> {
    const isDrawing = isDrawingFile(fileName, text);
    const cleanTitle = isDrawing
      ? cleanDrawingTitle(fileName)
      : fileName.replace(/\.(md|txt|markdown)$/i, '');
    const tags = this.extractTagsFromContent(text);
    if (isDrawing) {
      if (!tags.includes('drawing')) tags.push('drawing');
      if (!tags.includes('canvas')) tags.push('canvas');
    }

    const existing = await db.notes
      .filter(
        (n) =>
          n.title.toLowerCase() === cleanTitle.toLowerCase() &&
          n.folderId === targetFolderId &&
          n.trashedAt === null
      )
      .first();

    let noteId: number;
    let isNew = false;

    if (isDrawing) {
      // 1. Parse Drawing into CanvasDoc
      const canvasDoc = parseDrawingToCanvasDoc(text, fileName);
      let existingCanvas = existing?.id
        ? (await canvasRepo.getCanvasesForNote(existing.id))[0]
        : undefined;

      if (existingCanvas && existingCanvas.id) {
        await canvasRepo.updateCanvasDoc(existingCanvas.id, canvasDoc);
      } else {
        const createdCanvas = await canvasRepo.createCanvas({
          title: cleanTitle,
          doc: canvasDoc,
          tags,
          linkedNoteId: existing?.id ?? null,
        });
        existingCanvas = createdCanvas;
      }

      // Automatically enable canvas feature flag
      try {
        const currentFlags = getStoredFlags();
        if (!currentFlags.canvas) {
          saveFlags({ ...currentFlags, canvas: true });
        }
      } catch {
        // Ignore
      }

      const drawingNoteContent =
        text.includes('```json') ||
        text.includes('excalidraw-plugin') ||
        fileName.toLowerCase().endsWith('.canvas')
          ? `# ${cleanTitle}\n\n> [!NOTE] 🎨 Obsidian Drawing Canvas\n> This note is an interactive drawing canvas with **${canvasDoc.strokes.length} strokes**.\n> [Click to open in Drawing Canvas](/canvas/${existingCanvas?.id})\n`
          : text;

      if (existing && existing.id) {
        noteId = existing.id;
        await notesRepo.updateNote(existing.id, {
          content: drawingNoteContent,
          tags: Array.from(new Set([...existing.tags, ...tags])),
        });
      } else {
        const created = await notesRepo.createNote({
          title: cleanTitle,
          content: drawingNoteContent,
          folderId: targetFolderId,
          tags,
          inbox: false,
          pinned: false,
          archived: false,
        });
        noteId = created.id!;
        isNew = true;
      }

      if (
        existingCanvas &&
        existingCanvas.id &&
        (!existingCanvas.linkedNoteId || existingCanvas.linkedNoteId !== noteId)
      ) {
        await canvasRepo.updateCanvasMetadata(existingCanvas.id, { linkedNoteId: noteId });
      }
    } else {
      // Standard markdown note
      if (existing && existing.id) {
        noteId = existing.id;
        await notesRepo.updateNote(existing.id, {
          content: text,
          tags: Array.from(new Set([...existing.tags, ...tags])),
        });
      } else {
        const created = await notesRepo.createNote({
          title: cleanTitle,
          content: text,
          folderId: targetFolderId,
          tags,
          inbox: false,
          pinned: false,
          archived: false,
        });
        noteId = created.id!;
        isNew = true;
      }
    }

    return { isDrawing, isNew };
  },

  /**
   * Import a ZIP archive of a vault or folder into Dexie DB.
   * Preserves full subfolder hierarchies and extracts markdown notes + Obsidian drawings.
   */
  async importZipIntoVault(
    zipBlob: Blob | File,
    customVaultName?: string
  ): Promise<{
    success: boolean;
    message: string;
    vault?: LocalVaultMetadata;
    failuresCount?: number;
    errors?: { file: string; error: string }[];
  }> {
    const zip = await JSZip.loadAsync(zipBlob);

    // 1. Determine suitable vault name
    let vaultName = customVaultName?.trim() || '';
    if (!vaultName && (zipBlob as File).name) {
      vaultName = (zipBlob as File).name.replace(/\.zip$/i, '').trim();
    }

    const allPaths = Object.keys(zip.files).filter(
      (p) => !p.startsWith('__MACOSX') && !p.startsWith('.') && !p.includes('/.')
    );

    if (!vaultName || vaultName.toLowerCase() === 'archive' || vaultName.toLowerCase() === 'vault') {
      if (allPaths.length > 0) {
        const firstParts = allPaths.map((p) => p.split('/')[0]).filter(Boolean);
        const uniqueRoots = Array.from(new Set(firstParts));
        if (uniqueRoots.length === 1 && uniqueRoots[0]) {
          vaultName = uniqueRoots[0];
        }
      }
    }

    if (!vaultName) {
      vaultName = 'Imported Vault';
    }

    // 2. Ensure or find top-level vault folder
    let vaultFolder = await db.folders
      .filter((f) => f.name.toLowerCase() === vaultName.toLowerCase() && !f.parentId)
      .first();

    if (!vaultFolder) {
      vaultFolder = await foldersRepo.createFolder(vaultName, null);
    }

    const folderMap = new Map<string, number>();
    folderMap.set('', vaultFolder.id as number);

    let notesCount = 0;
    let foldersCount = 0;
    let failuresCount = 0;
    const errors: { file: string; error: string }[] = [];

    const fileEntries = Object.entries(zip.files);

    for (const [rawPath, entry] of fileEntries) {
      // Skip macOS metadata and hidden entries (.git, .obsidian, .trash)
      if (rawPath.startsWith('__MACOSX/') || rawPath.startsWith('.') || rawPath.includes('/.')) {
        continue;
      }

      const pathParts = rawPath.split('/').filter(Boolean);
      if (pathParts.length === 0) continue;

      // If root path segment equals vaultName, strip it so we don't duplicate the root folder
      let relativeParts = pathParts;
      if (pathParts[0].toLowerCase() === vaultName.toLowerCase()) {
        relativeParts = pathParts.slice(1);
      }

      if (entry.dir) {
        if (relativeParts.length > 0) {
          let currentParentId = vaultFolder.id as number;
          let currentPath = '';
          for (let i = 0; i < relativeParts.length; i++) {
            const folderName = relativeParts[i];
            currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            if (folderMap.has(currentPath)) {
              currentParentId = folderMap.get(currentPath)!;
            } else {
              let sub = await db.folders
                .filter((f) => f.name === folderName && f.parentId === currentParentId)
                .first();
              if (!sub) {
                sub = await foldersRepo.createFolder(folderName, currentParentId);
                foldersCount++;
              }
              currentParentId = sub.id as number;
              folderMap.set(currentPath, currentParentId);
            }
          }
        }
        continue;
      }

      const fileName = relativeParts[relativeParts.length - 1];
      if (!fileName) continue;

      if (!isSupportedVaultFile(fileName)) {
        continue;
      }

      // Ensure intermediate subdirectories exist in Dexie
      let targetFolderId = vaultFolder.id as number;
      if (relativeParts.length > 1) {
        let currentParentId = vaultFolder.id as number;
        let currentPath = '';
        for (let i = 0; i < relativeParts.length - 1; i++) {
          const folderName = relativeParts[i];
          currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
          if (folderMap.has(currentPath)) {
            currentParentId = folderMap.get(currentPath)!;
          } else {
            let sub = await db.folders
              .filter((f) => f.name === folderName && f.parentId === currentParentId)
              .first();
            if (!sub) {
              sub = await foldersRepo.createFolder(folderName, currentParentId);
              foldersCount++;
            }
            currentParentId = sub.id as number;
            folderMap.set(currentPath, currentParentId);
          }
        }
        targetFolderId = currentParentId;
      }

      try {
        const text = await entry.async('string');
        await this.saveFileToNoteOrCanvas(fileName, text, targetFolderId);
        notesCount++;
      } catch (err: any) {
        failuresCount++;
        errors.push({ file: fileName, error: err?.message || String(err) });
        console.warn(`Failed to extract note ${fileName} from zip:`, err);
      }
    }

    const metadata: LocalVaultMetadata = {
      name: vaultName,
      isLinked: true,
      linkedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      fileCount: notesCount,
      folderCount: foldersCount + 1,
      rootPath: vaultName,
      storageType: 'app-managed',
    };

    this.saveActiveVault(metadata);
    await linksRepo.reindexAllLinks().catch(() => {});

    const hasFailures = failuresCount > 0;
    const isTotalFailure = notesCount === 0 && hasFailures;
    const success = !isTotalFailure;
    const message = isTotalFailure
      ? `Failed to import ZIP vault "${vaultName}": all ${failuresCount} file(s) failed.`
      : hasFailures
        ? `Imported ZIP vault "${vaultName}" with ${notesCount} notes (${failuresCount} failed) and ${foldersCount} folders.`
        : `Imported ZIP vault "${vaultName}" with ${notesCount} notes and ${foldersCount} folders.`;

    return {
      success,
      message,
      vault: metadata,
      failuresCount,
      errors,
    };
  },

  /**
   * Import files from webkitdirectory or file input into Dexie DB
   */
  async importFilesIntoVault(
    files: FileList | File[],
    customVaultName?: string
  ): Promise<{
    notesCount: number;
    foldersCount: number;
    vaultName: string;
    failuresCount: number;
    errors: { file: string; error: string }[];
  }> {
    const fileList = Array.from(files);

    // If a zip archive was supplied, route through the ZIP extractor
    const zipFile = fileList.find((f) => f.name.toLowerCase().endsWith('.zip'));
    if (zipFile) {
      const zipRes = await this.importZipIntoVault(zipFile, customVaultName);
      return {
        notesCount: zipRes.vault?.fileCount || 0,
        foldersCount: zipRes.vault?.folderCount || 0,
        vaultName: zipRes.vault?.name || 'Imported Vault',
        failuresCount: zipRes.failuresCount || 0,
        errors: zipRes.errors || [],
      };
    }

    let vaultName = customVaultName?.trim() || '';

    if (!vaultName) {
      for (const f of fileList) {
        const relPath = (f as any).webkitRelativePath;
        if (relPath) {
          const parts = relPath.split('/');
          if (parts.length > 1 && parts[0]) {
            vaultName = parts[0];
            break;
          }
        }
      }
    }

    if (!vaultName) {
      vaultName = this.isNativeOrMobile() ? 'Mobile Vault' : 'Imported Vault';
    }

    let vaultFolder = await db.folders
      .filter((f) => f.name.toLowerCase() === vaultName.toLowerCase() && !f.parentId)
      .first();

    if (!vaultFolder) {
      vaultFolder = await foldersRepo.createFolder(vaultName, null);
    }

    const folderMap = new Map<string, number>();
    folderMap.set('', vaultFolder.id as number);

    let notesCount = 0;
    let foldersCount = 0;
    let failuresCount = 0;
    const errors: { file: string; error: string }[] = [];

    for (const file of fileList) {
      if (!isSupportedVaultFile(file.name)) {
        continue;
      }

      let targetFolderId = vaultFolder.id as number;
      const relPath = (file as any).webkitRelativePath;
      if (relPath) {
        const parts = relPath.split('/').filter(Boolean);
        if (parts.length > 2) {
          let currentPath = '';
          let currentParentId = vaultFolder.id as number;
          for (let p = 1; p < parts.length - 1; p++) {
            const folderName = parts[p];
            currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            if (folderMap.has(currentPath)) {
              currentParentId = folderMap.get(currentPath)!;
            } else {
              let sub = await db.folders
                .filter((f) => f.name === folderName && f.parentId === currentParentId)
                .first();
              if (!sub) {
                sub = await foldersRepo.createFolder(folderName, currentParentId);
                foldersCount++;
              }
              currentParentId = sub.id as number;
              folderMap.set(currentPath, currentParentId);
            }
          }
          targetFolderId = currentParentId;
        }
      }

      try {
        const text = await file.text();
        await this.saveFileToNoteOrCanvas(file.name, text, targetFolderId);
        notesCount++;
      } catch (e: any) {
        failuresCount++;
        errors.push({ file: file.name, error: e?.message || String(e) });
        console.warn(`Failed to read file ${file.name}:`, e);
      }
    }

    return { notesCount, foldersCount, vaultName, failuresCount, errors };
  },

  /**
   * Helper to import a FileList or File[] and persist vault metadata
   */
  async importFileList(
    files: FileList | File[],
    customVaultName?: string
  ): Promise<{
    success: boolean;
    message: string;
    vault?: LocalVaultMetadata;
    failuresCount: number;
    errors: { file: string; error: string }[];
  }> {
    const res = await this.importFilesIntoVault(files, customVaultName);
    const metadata: LocalVaultMetadata = {
      name: res.vaultName,
      isLinked: true,
      linkedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      fileCount: res.notesCount,
      folderCount: res.foldersCount,
      rootPath: res.vaultName,
      storageType: 'app-managed',
    };
    this.saveActiveVault(metadata);
    await linksRepo.reindexAllLinks().catch(() => {});

    const hasFailures = res.failuresCount > 0;
    const isTotalFailure = res.notesCount === 0 && hasFailures;
    const success = !isTotalFailure;
    const message = isTotalFailure
      ? `Failed to import files into "${res.vaultName}": all ${res.failuresCount} file(s) failed.`
      : hasFailures
        ? `Linked vault "${res.vaultName}" with ${res.notesCount} notes (${res.failuresCount} failed) and ${res.foldersCount} folders.`
        : `Linked vault "${res.vaultName}" with ${res.notesCount} notes and ${res.foldersCount} folders.`;

    return {
      success,
      message,
      vault: metadata,
      failuresCount: res.failuresCount,
      errors: res.errors,
    };
  },

  /**
   * Create or link a safe custom app-managed storage vault in Dexie/IndexedDB
   */
  async createAppManagedVault(name = 'Mobile Vault'): Promise<{
    success: boolean;
    message: string;
    vault: LocalVaultMetadata;
  }> {
    let vaultFolder = await db.folders
      .filter((f) => f.name.toLowerCase() === name.toLowerCase() && !f.parentId)
      .first();

    if (!vaultFolder) {
      vaultFolder = await foldersRepo.createFolder(name, null);
    }

    const noteCount = await db.notes
      .filter((n) => n.folderId === vaultFolder!.id && n.trashedAt === null)
      .count();

    const metadata: LocalVaultMetadata = {
      name,
      isLinked: true,
      linkedAt: new Date().toISOString(),
      lastSyncedAt: new Date().toISOString(),
      fileCount: noteCount,
      folderCount: 1,
      rootPath: `/internal/${name}`,
      storageType: 'app-managed',
    };

    this.saveActiveVault(metadata);
    await linksRepo.reindexAllLinks().catch(() => {});

    return {
      success: true,
      message: `Active vault set to app-managed "${name}" (${noteCount} notes).`,
      vault: metadata,
    };
  },

  /**
   * Dedicated file picker for ZIP vault archives. Works smoothly on both mobile and laptop.
   */
  async openZipPicker(customVaultName?: string): Promise<{
    success: boolean;
    message: string;
    vault?: LocalVaultMetadata;
  }> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,application/zip,application/x-zip-compressed';
      let resolved = false;

      const cleanup = () => {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };

      input.onchange = async () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        const file = input.files?.[0];
        if (!file) {
          resolve({ success: false, message: 'No ZIP file selected.' });
          return;
        }
        try {
          const res = await this.importZipIntoVault(file, customVaultName);
          resolve(res);
        } catch (e: any) {
          resolve({ success: false, message: `Failed to import ZIP: ${e.message}` });
        }
      };

      input.oncancel = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ success: false, message: 'ZIP selection cancelled.' });
        }
      };

      input.style.display = 'none';
      document.body.appendChild(input);
      input.click();
    });
  },

  /**
   * Dedicated file picker for selecting multiple markdown/text/drawing files.
   * Fully supported across all mobile (Android, iOS) and laptop browsers.
   */
  async openFilesPicker(customVaultName?: string): Promise<{
    success: boolean;
    message: string;
    vault?: LocalVaultMetadata;
  }> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      // Broad accept parameters ensuring Android SAF and desktop file pickers display markdown & drawing files
      input.accept = '.md,.markdown,.txt,.canvas,.excalidraw,.drawing,.ink,text/markdown,text/plain,text/*';
      let resolved = false;

      const cleanup = () => {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };

      input.onchange = async () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        const files = input.files;
        if (!files || files.length === 0) {
          resolve({ success: false, message: 'No files were selected.' });
          return;
        }
        try {
          const res = await this.importFileList(files, customVaultName);
          resolve(res);
        } catch (e: any) {
          resolve({ success: false, message: `Failed to import files: ${e.message}` });
        }
      };

      input.oncancel = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ success: false, message: 'File selection cancelled.' });
        }
      };

      input.style.display = 'none';
      document.body.appendChild(input);
      input.click();
    });
  },

  /**
   * Fallback folder picker using HTML webkitdirectory input.
   * Safe and free of premature 800ms timeouts!
   */
  async openFolderPickerFallback(customVaultName?: string): Promise<{
    success: boolean;
    message: string;
    vault?: LocalVaultMetadata;
  }> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
      input.setAttribute('multiple', '');

      let resolved = false;

      const cleanup = () => {
        if (input.parentNode) {
          input.parentNode.removeChild(input);
        }
      };

      const handleFiles = async (files: FileList | null) => {
        if (resolved) return;
        resolved = true;
        cleanup();

        if (files && files.length > 0) {
          try {
            const res = await this.importFileList(files, customVaultName);
            resolve(res);
          } catch (e: any) {
            resolve({
              success: false,
              message: `Failed to import vault files: ${e.message}`,
            });
          }
        } else {
          resolve({
            success: false,
            message: 'No files or folder were selected.',
          });
        }
      };

      input.onchange = () => handleFiles(input.files);
      input.oncancel = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve({ success: false, message: 'Folder selection was cancelled.' });
        }
      };

      input.style.display = 'none';
      document.body.appendChild(input);
      input.click();
    });
  },

  /**
   * Prompt user to pick a local folder from their disk using showDirectoryPicker
   * with fallback to webkitdirectory or file selection.
   */
  async openLocalFolderPicker(customVaultName?: string): Promise<{
    success: boolean;
    message: string;
    vault?: LocalVaultMetadata;
    failuresCount?: number;
    errors?: { file: string; error: string }[];
  }> {
    if (!this.isFileSystemSupported()) {
      return this.openFolderPickerFallback(customVaultName);
    }

    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
      });

      currentDirHandle = dirHandle;
      const vaultName = customVaultName?.trim() || dirHandle.name || 'Local Vault';

      // 1. Ensure or find a top-level folder for this vault in the app
      let vaultFolder = await db.folders
        .filter((f) => f.name.toLowerCase() === vaultName.toLowerCase() && !f.parentId)
        .first();

      if (!vaultFolder) {
        vaultFolder = await foldersRepo.createFolder(vaultName, null);
      }

      // 2. Scan and import all files & directories recursively
      const result = await this.scanAndSyncDirectory(dirHandle, vaultFolder.id as number);

      const metadata: LocalVaultMetadata = {
        name: vaultName,
        isLinked: true,
        linkedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        fileCount: result.notesCount,
        folderCount: result.foldersCount,
        rootPath: vaultName,
        storageType: 'filesystem',
      };

      this.saveActiveVault(metadata);

      // Re-index all wikilinks for the graph
      await linksRepo.reindexAllLinks().catch(() => {});

      const hasFailures = result.failuresCount > 0;
      const isTotalFailure = result.notesCount === 0 && hasFailures;
      return {
        success: !isTotalFailure,
        message: isTotalFailure
          ? `Failed to link vault "${vaultName}": all ${result.failuresCount} file(s) failed.`
          : hasFailures
            ? `Linked vault "${vaultName}" with ${result.notesCount} notes (${result.failuresCount} failed) and ${result.foldersCount} folders.`
            : `Linked vault "${vaultName}" with ${result.notesCount} notes and ${result.foldersCount} folders.`,
        vault: metadata,
        failuresCount: result.failuresCount,
        errors: result.errors,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Vault folder selection was cancelled.' };
      }
      console.warn('Native directory picker failed, falling back to input picker:', err);
      return this.openFolderPickerFallback(customVaultName);
    }
  },

  /**
   * Handle drag-and-drop of folders, zip archives, or files directly into the vault
   */
  async importFromDataTransfer(
    dataTransfer: DataTransfer,
    customVaultName?: string
  ): Promise<{
    success: boolean;
    message: string;
    vault?: LocalVaultMetadata;
  }> {
    // Check if user dropped a zip file
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const f = dataTransfer.files[i];
        if (f.name.toLowerCase().endsWith('.zip')) {
          return this.importZipIntoVault(f, customVaultName);
        }
      }
    }

    const items = dataTransfer.items;
    const collectedFiles: File[] = [];
    let detectedVaultName = customVaultName || '';

    // Traverse directory tree via webkitGetAsEntry if available
    const traverseEntry = async (entry: any, currentPath: string): Promise<void> => {
      if (entry.isFile) {
        return new Promise((res) => {
          entry.file(
            (f: File) => {
              const relPath = currentPath ? `${currentPath}/${f.name}` : f.name;
              try {
                Object.defineProperty(f, 'webkitRelativePath', {
                  value: relPath,
                  configurable: true,
                });
              } catch {
                // Ignore if read-only
              }
              collectedFiles.push(f);
              res();
            },
            () => res()
          );
        });
      } else if (entry.isDirectory) {
        if (!detectedVaultName) {
          detectedVaultName = entry.name;
        }
        const reader = entry.createReader();
        const readBatch = async (): Promise<any[]> => {
          return new Promise((res) => {
            reader.readEntries(
              (results: any[]) => res(results),
              () => res([])
            );
          });
        };

        let allEntries: any[] = [];
        let batch: any[];
        do {
          batch = await readBatch();
          allEntries = allEntries.concat(batch);
        } while (batch.length > 0);

        for (const child of allEntries) {
          const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
          await traverseEntry(child, newPath);
        }
      }
    };

    if (items && items.length > 0 && typeof (items[0] as any).webkitGetAsEntry === 'function') {
      for (let i = 0; i < items.length; i++) {
        const entry = (items[i] as any).webkitGetAsEntry();
        if (entry) {
          await traverseEntry(entry, '');
        }
      }
    } else if (dataTransfer.files && dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        collectedFiles.push(dataTransfer.files[i]);
      }
    }

    if (collectedFiles.length === 0) {
      return { success: false, message: 'No valid files or folders were dropped.' };
    }

    const finalVaultName = detectedVaultName || customVaultName || 'Dropped Vault';
    return this.importFileList(collectedFiles, finalVaultName);
  },

  /**
   * Scan directory handle recursively and sync into Dexie db
   */
  async scanAndSyncDirectory(
    dirHandle: any,
    parentFolderId: number
  ): Promise<{
    notesCount: number;
    foldersCount: number;
    failuresCount: number;
    errors: { file: string; error: string }[];
  }> {
    let notesCount = 0;
    let foldersCount = 0;
    let failuresCount = 0;
    const errors: { file: string; error: string }[] = [];

    for await (const entry of dirHandle.values()) {
      // Skip hidden system files (.git, .obsidian, .trash, etc.)
      if (entry.name.startsWith('.')) continue;

      if (entry.kind === 'directory') {
        foldersCount++;
        // Find or create subfolder
        let subFolder = await db.folders
          .filter((f) => f.name === entry.name && f.parentId === parentFolderId)
          .first();

        if (!subFolder) {
          subFolder = await foldersRepo.createFolder(entry.name, parentFolderId);
        }

        const childRes = await this.scanAndSyncDirectory(entry, subFolder.id as number);
        notesCount += childRes.notesCount;
        foldersCount += childRes.foldersCount;
        failuresCount += childRes.failuresCount;
        errors.push(...childRes.errors);
      } else if (entry.kind === 'file') {
        if (isSupportedVaultFile(entry.name)) {
          try {
            const file = await entry.getFile();
            const text = await file.text();
            await this.saveFileToNoteOrCanvas(entry.name, text, parentFolderId);
            notesCount++;
          } catch (e: any) {
            failuresCount++;
            errors.push({ file: entry.name, error: e?.message || String(e) });
            console.warn(`Failed to read file ${entry.name}:`, e);
          }
        }
      }
    }

    return { notesCount, foldersCount, failuresCount, errors };
  },

  /**
   * Resync active local vault if handle is available or refresh app-managed vault
   */
  async resyncActiveVault(): Promise<{
    success: boolean;
    message: string;
    failuresCount?: number;
    errors?: { file: string; error: string }[];
  }> {
    const active = this.getActiveVault();
    if (!currentDirHandle) {
      if (active.isLinked) {
        const vaultFolder = await db.folders
          .filter((f) => f.name.toLowerCase() === active.name.toLowerCase() && !f.parentId)
          .first();

        if (vaultFolder && vaultFolder.id) {
          const notesCount = await db.notes
            .filter((n) => n.folderId === vaultFolder.id && n.trashedAt === null)
            .count();
          const foldersCount = await db.folders
            .filter((f) => f.parentId === vaultFolder.id)
            .count();

          const metadata: LocalVaultMetadata = {
            ...active,
            lastSyncedAt: new Date().toISOString(),
            fileCount: notesCount,
            folderCount: foldersCount + 1,
          };
          this.saveActiveVault(metadata);
          await linksRepo.reindexAllLinks().catch(() => {});
          return {
            success: true,
            message: `Vault "${active.name}" synced: ${notesCount} notes indexed.`,
          };
        }
      }

      // Prompt user to re-select
      const pickRes = await this.openLocalFolderPicker();
      return pickRes;
    }

    try {
      const vaultName = currentDirHandle.name || 'Local Vault';
      const vaultFolder = await db.folders
        .filter((f) => f.name.toLowerCase() === vaultName.toLowerCase() && !f.parentId)
        .first();

      if (!vaultFolder) {
        return { success: false, message: 'Could not find root folder for vault.' };
      }

      const result = await this.scanAndSyncDirectory(currentDirHandle, vaultFolder.id as number);

      const metadata: LocalVaultMetadata = {
        name: vaultName,
        isLinked: true,
        linkedAt: this.getActiveVault().linkedAt || new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        fileCount: result.notesCount,
        folderCount: result.foldersCount,
        rootPath: vaultName,
      };

      this.saveActiveVault(metadata);
      await linksRepo.reindexAllLinks().catch(() => {});

      const hasFailures = result.failuresCount > 0;
      const isTotalFailure = result.notesCount === 0 && hasFailures;
      return {
        success: !isTotalFailure,
        message: isTotalFailure
          ? `Failed to sync vault "${vaultName}": all ${result.failuresCount} file(s) failed.`
          : hasFailures
            ? `Vault synced: ${result.notesCount} notes refreshed (${result.failuresCount} failed).`
            : `Vault synced: ${result.notesCount} notes refreshed.`,
        failuresCount: result.failuresCount,
        errors: result.errors,
      };
    } catch (err: any) {
      return { success: false, message: `Vault resync failed: ${err.message}` };
    }
  },

  /**
   * Extract tags from markdown content
   */
  extractTagsFromContent(content: string): string[] {
    return extractTagsFromText(content);
  },
};
