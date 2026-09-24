import { useState } from 'react';
import { useTrashNotes, notesRepo } from '../../db/notesRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { getDisplayTitle, getContentSnippet, formatRelativeTime } from '../../utils/format';

export function TrashView() {
  const notes = useTrashNotes();
  const { showUndo } = useSnackbar();

  // State for single-item delete modal
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  // State for empty trash confirmation modal
  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);

  const handleRestore = async (id?: number) => {
    if (typeof id !== 'number') return;
    try {
      await notesRepo.restoreNote(id);
      showUndo('Note restored', async () => {
        await notesRepo.trashNote(id);
      });
    } catch (err) {
      console.error('Failed to restore note:', err);
    }
  };

  const handleConfirmPermanentDelete = async () => {
    if (typeof deleteTargetId !== 'number') return;
    try {
      await notesRepo.deletePermanently(deleteTargetId);
      setDeleteTargetId(null);
    } catch (err) {
      console.error('Failed to permanently delete note:', err);
    }
  };

  const handleConfirmEmptyTrash = async () => {
    try {
      await notesRepo.emptyTrash();
      setShowEmptyTrashModal(false);
    } catch (err) {
      console.error('Failed to empty trash:', err);
    }
  };

  if (notes === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center">
        <div className="text-sm text-slate-400 animate-pulse">Loading trash...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Trash
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {notes.length}
          </span>
        </div>

        {notes.length > 0 && (
          <button
            type="button"
            onClick={() => setShowEmptyTrashModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/60 transition-colors self-start sm:self-auto"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>Empty Trash</span>
          </button>
        )}
      </div>

      {/* 30-day notice */}
      <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5 px-1">
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>Items older than 30 days are automatically purged on launch.</span>
      </div>

      {/* Empty State */}
      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3 bg-white/50 dark:bg-slate-900/30">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              Trash is empty
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Notes you delete will appear here. You can restore them or delete them permanently.
            </p>
          </div>
        </div>
      ) : (
        /* Trashed Notes List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base text-slate-900 dark:text-white line-clamp-1">
                    {getDisplayTitle(note)}
                  </h3>
                  <span className="text-xs text-slate-400 shrink-0">
                    Deleted {formatRelativeTime(note.trashedAt)}
                  </span>
                </div>

                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                  {getContentSnippet(note.content, 2) || (
                    <span className="italic text-slate-400">Empty note</span>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(note.id!)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
                >
                  Delete forever
                </button>
                <button
                  type="button"
                  onClick={() => handleRestore(note.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/70 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 14 4 9 9 4" />
                    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                  </svg>
                  <span>Restore</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog: Delete Single Note Forever */}
      {deleteTargetId !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Delete permanently?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This will completely remove this note from your IndexedDB database. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPermanentDelete}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs"
              >
                Delete forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Empty All Trash */}
      {showEmptyTrashModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Empty all trash?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              This will permanently delete all {notes.length} {notes.length === 1 ? 'note' : 'notes'} in the trash. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEmptyTrashModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEmptyTrash}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs"
              >
                Empty Trash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
