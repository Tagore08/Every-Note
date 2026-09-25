import { db } from './database';
import { getStoredFlags } from '../app/flags';
import type { Note } from '../types/note';
import type { Attachment } from '../types/attachment';
import type { Task } from '../types/task';
import type { CalendarEvent } from '../types/event';
import type { Person } from '../types/person';
import type { Habit, HabitLog } from '../types/habit';
import type { FocusSession, TimerPreset } from '../types/focus';
import type { Template } from '../types/template';
import type { NoteLink } from '../types/link';
import type { Routine, RoutineRun } from '../types/routine';
import type { CanvasEntity } from '../types/canvas';
import type { Folder } from '../types/folder';

export interface ExportAttachment extends Omit<Attachment, 'data'> {
  dataBase64?: string;
}

export interface ExportPerson extends Omit<Person, 'photoBlob'> {
  photoBase64?: string;
}

export interface ExportCanvas extends Omit<CanvasEntity, 'thumbBlob'> {
  thumbBase64?: string;
}

export interface BackupEnvelope {
  version: number;
  app: string;
  exportedAt: string;
  notes: Note[];
  folders?: Folder[];
  tasks?: Task[];
  events?: CalendarEvent[];
  people?: ExportPerson[];
  attachments?: ExportAttachment[];
  habits?: Habit[];
  habitLogs?: HabitLog[];
  focusSessions?: FocusSession[];
  templates?: Template[];
  links?: NoteLink[];
  routines?: Routine[];
  routineRuns?: RoutineRun[];
  canvases?: ExportCanvas[];
  timerPresets?: TimerPreset[];
  settings?: {
    theme?: string;
    flags?: Record<string, boolean>;
  };
  lifeAreas?: any[]; // optional for backward compatibility with old exports
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64Data: string, mimeType: string): Blob {
  try {
    const parts = base64Data.split(',');
    const raw = parts.length > 1 ? parts[1] : parts[0];
    const byteString = atob(raw);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeType });
  } catch (err) {
    console.warn('Failed to parse base64 blob:', err);
    return new Blob([], { type: mimeType });
  }
}

export async function buildFullBackupEnvelope(): Promise<BackupEnvelope> {
  const allNotes = await db.notes.toArray();
  const allTasks = await db.tasks.toArray();
  const allEvents = await db.events.toArray();
  const allPeople = await db.people.toArray();
  const allHabits = await db.habits.toArray();
  const allHabitLogs = await db.habitLogs.toArray();
  const allFocusSessions = await db.focusSessions.toArray();
  const allAttachments = await db.attachments.toArray();
  const allTemplates = await db.templates.toArray();

  const exportedAttachments: ExportAttachment[] = [];
  for (const att of allAttachments) {
    let dataBase64: string | undefined = undefined;
    if (att.data) {
      try {
        dataBase64 = await blobToBase64(att.data);
      } catch (err) {
        console.warn(`Failed to encode attachment ${att.id}:`, err);
      }
    }
    exportedAttachments.push({
      id: att.id,
      noteId: att.noteId,
      ownerType: att.ownerType,
      kind: att.kind,
      name: att.name,
      mimeType: att.mimeType,
      size: att.size,
      createdAt: att.createdAt,
      url: att.url,
      dataBase64,
    });
  }

  const exportedPeople: ExportPerson[] = [];
  for (const p of allPeople) {
    let photoBase64: string | undefined = undefined;
    if (p.photoBlob) {
      try {
        photoBase64 = await blobToBase64(p.photoBlob);
      } catch (err) {
        console.warn(`Failed to encode photo for person ${p.id}:`, err);
      }
    }
    exportedPeople.push({
      id: p.id,
      name: p.name,
      contactInfo: p.contactInfo,
      notes: p.notes,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      trashedAt: p.trashedAt,
      photoBase64,
    });
  }

  const allLinks = await db.links.toArray();
  const allRoutines = await db.routines.toArray();
  const allRoutineRuns = await db.routineRuns.toArray();
  const allCanvases = await db.canvases.toArray();
  const allTimerPresets = await db.timerPresets.toArray();

  const exportedCanvases: ExportCanvas[] = [];
  for (const c of allCanvases) {
    let thumbBase64: string | undefined = undefined;
    if (c.thumbBlob) {
      try {
        thumbBase64 = await blobToBase64(c.thumbBlob);
      } catch (err) {
        console.warn(`Failed to encode thumbBlob for canvas ${c.id}:`, err);
      }
    }
    exportedCanvases.push({
      id: c.id,
      title: c.title,
      doc: c.doc,
      linkedNoteId: c.linkedNoteId,
      tags: c.tags,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      trashedAt: c.trashedAt,
      thumbBase64,
    });
  }

  const allFolders = await db.folders.toArray();
  const currentTheme = localStorage.getItem('notes_theme_mode') || 'system';
  const currentFlags = getStoredFlags();

  return {
    version: 16,
    app: 'notes-app',
    exportedAt: new Date().toISOString(),
    notes: allNotes,
    folders: allFolders,
    tasks: allTasks,
    events: allEvents,
    people: exportedPeople,
    habits: allHabits,
    habitLogs: allHabitLogs,
    focusSessions: allFocusSessions,
    attachments: exportedAttachments,
    templates: allTemplates,
    links: allLinks,
    routines: allRoutines,
    routineRuns: allRoutineRuns,
    canvases: exportedCanvases,
    timerPresets: allTimerPresets,
    settings: {
      theme: currentTheme,
      flags: currentFlags,
    },
  };
}

export function triggerDownload(content: string, filename: string): void {
  try {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.warn('Browser download trigger failed:', err);
  }
}

export async function saveBackupToOPFS(content: string, filename: string): Promise<boolean> {
  try {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      return false;
    }
    const root = await navigator.storage.getDirectory();
    const backupsDir = await root.getDirectoryHandle('backups', { create: true });
    const fileHandle = await backupsDir.getFileHandle(filename, { create: true });
    // @ts-ignore createWritable is standard in modern browsers
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch (err) {
    console.warn('Failed to write backup to OPFS:', err);
    return false;
  }
}

export async function listOPFSBackups(): Promise<string[]> {
  try {
    if (!navigator.storage || !navigator.storage.getDirectory) {
      return [];
    }
    const root = await navigator.storage.getDirectory();
    const backupsDir = await root.getDirectoryHandle('backups', { create: true });
    const names: string[] = [];
    // @ts-ignore
    for await (const name of backupsDir.keys()) {
      names.push(name);
    }
    return names;
  } catch {
    return [];
  }
}
