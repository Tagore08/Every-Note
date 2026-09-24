import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { notesRepo } from '../db/notesRepo';
import { tasksRepo } from '../db/tasksRepo';
import { useFlag } from './flags';
import { Sheet } from '../design/ui/Sheet';
import { FAB } from '../design/ui/FAB';
import { TaskEditorModal } from '../components/tasks/TaskEditorModal';
import { TemplatePickerSheet } from '../features/templates/TemplatePickerSheet';
import { useSnackbar } from '../context/SnackbarContext';
import type { Template } from '../types/template';

interface CaptureFabProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  // If true, render the floating action button (mobile)
  showFAB?: boolean;
}

export function CaptureFab({
  isOpen: controlledIsOpen,
  onOpenChange,
  showFAB = true,
}: CaptureFabProps) {
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isDirectInbox, setIsDirectInbox] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const { showSnackbar } = useSnackbar();

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalOpen;
  const setOpen = (open: boolean) => {
    if (onOpenChange) onOpenChange(open);
    else setInternalOpen(open);
  };

  const isJournalEnabled = useFlag('journal');
  const isCanvasEnabled = useFlag('canvas');
  const isTemplatesEnabled = useFlag('smartInbox');

  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autofocus when capture sheet opens
  useEffect(() => {
    if (isOpen) {
      setContent('');
      setIsSaving(false);
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSaveInbox = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSaving) {
      setOpen(false);
      setIsDirectInbox(false);
      return;
    }

    try {
      setIsSaving(true);
      await notesRepo.captureNote(trimmed);
      setContent('');
      setOpen(false);
      setIsDirectInbox(false);
    } catch (err) {
      console.error('Failed to capture note to inbox:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveInbox();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setIsDirectInbox(false);
    }
  };

  const handleLongPress = () => {
    setIsDirectInbox(true);
    setOpen(true);
  };

  const handleNewNote = async () => {
    setOpen(false);
    try {
      const note = await notesRepo.createNote({ title: '', content: '' });
      navigate(`/notes/${note.id}`);
    } catch {
      navigate('/notes');
    }
  };

  const handleNewTask = () => {
    setOpen(false);
    setIsTaskModalOpen(true);
  };

  const handleJournal = () => {
    setOpen(false);
    navigate('/journal');
  };

  const handleCanvas = () => {
    setOpen(false);
    navigate('/canvas');
  };

  const handleApplyTemplate = async (template: Template) => {
    if (template.kind === 'task') {
      const dueAt = template.body.dueOffsetDays
        ? new Date(Date.now() + template.body.dueOffsetDays * 86400000)
        : null;

      const task = await tasksRepo.createTask({
        title: template.body.title || template.name,
        priority: (template.body.priority as any) || 'none',
        lifeAreaId: template.body.lifeAreaId ?? null,
        dueAt,
      });

      if (template.body.subtasks && Array.isArray(template.body.subtasks)) {
        for (const st of template.body.subtasks) {
          if (st.trim() && task.id) {
            await tasksRepo.createSubtask(task.id, st.trim());
          }
        }
      }

      showSnackbar({ message: `Created task from "${template.name}"` });
      navigate('/tasks');
    } else if (template.kind === 'note') {
      const note = await notesRepo.createNote({
        title: template.body.title || template.name,
        content: template.body.content || '',
        lifeAreaId: template.body.lifeAreaId ?? null,
      });

      showSnackbar({ message: `Created note from "${template.name}"` });
      navigate(`/notes/${note.id}`);
    }
  };

  return (
    <>
      {showFAB && (
        <div className="fixed bottom-20 right-4 z-40 md:hidden">
          <FAB
            onClick={() => {
              setIsDirectInbox(false);
              setOpen(true);
            }}
            onLongPress={handleLongPress}
            icon={
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
            ariaLabel="Quick Capture (hold for instant inbox note)"
          />
        </div>
      )}

      {/* Capture Sheet */}
      <Sheet
        isOpen={isOpen}
        onClose={() => {
          setOpen(false);
          setIsDirectInbox(false);
        }}
        title={isDirectInbox ? 'Direct Inbox Capture' : 'Quick Capture'}
        description={isDirectInbox ? 'Sub-3s capture to Inbox' : 'Note, task, or entry'}
      >
        <div className="space-y-4">
          {/* Sacred <3s Inbox capture input */}
          <div className="p-3.5 rounded-card bg-surface-2 border border-border focus-within:border-accent transition-colors">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind? Capture to inbox..."
              rows={3}
              className="w-full resize-none bg-transparent text-ink placeholder-ink-muted text-base focus:outline-none leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-ink-muted">
              <span className="hidden sm:inline">
                <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono text-[10px]">
                  Enter
                </kbd>{' '}
                to save ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono text-[10px]">
                  Shift+Enter
                </kbd>{' '}
                newline
              </span>
              <span className="sm:hidden">Tap Save to record</span>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleSaveInbox}
                  disabled={!content.trim() || isSaving}
                  className="px-4 py-2 rounded-pill bg-accent text-accent-ink font-semibold text-xs hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer min-h-[44px]"
                >
                  {isSaving ? 'Saving…' : 'Save to Inbox'}
                </button>
              </div>
            </div>
          </div>

          {/* Additional Capture Actions (Only shown in full sheet mode, not direct inbox) */}
          {!isDirectInbox && (
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Create
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleNewNote}
                  className="flex items-center gap-2.5 p-3 rounded-card bg-surface-2 hover:bg-surface border border-border text-ink text-sm font-medium transition-colors text-left cursor-pointer min-h-[44px]"
                >
                  <svg className="w-5 h-5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>New Note</span>
                </button>

                <button
                  type="button"
                  onClick={handleNewTask}
                  className="flex items-center gap-2.5 p-3 rounded-card bg-surface-2 hover:bg-surface border border-border text-ink text-sm font-medium transition-colors text-left cursor-pointer min-h-[44px]"
                >
                  <svg className="w-5 h-5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  <span>New Task</span>
                </button>

                {isJournalEnabled && (
                  <button
                    type="button"
                    onClick={handleJournal}
                    className="flex items-center gap-2.5 p-3 rounded-card bg-surface-2 hover:bg-surface border border-border text-ink text-sm font-medium transition-colors text-left cursor-pointer min-h-[44px]"
                  >
                    <svg className="w-5 h-5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    <span>Journal Entry</span>
                  </button>
                )}

                {isCanvasEnabled && (
                  <button
                    type="button"
                    onClick={handleCanvas}
                    className="flex items-center gap-2.5 p-3 rounded-card bg-surface-2 hover:bg-surface border border-border text-ink text-sm font-medium transition-colors text-left cursor-pointer min-h-[44px]"
                  >
                    <svg className="w-5 h-5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                    </svg>
                    <span>New Drawing</span>
                  </button>
                )}

                {isTemplatesEnabled && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setIsTemplatePickerOpen(true);
                    }}
                    className="flex items-center gap-2.5 p-3 rounded-card bg-surface-2 hover:bg-surface border border-border text-ink text-sm font-medium transition-colors text-left cursor-pointer min-h-[44px]"
                  >
                    <svg className="w-5 h-5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 3v18" />
                    </svg>
                    <span>From Template</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </Sheet>

      {/* Template Picker Sheet */}
      <TemplatePickerSheet
        isOpen={isTemplatePickerOpen}
        onClose={() => setIsTemplatePickerOpen(false)}
        onSelectTemplate={handleApplyTemplate}
      />

      {/* Task Creation Modal if user chose New Task */}
      {isTaskModalOpen && (
        <TaskEditorModal
          task={null}
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onDelete={() => {}}
        />
      )}
    </>
  );
}
