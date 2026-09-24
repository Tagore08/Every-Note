import { useSearchParams, useNavigate } from 'react-router-dom';
import { useActiveNotes, notesRepo } from '../../db/notesRepo';
import { formatRelativeTime, getDisplayTitle, getContentSnippet } from '../../utils/format';

export function NotesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tagFilter = searchParams.get('tag') || undefined;
  const navigate = useNavigate();

  const notes = useActiveNotes(tagFilter);

  const handleTogglePin = async (e: React.MouseEvent, id?: number, currentPinned?: boolean) => {
    e.stopPropagation();
    if (typeof id !== 'number') return;
    try {
      await notesRepo.togglePin(id, !currentPinned);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const handleTrash = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (typeof id !== 'number') return;
    try {
      await notesRepo.trashNote(id);
    } catch (err) {
      console.error('Failed to trash note:', err);
    }
  };

  const handleClearTagFilter = () => {
    searchParams.delete('tag');
    setSearchParams(searchParams);
  };

  if (notes === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center">
        <div className="text-sm text-slate-400 animate-pulse">Loading notes...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Notes
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {notes.length}
            </span>
          </div>
          {tagFilter && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-500">Filtered by tag:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                #{tagFilter}
                <button
                  type="button"
                  onClick={handleClearTagFilter}
                  className="hover:text-blue-900 dark:hover:text-blue-100"
                  aria-label="Clear tag filter"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/notes/new')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors self-start sm:self-auto"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Note</span>
        </button>
      </div>

      {/* Empty State */}
      {notes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-4 bg-white/50 dark:bg-slate-900/30">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {tagFilter ? `No notes tagged #${tagFilter}` : 'No notes yet'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {tagFilter
                ? 'Try removing the tag filter to see all active notes.'
                : 'Create your first note to start organizing your knowledge base.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => (tagFilter ? handleClearTagFilter() : navigate('/notes/new'))}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 transition-colors shadow-xs"
          >
            <span>{tagFilter ? 'Clear tag filter' : 'Create a note'}</span>
          </button>
        </div>
      ) : (
        /* Notes Grid / List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {notes.map((note) => (
            <div
              key={note.id}
              onClick={() => navigate(`/notes/${note.id}`)}
              className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs hover:border-blue-400/60 dark:hover:border-blue-500/60 transition-all cursor-pointer flex flex-col justify-between gap-3"
            >
              <div className="space-y-2">
                {/* Note Header */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {getDisplayTitle(note)}
                  </h3>
                  <div className="flex items-center gap-1">
                    {note.pinned && (
                      <span className="p-1 text-amber-500" title="Pinned">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" strokeWidth="2" />
                          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>

                {/* 2-line snippet */}
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {getContentSnippet(note.content, 2) || (
                    <span className="italic text-slate-400 dark:text-slate-500">Empty note</span>
                  )}
                </p>
              </div>

              {/* Footer: Tags, Updated Date, and Actions */}
              <div className="pt-2 flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800/80">
                {/* Tags row */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchParams({ tag });
                        }}
                        className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 transition-colors"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                  <span>{formatRelativeTime(note.updatedAt)}</span>

                  {/* Card Actions */}
                  <div className="flex items-center gap-1 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(e, note.id, note.pinned)}
                      className="p-1 rounded text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      title={note.pinned ? 'Unpin' : 'Pin to top'}
                      aria-label={note.pinned ? 'Unpin' : 'Pin to top'}
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="17" x2="12" y2="22" />
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleTrash(e, note.id)}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                      title="Delete"
                      aria-label="Delete"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
