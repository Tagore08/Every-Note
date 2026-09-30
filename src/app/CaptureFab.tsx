import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Search } from 'lucide-react';
import { notesRepo } from '../db/notesRepo';
import { tasksRepo } from '../db/tasksRepo';
import { canvasRepo } from '../db/repos/canvasRepo';
import { useFlag } from './flags';
import { Sheet } from '../design/ui/Sheet';
import { TaskEditorModal } from '../components/tasks/TaskEditorModal';
import { TemplatePickerSheet } from '../features/templates/TemplatePickerSheet';
import { ScratchpadModal } from '../features/scratchpad/ScratchpadModal';
import { useSnackbar } from '../context/SnackbarContext';
import { localDateStr } from '../lib/date';
import type { Template } from '../types/template';

interface CaptureFabProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  showFAB?: boolean;
  onOpenSearch?: () => void;
}

interface SpeedDialAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  onClick: () => void;
}

export function CaptureFab({
  isOpen: controlledIsOpen,
  onOpenChange,
  showFAB = true,
  onOpenSearch,
}: CaptureFabProps) {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isSpeedDialOpen, setIsSpeedDialOpen] = useState(false);
  const [isDirectInbox, setIsDirectInbox] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
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

  // Long-press detection on FAB
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const startPress = () => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if ('vibrate' in navigator) navigator.vibrate(50);
      setIsSpeedDialOpen(false);
      setIsDirectInbox(true);
      setOpen(true);
    }, 500);
  };

  const endPress = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  };

  const handleFabClick = () => {
    if (isLongPressRef.current) { isLongPressRef.current = false; return; }
    setIsSpeedDialOpen((prev) => !prev);
  };

  const closeSpeedDial = () => setIsSpeedDialOpen(false);

  // Autofocus textarea when capture sheet opens
  useEffect(() => {
    if (isOpen) {
      setContent('');
      setIsSaving(false);
      const timer = setTimeout(() => textareaRef.current?.focus(), 70);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close speed-dial when capture sheet opens
  useEffect(() => {
    if (isOpen) setIsSpeedDialOpen(false);
  }, [isOpen]);

  const handleSaveInbox = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSaving) { setOpen(false); setIsDirectInbox(false); return; }
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveInbox(); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setIsDirectInbox(false); }
  };

  const handleNewNote = async () => {
    closeSpeedDial();
    try {
      const note = await notesRepo.createNote({ title: '', content: '' });
      navigate(`/notes/${note.id}`);
    } catch { navigate('/notes'); }
  };

  const handleNewTask = () => { closeSpeedDial(); setIsTaskModalOpen(true); };
  const handleJournal = () => { closeSpeedDial(); navigate('/journal'); };

  const handleCanvas = async () => {
    closeSpeedDial();
    try {
      const created = await canvasRepo.createCanvas({ title: 'Untitled drawing' });
      navigate(`/canvas/${created.id}`);
    } catch { navigate('/canvas'); }
  };

  const handleCapture = () => {
    closeSpeedDial();
    setIsDirectInbox(false);
    setOpen(true);
  };

  const handleApplyTemplate = async (template: Template) => {
    if (template.kind === 'task') {
      const dueAt = template.body.dueOffsetDays
        ? new Date(Date.now() + template.body.dueOffsetDays * 86400000)
        : null;
      const task = await tasksRepo.createTask({
        title: template.body.title || template.name,
        priority: (template.body.priority as any) || 'none',
        dueAt,
      });
      if (template.body.subtasks && Array.isArray(template.body.subtasks)) {
        for (const st of template.body.subtasks) {
          if (st.trim() && task.id) await tasksRepo.createSubtask(task.id, st.trim());
        }
      }
      showSnackbar({ message: `Created task from "${template.name}"` });
      navigate('/tasks');
    } else if (template.kind === 'note') {
      const note = await notesRepo.createNote({
        title: template.body.title || template.name,
        content: template.body.content || '',
      });
      showSnackbar({ message: `Created note from "${template.name}"` });
      navigate(`/notes/${note.id}`);
    } else if (template.kind === 'journal') {
      const todayStr = localDateStr();
      const existing = await notesRepo.getJournalEntry(todayStr);
      let initialContent = '';
      if (template.body.prompts && template.body.prompts.length > 0) {
        initialContent = template.body.prompts.map((p) => `**${p}**\n\n`).join('\n');
      }
      if (existing) {
        if (!existing.content) await notesRepo.updateNote(existing.id!, { content: initialContent });
      } else {
        await notesRepo.createNote({
          kind: 'journal',
          journalDate: todayStr,
          title: `Journal — ${todayStr}`,
          content: initialContent,
          inbox: false,
          pinned: false,
          archived: false,
        });
      }
      showSnackbar({ message: `Opened journal with "${template.name}"` });
      navigate(`/journal/${todayStr}`);
    }
  };

  // Build speed-dial actions with distinct soft accent tints
  const speedDialActions: SpeedDialAction[] = [
    {
      id: 'capture',
      label: 'Quick Capture',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
          <path d="M17.586 3.414a2 2 0 112.828 2.828L12 14.828l-4 1 1-4 8.586-8.414z" />
        </svg>
      ),
      iconBg: 'bg-blue-500/15 dark:bg-blue-500/20',
      iconColor: 'text-blue-400 dark:text-blue-300',
      borderColor: 'border-blue-500/25',
      onClick: handleCapture,
    },
    {
      id: 'note',
      label: 'Note',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
      iconBg: 'bg-teal-500/15 dark:bg-teal-500/20',
      iconColor: 'text-teal-400 dark:text-teal-300',
      borderColor: 'border-teal-500/25',
      onClick: handleNewNote,
    },
    {
      id: 'task',
      label: 'Task',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      ),
      iconBg: 'bg-amber-500/15 dark:bg-amber-500/20',
      iconColor: 'text-amber-400 dark:text-amber-300',
      borderColor: 'border-amber-500/25',
      onClick: handleNewTask,
    },
    ...(isJournalEnabled
      ? [{
          id: 'journal',
          label: 'Journal Entry',
          icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
          ),
          iconBg: 'bg-purple-500/15 dark:bg-purple-500/20',
          iconColor: 'text-purple-400 dark:text-purple-300',
          borderColor: 'border-purple-500/25',
          onClick: handleJournal,
        }]
      : []),
    ...(isCanvasEnabled
      ? [{
          id: 'canvas',
          label: 'Drawing',
          icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
            </svg>
          ),
          iconBg: 'bg-rose-500/15 dark:bg-rose-500/20',
          iconColor: 'text-rose-400 dark:text-rose-300',
          borderColor: 'border-rose-500/25',
          onClick: handleCanvas,
        }]
      : []),
    ...(isTemplatesEnabled
      ? [{
          id: 'template',
          label: 'From Template',
          icon: (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /><path d="M14 9h3" /><path d="M14 15h3" />
            </svg>
          ),
          iconBg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
          iconColor: 'text-emerald-400 dark:text-emerald-300',
          borderColor: 'border-emerald-500/25',
          onClick: () => { closeSpeedDial(); setIsTemplatePickerOpen(true); },
        }]
      : []),
    {
      id: 'scratchpad',
      label: 'Scratchpad',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
      iconBg: 'bg-indigo-500/15 dark:bg-indigo-500/20',
      iconColor: 'text-indigo-400 dark:text-indigo-300',
      borderColor: 'border-indigo-500/25',
      onClick: () => { closeSpeedDial(); navigate('/scratchpad'); },
    },
  ];

  return (
    <>
      {showFAB && (
        <>
          {/* Speed-dial backdrop */}
          <AnimatePresence>
            {isSpeedDialOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
                className="fixed inset-0 z-[38] bg-black/50 backdrop-blur-xs"
                onClick={closeSpeedDial}
                aria-hidden="true"
              />
            )}
          </AnimatePresence>

          {/* Refined Floating Speed-Dial Action Sheet — positioned above bottom-right controls */}
          <div className="fixed bottom-[calc(80px+var(--safe-area-bottom,0px))] right-4 sm:right-6 w-[calc(100%-2rem)] max-w-[340px] z-[39] pointer-events-none flex justify-end">
            <AnimatePresence>
              {isSpeedDialOpen && (
                <motion.div
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.95 }}
                  animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 420, damping: 28 }
                  }
                  className="pointer-events-auto w-full p-3.5 rounded-3xl bg-surface/95 dark:bg-surface/95 backdrop-blur-2xl border border-border/80 shadow-2xl"
                >
                  <div className="flex items-center justify-between px-2 pt-1 pb-2.5 border-b border-border/40 mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                      Quick Create
                    </span>
                    <span className="text-[11px] text-ink-muted">Tap to open</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {speedDialActions.map((action) => (
                      <button
                        key={action.id}
                        type="button"
                        aria-label={action.label}
                        onClick={action.onClick}
                        className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl hover:bg-surface-2/80 active:scale-95 transition-all cursor-pointer min-h-[72px] group text-center"
                      >
                        <span className={`w-11 h-11 rounded-2xl ${action.iconBg} ${action.iconColor} ${action.borderColor} border flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform`}>
                          {action.icon}
                        </span>
                        <span className="text-[12px] font-medium text-ink truncate max-w-full leading-tight">
                          {action.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Floating Bottom-Right Overlay Controls ──────────────────────── */}
          <div className="fixed bottom-[calc(1.5rem+var(--safe-area-bottom,0px))] right-4 sm:right-6 z-40 pointer-events-none flex items-center justify-end">
            <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-full bg-surface/90 dark:bg-surface/90 backdrop-blur-2xl border border-border/80 shadow-card">
              {/* Clean Bottom Search Icon Button */}
              {onOpenSearch && (
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="w-11 h-11 rounded-full text-ink hover:text-accent hover:bg-surface-2 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                  title="Search & Commands (⌘K)"
                  aria-label="Search and Commands"
                >
                  <Search className="w-5 h-5" strokeWidth={1.9} />
                </button>
              )}

              {/* Clean Bottom "+" Action Icon Button */}
              <motion.button
                type="button"
                aria-label="Quick Create (hold for instant inbox note)"
                onPointerDown={startPress}
                onPointerUp={endPress}
                onPointerCancel={endPress}
                onClick={handleFabClick}
                whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
                whileTap={shouldReduceMotion ? undefined : { scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                className={`relative w-11 h-11 rounded-full flex items-center justify-center cursor-pointer select-none transition-colors border shadow-xs ${
                  isSpeedDialOpen
                    ? 'bg-surface text-ink border-border shadow-xs'
                    : 'bg-accent text-accent-ink border-accent/20'
                }`}
              >
                <motion.svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  animate={{ rotate: isSpeedDialOpen ? 45 : 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 22 }}
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </motion.svg>
              </motion.button>
            </div>
          </div>
        </>
      )}

      {/* Capture Sheet (for quick text capture / long-press) */}
      <Sheet
        isOpen={isOpen}
        onClose={() => { setOpen(false); setIsDirectInbox(false); }}
        title={isDirectInbox ? 'Direct Inbox Capture' : 'Quick Capture'}
        description={isDirectInbox ? 'Sub-3s capture to Inbox' : 'Note, task, or entry'}
      >
        <div className="space-y-4">
          {/* Quick capture textarea */}
          <div className="p-3.5 rounded-card bg-surface-2 border border-border focus-within:border-accent transition-colors">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's on your mind? Capture to inbox..."
              rows={3}
              className="w-full resize-none bg-transparent text-ink placeholder-ink-faint text-base focus:outline-none leading-relaxed"
            />
            <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs text-ink-muted">
              <span className="hidden sm:inline">
                <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono text-[10px]">Enter</kbd>{' '}
                to save ·{' '}
                <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono text-[10px]">Shift+Enter</kbd>{' '}
                newline
              </span>
              <span className="sm:hidden text-ink-faint">Tap Save to record</span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleSaveInbox}
                  disabled={!content.trim() || isSaving}
                  className="px-4 py-2 rounded-pill bg-accent text-accent-ink font-semibold text-xs hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer min-h-[40px]"
                >
                  {isSaving ? 'Saving…' : 'Save to Inbox'}
                </button>
              </div>
            </div>
          </div>

          {/* Additional actions in full sheet mode */}
          {!isDirectInbox && (
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint">Create</div>
              <div className="grid grid-cols-2 gap-2">
                {speedDialActions.slice(1).map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => { setOpen(false); action.onClick(); }}
                    className="flex items-center gap-2.5 p-3 rounded-card bg-surface-2/60 hover:bg-surface-2 border border-border/50 text-ink text-sm font-medium transition-colors text-left cursor-pointer min-h-[48px]"
                  >
                    <span className="w-8 h-8 rounded-xl bg-surface border border-border/60 text-ink-muted group-hover:text-accent flex items-center justify-center shrink-0">
                      {action.icon}
                    </span>
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Sheet>

      {/* Scratchpad Modal */}
      <ScratchpadModal isOpen={isScratchpadOpen} onClose={() => setIsScratchpadOpen(false)} />

      {/* Template Picker Sheet */}
      <TemplatePickerSheet
        isOpen={isTemplatePickerOpen}
        onClose={() => setIsTemplatePickerOpen(false)}
        onSelectTemplate={handleApplyTemplate}
      />

      {/* Task Creation Modal */}
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
