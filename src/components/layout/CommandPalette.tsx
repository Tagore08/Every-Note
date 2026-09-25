import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  FileText,
  CheckSquare,
  Sparkles,
  Zap,
  Timer,
  Target,
  Calendar,
  Palette,
  Settings,
  Sun,
  Moon,
  ArrowRight,
  Copy,
  Check,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { notesRepo } from '../../db/notesRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { useSnippets } from '../../db/repos/snippetsRepo';
import { useTheme } from '../../hooks/useTheme';
import { useSnackbar } from '../../context/SnackbarContext';
import type { Note } from '../../types/note';
import type { Task } from '../../types/task';
import type { Snippet } from '../../types/snippet';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCapture?: () => void;
}

interface PaletteAction {
  id: string;
  type: 'action';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  run: () => void;
}

interface PaletteNoteItem {
  id: string;
  type: 'note';
  note: Note;
}

interface PaletteTaskItem {
  id: string;
  type: 'task';
  task: Task;
}

interface PaletteSnippetItem {
  id: string;
  type: 'snippet';
  snippet: Snippet;
}

type PaletteItem = PaletteAction | PaletteNoteItem | PaletteTaskItem | PaletteSnippetItem;

export function CommandPalette({ isOpen, onClose, onOpenCapture }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { toggleTheme, isDark } = useTheme();
  const { showSnackbar } = useSnackbar();
  const snippets = useSnippets();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedSnippetId, setCopiedSnippetId] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  // Live query matching notes
  const notesResults = useLiveQuery<Note[]>(
    async () => {
      if (!isOpen) return [];
      if (!query.trim()) {
        const recent = await notesRepo.getActiveNotes();
        return recent.slice(0, 4);
      }
      return await notesRepo.searchNotes(query);
    },
    [isOpen, query]
  );

  // Live query matching tasks
  const tasksResults = useLiveQuery<Task[]>(
    async () => {
      if (!isOpen) return [];
      if (!query.trim()) {
        const todos = await tasksRepo.getTodoTasks();
        return todos.slice(0, 4);
      }
      return await tasksRepo.searchTasks(query);
    },
    [isOpen, query]
  );

  // Filter snippets matching query
  const snippetResults = useMemo(() => {
    if (!query.trim()) return snippets.slice(0, 3);
    const q = query.toLowerCase();
    return snippets.filter(
      (s) =>
        s.trigger.toLowerCase().includes(q) ||
        s.expansion.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
    ).slice(0, 5);
  }, [snippets, query]);

  // Available quick actions
  const actions: PaletteAction[] = useMemo(() => {
    const list: PaletteAction[] = [
      {
        id: 'act-new-note',
        type: 'action',
        title: 'New Note',
        subtitle: 'Create a new blank document',
        icon: <FileText className="w-4 h-4 text-emerald-500" />,
        run: () => {
          navigate('/notes/new');
          onClose();
        },
      },
      {
        id: 'act-new-task',
        type: 'action',
        title: 'Tasks',
        subtitle: 'Go to Tasks overview',
        icon: <CheckSquare className="w-4 h-4 text-blue-500" />,
        run: () => {
          navigate('/tasks');
          onClose();
        },
      },
      {
        id: 'act-capture',
        type: 'action',
        title: 'Quick Capture',
        subtitle: 'Capture thought to Inbox',
        icon: <Zap className="w-4 h-4 text-amber-500" />,
        run: () => {
          onClose();
          onOpenCapture?.();
        },
      },
      {
        id: 'act-focus',
        type: 'action',
        title: 'Focus Mode',
        subtitle: 'Start focus timer with plant companion',
        icon: <Timer className="w-4 h-4 text-rose-500" />,
        run: () => {
          navigate('/focus');
          onClose();
        },
      },
      {
        id: 'act-habits',
        type: 'action',
        title: 'Habits',
        subtitle: 'Track daily habits and streaks',
        icon: <Target className="w-4 h-4 text-violet-500" />,
        run: () => {
          navigate('/habits');
          onClose();
        },
      },
      {
        id: 'act-calendar',
        type: 'action',
        title: 'Calendar',
        subtitle: 'View schedule and day agenda',
        icon: <Calendar className="w-4 h-4 text-sky-500" />,
        run: () => {
          navigate('/calendar');
          onClose();
        },
      },
      {
        id: 'act-canvas',
        type: 'action',
        title: 'Canvas Drawing',
        subtitle: 'Open creative visual canvas',
        icon: <Palette className="w-4 h-4 text-pink-500" />,
        run: () => {
          navigate('/canvas');
          onClose();
        },
      },
      {
        id: 'act-theme',
        type: 'action',
        title: `Switch to ${isDark ? 'Light' : 'Dark'} Mode`,
        subtitle: 'Toggle theme display',
        icon: isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />,
        run: () => {
          toggleTheme();
          onClose();
        },
      },
      {
        id: 'act-settings',
        type: 'action',
        title: 'Settings',
        subtitle: 'Preferences, snippets, backups, and data',
        icon: <Settings className="w-4 h-4 text-slate-500" />,
        run: () => {
          navigate('/settings');
          onClose();
        },
      },
    ];

    if (!query.trim()) return list;

    const q = query.toLowerCase();
    return list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.subtitle && a.subtitle.toLowerCase().includes(q))
    );
  }, [navigate, onClose, onOpenCapture, isDark, toggleTheme, query]);

  // Flatten all items into navigable list
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];

    // Actions
    for (const act of actions) {
      items.push(act);
    }

    // Notes
    if (notesResults) {
      for (const n of notesResults.slice(0, 6)) {
        items.push({ id: `note-${n.id}`, type: 'note', note: n });
      }
    }

    // Tasks
    if (tasksResults) {
      for (const t of tasksResults.slice(0, 6)) {
        items.push({ id: `task-${t.id}`, type: 'task', task: t });
      }
    }

    // Snippets
    for (const s of snippetResults) {
      items.push({ id: `snippet-${s.id}`, type: 'snippet', snippet: s });
    }

    return items;
  }, [actions, notesResults, tasksResults, snippetResults]);

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= allItems.length) {
      setSelectedIndex(Math.max(0, allItems.length - 1));
    }
  }, [allItems.length, selectedIndex]);

  // Execute selected item
  const handleExecute = (item: PaletteItem) => {
    if (item.type === 'action') {
      item.run();
    } else if (item.type === 'note') {
      if (item.note.id) {
        navigate(`/notes/${item.note.id}`);
        onClose();
      }
    } else if (item.type === 'task') {
      navigate('/tasks');
      onClose();
    } else if (item.type === 'snippet') {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(item.snippet.expansion).then(() => {
          setCopiedSnippetId(item.snippet.id || null);
          showSnackbar({ message: `Copied "${item.snippet.trigger}" expansion to clipboard` });
          setTimeout(() => setCopiedSnippetId(null), 1500);
        });
      }
    }
  };

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, allItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % Math.max(1, allItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        handleExecute(allItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-[var(--color-ink)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/30">
          <Search className="w-5 h-5 text-[var(--color-ink-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search notes, tasks, snippets..."
            className="flex-1 bg-transparent text-sm sm:text-base text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] px-1.5 py-0.5 rounded cursor-pointer"
            >
              Clear
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-[var(--color-surface-2)] text-[10px] font-mono text-[var(--color-ink-muted)] border border-[var(--color-border)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-4">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-[var(--color-ink-muted)] text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <>
              {/* Actions Section */}
              {actions.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-muted)]">
                    Actions
                  </div>
                  <div className="space-y-0.5">
                    {actions.map((act) => {
                      const itemIdx = allItems.findIndex((it) => it.id === act.id);
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <button
                          key={act.id}
                          type="button"
                          onClick={() => handleExecute(act)}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold'
                              : 'hover:bg-[var(--color-surface-2)] text-[var(--color-ink)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <div className="p-1 rounded-lg bg-[var(--color-surface-2)]">
                              {act.icon}
                            </div>
                            <div className="truncate">
                              <span>{act.title}</span>
                              {act.subtitle && (
                                <span className="ml-2 text-xs text-[var(--color-ink-muted)] font-normal hidden sm:inline truncate">
                                  {act.subtitle}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes Section */}
              {notesResults && notesResults.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-muted)] flex items-center justify-between">
                    <span>Notes</span>
                    <span className="text-[10px] lowercase font-normal">{notesResults.length} found</span>
                  </div>
                  <div className="space-y-0.5">
                    {notesResults.slice(0, 6).map((n) => {
                      const itemIdx = allItems.findIndex((it) => it.id === `note-${n.id}`);
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <button
                          key={`note-${n.id}`}
                          type="button"
                          onClick={() => handleExecute({ id: `note-${n.id}`, type: 'note', note: n })}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold'
                              : 'hover:bg-[var(--color-surface-2)] text-[var(--color-ink)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="truncate">
                              <span className="font-semibold">{n.title || 'Untitled Note'}</span>
                              {n.content && (
                                <span className="ml-2 text-xs text-[var(--color-ink-muted)] font-normal truncate hidden sm:inline">
                                  {n.content.slice(0, 60).replace(/\n/g, ' ')}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tasks Section */}
              {tasksResults && tasksResults.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-muted)] flex items-center justify-between">
                    <span>Tasks</span>
                    <span className="text-[10px] lowercase font-normal">{tasksResults.length} found</span>
                  </div>
                  <div className="space-y-0.5">
                    {tasksResults.slice(0, 6).map((t) => {
                      const itemIdx = allItems.findIndex((it) => it.id === `task-${t.id}`);
                      const isSelected = itemIdx === selectedIndex;
                      return (
                        <button
                          key={`task-${t.id}`}
                          type="button"
                          onClick={() => handleExecute({ id: `task-${t.id}`, type: 'task', task: t })}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold'
                              : 'hover:bg-[var(--color-surface-2)] text-[var(--color-ink)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <CheckSquare className="w-4 h-4 text-blue-500 shrink-0" />
                            <span className="truncate">{t.title}</span>
                            {t.priority && t.priority !== 'none' && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-full uppercase font-bold border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400">
                                {t.priority}
                              </span>
                            )}
                          </div>
                          {isSelected && <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Snippets Section */}
              {snippetResults.length > 0 && (
                <div>
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-muted)] flex items-center justify-between">
                    <span>Text Snippets</span>
                    <span className="text-[10px] lowercase font-normal">click to copy</span>
                  </div>
                  <div className="space-y-0.5">
                    {snippetResults.map((s) => {
                      const itemIdx = allItems.findIndex((it) => it.id === `snippet-${s.id}`);
                      const isSelected = itemIdx === selectedIndex;
                      const isCopied = copiedSnippetId === s.id;
                      return (
                        <button
                          key={`snippet-${s.id}`}
                          type="button"
                          onClick={() => handleExecute({ id: `snippet-${s.id}`, type: 'snippet', snippet: s })}
                          onMouseEnter={() => setSelectedIndex(itemIdx)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold'
                              : 'hover:bg-[var(--color-surface-2)] text-[var(--color-ink)]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="font-mono font-bold">{s.trigger}</span>
                            <span className="text-xs text-[var(--color-ink-muted)] truncate">
                              → {s.expansion.slice(0, 50).replace(/\n/g, ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 text-xs">
                            {isCopied ? (
                              <span className="text-emerald-500 flex items-center gap-1 text-[11px] font-semibold">
                                <Check className="w-3.5 h-3.5" /> Copied!
                              </span>
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-[var(--color-ink-muted)]" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with Keyboard Hints */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40 text-[11px] text-[var(--color-ink-muted)]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[9px]">
                ↑
              </kbd>
              <kbd className="px-1 py-0.2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[9px]">
                ↓
              </kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-[9px]">
                ↵
              </kbd>
              <span>select</span>
            </span>
          </div>
          <span className="hidden sm:inline text-[10px]">
            Cmd+K or Ctrl+K anytime
          </span>
        </div>
      </div>
    </div>
  );
}
