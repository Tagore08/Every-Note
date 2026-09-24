import { useState, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSearchNotes } from '../../db/notesRepo';
import { getDisplayTitle, getSearchSnippet, formatRelativeTime } from '../../utils/format';

function HighlightedText({ text, query }: { text: string; query: string }): ReactNode {
  if (!query.trim() || !text) return text;

  // Escape special regex characters
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-accent-soft text-accent rounded-xs px-0.5 font-semibold"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

export function SearchView() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const results = useSearchNotes(query);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const resultList = results ?? [];

  const rowVirtualizer = useVirtualizer({
    count: resultList.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 110,
    overscan: 5,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Search Bar Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-muted">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, body content, or #tags..."
          className="w-full pl-11 pr-10 py-3.5 rounded-card border border-border bg-surface text-ink placeholder-ink-muted focus:outline-none focus:border-accent text-base shadow-card transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-muted hover:text-ink cursor-pointer min-h-[44px] min-w-[44px] justify-center"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Query state */}
      {!query.trim() ? (
        <div className="rounded-card border border-border p-12 text-center space-y-3 bg-surface shadow-card">
          <div className="w-10 h-10 rounded-full bg-surface-2 text-ink-muted mx-auto flex items-center justify-center">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">
              Instant Local Search
            </h3>
            <p className="text-xs text-ink-muted mt-1 max-w-xs mx-auto">
              Type keywords above to instantly filter through note titles, bodies, and tags.
            </p>
          </div>
        </div>
      ) : results === undefined ? (
        <div className="py-8 text-center text-sm text-ink-muted animate-pulse">Searching...</div>
      ) : resultList.length === 0 ? (
        <div className="rounded-card border border-border p-8 text-center space-y-2 bg-surface shadow-card">
          <p className="text-sm text-ink">
            No notes found matching <span className="font-semibold">"{query}"</span>
          </p>
          <p className="text-xs text-ink-muted">
            Search is case-insensitive across titles, bodies, and tags.
          </p>
        </div>
      ) : (
        /* Virtualized Results List */
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-muted px-1">
            Found {resultList.length} {resultList.length === 1 ? 'match' : 'matches'}
          </div>

          <div
            ref={scrollContainerRef}
            className="h-[calc(100vh-16rem)] overflow-y-auto pr-1"
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: '100%',
                position: 'relative',
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const note = resultList[virtualRow.index];
                const snippet = getSearchSnippet(note.content, query);

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
                    className="pb-3"
                  >
                    <div
                      onClick={() => navigate(`/notes/${note.id}`)}
                      className="p-4 sm:p-5 rounded-card border border-border bg-surface hover:border-accent/40 shadow-card transition-all cursor-pointer space-y-2 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-base text-ink line-clamp-1">
                          <HighlightedText text={getDisplayTitle(note)} query={query} />
                        </h4>
                        <span className="text-[11px] text-ink-muted shrink-0">
                          {formatRelativeTime(note.updatedAt)}
                        </span>
                      </div>

                      {snippet && (
                        <p className="text-sm text-ink-muted line-clamp-2 leading-relaxed">
                          <HighlightedText text={snippet} query={query} />
                        </p>
                      )}

                      {note.tags && note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {note.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted"
                            >
                              #<HighlightedText text={t} query={query} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
