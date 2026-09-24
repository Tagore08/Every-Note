import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { notesRepo, useNote } from '../../db/notesRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatRelativeTime } from '../../utils/format';

export function NoteEditorView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showUndo } = useSnackbar();
  const numericId = id && id !== 'new' ? parseInt(id, 10) : null;

  const note = useNote(numericId);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');

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
    <div className="max-w-4xl mx-auto flex flex-col min-h-[calc(100vh-8rem)]">
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

        {/* Note tools */}
        <div className="flex items-center gap-1.5">
          {/* Pin action */}
          <button
            type="button"
            onClick={handleTogglePin}
            className={`p-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
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
            className={`p-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
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
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
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
          placeholder="Start writing plain text..."
          className="flex-1 w-full bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-700 text-base leading-relaxed resize-none focus:outline-none min-h-[350px]"
        />
      </div>
    </div>
  );
}
