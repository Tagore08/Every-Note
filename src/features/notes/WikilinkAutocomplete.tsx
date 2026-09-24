import { useState, useEffect, useRef } from 'react';
import { db } from '../../db/database';
import { normalizeTitle } from '../../lib/wikilinks';
import type { Note } from '../../types/note';

export interface WikilinkAutocompleteProps {
  query: string;
  isOpen: boolean;
  onSelect: (title: string) => void;
  onClose: () => void;
  currentNoteId?: number | null;
}

export function WikilinkAutocomplete({
  query,
  isOpen,
  onSelect,
  onClose,
  currentNoteId,
}: WikilinkAutocompleteProps) {
  const [candidates, setCandidates] = useState<Note[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setCandidates([]);
      setSelectedIndex(0);
      return;
    }

    let isCancelled = false;
    const cleanQuery = query.trim().toLowerCase();

    db.notes
      .filter((n) => n.trashedAt === null && (!currentNoteId || n.id !== currentNoteId))
      .toArray()
      .then((notes) => {
        if (isCancelled) return;

        let filtered: Note[] = [];
        if (!cleanQuery) {
          // If no query yet, show recent notes
          filtered = [...notes].sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        } else {
          // Ranked: title startsWith > title contains
          const prefixMatches: Note[] = [];
          const containsMatches: Note[] = [];

          for (const n of notes) {
            const titleNorm = normalizeTitle(n.title || '');
            const journalNorm = n.journalDate ? normalizeTitle(n.journalDate) : '';

            if (titleNorm.startsWith(cleanQuery) || journalNorm.startsWith(cleanQuery)) {
              prefixMatches.push(n);
            } else if (titleNorm.includes(cleanQuery) || journalNorm.includes(cleanQuery)) {
              containsMatches.push(n);
            }
          }

          prefixMatches.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
          containsMatches.sort((a, b) => (a.title || '').localeCompare(b.title || ''));

          filtered = [...prefixMatches, ...containsMatches];
        }

        // Limit to 8 rows max per spec
        const top8 = filtered.slice(0, 8);
        setCandidates(top8);
        setSelectedIndex(0);
      });

    return () => {
      isCancelled = true;
    };
  }, [query, isOpen, currentNoteId]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const total = candidates.length + (query.trim() ? 1 : 0);
          return total > 0 ? (prev + 1) % total : 0;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const total = candidates.length + (query.trim() ? 1 : 0);
          return total > 0 ? (prev - 1 + total) % total : 0;
        });
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (selectedIndex < candidates.length) {
          const chosen = candidates[selectedIndex];
          onSelect(chosen.title || chosen.journalDate || 'Untitled');
        } else if (query.trim()) {
          // Create link to new title
          onSelect(query.trim());
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, candidates, selectedIndex, query, onSelect, onClose]);

  if (!isOpen) return null;

  const showCreateOption = query.trim().length > 0 && !candidates.some((c) => normalizeTitle(c.title || '') === normalizeTitle(query));

  return (
    <div
      ref={containerRef}
      className="absolute z-50 left-4 right-4 sm:left-auto sm:w-80 mt-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-float)] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ maxHeight: '280px' }}
      onMouseDown={(e) => e.preventDefault()} // Keep textarea focus
    >
      <div className="p-2 border-b border-[var(--color-border)] text-xs text-[var(--color-ink-muted)] flex items-center justify-between font-medium">
        <span>Link to note</span>
        <span className="text-[10px] tracking-wider uppercase opacity-75">↑↓ Enter</span>
      </div>

      <div className="overflow-y-auto max-h-60 p-1">
        {candidates.map((c, idx) => {
          const isSelected = idx === selectedIndex;
          const displayTitle = c.title || (c.journalDate ? `Journal — ${c.journalDate}` : 'Untitled Note');

          return (
            <button
              key={c.id ?? idx}
              type="button"
              onClick={() => onSelect(c.title || c.journalDate || 'Untitled')}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center justify-between gap-2 transition-colors ${
                isSelected
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-medium'
                  : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              <div className="truncate flex-1">
                <span>{displayTitle}</span>
                {c.kind === 'journal' && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                    Journal
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {showCreateOption && (
          <button
            type="button"
            onClick={() => onSelect(query.trim())}
            onMouseEnter={() => setSelectedIndex(candidates.length)}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors border-t border-[var(--color-border)] mt-1 ${
              selectedIndex === candidates.length
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-medium'
                : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <span className="text-xs text-[var(--color-accent)] font-semibold">+</span>
            <span className="truncate">Create «{query.trim()}»</span>
          </button>
        )}

        {candidates.length === 0 && !showCreateOption && (
          <div className="p-4 text-center text-xs text-[var(--color-ink-muted)]">
            No notes found
          </div>
        )}
      </div>
    </div>
  );
}
