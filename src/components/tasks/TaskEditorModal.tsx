import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Task, TaskPriority, TaskStatus } from '../../types/task';
import { tasksRepo } from '../../db/tasksRepo';
import { isOverdue, formatDueDate } from '../../utils/format';

interface TaskEditorModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: number) => void;
}

// Convert Date to YYYY-MM-DDTHH:mm for datetime-local input
function dateToInputString(date?: Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${mins}`;
}

export function TaskEditorModal({ task, isOpen, onClose, onDelete }: TaskEditorModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('none');
  const [dueAtStr, setDueAtStr] = useState('');
  const [importance, setImportance] = useState(false);
  const [urgency, setUrgency] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync state when task changes or modal opens
  useEffect(() => {
    if (task && isOpen) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setStatus(task.status || 'todo');
      setPriority(task.priority || 'none');
      setDueAtStr(dateToInputString(task.dueAt));
      setImportance(Boolean(task.importance));
      setUrgency(Boolean(task.urgency));
      setTags(task.tags ? [...task.tags] : []);
      setTagInput('');
    }
  }, [task, isOpen]);

  // Focus title input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSaveAndClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  if (!isOpen || !task || !task.id) return null;

  const handleSaveAndClose = async () => {
    if (!task.id) {
      onClose();
      return;
    }

    const dueAtDate = dueAtStr ? new Date(dueAtStr) : null;
    await tasksRepo.updateTask(task.id, {
      title: title.trim() || 'Untitled Task',
      description: description.trim(),
      status,
      priority,
      dueAt: isNaN(dueAtDate?.getTime() ?? 0) ? null : dueAtDate,
      importance,
      urgency,
      tags,
    });
    onClose();
  };

  const handleAddTag = (rawTag: string) => {
    const clean = rawTag.trim().replace(/^#/, '');
    if (!clean || tags.includes(clean)) {
      setTagInput('');
      return;
    }
    setTags([...tags, clean]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      handleRemoveTag(tags[tags.length - 1]);
    }
  };

  // Due date quick presets
  const setDuePreset = (type: 'today' | 'tomorrow' | 'nextWeek' | 'clear') => {
    if (type === 'clear') {
      setDueAtStr('');
      return;
    }
    const d = new Date();
    d.setSeconds(0);
    d.setMilliseconds(0);
    if (type === 'today') {
      d.setHours(18, 0, 0, 0);
    } else if (type === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      d.setHours(18, 0, 0, 0);
    } else if (type === 'nextWeek') {
      d.setDate(d.getDate() + 7);
      d.setHours(10, 0, 0, 0);
    }
    setDueAtStr(dateToInputString(d));
  };

  const isCurrentOverdue = status === 'todo' && dueAtStr && isOverdue(new Date(dueAtStr));

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSaveAndClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl space-y-5">
        {/* Header with Status & Close */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStatus(status === 'todo' ? 'done' : 'todo')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                status === 'done'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
              }`}
            >
              {status === 'done' ? (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Done</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                  <span>Todo</span>
                </>
              )}
            </button>

            {isCurrentOverdue && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300">
                Overdue
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                if (task.id) onDelete(task.id);
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Delete task"
              aria-label="Delete task"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleSaveAndClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close task editor"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Task Title */}
        <div>
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title..."
            className="w-full text-lg sm:text-xl font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 bg-transparent focus:outline-none tracking-tight"
          />
        </div>

        {/* Progressive Disclosure Section: Optional Fields */}
        <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* 1. Description */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, notes, or instructions..."
              rows={3}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 text-xs sm:text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
            />
          </div>

          {/* 2. Due Date with Quick Presets */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Due Date & Time
              </label>
              {dueAtStr && (
                <span className={`text-xs ${isCurrentOverdue ? 'text-red-500 font-semibold' : 'text-slate-500'}`}>
                  {formatDueDate(dueAtStr)}
                </span>
              )}
            </div>

            <input
              type="datetime-local"
              value={dueAtStr}
              onChange={(e) => setDueAtStr(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-800 dark:text-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setDuePreset('today')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDuePreset('tomorrow')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => setDuePreset('nextWeek')}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Next Week
              </button>
              {dueAtStr && (
                <button
                  type="button"
                  onClick={() => setDuePreset('clear')}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* 3. Priority Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Priority
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { key: 'none', label: 'None', color: 'text-slate-600 dark:text-slate-400' },
                  { key: 'low', label: 'Low', color: 'text-blue-600 dark:text-blue-400' },
                  { key: 'medium', label: 'Med', color: 'text-amber-600 dark:text-amber-400' },
                  { key: 'high', label: 'High', color: 'text-red-600 dark:text-red-400' },
                ] as const
              ).map((p) => {
                const isSelected = priority === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPriority(p.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-700 dark:border-blue-500 dark:bg-blue-950/50 dark:text-blue-300 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className={p.color}>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Tags Manager */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                >
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => {
                  if (tagInput.trim()) handleAddTag(tagInput);
                }}
                placeholder={tags.length === 0 ? '+ Add tag (Enter)...' : '+ tag...'}
                className="text-xs bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none min-w-[100px] px-1 py-0.5"
              />
            </div>
          </div>

          {/* 5. Subtle Importance & Urgency Toggles (Feature 3: Schema preparation for Eisenhower matrix) */}
          <div className="space-y-1.5 pt-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Attributes
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setImportance(!importance)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  importance
                    ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={importance ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>Important</span>
              </button>

              <button
                type="button"
                onClick={() => setUrgency(!urgency)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  urgency
                    ? 'border-red-400 bg-red-50 text-red-800 dark:border-red-600 dark:bg-red-950/40 dark:text-red-300'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span>Urgent</span>
              </button>
            </div>
          </div>

          {/* 6. Linked Note Backlink (Feature 2) */}
          {typeof task.sourceNoteId === 'number' && (
            <div className="pt-2">
              <Link
                to={`/notes/${task.sourceNoteId}`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>Converted from Note #{task.sourceNoteId} · Open Note →</span>
              </Link>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors"
          >
            Save Task
          </button>
        </div>
      </div>
    </div>
  );
}
