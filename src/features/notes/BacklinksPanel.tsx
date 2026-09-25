import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useBacklinks,
  useUnresolvedBacklinks,
  useOutgoingLinks,
  linksRepo,
} from '../../db/repos/linksRepo';
import { notesRepo } from '../../db/notesRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import type { Note } from '../../types/note';

export interface BacklinksPanelProps {
  note: Note;
}

export function BacklinksPanel({ note }: BacklinksPanelProps) {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [isExpanded, setIsExpanded] = useState(true);

  const noteId = note.id;
  const backlinks = useBacklinks(noteId) || [];
  const unresolvedBacklinks = useUnresolvedBacklinks(note.title) || [];
  const outgoingLinks = useOutgoingLinks(noteId) || [];

  const totalIncoming = backlinks.length;

  // Helper to format snippet with bold link target
  const renderSnippet = (snippet: string) => {
    if (!snippet) return null;
    const parts = snippet.split(/(\[\[[^\]]+\]\])/g);
    return (
      <span>
        {parts.map((part, i) => {
          if (part.startsWith('[[') && part.endsWith(']]')) {
            const inner = part.slice(2, -2).split('|')[0].split('#')[0];
            return (
              <span key={i} className="font-semibold text-[var(--color-ink)]">
                {inner}
              </span>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  const handleClaim = async () => {
    if (!noteId || !note.title) return;
    const count = await linksRepo.claimUnresolvedLinks(noteId, note.title);
    showSnackbar({ message: `Claimed ${count} link${count === 1 ? '' : 's'}` });
  };

  const handleCreateNoteFromLink = async (targetTitle: string) => {
    try {
      const newNote = await notesRepo.createNote({
        title: targetTitle,
        content: '',
        tags: [],
        pinned: false,
        archived: false,
        inbox: false,
      });

      if (newNote.id) {
        await linksRepo.claimUnresolvedLinks(newNote.id, targetTitle);
        if (noteId) {
          await linksRepo.reindexNote(noteId);
        }
        showSnackbar({ message: `Created note «${targetTitle}»` });
        navigate(`/notes/${newNote.id}`);
      }
    } catch (err) {
      console.error('Failed to create note from link:', err);
    }
  };

  const hasAnyLinks = totalIncoming > 0 || unresolvedBacklinks.length > 0 || outgoingLinks.length > 0;
  if (!hasAnyLinks) {
    return null;
  }

  return (
    <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
      {/* Outgoing links chip row */}
      {outgoingLinks.length > 0 && (
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] mb-2">
            Outgoing Links ({outgoingLinks.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {outgoingLinks.map(({ link, targetNote }, i) => {
              const isResolved = Boolean(link.targetId && targetNote);
              const label = link.targetTitle || targetNote?.title || 'Untitled';

              if (isResolved) {
                return (
                  <button
                    key={link.id ?? i}
                    type="button"
                    onClick={() => {
                      if (targetNote?.kind === 'journal' && targetNote.journalDate) {
                        navigate(`/journal/${targetNote.journalDate}`);
                      } else if (targetNote?.id) {
                        navigate(`/notes/${targetNote.id}`);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:opacity-80 transition-opacity"
                  >
                    <span>[[{label}]]</span>
                  </button>
                );
              }

              return (
                <button
                  key={link.id ?? i}
                  type="button"
                  onClick={() => handleCreateNoteFromLink(link.targetTitle)}
                  title="Click to create note"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-[var(--color-border)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
                >
                  <span className="text-[10px] font-bold">+</span>
                  <span>[[{label}]]</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Unresolved Mentions / Claim */}
      {unresolvedBacklinks.length > 0 && (
        <div className="mb-6 p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-[var(--color-ink)]">
              {unresolvedBacklinks.length} Unclaimed Mention{unresolvedBacklinks.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={handleClaim}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:opacity-90 transition-opacity"
            >
              Claim all
            </button>
          </div>
          <p className="text-xs text-[var(--color-ink-muted)] mb-2">
            Other notes reference «{note.title}», but aren't linked yet.
          </p>
          <div className="space-y-1.5">
            {unresolvedBacklinks.map(({ link, sourceNote }, idx) => (
              <div
                key={link.id ?? idx}
                className="text-xs text-[var(--color-ink-muted)] flex items-center justify-between"
              >
                <span className="font-medium text-[var(--color-ink)]">
                  {sourceNote?.title || 'Untitled Note'}
                </span>
                <span className="truncate max-w-[200px] italic">{link.context}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incoming Backlinks Section */}
      {totalIncoming > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between py-2 text-left text-sm font-semibold text-[var(--color-ink)] hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <span>Linked in {totalIncoming} note{totalIncoming === 1 ? '' : 's'}</span>
            </div>
            <span className="text-xs text-[var(--color-ink-muted)] font-normal">
              {isExpanded ? 'Hide' : 'Show'}
            </span>
          </button>

          {isExpanded && (
            <div className="mt-2 space-y-2">
              {backlinks.map(({ link, sourceNote }, idx) => {
                if (!sourceNote) return null;
                const sourceTitle = sourceNote.title || (sourceNote.journalDate ? `Journal — ${sourceNote.journalDate}` : 'Untitled Note');

                return (
                  <button
                    key={link.id ?? idx}
                    type="button"
                    onClick={() => {
                      if (sourceNote.kind === 'journal' && sourceNote.journalDate) {
                        navigate(`/journal/${sourceNote.journalDate}`);
                      } else {
                        navigate(`/notes/${sourceNote.id}`);
                      }
                    }}
                    className="w-full text-left p-3 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-colors group"
                  >
                    <div className="text-sm font-medium text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors mb-1">
                      {sourceTitle}
                    </div>
                    <div className="text-xs text-[var(--color-ink-muted)] line-clamp-2 leading-relaxed">
                      {renderSnippet(link.context)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
