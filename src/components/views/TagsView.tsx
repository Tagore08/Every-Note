import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTagsWithCounts, useActiveNotes } from '../../db/notesRepo';
import { getDisplayTitle, getContentSnippet, formatRelativeTime } from '../../utils/format';

export function TagsView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlTag = searchParams.get('tag') || null;

  const [selectedTag, setSelectedTag] = useState<string | null>(urlTag);
  const tagList = useTagsWithCounts();
  const notesForSelectedTag = useActiveNotes(selectedTag || undefined);

  useEffect(() => {
    setSelectedTag(urlTag);
  }, [urlTag]);

  const handleSelectTag = (tag: string) => {
    if (selectedTag === tag) {
      setSelectedTag(null);
      searchParams.delete('tag');
      setSearchParams(searchParams);
    } else {
      setSelectedTag(tag);
      setSearchParams({ tag });
    }
  };

  if (tagList === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center">
        <div className="text-sm text-slate-400 animate-pulse">Loading tags...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Tags
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {tagList.length}
          </span>
        </div>
      </div>

      {/* Empty State */}
      {tagList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-4 bg-white/50 dark:bg-slate-900/30">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              No tags yet
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Add tags to any note using the tag bar in the note editor to categorize and group ideas.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tags Chips / Cloud */}
          <div className="flex flex-wrap gap-2">
            {tagList.map(({ tag, count }) => {
              const isSelected = selectedTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleSelectTag(tag)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  <span>#{tag}</span>
                  <span
                    className={`text-xs px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? 'bg-blue-700 text-blue-100'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Notes under selected tag */}
          {selectedTag && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-mono tracking-wider text-slate-400">
                    Notes tagged
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    #{selectedTag}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectTag(selectedTag)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  Clear selection
                </button>
              </div>

              {notesForSelectedTag === undefined ? (
                <div className="py-6 text-sm text-slate-400 animate-pulse text-center">
                  Loading notes...
                </div>
              ) : notesForSelectedTag.length === 0 ? (
                <p className="text-sm text-slate-400 py-4">No active notes found with this tag.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {notesForSelectedTag.map((note) => (
                    <div
                      key={note.id}
                      onClick={() => navigate(`/notes/${note.id}`)}
                      className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs hover:border-blue-400/60 dark:hover:border-blue-500/60 transition-all cursor-pointer space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                          {getDisplayTitle(note)}
                        </h4>
                        <span className="text-xs text-slate-400 shrink-0">
                          {formatRelativeTime(note.updatedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {getContentSnippet(note.content, 2) || (
                          <span className="italic text-slate-400">Empty note</span>
                        )}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
