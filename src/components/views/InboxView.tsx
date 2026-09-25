import { useState, useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInboxNotes, notesRepo } from '../../db/notesRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatRelativeTime, getDisplayTitle } from '../../utils/format';
import { useFlag } from '../../app/flags';
import { parseQuickAdd } from '../../lib/quickAdd';
import { InboxAnalyticsHeader } from '../../features/inbox/InboxAnalyticsHeader';
import { FileAsSheet } from '../../features/inbox/FileAsSheet';
import type { Note } from '../../types/note';

interface InboxViewProps {
  onOpenCapture?: () => void;
}

export function InboxView(props: InboxViewProps) {
  const notes = useInboxNotes();
  const navigate = useNavigate();
  const { showUndo } = useSnackbar();
  const outlet = useOutletContext<{ openCapture?: () => void } | null>();
  const onOpenCapture = props.onOpenCapture ?? outlet?.openCapture;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isSmartInbox = useFlag('smartInbox');
  const [quickInput, setQuickInput] = useState('');
  const [triageNote, setTriageNote] = useState<Note | null>(null);

  // Real-time NLP parsing for quick capture
  const nlp = useMemo(() => {
    return parseQuickAdd(quickInput);
  }, [quickInput]);

  const handleQuickCapture = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = quickInput.trim();
    if (!trimmed) return;

    try {
      const parsed = parseQuickAdd(trimmed);
      await notesRepo.createNote({
        title: parsed.title,
        content: trimmed,
        tags: parsed.tags,
        inbox: true,
      });
      setQuickInput('');
    } catch (err) {
      console.error('Failed to quick-capture note:', err);
    }
  };

  const handleFileAsNote = async (id?: number) => {
    if (typeof id !== 'number') return;
    try {
      await notesRepo.fileInboxNote(id);
      showUndo('Filed as note', async () => {
        await notesRepo.updateNote(id, { inbox: true });
      });
      navigate(`/notes/${id}`);
    } catch (err) {
      console.error('Failed to file note:', err);
    }
  };

  const handleDelete = async (id?: number) => {
    if (typeof id !== 'number') return;
    try {
      await notesRepo.trashNote(id);
      showUndo('Note moved to trash', async () => {
        await notesRepo.restoreNote(id);
      });
    } catch (err) {
      console.error('Failed to trash note:', err);
    }
  };

  const handleConvertToTask = async (note: Note) => {
    if (typeof note.id !== 'number') return;
    try {
      const task = await tasksRepo.createTaskFromNote(note);
      await notesRepo.fileInboxNote(note.id);
      showUndo('Converted to task', async () => {
        if (task.id) await tasksRepo.deletePermanently(task.id);
        await notesRepo.updateNote(note.id!, { inbox: true });
      });
    } catch (err) {
      console.error('Failed to convert note to task:', err);
    }
  };

  const noteList = notes ?? [];

  const rowVirtualizer = useVirtualizer({
    count: noteList.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  if (notes === undefined) {
    return (
      <div className="max-w-3xl mx-auto py-12 flex justify-center">
        <div className="text-sm text-ink-muted animate-pulse">Loading inbox...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Inbox
          </h2>
          {noteList.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
              {noteList.length}
            </span>
          )}
        </div>
        {onOpenCapture && (
          <button
            type="button"
            onClick={onOpenCapture}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill text-xs font-semibold bg-accent text-accent-ink shadow-card hover:opacity-90 transition-opacity cursor-pointer min-h-[44px]"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Capture</span>
          </button>
        )}
      </div>

      {/* Smart Inbox Analytics Header (flag-gated) */}
      {isSmartInbox && <InboxAnalyticsHeader />}

      {/* Quick Add with NLP Preview */}
      <form onSubmit={handleQuickCapture} className="space-y-1.5">
        <div className="flex gap-2">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Quick capture to inbox... #tag tomorrow"
            className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border bg-surface text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-accent min-h-[44px]"
          />
          <button
            type="submit"
            disabled={!quickInput.trim()}
            className="px-5 py-2.5 rounded-pill bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer min-h-[44px] shrink-0"
          >
            Capture
          </button>
        </div>
        {nlp.previewLabel && (
          <div className="px-3 py-1.5 text-xs text-accent bg-accent-soft rounded-lg flex items-center gap-1.5 border border-accent/20">
            <span className="font-semibold shrink-0">🪄 Detected:</span>
            <span className="truncate">{nlp.previewLabel}</span>
          </div>
        )}
      </form>

      {/* Empty State */}
      {noteList.length === 0 ? (
        <div className="rounded-card border border-border p-12 text-center space-y-4 bg-surface shadow-card">
          <div className="w-12 h-12 rounded-full bg-accent-soft text-accent mx-auto flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink">Inbox Zero</h3>
            <p className="text-sm text-ink-muted mt-1 max-w-sm mx-auto">
              You've cleared everything! Capture thoughts anytime with the quick bar above or press{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-ink font-mono text-[11px]">
                N
              </kbd>
              .
            </p>
          </div>
          {onOpenCapture && (
            <button
              type="button"
              onClick={onOpenCapture}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill text-sm font-semibold bg-accent text-accent-ink hover:opacity-90 transition-opacity shadow-card min-h-[44px] cursor-pointer"
            >
              <span>Quick Capture</span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      ) : (
        /* Virtualized Inbox List */
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
              const note = noteList[virtualRow.index];
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
                  <div className="p-4 sm:p-5 rounded-card bg-surface border border-border shadow-card hover:border-accent/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                        <h3 className="text-base font-semibold text-ink truncate">
                          {getDisplayTitle(note)}
                        </h3>
                      </div>
                      <p className="text-sm text-ink-muted line-clamp-2 leading-relaxed">
                        {note.content || <span className="italic opacity-60">No additional text</span>}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-ink-muted pt-1">
                        <span>Captured {formatRelativeTime(note.createdAt)}</span>
                        {note.tags && note.tags.length > 0 && (
                          <>
                            <span>·</span>
                            <div className="flex items-center gap-1 flex-wrap">
                              {note.tags.map((t) => (
                                <span key={t} className="text-ink-muted/80">#{t}</span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (>=44px touch targets) */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {isSmartInbox ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setTriageNote(note)}
                            className="px-4 py-2 rounded-pill bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer min-h-[44px] flex items-center gap-1.5 shadow-xs"
                            title="Triage, Subtasks, or Convert to Task"
                          >
                            <span>Triage / File</span>
                            <span aria-hidden="true">→</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(note.id)}
                            className="p-2 rounded-lg text-ink-muted hover:text-danger hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Delete note"
                            aria-label="Delete note"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleConvertToTask(note)}
                            className="px-3 py-1.5 rounded-pill bg-surface-2 hover:bg-surface border border-border text-ink text-xs font-semibold transition-colors cursor-pointer min-h-[44px] flex items-center gap-1.5"
                            title="Convert to Task"
                          >
                            <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M9 11l3 3L22 4" />
                              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                            </svg>
                            <span>Task</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleFileAsNote(note.id)}
                            className="px-3.5 py-1.5 rounded-pill bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer min-h-[44px] flex items-center gap-1.5 shadow-xs"
                          >
                            <span>File Note</span>
                            <span aria-hidden="true">→</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(note.id)}
                            className="p-2 rounded-lg text-ink-muted hover:text-danger hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Delete note"
                            aria-label="Delete note"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* File As / Triage Bottom Sheet */}
      <FileAsSheet
        isOpen={Boolean(triageNote)}
        onClose={() => setTriageNote(null)}
        note={triageNote}
      />
    </div>
  );
}
