import { useNavigate } from 'react-router-dom';
import { useArchivedNotes, notesRepo } from '../../db/notesRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { getDisplayTitle, getContentSnippet, formatRelativeTime } from '../../utils/format';

export function ArchiveView() {
  const notes = useArchivedNotes();
  const navigate = useNavigate();
  const { showUndo } = useSnackbar();

  const handleUnarchive = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (typeof id !== 'number') return;
    try {
      await notesRepo.unarchiveNote(id);
      showUndo('Note unarchived', async () => {
        await notesRepo.archiveNote(id);
      });
    } catch (err) {
      console.error('Failed to unarchive note:', err);
    }
  };

  const handleTrash = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
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

  if (notes === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center">
        <div className="text-sm text-slate-400 animate-pulse">Loading archive...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Archive
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {notes.length}
          </span>
        </div>
      </div>

      {/* Empty State */}
      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3 bg-white/50 dark:bg-slate-900/30">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="5" rx="1" />
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <path d="M10 12h4" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              No archived notes
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Archive notes you want to keep for reference without cluttering your active list.
            </p>
          </div>
        </div>
      ) : (
        /* Archived Notes List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => navigate(`/notes/${note.id}`)}
              className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {getDisplayTitle(note)}
                  </h3>
                  <span className="text-xs text-slate-400 shrink-0">
                    {formatRelativeTime(note.updatedAt)}
                  </span>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {getContentSnippet(note.content, 2) || (
                    <span className="italic text-slate-400">Empty note</span>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex flex-wrap gap-1">
                  {note.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={(e) => handleUnarchive(e, note.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                    title="Unarchive note"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 14 4 9 9 4" />
                      <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                    </svg>
                    <span>Unarchive</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleTrash(e, note.id)}
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title="Move to trash"
                    aria-label="Move to trash"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
