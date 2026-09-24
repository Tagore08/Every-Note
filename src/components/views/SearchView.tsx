import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
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
            className="bg-amber-200/80 dark:bg-amber-500/40 text-inherit rounded-xs px-0.5 font-medium"
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Search Bar Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
          className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-base shadow-xs transition-all"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3 bg-white/50 dark:bg-slate-900/30">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Instant Local Search
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              Type keywords above to instantly filter through note titles, bodies, and tags.
            </p>
          </div>
        </div>
      ) : results === undefined ? (
        <div className="py-8 text-center text-sm text-slate-400 animate-pulse">Searching...</div>
      ) : results.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2 bg-white dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No notes found matching <span className="font-semibold">"{query}"</span>
          </p>
          <p className="text-xs text-slate-400">
            Search is case-insensitive across titles, bodies, and tags.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-xs font-medium text-slate-400 dark:text-slate-500 px-1">
            Found {results.length} {results.length === 1 ? 'match' : 'matches'}
          </div>

          {results.map((note) => {
            const displayTitle = getDisplayTitle(note);
            const snippet = getSearchSnippet(note.content, query);

            return (
              <div
                key={note.id}
                onClick={() => navigate(`/notes/${note.id}`)}
                className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs hover:border-blue-400/60 dark:hover:border-blue-500/60 transition-all cursor-pointer space-y-2.5"
              >
                {/* Title & metadata */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    <HighlightedText text={displayTitle} query={query} />
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                    {note.inbox && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 text-[10px] font-medium border border-blue-200 dark:border-blue-900">
                        Inbox
                      </span>
                    )}
                    <span>{formatRelativeTime(note.updatedAt)}</span>
                  </div>
                </div>

                {/* Highlighted snippet */}
                {snippet && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <HighlightedText text={snippet} query={query} />
                  </p>
                )}

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        #<HighlightedText text={tag} query={query} />
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
