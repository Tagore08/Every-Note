import { useState, useEffect, useRef } from 'react';
import { Sheet } from '../../design/ui/Sheet';
import { notesRepo, useScratchpadNote } from '../../db/notesRepo';
import { WikilinkRenderer } from '../notes/WikilinkRenderer';

export interface ScratchpadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ScratchpadModal({ isOpen, onClose }: ScratchpadModalProps) {
  const scratchNote = useScratchpadNote();
  const [content, setContent] = useState('');
  const [isViewMode, setIsViewMode] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Initialize content when scratch note loads or modal opens
  useEffect(() => {
    if (isOpen) {
      if (!scratchNote) {
        notesRepo.getOrCreateScratchpad().then((note) => {
          setContent(note.content || '');
          initializedRef.current = true;
        });
      } else if (!initializedRef.current) {
        setContent(scratchNote.content || '');
        initializedRef.current = true;
      }
    } else {
      initializedRef.current = false;
      setIsViewMode(false);
    }
  }, [isOpen, scratchNote]);

  const handleContentChange = (val: string) => {
    setContent(val);

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    saveTimer.current = setTimeout(async () => {
      const note = scratchNote || (await notesRepo.getOrCreateScratchpad());
      if (note.id) {
        await notesRepo.updateNote(note.id, { content: val });
      }
    }, 300);
  };

  const handleClear = async () => {
    if (confirm('Clear scratchpad content?')) {
      setContent('');
      const note = scratchNote || (await notesRepo.getOrCreateScratchpad());
      if (note.id) {
        await notesRepo.updateNote(note.id, { content: '' });
      }
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Scratchpad"
      description="Instant notes outside the folder tree"
    >
      <div className="space-y-3 pb-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-ink-muted)]">
            Auto-saves locally · Not filed in vault folders
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsViewMode(!isViewMode)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-ink)] transition-colors cursor-pointer"
            >
              {isViewMode ? 'Edit' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-2 py-1 rounded-lg text-xs text-[var(--color-ink-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
              title="Clear scratchpad"
            >
              Clear
            </button>
          </div>
        </div>

        {isViewMode ? (
          <div className="min-h-[220px] max-h-[360px] overflow-y-auto p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-ink)]">
            {content.trim() ? (
              <WikilinkRenderer content={content} />
            ) : (
              <span className="text-[var(--color-ink-muted)] italic">Scratchpad is empty.</span>
            )}
          </div>
        ) : (
          <textarea
            autoFocus
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Type anything freely... Supports [[wikilinks]], quick thoughts, temporary clips."
            rows={8}
            className="w-full p-3.5 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-accent)] text-sm text-[var(--color-ink)] placeholder-[var(--color-ink-muted)] focus:outline-none resize-none leading-relaxed transition-colors"
          />
        )}
      </div>
    </Sheet>
  );
}
