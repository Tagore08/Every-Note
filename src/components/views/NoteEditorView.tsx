import { useState, useEffect, useRef, useCallback, type KeyboardEvent, type DragEvent, type ClipboardEvent } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { notesRepo, useNote } from '../../db/notesRepo';
import { attachmentsRepo, useAttachments } from '../../db/attachmentsRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatRelativeTime, formatFileSize, formatDateKey, parseDateKey } from '../../utils/format';
import { AttachmentGallery } from '../attachments/AttachmentGallery';
import { AddLinkModal } from '../attachments/AddLinkModal';
import { PersonBadge } from '../people/PersonBadge';
import { PersonPickerModal } from '../people/PersonPickerModal';
import { useLiveQuery } from 'dexie-react-hooks';
import { canvasRepo } from '../../db/repos/canvasRepo';
import { useFlag } from '../../app/flags';
import type { CanvasEntity } from '../../types/canvas';
import { linksRepo } from '../../db/repos/linksRepo';
import { useFolders, foldersRepo } from '../../db/repos/foldersRepo';
import { WikilinkAutocomplete } from '../../features/notes/WikilinkAutocomplete';
import { WikilinkRenderer } from '../../features/notes/WikilinkRenderer';
import { BacklinksPanel } from '../../features/notes/BacklinksPanel';
import { LocalGraphPanel } from '../../features/notes/LocalGraphPanel';
import { useSnippetAutocomplete } from '../../features/snippets/useSnippetAutocomplete';
import { Palette, ExternalLink, Wand2 } from 'lucide-react';
import { isDrawingFile, cleanDrawingTitle, parseDrawingToCanvasDoc } from '../../services/vault/drawingConverter';
import { SnippetSuggestPill } from '../../features/snippets/SnippetSuggestPill';
import { sanitizeTag } from '../../lib/tags';

function LinkedCanvasChip({ canvas, onOpen }: { canvas: CanvasEntity; onOpen: () => void }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!canvas.thumbBlob) return;
    const url = URL.createObjectURL(canvas.thumbBlob);
    setThumbUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [canvas.thumbBlob]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-2 p-1.5 pr-3 rounded-lg border border-border dark:border-border bg-surface-2 dark:bg-surface-2/60 hover:border-indigo-500 text-ink-muted dark:text-ink-muted text-xs font-medium transition-colors cursor-pointer"
    >
      {thumbUrl ? (
        <img src={thumbUrl} alt="" className="w-8 h-8 rounded-md object-cover border border-border dark:border-border" />
      ) : (
        <div className="w-8 h-8 rounded-md bg-indigo-500/10 flex items-center justify-center text-accent">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          </svg>
        </div>
      )}
      <div className="text-left">
        <p className="font-medium text-xs text-ink-muted dark:text-white truncate max-w-[120px]">
          {canvas.title || 'Untitled drawing'}
        </p>
        <span className="text-[10px] text-ink-muted">
          {canvas.doc.strokes.length} strokes
        </span>
      </div>
    </button>
  );
}

export function NoteEditorView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSnackbar, showUndo } = useSnackbar();
  const numericId = id && id !== 'new' ? parseInt(id, 10) : null;

  const note = useNote(numericId);
  const attachments = useAttachments(numericId);
  const isCanvasEnabled = useFlag('canvas');
  const linkedCanvases = useLiveQuery(
    () => (numericId ? canvasRepo.getCanvasesForNote(numericId) : []),
    [numericId]
  );

  const handleNewDrawing = async () => {
    if (!numericId) return;
    try {
      const canvas = await canvasRepo.createCanvas({
        linkedNoteId: numericId,
        title: `Sketch for ${title || 'Note'}`,
      });
      navigate(`/canvas/${canvas.id}`);
    } catch (err) {
      console.error('Failed to create linked drawing:', err);
    }
  };

  const handleConvertToCanvas = async () => {
    if (!numericId) return;
    try {
      const doc = parseDrawingToCanvasDoc(content, title || 'Drawing');
      const cleanTitle = cleanDrawingTitle(title || 'Drawing');
      const canvas = await canvasRepo.createCanvas({
        title: cleanTitle,
        doc,
        linkedNoteId: numericId,
        tags: Array.from(new Set([...tags, 'drawing', 'canvas'])),
      });
      await notesRepo.updateNote(numericId, {
        title: cleanTitle,
        tags: Array.from(new Set([...tags, 'drawing', 'canvas'])),
      });
      showSnackbar({ message: 'Successfully converted to interactive Canvas!' });
      navigate(`/canvas/${canvas.id}`);
    } catch (err: any) {
      showSnackbar({ message: `Conversion failed: ${err.message}` });
    }
  };

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [scheduledAtStr, setScheduledAtStr] = useState('');
  const [reminderTimeStr, setReminderTimeStr] = useState('');
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [personId, setPersonId] = useState<number | null>(null);
  const [isPersonPickerOpen, setIsPersonPickerOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');
  const [folderId, setFolderId] = useState<number | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const availableFolders = useFolders();


  // Attachment modal & drag states
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [largeFileQueue, setLargeFileQueue] = useState<File[]>([]);
  const currentLargeFile = largeFileQueue[0] || null;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Used to prevent re-initializing local state while typing
  const initialLoadDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reindexTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wikilink autocomplete state
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [wikilinkQuery, setWikilinkQuery] = useState('');
  const [wikilinkStartIndex, setWikilinkStartIndex] = useState<number | null>(null);

  // Text expansion snippets autocomplete
  const {
    hasMatches: hasSnippetMatches,
    matchingSnippets,
    applySnippet,
    handleKeyDown: handleSnippetKeyDown,
  } = useSnippetAutocomplete({
    value: content,
    onChange: (val) => {
      setContent(val);
      triggerAutoSave(title, val, tags, isPinned, isArchived);
    },
    inputRef: textareaRef,
  });

  const [searchParams] = useSearchParams();
  const folderIdParam = searchParams.get('folderId');
  const targetFolderId = folderIdParam ? parseInt(folderIdParam, 10) : undefined;

  // If navigating to /notes/new, instantly create a note and redirect to /notes/:id
  useEffect(() => {
    if (id === 'new') {
      let cancelled = false;
      const initialFid = targetFolderId && !isNaN(targetFolderId) ? targetFolderId : undefined;
      notesRepo.createNote({ title: '', content: '', tags: [], pinned: false, folderId: initialFid }).then((newNote) => {
        if (!cancelled && newNote.id) {
          navigate(`/notes/${newNote.id}`, { replace: true });
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [id, targetFolderId, navigate]);

  // Sync state from DB on initial load of note
  useEffect(() => {
    if (note && !initialLoadDone.current) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setTags(note.tags || []);
      setIsPinned(note.pinned || false);
      setIsArchived(note.archived || false);
      setFolderId(note.folderId ?? null);
      if (note.scheduledAt) {
        setScheduledAtStr(formatDateKey(new Date(note.scheduledAt)));
      }
      if (note.reminderAt) {
        const r = new Date(note.reminderAt);
        setReminderTimeStr(
          `${String(r.getHours()).padStart(2, '0')}:${String(r.getMinutes()).padStart(2, '0')}`
        );
      }
      setPersonId(note.personId ?? null);
      initialLoadDone.current = true;
    }
  }, [note]);

  // Persist changes to Dexie with ~500ms debounce + 800ms link reindexing
  const triggerAutoSave = useCallback(
    (
      newTitle: string,
      newContent: string,
      newTags: string[],
      pinnedState: boolean,
      archivedState: boolean,
      schedStr?: string,
      remTimeStr?: string,
      pId?: number | null,
      fId?: number | null
    ) => {
      if (!numericId) return;
      setSaveStatus('saving');

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(async () => {
        try {
          const finalSched = schedStr !== undefined ? schedStr : scheduledAtStr;
          const finalRem = remTimeStr !== undefined ? remTimeStr : reminderTimeStr;
          const finalPersonId = pId !== undefined ? pId : personId;
          const finalFolderId = fId !== undefined ? fId : folderId;

          let schedDate: Date | null = null;
          let remDate: Date | null = null;

          if (finalSched) {
            const base = parseDateKey(finalSched);
            schedDate = base;
            if (finalRem) {
              const [h, m] = finalRem.split(':').map(Number);
              remDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
            }
          }

          await notesRepo.updateNote(numericId, {
            title: newTitle,
            content: newContent,
            tags: newTags,
            pinned: pinnedState,
            archived: archivedState,
            scheduledAt: schedDate,
            reminderAt: remDate,
            personId: finalPersonId,
            folderId: finalFolderId,
          });
          setSaveStatus('saved');
        } catch (err) {
          console.error('Failed to autosave note:', err);
          setSaveStatus('idle');
        }
      }, 500);

      // Re-index outgoing wikilinks and claim unresolved incoming links (debounced 800ms per spec)
      if (reindexTimer.current) {
        clearTimeout(reindexTimer.current);
      }
      reindexTimer.current = setTimeout(async () => {
        try {
          await linksRepo.reindexNote(numericId);
          if (newTitle) {
            await linksRepo.claimUnresolvedLinks(numericId, newTitle);
          }
        } catch (err) {
          console.error('Failed to reindex links:', err);
        }
      }, 800);
    },
    [numericId, scheduledAtStr, reminderTimeStr, personId, folderId]
  );

  // Flush any pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      if (reindexTimer.current) {
        clearTimeout(reindexTimer.current);
      }
    };
  }, []);

  const checkWikilinkTrigger = (text: string, cursorIndex: number) => {
    const textBeforeCursor = text.slice(0, cursorIndex);
    const match = textBeforeCursor.match(/\[\[([^\]\n]*)$/);
    if (match) {
      setIsAutocompleteOpen(true);
      setWikilinkQuery(match[1]);
      setWikilinkStartIndex(cursorIndex - match[0].length);
    } else {
      setIsAutocompleteOpen(false);
      setWikilinkQuery('');
      setWikilinkStartIndex(null);
    }
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    triggerAutoSave(val, content, tags, isPinned, isArchived);
  };

  const handleContentChange = (val: string, cursorIndex?: number) => {
    setContent(val);
    triggerAutoSave(title, val, tags, isPinned, isArchived);
    if (cursorIndex !== undefined) {
      checkWikilinkTrigger(val, cursorIndex);
    }
  };

  const handleSelectWikilink = (targetTitle: string) => {
    if (wikilinkStartIndex === null || !textareaRef.current) return;
    const cursorIndex = textareaRef.current.selectionStart || 0;

    const before = content.slice(0, wikilinkStartIndex);
    const after = content.slice(cursorIndex);
    const inserted = `[[${targetTitle}]]`;
    const nextContent = before + inserted + after;

    setContent(nextContent);
    setIsAutocompleteOpen(false);
    setWikilinkQuery('');
    setWikilinkStartIndex(null);

    triggerAutoSave(title, nextContent, tags, isPinned, isArchived);

    const nextCursor = (before + inserted).length;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    }, 10);
  };

  const handleTogglePin = async () => {
    if (!numericId) return;
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    triggerAutoSave(title, content, tags, nextPinned, isArchived);

    showUndo(nextPinned ? 'Note pinned' : 'Note unpinned', async () => {
      setIsPinned(!nextPinned);
      triggerAutoSave(title, content, tags, !nextPinned, isArchived);
    });
  };

  const handleToggleArchive = async () => {
    if (!numericId) return;
    const nextArchived = !isArchived;
    setIsArchived(nextArchived);
    triggerAutoSave(title, content, tags, isPinned, nextArchived);

    showUndo(nextArchived ? 'Note archived' : 'Note unarchived', async () => {
      setIsArchived(!nextArchived);
      triggerAutoSave(title, content, tags, isPinned, !nextArchived);
    });
  };

  const handleTrash = async () => {
    if (!numericId) return;
    try {
      await notesRepo.trashNote(numericId);
      showUndo('Note moved to trash', async () => {
        await notesRepo.restoreNote(numericId);
      });
      navigate('/notes');
    } catch (err) {
      console.error('Failed to trash note:', err);
      showSnackbar({ message: 'Failed to move note to trash' });
    }
  };

  const handleConvertToTask = async () => {
    if (!numericId) return;
    try {
      const task = await tasksRepo.createTask({
        title: title.trim() || 'Untitled Task',
        description: content.trim(),
        tags: [...tags],
        sourceNoteId: numericId,
        personId: personId ?? undefined,
      });
      showUndo('Created task from note', async () => {
        if (task.id) await tasksRepo.deletePermanently(task.id);
      });
    } catch (err) {
      console.error('Failed to create task from note:', err);
      showSnackbar({ message: 'Failed to create task from note' });
    }
  };

  const handleAddTag = (rawTag: string) => {
    const clean = sanitizeTag(rawTag);
    if (!clean || tags.includes(clean)) {
      setTagInput('');
      return;
    }
    const updatedTags = [...tags, clean];
    setTags(updatedTags);
    setTagInput('');
    triggerAutoSave(title, content, updatedTags, isPinned, isArchived);
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = tags.filter((t) => t !== tagToRemove);
    setTags(updatedTags);
    triggerAutoSave(title, content, updatedTags, isPinned, isArchived);
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      handleRemoveTag(tags[tags.length - 1]);
    }
  };

  const handleScheduleDateChange = (val: string) => {
    setScheduledAtStr(val);
    triggerAutoSave(title, content, tags, isPinned, isArchived, val, reminderTimeStr);
  };

  const handleReminderTimeChange = (val: string) => {
    setReminderTimeStr(val);
    triggerAutoSave(title, content, tags, isPinned, isArchived, scheduledAtStr, val);
  };

  const handleClearSchedule = () => {
    setScheduledAtStr('');
    setReminderTimeStr('');
    triggerAutoSave(title, content, tags, isPinned, isArchived, '', '');
  };


  // Process files with size guards
  const processSingleFile = async (file: File) => {
    if (!numericId) return;

    // Hard block above 50 MB
    if (file.size > 50 * 1024 * 1024) {
      showSnackbar({
        message: `"${file.name}" exceeds the 50 MB limit and cannot be stored.`,
      });
      return;
    }

    // Warning prompt between 15 MB and 50 MB
    if (file.size > 15 * 1024 * 1024) {
      setLargeFileQueue((prev) => [...prev, file]);
      return;
    }

    try {
      await attachmentsRepo.addFileAttachment(numericId, file);
      showSnackbar({ message: `Attached "${file.name}"` });
    } catch (err) {
      console.error('Failed to attach file:', err);
      showSnackbar({ message: `Failed to attach "${file.name}"` });
    }
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    for (const f of files) {
      await processSingleFile(f);
    }
  };

  // Clipboard Paste listener (e.g. pasted screenshots/images)
  const handlePaste = (e: ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToAttach: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const ext = item.type.split('/')[1] || 'png';
          const namedFile = new File(
            [file],
            `Pasted Image ${new Date().toLocaleTimeString().replace(/:/g, '-')}.${ext}`,
            { type: file.type }
          );
          filesToAttach.push(namedFile);
        }
      }
    }

    if (filesToAttach.length > 0) {
      e.preventDefault();
      handleFiles(filesToAttach);
    }
  };

  // Desktop Drag & Drop
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Delete attachment with undo
  const handleDeleteAttachment = async (attachmentId: number) => {
    const att = attachments?.find((a) => a.id === attachmentId);
    if (!att || !numericId) return;

    try {
      await attachmentsRepo.deleteAttachment(attachmentId);
      showUndo(`Removed "${att.name}"`, async () => {
        if (att.kind === 'link' && att.url) {
          await attachmentsRepo.addLinkAttachment(numericId, att.url, att.name);
        } else if (att.data) {
          await attachmentsRepo.addFileAttachment(
            numericId,
            new File([att.data], att.name, { type: att.mimeType })
          );
        }
      });
    } catch (err) {
      console.error('Failed to remove attachment:', err);
      showSnackbar({ message: 'Failed to remove attachment' });
    }
  };

  const handleConfirmLargeFile = async () => {
    if (!currentLargeFile || !numericId) return;
    const file = currentLargeFile;
    setLargeFileQueue((prev) => prev.slice(1));
    try {
      await attachmentsRepo.addFileAttachment(numericId, file);
      showSnackbar({ message: `Attached "${file.name}"` });
    } catch (err) {
      console.error('Failed to attach large file:', err);
      showSnackbar({ message: `Failed to attach "${file.name}"` });
    }
  };

  const handleCancelLargeFile = () => {
    setLargeFileQueue((prev) => prev.slice(1));
  };

  if (id === 'new' || note === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center">
        <div className="text-sm text-ink-muted animate-pulse">Opening note...</div>
      </div>
    );
  }

  if (note === null) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <p className="text-sm text-ink-muted">Note not found or may have been deleted.</p>
        <button
          type="button"
          onClick={() => navigate('/notes')}
          className="text-sm font-semibold text-accent dark:text-accent hover:underline"
        >
          Return to notes
        </button>
      </div>
    );
  }

  return (
    <div
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-8rem)] transition-colors ${
        isDragging ? 'ring-2 ring-accent ring-offset-4 rounded-xl' : ''
      }`}
    >
      {/* Drag & drop visual banner */}
      {isDragging && (
        <div className="absolute inset-0 z-40 bg-surface-2/80 backdrop-blur-xs border-2 border-dashed border-accent/60 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-accent font-semibold">
            <svg className="w-8 h-8 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Drop files here to attach</span>
          </div>
        </div>
      )}

      {/* ── Notion-style slim top bar ── */}
      <div className="flex items-center justify-between py-2 border-b border-border/30 gap-2">
        {/* Left: back + autosave + folder breadcrumb */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Autosave dot */}
          <div className="flex items-center gap-1 text-[11px] text-ink-faint select-none">
            {saveStatus === 'saving' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            ) : saveStatus === 'saved' ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            ) : null}
            {saveStatus === 'saving' ? (
              <span>Saving…</span>
            ) : saveStatus === 'saved' && note.updatedAt ? (
              <span>Saved · {formatRelativeTime(note.updatedAt)}</span>
            ) : null}
          </div>

          {/* Folder picker (slim inline) */}
          <div className="hidden sm:flex items-center gap-1 pl-2 border-l border-border/30">
            <svg className="w-3 h-3 text-amber-500/70 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
            <select
              value={folderId ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setFolderId(val);
                triggerAutoSave(title, content, tags, isPinned, isArchived, undefined, undefined, undefined, val);
              }}
              className="bg-transparent text-[11px] font-medium text-ink-muted focus:outline-none cursor-pointer max-w-[130px] truncate"
              title="Folder"
            >
              <option value="">Root / Unfiled</option>
              {availableFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {foldersRepo.getFolderPathString(f.id ?? null, availableFolders)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Notion-style icon-only toolbar */}
        <div className="flex items-center gap-0.5">
          {/* Preview / Edit toggle */}
          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`p-1.5 rounded-md text-xs transition-colors cursor-pointer ${
              isPreviewMode
                ? 'bg-accent-soft text-accent'
                : 'text-ink-muted hover:text-ink hover:bg-surface-2'
            }`}
            title={isPreviewMode ? 'Switch to Edit mode' : 'Switch to Preview mode'}
            aria-label={isPreviewMode ? 'Edit' : 'Preview'}
          >
            {isPreviewMode ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>

          {/* Attach file */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
            title="Attach files or images"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Add link */}
          <button
            type="button"
            onClick={() => setIsAddLinkOpen(true)}
            className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
            title="Add link"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </button>

          {/* Draw */}
          {isCanvasEnabled && (
            <button
              type="button"
              onClick={handleNewDrawing}
              className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
              title="New drawing"
            >
              <Palette className="w-4 h-4" />
            </button>
          )}

          {/* Convert to task */}
          <button
            type="button"
            onClick={handleConvertToTask}
            className="p-1.5 rounded-md text-ink-muted hover:text-emerald-500 hover:bg-surface-2 transition-colors cursor-pointer"
            title="Create task from note"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </button>

          {/* Schedule */}
          <button
            type="button"
            onClick={() => setIsScheduleOpen(!isScheduleOpen)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              scheduledAtStr
                ? 'text-purple-500 bg-purple-500/10'
                : 'text-ink-muted hover:text-purple-400 hover:bg-surface-2'
            }`}
            title={scheduledAtStr ? `Scheduled on ${scheduledAtStr}` : 'Schedule note'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </button>

          {/* Link person */}
          <button
            type="button"
            onClick={() => setIsPersonPickerOpen(true)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              personId
                ? 'text-accent bg-accent-soft'
                : 'text-ink-muted hover:text-ink hover:bg-surface-2'
            }`}
            title={personId ? 'With person' : 'Link person'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </button>

          <span className="h-3.5 w-px bg-border/40 mx-1" />

          {/* Pin */}
          <button
            type="button"
            onClick={handleTogglePin}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isPinned
                ? 'text-amber-400 bg-amber-400/10'
                : 'text-ink-muted hover:text-ink hover:bg-surface-2'
            }`}
            title={isPinned ? 'Unpin note' : 'Pin note'}
            aria-label={isPinned ? 'Unpin note' : 'Pin note'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z" />
            </svg>
          </button>

          {/* Archive */}
          <button
            type="button"
            onClick={handleToggleArchive}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isArchived
                ? 'text-accent bg-accent-soft'
                : 'text-ink-muted hover:text-ink hover:bg-surface-2'
            }`}
            title={isArchived ? 'Unarchive note' : 'Archive note'}
            aria-label={isArchived ? 'Unarchive' : 'Archive'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="5" rx="1" />
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <path d="M10 12h4" />
            </svg>
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleTrash}
            className="p-1.5 rounded-md text-ink-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
            title="Delete note"
            aria-label="Delete note"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Schedule disclosure row */}
      {isScheduleOpen && (
        <div className="mt-2 p-3 rounded-xl bg-purple-500/8 border border-purple-500/20 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-purple-300">Show me this note on:</span>
              <input
                type="date"
                value={scheduledAtStr}
                onChange={(e) => handleScheduleDateChange(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-surface-2 border border-purple-500/30 text-ink focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
              />
            </div>

            {scheduledAtStr && (
              <div className="flex items-center gap-2">
                <span className="text-purple-300">Reminder time:</span>
                <input
                  type="time"
                  value={reminderTimeStr}
                  onChange={(e) => handleReminderTimeChange(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-surface-2 border border-purple-500/30 text-ink focus:outline-none focus:ring-1 focus:ring-purple-500 text-xs"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {scheduledAtStr && (
              <button
                type="button"
                onClick={handleClearSchedule}
                className="text-xs text-rose-400 hover:underline cursor-pointer"
              >
                Clear date
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsScheduleOpen(false)}
              className="p-1 rounded text-purple-400 hover:text-purple-200 cursor-pointer"
              aria-label="Close schedule section"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Notion page body ── */}
      <div className="flex-1 flex flex-col pt-8 pb-16 space-y-3">
        {/* Drawing / canvas banners */}
        {linkedCanvases && linkedCanvases.length > 0 ? (
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <Palette className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-ink">Drawing Canvas</div>
                <div className="text-[11px] text-ink-muted">
                  {linkedCanvases[0].doc?.strokes?.length || 0} strokes
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/canvas/${linkedCanvases[0].id}`)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Canvas</span>
            </button>
          </div>
        ) : isDrawingFile(title, content) ? (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Palette className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-ink">Drawing File Detected</div>
                <div className="text-[11px] text-ink-muted">Convert to visual canvas editor</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConvertToCanvas}
              className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Convert</span>
            </button>
          </div>
        ) : null}

        {/* ── Notion large title ── */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled"
          className="w-full bg-transparent text-3xl sm:text-4xl font-bold text-ink placeholder-ink-faint/40 focus:outline-none tracking-tight leading-tight"
        />

        {/* ── Property row: tags + folder selector ── */}
        <div className="flex flex-wrap items-center gap-2 pb-1 border-b border-border/20">
          {personId && (
            <PersonBadge
              personId={personId}
              onClick={() => setIsPersonPickerOpen(true)}
              onClear={() => {
                setPersonId(null);
                triggerAutoSave(title, content, tags, isPinned, isArchived, undefined, undefined, null);
              }}
            />
          )}

          {/* Tag chips */}
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-surface-2 text-ink-muted border border-border/40"
            >
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="text-ink-faint hover:text-ink p-0.5 rounded cursor-pointer"
                aria-label={`Remove tag ${tag}`}
              >
                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}

          {/* Tag input */}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => {
              if (tagInput.trim()) handleAddTag(tagInput);
            }}
            placeholder={tags.length === 0 ? '+ Add tag…' : '+ tag'}
            className="text-[11px] bg-transparent text-ink-muted placeholder-ink-faint/50 focus:outline-none px-1 py-0.5 rounded border border-transparent focus:border-border/40 w-28"
          />

          {/* Mobile folder selector */}
          <div className="flex items-center gap-1 sm:hidden">
            <svg className="w-3 h-3 text-amber-500/70 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>
            <select
              value={folderId ?? ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setFolderId(val);
                triggerAutoSave(title, content, tags, isPinned, isArchived, undefined, undefined, undefined, val);
              }}
              className="text-[11px] bg-surface-2 text-ink border border-border/40 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="">No folder</option>
              {availableFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Content area ── */}
        <div className="relative flex-1 flex flex-col">
          {isPreviewMode ? (
            <div className="min-h-[300px] text-base text-ink leading-8">
              {content.trim() ? (
                <WikilinkRenderer content={content} />
              ) : (
                <span className="text-ink-faint italic">No content. Switch to Edit to write.</span>
              )}
            </div>
          ) : (
            <>
              {hasSnippetMatches && (
                <div className="mb-2">
                  <SnippetSuggestPill
                    snippets={matchingSnippets}
                    onSelect={applySnippet}
                  />
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value, e.target.selectionStart)}
                onKeyDown={handleSnippetKeyDown}
                onKeyUp={(e) => checkWikilinkTrigger(content, e.currentTarget.selectionStart)}
                onClick={(e) => checkWikilinkTrigger(content, e.currentTarget.selectionStart)}
                placeholder="Start writing… (type [[ to link a note, #tag to expand, paste images with Ctrl+V)"
                className="flex-1 w-full bg-transparent text-ink-muted placeholder-ink-faint/40 text-base leading-8 resize-none focus:outline-none min-h-[300px]"
              />

              <WikilinkAutocomplete
                query={wikilinkQuery}
                isOpen={isAutocompleteOpen}
                onSelect={handleSelectWikilink}
                onClose={() => setIsAutocompleteOpen(false)}
                currentNoteId={numericId}
              />
            </>
          )}
        </div>

        {/* Linked drawings */}
        {((isCanvasEnabled || (linkedCanvases && linkedCanvases.length > 0)) && linkedCanvases && linkedCanvases.length > 0) && (
          <div className="space-y-2 pt-2">
            <h4 className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider">
              Linked Drawings ({linkedCanvases.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {linkedCanvases.map((c) => (
                <LinkedCanvasChip
                  key={c.id}
                  canvas={c}
                  onOpen={() => navigate(`/canvas/${c.id}`)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        <AttachmentGallery
          attachments={attachments ?? []}
          onDeleteAttachment={handleDeleteAttachment}
        />

        {/* Backlinks & Local Graph */}
        {note && (
          <>
            <BacklinksPanel note={note} />
            {numericId && <LocalGraphPanel noteId={numericId} noteTitle={title || 'Untitled'} />}
          </>
        )}
      </div>

      {/* Add Link dialog */}
      <AddLinkModal
        isOpen={isAddLinkOpen}
        onClose={() => setIsAddLinkOpen(false)}
        onAddLink={async (url, linkTitle) => {
          if (!numericId) return;
          try {
            await attachmentsRepo.addLinkAttachment(numericId, url, linkTitle);
            showSnackbar({ message: 'Link attached' });
          } catch (err) {
            console.error('Failed to attach link:', err);
          }
        }}
      />

      {/* Large File Warning Dialog */}
      {currentLargeFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-2/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl bg-surface border border-border p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-500">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h3 className="font-bold text-base text-ink">Large file warning</h3>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              <span className="font-semibold text-ink truncate block">"{currentLargeFile.name}"</span>
              This file is <strong>{formatFileSize(currentLargeFile.size)}</strong>. Storing large files in IndexedDB consumes significant browser quota. Attach anyway?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={handleCancelLargeFile}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-ink-muted hover:bg-surface-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLargeFile}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
              >
                Attach Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Person Picker Modal */}
      <PersonPickerModal
        isOpen={isPersonPickerOpen}
        onClose={() => setIsPersonPickerOpen(false)}
        selectedPersonId={personId}
        onSelectPerson={(id) => {
          setPersonId(id);
          triggerAutoSave(title, content, tags, isPinned, isArchived, undefined, undefined, id);
        }}
      />
    </div>
  );
}
