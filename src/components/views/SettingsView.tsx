import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTheme, type ThemeMode } from '../../hooks/useTheme';
import { notesRepo, useArchivedNotes, useTrashNotes } from '../../db/notesRepo';
import { attachmentsRepo } from '../../db/attachmentsRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatFileSize } from '../../utils/format';
import type { Note } from '../../types/note';
import type { Attachment } from '../../types/attachment';
import type { Task } from '../../types/task';

interface ExportAttachment extends Omit<Attachment, 'data'> {
  dataBase64?: string;
}

interface BackupEnvelope {
  version: number;
  app: string;
  exportedAt: string;
  notes: Note[];
  tasks?: Task[];
  attachments?: ExportAttachment[];
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

  // Import flow state
  const [importCandidate, setImportCandidate] = useState<BackupEnvelope | null>(null);
  const [importStrategy, setImportStrategy] = useState<'merge' | 'replace'>('merge');
  const [importError, setImportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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

  // 1. Export Flow (Including base64 encoded attachments)
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const allNotes = await notesRepo.getAllNotesForExport();
      const allTasks = await tasksRepo.getAllTasksForExport();
      const allAttachments = await attachmentsRepo.getAllAttachmentsForExport();

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

      const payload: BackupEnvelope = {
        version: 3, // Bumped to Version 3 for Stage 5 tasks
        app: 'notes-app',
        exportedAt: new Date().toISOString(),
        notes: allNotes,
        tasks: allTasks,
        attachments: exportedAttachments,
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
        message: `Exported ${allNotes.length} notes, ${allTasks.length} tasks & ${allAttachments.length} attachments (${formattedFileSize}).`,
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
      let tasksArray: Task[] = [];
      let attachmentsArray: ExportAttachment[] = [];
      let exportedAt = new Date().toISOString();
      let version = 1;

      if ('notes' in parsed && Array.isArray((parsed as BackupEnvelope).notes)) {
        notesArray = (parsed as BackupEnvelope).notes;
        exportedAt = (parsed as BackupEnvelope).exportedAt || exportedAt;
        version = (parsed as BackupEnvelope).version || version;
        if ('tasks' in parsed && Array.isArray((parsed as BackupEnvelope).tasks)) {
          tasksArray = (parsed as BackupEnvelope).tasks ?? [];
        }
        if ('attachments' in parsed && Array.isArray((parsed as BackupEnvelope).attachments)) {
          attachmentsArray = (parsed as BackupEnvelope).attachments ?? [];
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
        tasks: tasksArray,
        attachments: attachmentsArray,
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

  // 3. Confirm Import (Restores Notes, Tasks, and Attachments)
  const handleConfirmImport = async () => {
    if (!importCandidate) return;

    try {
      // Snapshot existing tasks and attachments before mutating (for undo)
      const prevTasks = await tasksRepo.getAllTasksForExport();
      const prevAttachments = await attachmentsRepo.getAllAttachmentsForExport();

      // 1. Import Notes
      const result = await notesRepo.importNotes(importCandidate.notes, importStrategy);
      const importedNotesCount = result.importedCount;
      const prevNotes = result.previousSnapshot;

      // 2. Import Tasks
      let importedTasksCount = 0;
      if (importCandidate.tasks && importCandidate.tasks.length > 0) {
        importedTasksCount = await tasksRepo.importTasks(importCandidate.tasks, importStrategy);
      }

      // 3. Import Attachments (if any in candidate)
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

      setImportCandidate(null);
      await loadStorageEstimate();

      showUndo(
        `Imported ${importedNotesCount} notes, ${importedTasksCount} tasks & ${importedAttachmentsCount} attachments (${importStrategy}).`,
        async () => {
          if (prevNotes) {
            await notesRepo.importNotes(prevNotes, 'replace');
          }
          if (importStrategy === 'replace' && prevTasks) {
            await tasksRepo.importTasks(prevTasks, 'replace');
          }
          if (importStrategy === 'replace' && prevAttachments) {
            await attachmentsRepo.importAttachments(prevAttachments, 'replace');
          }
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
      setShowDeleteAllModal(false);
      setDeleteConfirmationInput('');
      await loadStorageEstimate();
      showSnackbar({ message: 'All notes, tasks, and attachments have been completely deleted.' });
    } catch (err) {
      console.error('Failed to delete all data:', err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Settings
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage appearance, data backups, storage quota, and preferences.
        </p>
      </div>

      {/* Quick Navigation to Archive & Trash */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/archive"
          className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="5" rx="1" />
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <path d="M10 12h4" />
            </svg>
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Archive</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
            {archivedNotes?.length ?? 0}
          </span>
        </Link>

        <Link
          to="/trash"
          className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Trash</span>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
            {trashNotes?.length ?? 0}
          </span>
        </Link>
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(
            [
              { key: 'light', label: 'Light', desc: 'Always light' },
              { key: 'dark', label: 'Dark', desc: 'Always dark' },
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
                    ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/40 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">
                    {item.label}
                  </span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Browser Storage & Quota Estimation */}
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
        </div>
      </section>

      {/* 4. Danger Zone */}
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
              This action permanently purges all notes and attachments. To proceed, please type{' '}
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
