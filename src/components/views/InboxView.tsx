import { useState, useRef, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInboxNotes, notesRepo } from '../../db/notesRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatRelativeTime, getDisplayTitle } from '../../utils/format';
import { useFlag } from '../../app/flags';
import { useFolders } from '../../db/repos/foldersRepo';
import { InboxAnalyticsHeader } from '../../features/inbox/InboxAnalyticsHeader';
import { FileAsSheet } from '../../features/inbox/FileAsSheet';
import { Clock, Tag, FolderPlus, CheckCircle2, ArrowRight, Trash2, Sparkles, Pencil } from 'lucide-react';
import type { Note } from '../../types/note';

interface InboxViewProps {
  onOpenCapture?: () => void;
}

export function InboxView(props: InboxViewProps) {
  const notes = useInboxNotes();
  const folders = useFolders();
  const foldersMap = useMemo(() => new Map(folders.map((f) => [f.id, f.name])), [folders]);
  const navigate = useNavigate();
  const { showUndo } = useSnackbar();
  const outlet = useOutletContext<{ openCapture?: () => void } | null>();
  const onOpenCapture = props.onOpenCapture ?? outlet?.openCapture;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isSmartInbox = useFlag('smartInbox');
  const [triageNote, setTriageNote] = useState<Note | null>(null);

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
    estimateSize: () => 165,
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
      {/* Status Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <span>Unprocessed captures:</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
            {noteList.length}
          </span>
        </div>
      </div>

      {/* Smart Inbox Analytics Header (flag-gated) */}
      {isSmartInbox && <InboxAnalyticsHeader />}

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
              You've cleared everything! Capture thoughts anytime with the button below or press{' '}
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
        /* GoodNotes Tactile Card Inbox List */
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
              const isStale = Date.now() - new Date(note.createdAt).getTime() > 24 * 60 * 60 * 1000;
              const hasSketch = note.content?.includes('<svg') || note.content?.includes('data:image/svg+xml');
              const folderName = note.folderId ? foldersMap.get(note.folderId) : null;

              // Clean excerpt by stripping SVG raw strings if present
              const cleanExcerpt = note.content
                ? note.content.replace(/<svg[\s\S]*?<\/svg>/gi, '[Sketch]').replace(/!\[.*?\]\(data:image\/svg\+xml.*?\)/gi, '[Sketch]').trim()
                : '';

              return (
                <div
                  key={note.id ?? virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="pb-3.5"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (note.id) navigate(`/notes/${note.id}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && note.id) navigate(`/notes/${note.id}`);
                    }}
                    className={`group relative flex flex-col justify-between p-5 rounded-card border transition-all duration-200 cursor-pointer shadow-card hover:shadow-float ${
                      isStale
                        ? 'border-amber-500/30 bg-surface hover:border-amber-500/50'
                        : 'border-border bg-surface hover:border-accent/40'
                    }`}
                  >
                    {/* Left accent spine ribbon for GoodNotes tactile feel */}
                    <div
                      className={`absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full transition-colors ${
                        isStale
                          ? 'bg-amber-500 group-hover:bg-amber-600'
                          : 'bg-accent/40 group-hover:bg-accent'
                      }`}
                    />

                    {/* Card Body */}
                    <div className="space-y-2.5 pl-2 min-w-0">
                      {/* Top Header: Title & Badges */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                          <h3 className="text-base sm:text-lg font-bold text-ink truncate group-hover:text-accent transition-colors">
                            {getDisplayTitle(note)}
                          </h3>
                        </div>

                        {/* Status / Attention Badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {hasSketch && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-accent-soft text-accent border border-accent/20">
                              <Pencil className="w-2.5 h-2.5" />
                              <span>Sketch</span>
                            </span>
                          )}

                          {isStale ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span>Pending Triage</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-accent-soft text-accent border border-accent/20">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>New</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dynamic Content Excerpt */}
                      {cleanExcerpt ? (
                        <p className="text-sm text-ink-muted line-clamp-2 leading-relaxed">
                          {cleanExcerpt}
                        </p>
                      ) : (
                        <p className="text-xs text-ink-faint italic">
                          No text content
                        </p>
                      )}

                      {/* Metadata Row: Captured time, folder, tags */}
                      <div className="flex items-center gap-3 text-xs text-ink-muted flex-wrap pt-1">
                        <div className="flex items-center gap-1 text-[11px] text-ink-muted">
                          <Clock className="w-3 h-3 text-ink-faint" />
                          <span>Captured {formatRelativeTime(note.createdAt)}</span>
                        </div>

                        {folderName && (
                          <div className="flex items-center gap-1 text-[11px] text-ink-muted bg-surface-2 px-2 py-0.5 rounded-md border border-border/60">
                            <FolderPlus className="w-3 h-3 text-accent" />
                            <span>{folderName}</span>
                          </div>
                        )}

                        {note.tags && note.tags.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {note.tags.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-ink-muted bg-surface-2 px-1.5 py-0.5 rounded-md border border-border/50"
                              >
                                <Tag className="w-2.5 h-2.5 text-ink-faint" />
                                <span>{t}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tactile Action Bar */}
                    <div className="flex items-center justify-between gap-3 pt-3.5 mt-3 border-t border-border/50 pl-2">
                      <div className="text-[11px] text-ink-faint hidden sm:block">
                        Click card to edit note
                      </div>

                      <div
                        className="flex items-center gap-2 ml-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Convert to Task */}
                        <button
                          type="button"
                          onClick={() => handleConvertToTask(note)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface-2 hover:bg-accent hover:text-accent-ink border border-border text-ink text-xs font-semibold transition-all min-h-[38px] active:scale-95 cursor-pointer shadow-xs"
                          title="Convert to Task"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-accent group-hover:text-inherit" />
                          <span>Convert to Task</span>
                        </button>

                        {/* File / Triage Sheet */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isSmartInbox) {
                              setTriageNote(note);
                            } else {
                              handleFileAsNote(note.id);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-opacity min-h-[38px] active:scale-95 cursor-pointer shadow-xs"
                          title={isSmartInbox ? "Triage & File Note" : "File Note"}
                        >
                          <span>File Note</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>

                        {/* Delete Note */}
                        <button
                          type="button"
                          onClick={() => handleDelete(note.id)}
                          className="p-2 rounded-lg text-ink-muted hover:text-danger hover:bg-surface-2 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title="Delete note"
                          aria-label="Delete note"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
