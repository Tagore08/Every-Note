import { useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useActiveNotes, notesRepo } from '../../db/notesRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatRelativeTime, getDisplayTitle, getContentSnippet } from '../../utils/format';
import type { Note } from '../../types/note';

export function NotesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tagFilter = searchParams.get('tag') || undefined;
  const navigate = useNavigate();
  const { showUndo } = useSnackbar();

  const notes = useActiveNotes(tagFilter);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track long-press to distinguish between tap and hold on mobile
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressActive = useRef(false);

  const handleTogglePin = useCallback(
    async (id?: number, currentPinned?: boolean) => {
      if (typeof id !== 'number') return;
      try {
        const next = !currentPinned;
        await notesRepo.togglePin(id, next);
        showUndo(next ? 'Note pinned to top' : 'Note unpinned', async () => {
          await notesRepo.togglePin(id, currentPinned ?? false);
        });
      } catch (err) {
        console.error('Failed to toggle pin:', err);
      }
    },
    [showUndo]
  );

  const handleArchive = useCallback(
    async (e: React.MouseEvent, id?: number) => {
      e.stopPropagation();
      if (typeof id !== 'number') return;
      try {
        await notesRepo.archiveNote(id);
        showUndo('Note archived', async () => {
          await notesRepo.unarchiveNote(id);
        });
      } catch (err) {
        console.error('Failed to archive note:', err);
      }
    },
    [showUndo]
  );

  const handleTrash = useCallback(
    async (e: React.MouseEvent, id?: number) => {
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
    },
    [showUndo]
  );

  // Mobile long-press handlers
  const handleTouchStart = (note: Note) => {
    isLongPressActive.current = false;
    touchTimer.current = setTimeout(() => {
      isLongPressActive.current = true;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(40);
        } catch {
          // Ignore vibration permissions error
        }
      }
      handleTogglePin(note.id, note.pinned);
    }, 500);
  };

  const handleTouchEndOrMove = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  };

  const handleCardClick = (note: Note) => {
    if (isLongPressActive.current) {
      isLongPressActive.current = false;
      return;
    }
    navigate(`/notes/${note.id}`);
  };

  const handleClearTagFilter = () => {
    searchParams.delete('tag');
    setSearchParams(searchParams);
  };

  const noteList = notes ?? [];

  // TanStack Virtualizer for smooth 60fps scrolling over large lists
  const rowVirtualizer = useVirtualizer({
    count: noteList.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 140,
    overscan: 6,
  });

  if (notes === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center">
        <div className="text-sm text-ink-muted animate-pulse">Loading notes...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              Notes
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-2 text-ink border border-border">
              {notes.length}
            </span>
          </div>
          {tagFilter && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-ink-muted">Filtered by tag:</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-accent-soft text-accent border border-accent/20">
                #{tagFilter}
                <button
                  type="button"
                  onClick={handleClearTagFilter}
                  className="hover:opacity-80 p-0.5"
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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-pill text-sm font-semibold bg-accent text-accent-ink shadow-card hover:opacity-90 active:scale-95 transition-all self-start sm:self-auto cursor-pointer min-h-[44px]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Note</span>
        </button>
      </div>

      {/* Empty State */}
      {noteList.length === 0 ? (
        <div className="rounded-card border border-border p-12 text-center space-y-4 bg-surface shadow-card">
          <div className="w-12 h-12 rounded-full bg-surface-2 text-ink-muted mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink">
              {tagFilter ? `No notes tagged #${tagFilter}` : 'No notes yet'}
            </h3>
            <p className="text-sm text-ink-muted mt-1 max-w-sm mx-auto">
              {tagFilter
                ? 'Try removing the tag filter to see all active notes.'
                : 'Create your first note to start organizing your thoughts.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => (tagFilter ? handleClearTagFilter() : navigate('/notes/new'))}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill text-sm font-semibold bg-accent text-accent-ink hover:opacity-90 transition-opacity shadow-card min-h-[44px] cursor-pointer"
          >
            <span>{tagFilter ? 'Clear tag filter' : 'Create a note'}</span>
          </button>
        </div>
      ) : (
        /* Virtualized Notes List */
        <div
          ref={scrollContainerRef}
          className="h-[calc(100vh-14rem)] overflow-y-auto pr-1"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const note = noteList[virtualRow.index];
              return (
                <div
                  key={note.id ?? virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="pb-3.5"
                >
                  <div
                    onClick={() => handleCardClick(note)}
                    onTouchStart={() => handleTouchStart(note)}
                    onTouchEnd={handleTouchEndOrMove}
                    onTouchMove={handleTouchEndOrMove}
                    className={`group relative rounded-card border p-4 sm:p-5 shadow-card transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                      note.pinned
                        ? 'border-amber-400/40 bg-surface hover:border-amber-500/60'
                        : 'border-border bg-surface hover:border-accent/40'
                    }`}
                  >
                    <div className="space-y-1.5">
                      {/* Note Header */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-base text-ink line-clamp-1 group-hover:text-accent transition-colors">
                          {getDisplayTitle(note)}
                        </h3>
                        <div className="flex items-center gap-1">
                          {note.pinned && (
                            <span className="p-1 text-amber-500" title="Pinned to top">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" strokeWidth="2" />
                                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Snippet */}
                      <p className="text-sm text-ink-muted line-clamp-2 leading-relaxed">
                        {getContentSnippet(note.content, 2) || (
                          <span className="italic opacity-60">Empty note</span>
                        )}
                      </p>
                    </div>

                    {/* Footer: Tags, Updated Date, Actions */}
                    <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border/60">
                      {/* Tags row */}
                      {note.tags && note.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {note.tags.map((tag) => (
                            <span
                              key={tag}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchParams({ tag });
                              }}
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted hover:text-accent hover:bg-accent-soft transition-colors min-h-[24px] inline-flex items-center"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-ink-muted">
                          {formatRelativeTime(note.updatedAt)}
                        </span>
                      )}

                      {/* Card Actions */}
                      <div className="flex items-center gap-1 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(note.id, note.pinned);
                          }}
                          className={`p-2 rounded-lg transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center ${
                            note.pinned
                              ? 'text-amber-500 hover:bg-surface-2'
                              : 'text-ink-muted hover:text-ink hover:bg-surface-2'
                          }`}
                          title={note.pinned ? 'Unpin note' : 'Pin note'}
                          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" strokeWidth="2" />
                            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleArchive(e, note.id)}
                          className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Archive note"
                          aria-label="Archive note"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="3" width="20" height="5" rx="1" />
                            <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                            <path d="M10 12h4" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleTrash(e, note.id)}
                          className="p-2 rounded-lg text-ink-muted hover:text-danger hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="Delete note"
                          aria-label="Delete note"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
