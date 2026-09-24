import { useState, useRef, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTheme, type ThemeMode } from '../../hooks/useTheme';
import { notesRepo, useArchivedNotes, useTrashNotes } from '../../db/notesRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import type { Note } from '../../types/note';

interface BackupEnvelope {
  version: number;
  app: string;
  exportedAt: string;
  notes: Note[];
  settings?: {
    theme?: string;
  };
}

export function SettingsView() {
  const { mode, setMode, isDark } = useTheme();
  const { showSnackbar, showUndo } = useSnackbar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const archivedNotes = useArchivedNotes();
  const trashNotes = useTrashNotes();

  // Import flow state
  const [importCandidate, setImportCandidate] = useState<BackupEnvelope | null>(null);
  const [importStrategy, setImportStrategy] = useState<'merge' | 'replace'>('merge');
  const [importError, setImportError] = useState<string | null>(null);

  // Danger zone modal state
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

  // 1. Export Flow
  const handleExport = async () => {
    try {
      const allNotes = await notesRepo.getAllNotesForExport();
      const payload: BackupEnvelope = {
        version: 1,
        app: 'notes-app',
        exportedAt: new Date().toISOString(),
        notes: allNotes,
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

      showSnackbar({ message: `Exported ${allNotes.length} notes successfully.` });
    } catch (err) {
      console.error('Failed to export data:', err);
      showSnackbar({ message: 'Failed to export backup.' });
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

      // Handle standard envelope or direct notes array gracefully
      let notesArray: unknown[] = [];
      let exportedAt = new Date().toISOString();
      let version = 1;

      if ('notes' in parsed && Array.isArray((parsed as BackupEnvelope).notes)) {
        notesArray = (parsed as BackupEnvelope).notes;
        exportedAt = (parsed as BackupEnvelope).exportedAt || exportedAt;
        version = (parsed as BackupEnvelope).version || version;
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
      });
      setImportStrategy('merge');
    } catch (err) {
      console.error('Import parse failed:', err);
      setImportError('Failed to read file. Please ensure it is an uncorrupted JSON backup.');
    } finally {
      // Reset input so re-selecting the same file fires onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 3. Confirm Import
  const handleConfirmImport = async () => {
    if (!importCandidate) return;

    try {
      const result = await notesRepo.importNotes(importCandidate.notes, importStrategy);
      const importedCount = result.importedCount;
      const prevNotes = result.previousSnapshot;

      setImportCandidate(null);

      showUndo(
        `Imported ${importedCount} notes (${importStrategy}).`,
        async () => {
          if (prevNotes) {
            await notesRepo.importNotes(prevNotes, 'replace');
          }
        }
      );
    } catch (err) {
      console.error('Failed to import notes:', err);
      setImportError('An error occurred during import. No data was corrupted.');
    }
  };

  // 4. Danger Zone: Delete All Data
  const handleConfirmDeleteAll = async () => {
    if (deleteConfirmationInput.trim() !== 'DELETE ALL') return;

    try {
      await notesRepo.deleteAllNotes();
      setShowDeleteAllModal(false);
      setDeleteConfirmationInput('');
      showSnackbar({ message: 'All notes and data have been completely deleted.' });
    } catch (err) {
      console.error('Failed to delete all notes:', err);
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
          Manage appearance, data backups, and storage preferences.
        </p>
      </div>

      {/* Quick Navigation to Archive & Trash (especially convenient on mobile) */}
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
              { key: 'light', label: 'Light', icon: 'sun', desc: 'Always light' },
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
                className={`p-4 rounded-xl border text-left transition-all ${
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

      {/* 2. Data & Backups Section */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Data & Backup
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your notes live purely in your browser's IndexedDB. Export backups regularly to keep your data safe.
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
                Download all your notes, tags, archive, and settings in a single portable JSON file.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors shadow-xs"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download Backup</span>
            </button>
          </div>

          {/* Import card */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                Import data (JSON)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Restore or merge notes from a previously exported JSON backup file.
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
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
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

      {/* 3. Danger Zone */}
      <section className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-red-600 dark:text-red-400">
            Danger Zone
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Irreversible actions that completely reset your local storage.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="font-semibold text-sm text-red-900 dark:text-red-200">
              Delete all data
            </h4>
            <p className="text-xs text-red-700 dark:text-red-400">
              Permanently purge all notes, inbox captures, archive, and trash from this browser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmationInput('');
              setShowDeleteAllModal(true);
            }}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs self-start sm:self-auto shrink-0 transition-colors"
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
                Found {importCandidate.notes.length} notes in backup (exported on{' '}
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
                  Combines backup with your current notes without losing recent edits.
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
                  Clears all current notes and loads exactly what is in this backup file.
                </p>
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setImportCandidate(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
              >
                Import Notes
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
              This action cannot be undone. To proceed, please type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE ALL</span> below:
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
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmationInput.trim() !== 'DELETE ALL'}
                onClick={handleConfirmDeleteAll}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white shadow-xs transition-colors"
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
