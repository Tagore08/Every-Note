import { useNavigate, useOutletContext } from 'react-router-dom';
import { useInboxNotes, notesRepo } from '../../db/notesRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatRelativeTime, getDisplayTitle } from '../../utils/format';
import type { Note } from '../../types/note';

interface InboxViewProps {
  onOpenCapture?: () => void;
}

export function InboxView(props: InboxViewProps) {
  const notes = useInboxNotes();
  const navigate = useNavigate();
  const { showUndo } = useSnackbar();
  const outlet = useOutletContext<{ openCapture?: () => void } | null>();
  const onOpenCapture = props.onOpenCapture ?? outlet?.openCapture;

  const handleFileAsNote = async (id?: number) => {
    if (typeof id !== 'number') return;
    try {
      await notesRepo.fileInboxNote(id);
      showUndo('Filed as note', async () => {
        await notesRepo.updateNote(id, { inbox: true });
      });
      navigate(`/notes/${id}`);
    } catch (err) {
      console.error('Failed to file note:', err);
    }
  };

  const handleDelete = async (id?: number) => {
    if (typeof id !== 'number') return;
    try {
      await notesRepo.trashNote(id);
      showUndo('Note moved to trash', async () => {
        await notesRepo.restoreNote(id);
      });
    } catch (err) {
      console.error('Failed to trash note:', err);
    }
  };

  const handleConvertToTask = async (note: Note) => {
    if (typeof note.id !== 'number') return;
    try {
      const task = await tasksRepo.createTaskFromNote(note);
      await notesRepo.fileInboxNote(note.id);
      showUndo('Converted to task', async () => {
        if (task.id) await tasksRepo.deletePermanently(task.id);
        await notesRepo.updateNote(note.id!, { inbox: true });
      });
    } catch (err) {
      console.error('Failed to convert note to task:', err);
    }
  };

  if (notes === undefined) {
    return (
      <div className="max-w-3xl mx-auto py-12 flex justify-center">
        <div className="text-sm text-slate-400 animate-pulse">Loading inbox...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Inbox
          </h2>
          {notes.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
              {notes.length}
            </span>
          )}
        </div>
        {onOpenCapture && (
          <button
            type="button"
            onClick={onOpenCapture}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Capture</span>
          </button>
        )}
      </div>

      {/* Empty State */}
      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-4 bg-white/50 dark:bg-slate-900/30">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              Inbox Zero
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Your inbox is clear. Quick thoughts, clippings, and items to triage will appear here.
            </p>
          </div>
          {onOpenCapture && (
            <button
              type="button"
              onClick={onOpenCapture}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors shadow-xs"
            >
              <span>Capture a thought</span>
              <kbd className="text-[10px] px-1 py-0.5 rounded bg-slate-700 dark:bg-slate-200 text-slate-200 dark:text-slate-800 font-mono">
                N
              </kbd>
            </button>
          )}
        </div>
      ) : (
        /* Notes List */
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {getDisplayTitle(note)}
                  </span>
                  <span>{formatRelativeTime(note.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {note.content}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => handleDelete(note.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => handleConvertToTask(note)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-300 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
                  title="Convert to task and file note"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  <span>To task</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleFileAsNote(note.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/70 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>File as note</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
