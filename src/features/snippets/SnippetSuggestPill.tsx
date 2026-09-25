import { type FC } from 'react';
import type { Snippet } from '../../types/snippet';

export interface SnippetSuggestPillProps {
  snippets: Snippet[];
  onSelect: (snippet: Snippet) => void;
  className?: string;
}

export const SnippetSuggestPill: FC<SnippetSuggestPillProps> = ({
  snippets,
  onSelect,
  className = '',
}) => {
  if (!snippets || snippets.length === 0) return null;

  return (
    <div
      className={`flex items-center gap-1.5 overflow-x-auto py-1 px-1.5 bg-blue-50/90 dark:bg-blue-950/80 backdrop-blur-xs rounded-xl border border-blue-200 dark:border-blue-800/80 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150 ${className}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 px-1 flex items-center gap-1 shrink-0">
        <span>⚡</span>
        <span className="hidden sm:inline">Snippet:</span>
      </span>

      {snippets.slice(0, 3).map((snippet, idx) => (
        <button
          key={snippet.id || snippet.trigger}
          type="button"
          onClick={() => onSelect(snippet)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
            idx === 0
              ? 'bg-blue-600 text-white shadow-xs hover:bg-blue-700'
              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400'
          }`}
          title={`${snippet.trigger} ➔ ${snippet.expansion}`}
        >
          <span className="font-bold">{snippet.trigger}</span>
          <span className="text-slate-300 dark:text-slate-500">→</span>
          <span className="max-w-[120px] sm:max-w-[180px] truncate opacity-90">
            {snippet.expansion.replace(/\n/g, ' ')}
          </span>
          {idx === 0 && (
            <kbd className="hidden sm:inline-block ml-1 px-1 py-0.2 rounded-xs bg-white/20 text-[9px] font-mono">
              Tab
            </kbd>
          )}
        </button>
      ))}
    </div>
  );
};
