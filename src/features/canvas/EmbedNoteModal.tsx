import { useState, useEffect } from 'react';
import { db } from '../../db/database';
import type { Note } from '../../types/note';

interface EmbedNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNote: (note: { id: number; title: string; content?: string }) => void;
}

export function EmbedNoteModal({ isOpen, onClose, onSelectNote }: EmbedNoteModalProps) {
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      return;
    }

    setLoading(true);
    db.notes
      .filter((n) => !n.trashedAt)
      .toArray()
      .then((items) => {
        items.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setNotes(items);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load notes for canvas embedding:', err);
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = notes.filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
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
        className="w-full max-w-md bg-surface rounded-card border border-border shadow-float flex flex-col max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-lg">📄</span>
            <h3 className="font-semibold text-ink text-base">Embed Note Card</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border bg-surface-2/40">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes to embed..."
            autoFocus
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-ink placeholder:text-ink-muted focus:border-accent focus:outline-hidden"
          />
        </div>

        {/* Notes list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="p-6 text-center text-xs text-ink-muted animate-pulse">
              Loading notes...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-ink-muted">
              {search ? 'No notes matched your search.' : 'No notes available.'}
            </div>
          ) : (
            filtered.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => {
                  if (note.id) {
                    onSelectNote({
                      id: note.id,
                      title: note.title || 'Untitled Note',
                      content: note.content ? note.content.slice(0, 120) : '',
                    });
                    onClose();
                  }
                }}
                className="w-full text-left p-3 rounded-lg hover:bg-surface-2 transition-colors cursor-pointer border border-transparent hover:border-border group"
              >
                <div className="font-medium text-sm text-ink group-hover:text-accent truncate">
                  {note.title || 'Untitled Note'}
                </div>
                {note.content && (
                  <div className="text-xs text-ink-muted line-clamp-2 mt-0.5">
                    {note.content.replace(/<[^>]+>/g, '').slice(0, 100)}
                  </div>
                )}
                <div className="text-[10px] text-ink-muted/70 mt-1">
                  Updated {new Date(note.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
