import { useState, useEffect } from 'react';
import { db } from '../../db/database';
import type { Note } from '../../types/note';

interface LinkNoteModalProps {
  isOpen: boolean;
  currentNoteId?: number | null;
  onClose: () => void;
  onSelectNote: (noteId: number | null) => void;
}

export function LinkNoteModal({
  isOpen,
  currentNoteId,
  onClose,
  onSelectNote,
}: LinkNoteModalProps) {
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    db.notes
      .toArray()
      .then((all) => {
        // Exclude trashed
        const valid = all.filter((n) => !n.trashedAt);
        setNotes(valid.sort((a, b) => (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) - (a.updatedAt ? new Date(a.updatedAt).getTime() : 0)));
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = notes.filter((n) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.content && n.content.toLowerCase().includes(q))
    );
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface rounded-card border border-border shadow-xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <h3 className="font-semibold text-ink text-base">Link Canvas to Note</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="p-3 border-b border-border bg-surface-2/40">
          <input
            type="text"
            placeholder="Search notes to link…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-ink text-sm placeholder:text-ink-muted focus:outline-hidden focus:border-accent"
            autoFocus
          />
        </div>

        {currentNoteId && (
          <div className="px-4 py-2 bg-amber-500/10 border-b border-border flex items-center justify-between">
            <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Currently linked</span>
            <button
              type="button"
              onClick={() => {
                onSelectNote(null);
                onClose();
              }}
              className="text-xs text-red-600 dark:text-red-400 hover:underline font-semibold cursor-pointer"
            >
              Unlink Note
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 divide-y divide-border/40">
          {loading ? (
            <div className="p-6 text-center text-ink-muted text-sm">Loading notes…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-ink-muted text-sm">
              {query ? 'No matching notes found.' : 'No notes available.'}
            </div>
          ) : (
            filtered.map((note) => {
              const isSelected = note.id === currentNoteId;
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => {
                    onSelectNote(note.id!);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-lg flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-accent/10 border border-accent/30'
                      : 'hover:bg-surface-2 text-ink'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-ink truncate">
                      {note.title || 'Untitled Note'}
                    </p>
                    {note.content && (
                      <p className="text-xs text-ink-muted line-clamp-1 mt-0.5">
                        {note.content.replace(/^[#*>\-\s]+/, '')}
                      </p>
                    )}
                  </div>
                  {isSelected && (
                    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-accent text-white font-medium">
                      Linked
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
