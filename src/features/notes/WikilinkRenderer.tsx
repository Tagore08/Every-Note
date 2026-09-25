import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseContentSegments, normalizeTitle } from '../../lib/wikilinks';
import { useActiveNotes } from '../../db/notesRepo';

export interface WikilinkRendererProps {
  content: string;
  className?: string;
  onWikilinkClick?: (targetTitle: string, resolvedId: number | null) => void;
}

export function WikilinkRenderer({
  content,
  className = '',
  onWikilinkClick,
}: WikilinkRendererProps) {
  const navigate = useNavigate();
  const allNotes = useActiveNotes() || [];

  // Map of normalized title/journalDate -> note
  const notesMap = useMemo(() => {
    const map = new Map<string, { id?: number; kind?: string; journalDate?: string | null }>();
    for (const n of allNotes) {
      if (n.title) {
        map.set(normalizeTitle(n.title), { id: n.id, kind: n.kind, journalDate: n.journalDate });
      }
      if (n.journalDate) {
        map.set(normalizeTitle(n.journalDate), { id: n.id, kind: n.kind, journalDate: n.journalDate });
      }
    }
    return map;
  }, [allNotes]);

  const segments = useMemo(() => parseContentSegments(content), [content]);

  const handleLinkClick = (targetTitle: string) => {
    const norm = normalizeTitle(targetTitle);
    const target = notesMap.get(norm);

    if (onWikilinkClick) {
      onWikilinkClick(targetTitle, target?.id ?? null);
      return;
    }

    if (target?.id) {
      if (target.kind === 'journal' && target.journalDate) {
        navigate(`/journal/${target.journalDate}`);
      } else {
        navigate(`/notes/${target.id}`);
      }
    } else {
      // Unresolved note link: navigate to notes with filter or search
      navigate(`/notes?search=${encodeURIComponent(targetTitle)}`);
    }
  };

  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {segments.map((segment, idx) => {
        if (segment.type === 'text') {
          return <span key={idx}>{segment.text}</span>;
        }

        const rawTitle = segment.rawTitle || '';
        const norm = normalizeTitle(rawTitle);
        const resolved = notesMap.has(norm);
        const display = segment.displayText || rawTitle;

        return (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleLinkClick(rawTitle);
            }}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 align-baseline ${
              resolved
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:brightness-95 border border-[var(--color-accent)]/20 shadow-xs'
                : 'bg-[var(--color-surface-2)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] border border-dashed border-[var(--color-border-strong)]'
            }`}
            title={resolved ? `Go to "${rawTitle}"` : `Unresolved note: "${rawTitle}"`}
          >
            <span className="opacity-60 text-[10px]">[[</span>
            <span className="font-semibold underline decoration-transparent hover:decoration-current">
              {display}
            </span>
            <span className="opacity-60 text-[10px]">]]</span>
            {!resolved && (
              <span className="text-[10px] text-amber-500 font-bold ml-0.5" title="Unresolved link">
                ?
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
