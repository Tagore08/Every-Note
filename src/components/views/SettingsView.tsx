import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTheme, type ThemeMode } from '../../hooks/useTheme';
import { notesRepo, useArchivedNotes, useTrashNotes } from '../../db/notesRepo';
import { attachmentsRepo } from '../../db/attachmentsRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { eventsRepo } from '../../db/eventsRepo';
import { peopleRepo } from '../../db/peopleRepo';
import { habitsRepo } from '../../db/habitsRepo';
import { focusRepo } from '../../db/focusRepo';
import { templatesRepo } from '../../db/repos/templatesRepo';
import { linksRepo } from '../../db/repos/linksRepo';
import { canvasRepo } from '../../db/repos/canvasRepo';
import { timerPresetsRepo } from '../../db/repos/timerPresetsRepo';
import { routinesRepo } from '../../db/repos/routinesRepo';
import { foldersRepo } from '../../db/repos/foldersRepo';
import { snippetsRepo } from '../../db/repos/snippetsRepo';
import { stickyNotesRepo } from '../../db/repos/stickyNotesRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatFileSize } from '../../utils/format';
import {
  getNotificationPermission,
  requestNotificationPermission,
} from '../../services/reminderService';
import { CloudStorageSettings } from '../cloud/CloudStorageSettings';

import type { Note } from '../../types/note';
import type { Attachment } from '../../types/attachment';
import type { Task } from '../../types/task';
import type { CalendarEvent } from '../../types/event';
import type { Person } from '../../types/person';
import type { Habit, HabitLog } from '../../types/habit';
import type { FocusSession, TimerPreset } from '../../types/focus';
import type { Template } from '../../types/template';
import type { CanvasEntity } from '../../types/canvas';
import type { Routine, RoutineRun } from '../../types/routine';
import type { Folder } from '../../types/folder';
import type { NoteLink } from '../../types/link';
import type { Snippet } from '../../types/snippet';
import type { StickyNote } from '../../types/sticky';

interface ExportAttachment extends Omit<Attachment, 'data'> {
  dataBase64?: string;
}

interface ExportPerson extends Omit<Person, 'photoBlob'> {
  photoBase64?: string;
}

interface ExportCanvas extends Omit<CanvasEntity, 'thumbBlob'> {
  thumbBase64?: string;
}

interface BackupEnvelope {
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
  canvases?: ExportCanvas[];
  timerPresets?: TimerPreset[];
  routines?: Routine[];
  routineRuns?: RoutineRun[];
  snippets?: Snippet[];
  stickyNotes?: StickyNote[];
  settings?: {
    theme?: string;
  };
}


// Convert Blob to data URL base64 string
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Convert data URL base64 string back to Blob
function base64ToBlob(base64Data: string, mimeType: string): Blob {
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

export function SettingsView() {
  const { mode, setMode, isDark } = useTheme();
  const { showSnackbar, showUndo } = useSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const archivedNotes = useArchivedNotes();
  const trashNotes = useTrashNotes();

  // Storage info state
  const [storageInfo, setStorageInfo] = useState<{
    usedBytes: number;
    quotaBytes: number;
    isPersisted: boolean;
  } | null>(null);

  // Notification state
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(
    getNotificationPermission()
  );

  // Import flow state
  const [importCandidate, setImportCandidate] = useState<BackupEnvelope | null>(null);
  const [importStrategy, setImportStrategy] = useState<'merge' | 'replace'>('merge');
  const [importError, setImportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Auto-purge trash setting (30+ days)
  const [autoPurgeTrash, setAutoPurgeTrash] = useState<boolean>(() => {
    return localStorage.getItem('notes_auto_purge_trash') === 'true';
  });

  const handleToggleAutoPurge = (enabled: boolean) => {
    setAutoPurgeTrash(enabled);
    localStorage.setItem('notes_auto_purge_trash', enabled ? 'true' : 'false');
    showSnackbar({
      message: enabled
        ? 'Auto-purge enabled: Trashed notes older than 30 days will be removed on startup.'
        : 'Auto-purge disabled.',
    });
  };

  // Danger zone modal state
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

  // Load storage estimation
  const loadStorageEstimate = async () => {
    try {
      const est = await attachmentsRepo.getStorageEstimate();
      setStorageInfo(est);
    } catch (err) {
      console.warn('Failed to load storage estimation:', err);
    }
  };

  useEffect(() => {
    loadStorageEstimate();
  }, []);

  const handleRequestPersistence = async () => {
    const granted = await attachmentsRepo.requestPersistentStorage();
    if (granted) {
      showSnackbar({ message: 'Persistent storage granted by browser.' });
    } else {
      showSnackbar({ message: 'Persistent storage not granted (standard storage mode).' });
    }
    await loadStorageEstimate();
  };

  const handleRequestNotif = async () => {
    const res = await requestNotificationPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      showSnackbar({ message: 'Notifications enabled for reminders.' });
    } else if (res === 'denied') {
      showSnackbar({ message: 'Notifications were blocked in your browser settings.' });
    }
  };

  // 1. Export Flow (Including base64 encoded attachments, tasks, and events)
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const allNotes = await notesRepo.getAllNotesForExport();
      const allTasks = await tasksRepo.getAllTasksForExport();
      const allEvents = await eventsRepo.getAllEventsForExport();
      const allPeople = await peopleRepo.getAllPeopleForExport();
      const allHabits = await habitsRepo.getAllHabitsForExport();
      const allHabitLogs = await habitsRepo.getAllHabitLogsForExport();
      const allFocusSessions = await focusRepo.getAllSessionsForExport();
      const allAttachments = await attachmentsRepo.getAllAttachmentsForExport();
      const allTemplates = await templatesRepo.getAllTemplatesForExport();
      const allCanvases = await canvasRepo.getAllCanvasesForExport();
      const allTimerPresets = await timerPresetsRepo.getAllPresetsForExport();
      const allRoutines = await routinesRepo.getAllRoutinesForExport();
      const allRoutineRuns = await routinesRepo.getAllRoutineRunsForExport();
      const allFolders = await foldersRepo.getAllFolders();
      const allLinks = await linksRepo.getAllLinksForExport();
      const allSnippets = await snippetsRepo.getAllForExport();
      const allStickyNotes = await stickyNotesRepo.getAllForExport();

      // Convert Blobs to base64 strings
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

      // Convert People photoBlobs to base64 strings
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

      // Convert Canvas thumbBlobs to base64 strings
      const exportedCanvases: ExportCanvas[] = [];
      for (const c of allCanvases) {
        let thumbBase64: string | undefined = undefined;
        if (c.thumbBlob) {
          try {
            thumbBase64 = await blobToBase64(c.thumbBlob);
          } catch (err) {
            console.warn(`Failed to encode canvas thumb ${c.id}:`, err);
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

      const payload: BackupEnvelope = {
        version: 18,
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
        canvases: exportedCanvases,
        timerPresets: allTimerPresets,
        routines: allRoutines,
        routineRuns: allRoutineRuns,
        snippets: allSnippets,
        stickyNotes: allStickyNotes,
        settings: {
          theme: mode,
        },
      };

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `notes-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      const formattedFileSize = formatFileSize(blob.size);
      showSnackbar({
        message: `Exported ${allNotes.length} notes, ${allTasks.length} tasks, ${allCanvases.length} canvases & data (${formattedFileSize}).`,
      });
    } catch (err) {
      console.error('Failed to export data:', err);
      showSnackbar({ message: 'Failed to export backup.' });
    } finally {
      setIsExporting(false);
    }
  };


  // 2. Import File Picker Handler
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportError('The selected file is not valid JSON. Please choose a valid backup file.');
        return;
      }

      if (!parsed || typeof parsed !== 'object') {
        setImportError('Invalid backup file: file root must be a JSON object.');
        return;
      }

      let notesArray: unknown[] = [];
      let foldersArray: Folder[] = [];
      let tasksArray: Task[] = [];
      let eventsArray: CalendarEvent[] = [];
      let peopleArray: ExportPerson[] = [];
      let attachmentsArray: ExportAttachment[] = [];
      let habitsArray: Habit[] = [];
      let habitLogsArray: HabitLog[] = [];
      let focusSessionsArray: FocusSession[] = [];
      let templatesArray: Template[] = [];
      let linksArray: NoteLink[] = [];
      let canvasesArray: ExportCanvas[] = [];
      let timerPresetsArray: TimerPreset[] = [];
      let routinesArray: Routine[] = [];
      let routineRunsArray: RoutineRun[] = [];
      let snippetsArray: Snippet[] = [];
      let stickyNotesArray: StickyNote[] = [];
      let exportedAt = new Date().toISOString();
      let version = 1;

      if ('notes' in parsed && Array.isArray((parsed as BackupEnvelope).notes)) {
        const envelope = parsed as BackupEnvelope;
        notesArray = envelope.notes;
        exportedAt = envelope.exportedAt || exportedAt;
        version = envelope.version || version;
        if ('folders' in parsed && Array.isArray(envelope.folders)) {
          foldersArray = envelope.folders ?? [];
        }
        if ('tasks' in parsed && Array.isArray(envelope.tasks)) {
          tasksArray = envelope.tasks ?? [];
        }
        if ('events' in parsed && Array.isArray(envelope.events)) {
          eventsArray = envelope.events ?? [];
        }
        if ('people' in parsed && Array.isArray(envelope.people)) {
          peopleArray = envelope.people ?? [];
        }
        if ('attachments' in parsed && Array.isArray(envelope.attachments)) {
          attachmentsArray = envelope.attachments ?? [];
        }
        if ('habits' in parsed && Array.isArray(envelope.habits)) {
          habitsArray = envelope.habits ?? [];
        }
        if ('habitLogs' in parsed && Array.isArray(envelope.habitLogs)) {
          habitLogsArray = envelope.habitLogs ?? [];
        }
        if ('focusSessions' in parsed && Array.isArray(envelope.focusSessions)) {
          focusSessionsArray = envelope.focusSessions ?? [];
        }
        if ('templates' in parsed && Array.isArray(envelope.templates)) {
          templatesArray = envelope.templates ?? [];
        }
        if ('links' in parsed && Array.isArray(envelope.links)) {
          linksArray = envelope.links ?? [];
        }
        if ('canvases' in parsed && Array.isArray(envelope.canvases)) {
          canvasesArray = envelope.canvases ?? [];
        }
        if ('timerPresets' in parsed && Array.isArray(envelope.timerPresets)) {
          timerPresetsArray = envelope.timerPresets ?? [];
        }
        if ('routines' in parsed && Array.isArray(envelope.routines)) {
          routinesArray = envelope.routines ?? [];
        }
        if ('routineRuns' in parsed && Array.isArray(envelope.routineRuns)) {
          routineRunsArray = envelope.routineRuns ?? [];
        }
        if ('snippets' in parsed && Array.isArray(envelope.snippets)) {
          snippetsArray = envelope.snippets ?? [];
        }
        if ('stickyNotes' in parsed && Array.isArray(envelope.stickyNotes)) {
          stickyNotesArray = envelope.stickyNotes ?? [];
        }
      } else if (Array.isArray(parsed)) {
        notesArray = parsed;
      } else {
        setImportError('Invalid backup file: could not find "notes" list in file.');
        return;
      }

      setImportCandidate({
        version,
        app: 'notes-app',
        exportedAt,
        notes: notesArray as Note[],
        folders: foldersArray,
        tasks: tasksArray,
        events: eventsArray,
        people: peopleArray,
        attachments: attachmentsArray,
        habits: habitsArray,
        habitLogs: habitLogsArray,
        focusSessions: focusSessionsArray,
        templates: templatesArray,
        links: linksArray,
        canvases: canvasesArray,
        timerPresets: timerPresetsArray,
        routines: routinesArray,
        routineRuns: routineRunsArray,
        snippets: snippetsArray,
        stickyNotes: stickyNotesArray,
      });
      setImportStrategy('merge');
    } catch (err) {
      console.error('Import parse failed:', err);
      setImportError('Failed to read file. Please ensure it is an uncorrupted JSON backup.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 3. Confirm Import (Restores Notes, Tasks, Events, People, and Attachments)
  const handleConfirmImport = async () => {
    if (!importCandidate) return;

    try {
      // Snapshot existing entities before mutating (for undo)
      const prevTasks = await tasksRepo.getAllTasksForExport();
      const prevEvents = await eventsRepo.getAllEventsForExport();
      const prevPeople = await peopleRepo.getAllPeopleForExport();
      const prevHabits = await habitsRepo.getAllHabitsForExport();
      const prevHabitLogs = await habitsRepo.getAllHabitLogsForExport();
      const prevFocusSessions = await focusRepo.getAllSessionsForExport();
      const prevAttachments = await attachmentsRepo.getAllAttachmentsForExport();
      const prevCanvases = await canvasRepo.getAllCanvasesForExport();
      const prevTimerPresets = await timerPresetsRepo.getAllPresetsForExport();
      const prevRoutines = await routinesRepo.getAllRoutinesForExport();
      const prevRoutineRuns = await routinesRepo.getAllRoutineRunsForExport();
      const prevFolders = await foldersRepo.getAllFolders();
      const prevLinks = await linksRepo.getAllLinksForExport();
      const prevSnippets = await snippetsRepo.getAllForExport();
      const prevStickyNotes = await stickyNotesRepo.getAllForExport();

      // 1. Import Notes
      const result = await notesRepo.importNotes(importCandidate.notes, importStrategy);
      const importedNotesCount = result.importedCount;
      const prevNotes = result.previousSnapshot;

      // 2. Import Tasks
      let importedTasksCount = 0;
      if (importCandidate.tasks && importCandidate.tasks.length > 0) {
        importedTasksCount = await tasksRepo.importTasks(importCandidate.tasks, importStrategy);
      }

      // 3. Import Events
      let importedEventsCount = 0;
      if (importCandidate.events && importCandidate.events.length > 0) {
        if (importStrategy === 'replace') {
          await eventsRepo.deleteAllEvents();
        }
        await eventsRepo.importEvents(importCandidate.events);
        importedEventsCount = importCandidate.events.length;
      }

      // 4. Import People
      let importedPeopleCount = 0;
      if (importCandidate.people && importCandidate.people.length > 0) {
        const restoredPeople: Person[] = [];
        for (const raw of importCandidate.people) {
          let photoBlob: Blob | null = null;
          if (raw.photoBase64) {
            photoBlob = base64ToBlob(raw.photoBase64, 'image/jpeg');
          }
          restoredPeople.push({
            id: typeof raw.id === 'number' ? raw.id : undefined,
            name: raw.name || 'Untitled Person',
            contactInfo: raw.contactInfo,
            notes: raw.notes,
            photoBlob,
            createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
            updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : new Date(),
            trashedAt: raw.trashedAt ? new Date(raw.trashedAt) : null,
          });
        }
        importedPeopleCount = await peopleRepo.importPeople(restoredPeople, importStrategy);
      }

      // 5. Import Habits & Logs
      let importedHabitsCount = 0;
      if (importCandidate.habits && importCandidate.habits.length > 0) {
        const { habitsCount } = await habitsRepo.importHabits(
          importCandidate.habits,
          importCandidate.habitLogs || [],
          importStrategy
        );
        importedHabitsCount = habitsCount;
      }

      // 6. Import Focus Sessions
      let importedFocusCount = 0;
      if (importCandidate.focusSessions && importCandidate.focusSessions.length > 0) {
        importedFocusCount = await focusRepo.importSessions(
          importCandidate.focusSessions,
          importStrategy
        );
      }

      // 7. Import Attachments (if any in candidate)
      let importedAttachmentsCount = 0;
      if (importCandidate.attachments && importCandidate.attachments.length > 0) {
        const restoredAttachments: Attachment[] = [];
        for (const raw of importCandidate.attachments) {
          let dataBlob: Blob | undefined = undefined;
          if (raw.dataBase64) {
            dataBlob = base64ToBlob(raw.dataBase64, raw.mimeType || 'application/octet-stream');
          }
          restoredAttachments.push({
            id: typeof raw.id === 'number' ? raw.id : undefined,
            noteId: raw.noteId,
            ownerType: raw.ownerType || 'note',
            kind: raw.kind,
            name: raw.name || 'Untitled Attachment',
            mimeType: raw.mimeType || 'application/octet-stream',
            size: typeof raw.size === 'number' ? raw.size : 0,
            createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
            url: raw.url,
            data: dataBlob,
          });
        }
        importedAttachmentsCount = await attachmentsRepo.importAttachments(
          restoredAttachments,
          importStrategy
        );
      }

      // 8. Import Templates
      let importedTemplatesCount = 0;
      if (importCandidate.templates && importCandidate.templates.length > 0) {
        importedTemplatesCount = await templatesRepo.importTemplates(
          importCandidate.templates,
          importStrategy
        );
      }

      // 9. Import Canvases
      let importedCanvasesCount = 0;
      if (importCandidate.canvases && importCandidate.canvases.length > 0) {
        const restoredCanvases: CanvasEntity[] = [];
        for (const raw of importCandidate.canvases) {
          let thumbBlob: Blob | undefined = undefined;
          if (raw.thumbBase64) {
            thumbBlob = base64ToBlob(raw.thumbBase64, 'image/png');
          }
          restoredCanvases.push({
            id: typeof raw.id === 'number' ? raw.id : undefined,
            title: raw.title || 'Untitled drawing',
            doc: raw.doc,
            thumbBlob,
            linkedNoteId: raw.linkedNoteId ?? null,
            tags: raw.tags || [],
            createdAt: raw.createdAt || Date.now(),
            updatedAt: raw.updatedAt || Date.now(),
            trashedAt: raw.trashedAt ?? null,
          });
        }
        importedCanvasesCount = await canvasRepo.importCanvases(restoredCanvases, importStrategy);
      }

      // 11. Import Timer Presets
      let importedPresetsCount = 0;
      if (importCandidate.timerPresets && importCandidate.timerPresets.length > 0) {
        importedPresetsCount = await timerPresetsRepo.importPresets(
          importCandidate.timerPresets,
          importStrategy
        );
      }

      // 12. Import Routines & Runs
      let importedRoutinesCount = 0;
      if (importCandidate.routines && importCandidate.routines.length > 0) {
        const rResult = await routinesRepo.importRoutines(
          importCandidate.routines,
          importCandidate.routineRuns || [],
          importStrategy
        );
        importedRoutinesCount = rResult.routinesCount;
      }

      // 13. Import Folders
      let importedFoldersCount = 0;
      if (importCandidate.folders && importCandidate.folders.length > 0) {
        importedFoldersCount = await foldersRepo.importFolders(
          importCandidate.folders,
          importStrategy
        );
      }

      // 14. Import Links
      let importedLinksCount = 0;
      if (importCandidate.links && importCandidate.links.length > 0) {
        importedLinksCount = await linksRepo.importLinks(
          importCandidate.links,
          importStrategy
        );
      }

      // 15. Import Snippets
      let importedSnippetsCount = 0;
      if (importCandidate.snippets && importCandidate.snippets.length > 0) {
        importedSnippetsCount = await snippetsRepo.importSnippets(
          importCandidate.snippets,
          importStrategy
        );
      }

      // 16. Import Sticky Notes
      let importedStickyNotesCount = 0;
      if (importCandidate.stickyNotes && importCandidate.stickyNotes.length > 0) {
        importedStickyNotesCount = await stickyNotesRepo.importStickyNotes(
          importCandidate.stickyNotes,
          importStrategy
        );
      }

      // Re-index all wikilinks after import so the graph & backlinks are fully resolved
      await linksRepo.reindexAllLinks();

      setImportCandidate(null);
      await loadStorageEstimate();

      showUndo(
        `Imported ${importedNotesCount} notes, ${importedFoldersCount} folders, ${importedTasksCount} tasks, ${importedLinksCount} links, ${importedCanvasesCount} canvases, ${importedEventsCount} events, ${importedPeopleCount} people, ${importedHabitsCount} habits, ${importedFocusCount} focus sessions, ${importedPresetsCount} timer presets, ${importedRoutinesCount} routines, ${importedSnippetsCount} snippets, ${importedStickyNotesCount} sticky notes, ${importedTemplatesCount} templates & ${importedAttachmentsCount} attachments (${importStrategy}).`,
        async () => {
          if (prevNotes) {
            await notesRepo.importNotes(prevNotes, 'replace');
          }
          if (importStrategy === 'replace' && prevTasks) {
            await tasksRepo.importTasks(prevTasks, 'replace');
          }
          if (importStrategy === 'replace' && prevEvents) {
            await eventsRepo.deleteAllEvents();
            await eventsRepo.importEvents(prevEvents);
          }
          if (importStrategy === 'replace' && prevPeople) {
            await peopleRepo.importPeople(prevPeople, 'replace');
          }
          if (importStrategy === 'replace' && prevHabits) {
            await habitsRepo.importHabits(prevHabits, prevHabitLogs || [], 'replace');
          }
          if (importStrategy === 'replace' && prevFocusSessions) {
            await focusRepo.importSessions(prevFocusSessions, 'replace');
          }
          if (importStrategy === 'replace' && prevAttachments) {
            await attachmentsRepo.importAttachments(prevAttachments, 'replace');
          }
          if (importStrategy === 'replace' && prevCanvases) {
            await canvasRepo.importCanvases(prevCanvases, 'replace');
          }
          if (importStrategy === 'replace' && prevTimerPresets) {
            await timerPresetsRepo.importPresets(prevTimerPresets, 'replace');
          }
          if (importStrategy === 'replace' && prevRoutines) {
            await routinesRepo.importRoutines(prevRoutines, prevRoutineRuns || [], 'replace');
          }
          if (importStrategy === 'replace' && prevFolders) {
            await foldersRepo.importFolders(prevFolders, 'replace');
          }
          if (importStrategy === 'replace' && prevLinks) {
            await linksRepo.importLinks(prevLinks, 'replace');
          }
          if (importStrategy === 'replace' && prevSnippets) {
            await snippetsRepo.importSnippets(prevSnippets, 'replace');
          }
          if (importStrategy === 'replace' && prevStickyNotes) {
            await stickyNotesRepo.importStickyNotes(prevStickyNotes, 'replace');
          }
          await linksRepo.reindexAllLinks();
          await loadStorageEstimate();
        }
      );
    } catch (err) {
      console.error('Failed to import data:', err);
      setImportError('An error occurred during import. No data was corrupted.');
    }
  };

  // 4. Danger Zone: Delete All Data
  const handleConfirmDeleteAll = async () => {
    if (deleteConfirmationInput.trim() !== 'DELETE ALL') return;

    try {
      await notesRepo.deleteAllNotes();
      await tasksRepo.deleteAllTasks();
      await eventsRepo.deleteAllEvents();
      await peopleRepo.deleteAllPeople();
      await habitsRepo.deleteAllHabits();
      await focusRepo.deleteAllSessions();
      await timerPresetsRepo.deleteAllAndReseed();
      await routinesRepo.deleteAllRoutines();
      await linksRepo.deleteAllLinks();
      await snippetsRepo.clearAll();
      await stickyNotesRepo.clearAllStickyNotes();
      const allCanvases = await canvasRepo.getAllCanvasesForExport();
      for (const c of allCanvases) {
        if (c.id) await canvasRepo.deleteCanvasPermanently(c.id);
      }
      setShowDeleteAllModal(false);
      setDeleteConfirmationInput('');
      await loadStorageEstimate();
      showSnackbar({ message: 'All notes, tasks, events, people, habits, focus sessions, canvases, snippets, sticky notes, and attachments have been completely deleted.' });
    } catch (err) {
      console.error('Failed to delete all data:', err);
    }
  };


  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12 pt-2">
      {/* Quick Navigation to Labs, Archive & Trash */}
      <div className="space-y-3">
        <Link
          to="/settings/labs"
          className="flex items-center justify-between p-4 rounded-card border border-border bg-surface hover:border-accent/40 shadow-card transition-colors min-h-[44px]"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
                <path d="M8.5 2h7" />
                <path d="M7 16h10" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">Experimental Labs</div>
              <div className="text-xs text-ink-muted">Toggle expansion feature flags and developer options</div>
            </div>
          </div>
          <span className="text-accent text-xs font-semibold px-3 py-1 rounded-pill bg-accent-soft">
            Manage Labs →
          </span>
        </Link>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          <Link
            to="/settings/templates"
            className="flex items-center justify-between p-4 rounded-card border border-border bg-surface hover:border-accent/40 shadow-card transition-colors min-h-[44px]"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <div>
                <div className="text-sm font-medium text-ink">Starter Templates</div>
                <div className="text-[11px] text-ink-muted">Task & Note skeletons</div>
              </div>
            </div>
            <span className="text-accent text-xs font-semibold">Manage →</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/archive"
            className="flex items-center justify-between p-4 rounded-card border border-border bg-surface hover:border-accent/40 shadow-card transition-colors min-h-[44px]"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="5" rx="1" />
                <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                <path d="M10 12h4" />
              </svg>
              <span className="text-sm font-medium text-ink">Archive</span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-2 text-ink border border-border font-semibold">
              {archivedNotes?.length ?? 0}
            </span>
          </Link>

          <Link
            to="/trash"
            className="flex items-center justify-between p-4 rounded-card border border-border bg-surface hover:border-accent/40 shadow-card transition-colors min-h-[44px]"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span className="text-sm font-medium text-ink">Trash</span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-2 text-ink border border-border font-semibold">
              {trashNotes?.length ?? 0}
            </span>
          </Link>
        </div>
      </div>

      {/* 1. Appearance Section */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Appearance
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose your preferred color theme or follow your operating system automatically.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(
            [
              { key: 'light', label: 'Light', desc: 'Always light' },
              { key: 'dark', label: 'Dark', desc: 'Deep slate dark' },
              { key: 'true-black', label: 'True Black', desc: 'OLED pure black' },
              {
                key: 'system',
                label: 'System',
                desc: isDark ? 'Currently dark' : 'Currently light',
              },
            ] as const
          ).map((item) => {
            const isSelected = mode === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key as ThemeMode)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-accent bg-accent-soft text-accent shadow-xs'
                    : 'border-border bg-surface hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-semibold text-sm ${isSelected ? 'text-accent' : 'text-ink'}`}>
                    {item.label}
                  </span>
                  {isSelected && (
                    <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                  )}
                </div>
                <p className="text-xs text-ink-muted mt-1">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Notifications & Reminders */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Notifications & Reminders
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Browser notification alerts for upcoming events and scheduled notes.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                  Notification Alerts
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {notifPermission === 'granted'
                    ? 'Notifications are active'
                    : notifPermission === 'denied'
                      ? 'Notifications are blocked in browser settings'
                      : notifPermission === 'unsupported'
                        ? 'Notifications are not supported in this browser'
                        : 'Notifications not yet enabled'}
                </span>
              </div>
            </div>

            {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
              <button
                type="button"
                onClick={handleRequestNotif}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer shrink-0"
              >
                Enable Notifications
              </button>
            )}

            {notifPermission === 'granted' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Enabled</span>
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-2.5">
            <strong>Why enable?</strong> Reminders send you timely alerts when events are starting or when scheduled notes require your attention. In offline installable PWAs, reminders trigger locally whenever the app is open or running on your device.
          </p>
        </div>
      </section>

      {/* 3. Browser Storage & Quota Estimation */}
      <section className="space-y-4">

        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Storage & Persistence
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            IndexedDB storage estimation for notes, images, and attachments on this device.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          {storageInfo ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-medium">
                  Used: {formatFileSize(storageInfo.usedBytes)} of {formatFileSize(storageInfo.quotaBytes)}
                </span>
                <span className="text-slate-500">
                  {formatFileSize(Math.max(0, storageInfo.quotaBytes - storageInfo.usedBytes))} free
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      storageInfo.quotaBytes > 0
                        ? (storageInfo.usedBytes / storageInfo.quotaBytes) * 100
                        : 0
                    )}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Storage Protection:</span>
                  <span
                    className={`font-semibold ${
                      storageInfo.isPersisted
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {storageInfo.isPersisted ? 'Persistent (Eviction Protected)' : 'Standard (Best Effort)'}
                  </span>
                </div>

                {!storageInfo.isPersisted && (
                  <button
                    type="button"
                    onClick={handleRequestPersistence}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Request Protection
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 animate-pulse">Calculating storage estimation...</div>
          )}
        </div>
      </section>

      {/* Cloud Storage & Sync Section */}
      <section className="space-y-4">
        <CloudStorageSettings />
      </section>

      {/* 3. Data & Backups Section */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Data & Backup
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Export complete backups including files, images, and links to keep your notes safe.
          </p>
        </div>

        {importError && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
            <svg className="w-4 h-4 shrink-0 mt-0.5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>{importError}</div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Export card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                Export backup (JSON)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download all notes and embedded attachments in a single portable JSON file.
              </p>
            </div>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExport}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white disabled:opacity-50 text-white dark:text-slate-900 transition-colors shadow-xs cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>{isExporting ? 'Encoding Backup...' : 'Download Backup'}</span>
            </button>
          </div>

          {/* Import card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                Import data (JSON)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Restore or merge notes and attachments from a previously exported JSON backup file.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>Select JSON File</span>
              </button>
            </div>
          </div>

          {/* Auto-Purge Trash Card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                Auto-purge trash (30+ days)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatically clean up notes that have been in the trash for more than 30 days on startup.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoPurgeTrash}
                onChange={(e) => handleToggleAutoPurge(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </section>

      {/* 4. Help & Guides */}
      <section className="space-y-4 pt-4 border-t border-border">
        <div>
          <h3 className="text-base font-semibold text-ink">
            Help & Guides
          </h3>
          <p className="text-xs text-ink-muted">
            Explore productivity shortcuts or replay the introductory tour.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-shortcuts-modal'))}
            className="p-3.5 rounded-xl border border-border bg-surface hover:bg-surface-2 flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">⌨️</span>
              <div>
                <div className="text-xs font-semibold text-ink">Keyboard Shortcuts</div>
                <div className="text-[11px] text-ink-muted">View all quick keys & commands</div>
              </div>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[10px] font-mono text-ink">?</kbd>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open-onboarding-modal'))}
            className="p-3.5 rounded-xl border border-border bg-surface hover:bg-surface-2 flex items-center justify-between text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <span className="text-base">✨</span>
              <div>
                <div className="text-xs font-semibold text-ink">Replay Onboarding Tour</div>
                <div className="text-[11px] text-ink-muted">Review features and personalization</div>
              </div>
            </div>
            <span className="text-xs text-accent font-semibold">Start &rarr;</span>
          </button>
        </div>
      </section>

      {/* 5. Danger Zone */}
      <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-red-600 dark:text-red-400">
            Danger Zone
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Irreversible actions that completely reset your local storage and delete all attachments.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="font-semibold text-sm text-red-900 dark:text-red-200">
              Delete all data
            </h4>
            <p className="text-xs text-red-700 dark:text-red-400">
              Permanently purge all notes, attachments, inbox captures, archive, and trash.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmationInput('');
              setShowDeleteAllModal(true);
            }}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs self-start sm:self-auto shrink-0 transition-colors cursor-pointer"
          >
            Delete all data
          </button>
        </div>
      </section>

      {/* Import Preview & Strategy Modal */}
      {importCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Import Backup
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Found {importCandidate.notes.length} notes and{' '}
                {importCandidate.attachments?.length ?? 0} attachments (v{importCandidate.version}, exported on{' '}
                {new Date(importCandidate.exportedAt).toLocaleDateString()}).
              </p>
            </div>

            {/* Strategy Options */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Choose merge strategy:
              </label>

              <div
                onClick={() => setImportStrategy('merge')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  importStrategy === 'merge'
                    ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/40'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="importStrategy"
                    checked={importStrategy === 'merge'}
                    onChange={() => setImportStrategy('merge')}
                    className="text-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Merge (keep both, newest wins on same ID)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-5">
                  Combines backup with your current notes and attachments without losing recent edits.
                </p>
              </div>

              <div
                onClick={() => setImportStrategy('replace')}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  importStrategy === 'replace'
                    ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/40'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="importStrategy"
                    checked={importStrategy === 'replace'}
                    onChange={() => setImportStrategy('replace')}
                    className="text-blue-600"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Replace everything
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-5">
                  Clears all current notes and attachments and loads this backup file.
                </p>
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setImportCandidate(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                Import Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone: Typed Confirmation Modal */}
      {showDeleteAllModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h3 className="font-bold text-base">Erase all data?</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This action permanently purges all notes, tasks, events, people, habits, focus sessions, and attachments. To proceed, please type{' '}
              <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE ALL</span> below:
            </p>


            <input
              type="text"
              autoFocus
              value={deleteConfirmationInput}
              onChange={(e) => setDeleteConfirmationInput(e.target.value)}
              placeholder="DELETE ALL"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500/50"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmationInput.trim() !== 'DELETE ALL'}
                onClick={handleConfirmDeleteAll}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white shadow-xs transition-colors cursor-pointer"
              >
                Erase Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
