import { useState, useEffect, useRef, useCallback, type KeyboardEvent, type DragEvent, type ClipboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { notesRepo, useNote } from '../../db/notesRepo';
import { attachmentsRepo, useAttachments } from '../../db/attachmentsRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatRelativeTime, formatFileSize } from '../../utils/format';
import { AttachmentGallery } from '../attachments/AttachmentGallery';
import { AddLinkModal } from '../attachments/AddLinkModal';

export function NoteEditorView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSnackbar, showUndo } = useSnackbar();
  const numericId = id && id !== 'new' ? parseInt(id, 10) : null;

  const note = useNote(numericId);
  const attachments = useAttachments(numericId);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');

  // Attachment modal & drag states
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [largeFileQueue, setLargeFileQueue] = useState<File[]>([]);
  const currentLargeFile = largeFileQueue[0] || null;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Used to prevent re-initializing local state while typing
  const initialLoadDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // If navigating to /notes/new, instantly create a note and redirect to /notes/:id
  useEffect(() => {
    if (id === 'new') {
      let cancelled = false;
      notesRepo.createNote({ title: '', content: '', tags: [], pinned: false }).then((newNote) => {
        if (!cancelled && newNote.id) {
          navigate(`/notes/${newNote.id}`, { replace: true });
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [id, navigate]);

  // Sync state from DB on initial load of note
  useEffect(() => {
    if (note && !initialLoadDone.current) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setTags(note.tags || []);
      setIsPinned(note.pinned || false);
      setIsArchived(note.archived || false);
      initialLoadDone.current = true;
    }
  }, [note]);

  // Persist changes to Dexie with ~500ms debounce
  const triggerAutoSave = useCallback(
    (newTitle: string, newContent: string, newTags: string[], pinnedState: boolean, archivedState: boolean) => {
      if (!numericId) return;
      setSaveStatus('saving');

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(async () => {
        try {
          await notesRepo.updateNote(numericId, {
            title: newTitle,
            content: newContent,
            tags: newTags,
            pinned: pinnedState,
            archived: archivedState,
          });
          setSaveStatus('saved');
        } catch (err) {
          console.error('Failed to autosave note:', err);
          setSaveStatus('idle');
        }
      }, 500);
    },
    [numericId]
  );

  // Flush any pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    triggerAutoSave(val, content, tags, isPinned, isArchived);
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    triggerAutoSave(title, val, tags, isPinned, isArchived);
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
    }
  };

  const handleAddTag = (rawTag: string) => {
    const clean = rawTag.trim().replace(/^#/, '');
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
        <div className="text-sm text-slate-400 animate-pulse">Opening note...</div>
      </div>
    );
  }

  if (note === null) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <p className="text-sm text-slate-500">Note not found or may have been deleted.</p>
        <button
          type="button"
          onClick={() => navigate('/notes')}
          className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
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
        isDragging ? 'ring-2 ring-blue-500 ring-offset-4 rounded-xl bg-blue-50/20 dark:bg-blue-950/20' : ''
      }`}
    >
      {/* Drag & drop visual banner */}
      {isDragging && (
        <div className="absolute inset-0 z-40 bg-blue-50/80 dark:bg-slate-900/80 backdrop-blur-xs border-2 border-dashed border-blue-500 rounded-xl flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold">
            <svg className="w-8 h-8 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Drop files here to attach to this note</span>
          </div>
        </div>
      )}

      {/* Top action bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* Autosave Status Indicator */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 select-none">
            {saveStatus === 'saving' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Saving...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Saved</span>
              </>
            ) : (
              <span>Unsaved changes</span>
            )}
            {note.updatedAt && (
              <span className="hidden sm:inline text-slate-400 dark:text-slate-600">
                · {formatRelativeTime(note.updatedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Note tools & attachments */}
        <div className="flex items-center gap-1.5">
          {/* Attach file action */}
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
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Attach files or images"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span className="hidden sm:inline">Attach</span>
          </button>

          {/* Add link action */}
          <button
            type="button"
            onClick={() => setIsAddLinkOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Add link"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span className="hidden sm:inline">Link</span>
          </button>

          <span className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

          {/* Pin action */}
          <button
            type="button"
            onClick={handleTogglePin}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              isPinned
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={isPinned ? 'Unpin note' : 'Pin note to top'}
            aria-label={isPinned ? 'Unpin note' : 'Pin note to top'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z" />
            </svg>
          </button>

          {/* Archive action */}
          <button
            type="button"
            onClick={handleToggleArchive}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              isArchived
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={isArchived ? 'Unarchive note' : 'Archive note'}
            aria-label={isArchived ? 'Unarchive note' : 'Archive note'}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="5" rx="1" />
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <path d="M10 12h4" />
            </svg>
          </button>

          {/* Delete action */}
          <button
            type="button"
            onClick={handleTrash}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
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

      {/* Editor Body */}
      <div className="flex-1 flex flex-col py-6 space-y-4">
        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled Note"
          className="w-full bg-transparent text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-700 focus:outline-none tracking-tight"
        />

        {/* Tag Pill Manager */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80"
            >
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-100 p-0.5 rounded-full cursor-pointer"
                aria-label={`Remove tag ${tag}`}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}

          {/* New Tag Input */}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => {
              if (tagInput.trim()) handleAddTag(tagInput);
            }}
            placeholder={tags.length === 0 ? '+ Add tag (Enter or comma)...' : '+ tag...'}
            className="text-xs bg-transparent text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none px-2 py-0.5 rounded border border-transparent focus:border-slate-300 dark:focus:border-slate-700 w-44"
          />
        </div>

        {/* Content Textarea */}
        <textarea
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start writing plain text... (paste images with Ctrl+V, drag & drop files, or use Attach)"
          className="flex-1 w-full bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-700 text-base leading-relaxed resize-none focus:outline-none min-h-[300px]"
        />

        {/* Attachments Section */}
        <AttachmentGallery
          attachments={attachments ?? []}
          onDeleteAttachment={handleDeleteAttachment}
        />
      </div>

      {/* Add Link Dialog */}
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

      {/* Large File Warning Dialog (15 MB - 50 MB) */}
      {currentLargeFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Large file warning
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                "{currentLargeFile.name}"
              </span>
              This file is <strong>{formatFileSize(currentLargeFile.size)}</strong>. Storing large files in IndexedDB consumes significant browser quota. Attach anyway?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCancelLargeFile}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLargeFile}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer"
              >
                Attach Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
