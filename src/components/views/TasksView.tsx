import React, { useState, useRef, useMemo, useCallback, type KeyboardEvent, type TouchEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Task } from '../../types/task';
import type { Template } from '../../types/template';
import { useTodoTasks, useDoneTasks, tasksRepo, useAllSubtaskProgressMap, useSubtasks } from '../../db/tasksRepo';
import { parseQuickAdd } from '../../lib/quickAdd';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatDueDate, isOverdue, formatRelativeTime } from '../../utils/format';
import { localDateStr, addDays } from '../../lib/date';
import { normalizePriority, getPriorityMeta, type PriorityLevel } from '../../features/tasks/priority';
import { TaskEditorModal } from '../tasks/TaskEditorModal';
import { QuickRescheduleModal } from '../tasks/QuickRescheduleModal';
import { TemplatePickerSheet } from '../../features/templates/TemplatePickerSheet';
import { EisenhowerMatrixView } from './EisenhowerMatrixView';
import { useSnippetAutocomplete } from '../../features/snippets/useSnippetAutocomplete';
import { SnippetSuggestPill } from '../../features/snippets/SnippetSuggestPill';

export type TaskViewType = 'today' | 'upcoming' | 'all' | 'matrix';
export type GroupByType = 'none' | 'tag' | 'priority' | 'date';

const SubtaskProgressChip = React.memo(function SubtaskProgressChip({
  progress,
  isExpanded,
  onToggleExpand,
}: {
  progress?: { total: number; completed: number };
  isExpanded: boolean;
  onToggleExpand: (e: React.MouseEvent) => void;
}) {
  if (!progress || progress.total === 0) return null;
  return (
    <button
      type="button"
      onClick={onToggleExpand}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors cursor-pointer shrink-0 ${
        isExpanded
          ? 'bg-accent/10 text-accent border-accent/30'
          : 'bg-surface-2 text-ink-muted border-border hover:border-accent/40'
      }`}
      title={`${progress.completed} of ${progress.total} subtasks completed. Click to toggle list.`}
    >
      <span>{progress.completed}/{progress.total}</span>
      <svg
        className={`w-3 h-3 text-ink-muted transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
});

function TaskSubtasksChecklist({ parentTaskId }: { parentTaskId: number }) {
  const subtasks = useSubtasks(parentTaskId);
  const { showSnackbar } = useSnackbar();
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleToggleSubtask = async (st: Task) => {
    if (!st.id) return;
    try {
      await tasksRepo.toggleTaskStatus(st.id, st.status);
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
      showSnackbar({ message: 'Failed to update subtask' });
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTitle.trim();
    if (!clean) return;
    try {
      await tasksRepo.createSubtask(parentTaskId, clean);
      setNewTitle('');
    } catch (err) {
      console.error('Failed to add subtask:', err);
      showSnackbar({ message: 'Failed to add subtask' });
    }
  };

  return (
    <div className="border-l-2 border-border/80 ml-5 pl-3.5 space-y-2 mt-2 pt-1 animate-in fade-in duration-100">
      {subtasks.map((st) => (
        <div key={st.id} className="flex items-center gap-2 group/st text-xs">
          <button
            type="button"
            onClick={() => handleToggleSubtask(st)}
            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
              st.status === 'done'
                ? 'bg-success border-success text-white'
                : 'border-border hover:border-accent'
            }`}
            aria-label={st.status === 'done' ? 'Mark subtask todo' : 'Mark subtask done'}
          >
            {st.status === 'done' && (
              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
          <span
            className={`truncate flex-1 select-text ${
              st.status === 'done' ? 'line-through text-ink-muted' : 'text-ink'
            }`}
          >
            {st.title}
          </span>
        </div>
      ))}

      {isAdding ? (
        <form onSubmit={handleAddSubtask} className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Subtask title..."
            autoFocus
            className="flex-1 px-2.5 py-1 rounded-lg text-xs bg-surface-2 border border-border text-ink focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="px-2.5 py-1 rounded-lg bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 cursor-pointer"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAdding(false);
              setNewTitle('');
            }}
            className="px-2 py-1 text-xs text-ink-muted hover:text-ink cursor-pointer"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="text-[11px] font-medium text-accent hover:underline flex items-center gap-1 cursor-pointer pt-0.5"
        >
          <span>＋</span> Add subtask
        </button>
      )}
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  subtaskProgress?: { total: number; completed: number };
  isSubtasksOpen: boolean;
  onToggleComplete: (task: Task) => void;
  onOpenEditor: (task: Task) => void;
  onToggleSubtasksExpand: (taskId: number, e: React.MouseEvent) => void;
  onReschedule: (task: Task) => void;
  onDeleteTask: (taskId: number) => void;
  onTouchStart: (e: TouchEvent, taskId?: number) => void;
  onTouchEnd: (e: TouchEvent, task: Task) => void;
}

const TaskRow = React.memo(function TaskRow({
  task,
  subtaskProgress,
  isSubtasksOpen,
  onToggleComplete,
  onOpenEditor,
  onToggleSubtasksExpand,
  onReschedule,
  onDeleteTask,
  onTouchStart,
  onTouchEnd,
}: TaskRowProps) {
  const overdue = task.status === 'todo' && task.dueAt && isOverdue(task.dueAt);
  const prioMeta = getPriorityMeta(task.priority);

  return (
    <div
      onTouchStart={(e) => onTouchStart(e, task.id)}
      onTouchEnd={(e) => onTouchEnd(e, task)}
      className={`group rounded-2xl border bg-surface p-3 sm:p-3.5 shadow-card transition-all hover:border-accent/40 flex flex-col gap-1 select-none ${
        overdue
          ? 'border-danger/40 bg-danger/5'
          : 'border-border'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Circular checkbox styled by priority level (Todoist style) */}
        <button
          type="button"
          onClick={() => onToggleComplete(task)}
          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
            task.status === 'done'
              ? 'bg-success border-success text-white'
              : prioMeta.checkboxBorder
          }`}
          aria-label={task.status === 'done' ? 'Mark task todo' : 'Mark task done'}
        >
          {task.status === 'done' && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* Task body: tap to edit */}
        <div
          onClick={() => onOpenEditor(task)}
          className="flex-1 min-w-0 cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <p
                className={`text-sm font-semibold leading-snug break-words ${
                  task.status === 'done'
                    ? 'line-through text-ink-muted'
                    : overdue
                    ? 'text-danger font-bold'
                    : 'text-ink'
                }`}
              >
                {task.title}
              </p>

              {/* Subtasks Progress Chip with toggle */}
              {task.id && (
                <SubtaskProgressChip
                  progress={subtaskProgress}
                  isExpanded={isSubtasksOpen}
                  onToggleExpand={(e) => onToggleSubtasksExpand(task.id!, e)}
                />
              )}
            </div>

            {/* Due Date & Action hints */}
            <div className="flex items-center gap-2 shrink-0">
              {task.dueAt && (
                <span
                  className={`text-xs font-semibold ${
                    overdue
                      ? 'text-danger font-bold'
                      : 'text-ink-muted'
                  }`}
                >
                  {overdue ? 'Overdue · ' : ''}
                  {formatDueDate(task.dueAt)}
                </span>
              )}

              {/* Action buttons (always visible on mobile, hover/focus on desktop) */}
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReschedule(task);
                  }}
                  className="p-1 rounded-lg text-ink-muted hover:text-accent hover:bg-surface-2 transition-colors cursor-pointer"
                  title="Reschedule"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (task.id) onDeleteTask(task.id);
                  }}
                  className="p-1 rounded-lg text-ink-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Delete"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Metadata row: Priority Badge, Tags, Source Note */}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-ink-muted">
            {/* P1-P4 Priority Badge */}
            {prioMeta.level !== 'p4' && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${prioMeta.badgeBg}`}>
                {prioMeta.shortLabel}
              </span>
            )}

            {/* Tags */}
            {task.tags &&
              task.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-2 text-ink-muted border border-border"
                >
                  #{tag}
                </span>
              ))}

            {/* Linked note */}
            {typeof task.sourceNoteId === 'number' && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-accent">
                <span>Note #{task.sourceNoteId}</span>
              </span>
            )}

            {/* Completion time */}
            {task.status === 'done' && task.completedAt && (
              <span className="text-[10px] text-ink-muted">
                · Completed {formatRelativeTime(task.completedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Nested Indented Subtasks Checklist */}
      {task.id && isSubtasksOpen && (
        <TaskSubtasksChecklist parentTaskId={task.id} />
      )}
    </div>
  );
});

export const TasksView = React.memo(function TasksView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const view: TaskViewType = rawView === 'matrix' || rawView === 'today' || rawView === 'upcoming' || rawView === 'all'
    ? rawView
    : 'today';

  const setView = (v: TaskViewType) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', v);
      return next;
    });
  };

  const [segment, setSegment] = useState<'todo' | 'done'>('todo');
  const [groupBy, setGroupBy] = useState<GroupByType>('none');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState<PriorityLevel>('p4');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<Task | null>(null);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [warningTask, setWarningTask] = useState<Task | null>(null);

  // Expanded subtasks parent IDs
  const [expandedSubtaskParents, setExpandedSubtaskParents] = useState<Record<number, boolean>>({});

  const toggleSubtasksExpand = useCallback((taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSubtaskParents((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  }, []);

  const todoTasks = useTodoTasks();
  const doneTasks = useDoneTasks();
  const allSubtaskProgress = useAllSubtaskProgressMap();
  const { showUndo, showSnackbar } = useSnackbar();

  // Swipe detection for touch devices
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipedTaskId = useRef<number | null>(null);

  // Quick Add input ref & Snippet expansion
  const quickInputRef = useRef<HTMLInputElement>(null);
  const {
    hasMatches: hasSnippetMatches,
    matchingSnippets,
    applySnippet,
    handleKeyDown: handleSnippetKeyDown,
  } = useSnippetAutocomplete({
    value: quickTitle,
    onChange: setQuickTitle,
    inputRef: quickInputRef,
  });

  // NLP preview calculation
  const parsedPreview = useMemo(() => {
    if (!quickTitle.trim()) return null;
    return parseQuickAdd(quickTitle);
  }, [quickTitle]);

  const handleKeyDownQuickAdd = (e: KeyboardEvent<HTMLInputElement>) => {
    if (hasSnippetMatches && e.key === 'Tab') {
      handleSnippetKeyDown(e);
      return;
    }
    handleQuickAdd(e);
  };

  const handleQuickAdd = async (e?: KeyboardEvent<HTMLInputElement>) => {
    if (e && e.key !== 'Enter') return;
    if (e) e.preventDefault();
    const clean = quickTitle.trim();
    if (!clean) return;

    const parsed = parseQuickAdd(clean);
    const finalPriority = parsed.priority || quickPriority;

    try {
      await tasksRepo.createTask({
        title: parsed.title || clean,
        dueAt: parsed.dueAt,
        tags: parsed.tags,
        priority: finalPriority,
      });
      setQuickTitle('');
      setQuickPriority('p4');
    } catch (err) {
      console.error('Failed to create task:', err);
      showSnackbar({ message: 'Failed to create task' });
    }
  };

  const executeToggleComplete = useCallback(async (task: Task) => {
    if (!task.id) return;
    const previousStatus = task.status;
    try {
      const nextStatus = await tasksRepo.toggleTaskStatus(task.id, previousStatus);
      showUndo(
        nextStatus === 'done' ? 'Task completed' : 'Task marked todo',
        async () => {
          if (task.id) await tasksRepo.toggleTaskStatus(task.id, nextStatus);
        }
      );
    } catch (err) {
      console.error('Failed to toggle task status:', err);
      showSnackbar({ message: 'Failed to update task status' });
    }
  }, [showUndo, showSnackbar]);

  const handleToggleComplete = useCallback(async (task: Task) => {
    if (!task.id) return;
    if (task.status === 'todo') {
      const hasIncomplete = await tasksRepo.hasIncompleteSubtasks(task.id);
      if (hasIncomplete) {
        setWarningTask(task);
        return;
      }
    }
    await executeToggleComplete(task);
  }, [executeToggleComplete]);

  const handleDeleteTask = useCallback(async (taskId: number) => {
    const taskToDelete = (todoTasks || []).concat(doneTasks || []).find((t) => t.id === taskId);
    if (!taskToDelete) return;

    try {
      await tasksRepo.deletePermanently(taskId);
      showUndo(`Deleted "${taskToDelete.title}"`, async () => {
        await tasksRepo.createTask(taskToDelete);
      });
    } catch (err) {
      console.error('Failed to delete task:', err);
      showSnackbar({ message: 'Failed to delete task' });
    }
  }, [todoTasks, doneTasks, showUndo, showSnackbar]);

  const handleApplyTemplate = async (template: Template) => {
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
        if (st.trim() && task.id) {
          await tasksRepo.createSubtask(task.id, st.trim());
        }
      }
    }

    showUndo(`Created task from "${template.name}"`, async () => {
      if (task.id) await tasksRepo.deletePermanently(task.id);
    });
  };

  // Touch Swipe Handlers: Swipe right = Complete, Swipe left = Reschedule
  const handleTouchStart = useCallback((e: TouchEvent, taskId?: number) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipedTaskId.current = taskId ?? null;
  }, []);

  const handleTouchEnd = useCallback((e: TouchEvent, task: Task) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(diffX) > 60 && Math.abs(diffY) < 40) {
      if (diffX > 0) {
        // Swipe Right -> Toggle Complete
        handleToggleComplete(task);
      } else if (diffX < 0) {
        // Swipe Left -> Reschedule
        setRescheduleTask(task);
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    swipedTaskId.current = null;
  }, [handleToggleComplete]);

  const openEditor = useCallback((task: Task) => {
    setSelectedTask(task);
    setIsEditorOpen(true);
  }, []);

  // Filter tasks based on view and tag selection
  const rawList = view === 'all' && segment === 'done' ? doneTasks : todoTasks;

  const filteredTasks = useMemo(() => {
    if (!rawList) return [];
    let list = [...rawList];

    const todayStr = localDateStr();

    if (view === 'today') {
      // Due today or overdue
      list = list.filter((t) => {
        if (!t.dueAt) return false;
        const dStr = localDateStr(new Date(t.dueAt));
        return dStr <= todayStr || isOverdue(t.dueAt);
      });
    } else if (view === 'upcoming') {
      // Due tomorrow or later
      list = list.filter((t) => {
        if (!t.dueAt) return false;
        const dStr = localDateStr(new Date(t.dueAt));
        return dStr > todayStr && !isOverdue(t.dueAt);
      });
    }

    if (selectedTagFilter) {
      list = list.filter((t) => t.tags && t.tags.includes(selectedTagFilter));
    }

    return list;
  }, [rawList, view, selectedTagFilter]);

  // Collect all unique tags for filter row
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const t of rawList || []) {
      if (t.tags) {
        for (const tag of t.tags) set.add(tag);
      }
    }
    return Array.from(set).sort();
  }, [rawList]);

interface TaskGroup {
  groupKey: string;
  title: string;
  tasks: Task[];
  badgeColor?: string;
}

  // Group tasks if groupBy is selected
  const groupedTasks = useMemo<TaskGroup[]>(() => {
    if (groupBy === 'none') {
      return [{ groupKey: 'all', title: '', tasks: filteredTasks }];
    }

    if (groupBy === 'priority') {
      const groups: Record<PriorityLevel, Task[]> = { p1: [], p2: [], p3: [], p4: [] };
      for (const t of filteredTasks) {
        const lvl = normalizePriority(t.priority);
        groups[lvl].push(t);
      }
      return [
        { groupKey: 'p1', title: 'P1 — Urgent', tasks: groups.p1, badgeColor: 'bg-rose-500/15 text-rose-600' },
        { groupKey: 'p2', title: 'P2 — High', tasks: groups.p2, badgeColor: 'bg-amber-500/15 text-amber-600' },
        { groupKey: 'p3', title: 'P3 — Medium', tasks: groups.p3, badgeColor: 'bg-blue-500/15 text-blue-600' },
        { groupKey: 'p4', title: 'P4 — None', tasks: groups.p4, badgeColor: 'bg-surface-2 text-ink-muted' },
      ].filter((g) => g.tasks.length > 0);
    }

    if (groupBy === 'tag') {
      const tagMap = new Map<string, Task[]>();
      const untagged: Task[] = [];

      for (const t of filteredTasks) {
        if (!t.tags || t.tags.length === 0) {
          untagged.push(t);
        } else {
          for (const tag of t.tags) {
            if (!tagMap.has(tag)) tagMap.set(tag, []);
            tagMap.get(tag)!.push(t);
          }
        }
      }

      const res: { groupKey: string; title: string; tasks: Task[] }[] = [];
      const sortedKeys = Array.from(tagMap.keys()).sort();
      for (const key of sortedKeys) {
        res.push({ groupKey: key, title: `#${key}`, tasks: tagMap.get(key)! });
      }
      if (untagged.length > 0) {
        res.push({ groupKey: 'untagged', title: 'Untagged', tasks: untagged });
      }
      return res;
    }

    if (groupBy === 'date') {
      const todayStr = localDateStr();
      const tomorrowStr = addDays(todayStr, 1);

      const overdueGroup: Task[] = [];
      const todayGroup: Task[] = [];
      const tomorrowGroup: Task[] = [];
      const upcomingGroup: Task[] = [];
      const noDateGroup: Task[] = [];

      for (const t of filteredTasks) {
        if (!t.dueAt) {
          noDateGroup.push(t);
        } else {
          const dStr = localDateStr(new Date(t.dueAt));
          if (isOverdue(t.dueAt) && dStr < todayStr) {
            overdueGroup.push(t);
          } else if (dStr === todayStr) {
            todayGroup.push(t);
          } else if (dStr === tomorrowStr) {
            tomorrowGroup.push(t);
          } else {
            upcomingGroup.push(t);
          }
        }
      }

      return [
        { groupKey: 'overdue', title: 'Overdue', tasks: overdueGroup, badgeColor: 'bg-danger/15 text-danger' },
        { groupKey: 'today', title: 'Today', tasks: todayGroup, badgeColor: 'bg-accent/15 text-accent' },
        { groupKey: 'tomorrow', title: 'Tomorrow', tasks: tomorrowGroup, badgeColor: 'bg-surface-2 text-ink' },
        { groupKey: 'upcoming', title: 'Later', tasks: upcomingGroup, badgeColor: 'bg-surface-2 text-ink-muted' },
        { groupKey: 'noDate', title: 'No Date', tasks: noDateGroup, badgeColor: 'bg-surface-2 text-ink-muted' },
      ].filter((g) => g.tasks.length > 0);
    }

    return [{ groupKey: 'all', title: '', tasks: filteredTasks }];
  }, [filteredTasks, groupBy]);

  // If view is 'matrix', render the EisenhowerMatrixView directly inline!
  if (view === 'matrix') {
    return (
      <div className="space-y-4">
        {/* View Switcher Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-1.5 p-1 rounded-pill bg-surface-2 border border-border">
            <button
              type="button"
              onClick={() => setView('today')}
              className="px-3.5 py-1.5 rounded-pill text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer min-h-[36px]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setView('upcoming')}
              className="px-3.5 py-1.5 rounded-pill text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer min-h-[36px]"
            >
              Upcoming
            </button>
            <button
              type="button"
              onClick={() => setView('all')}
              className="px-3.5 py-1.5 rounded-pill text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer min-h-[36px]"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setView('matrix')}
              className="px-3.5 py-1.5 rounded-pill text-xs font-semibold bg-surface text-ink shadow-xs cursor-pointer min-h-[36px]"
            >
              Eisenhower
            </button>
          </div>
        </div>

        <EisenhowerMatrixView />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* 1. View Switcher & Task Count */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-muted">Total tasks:</span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-soft text-accent">
            {filteredTasks.length}
          </span>
        </div>

        {/* 4 View Tabs: Today, Upcoming, All, Eisenhower */}
        <div className="flex items-center gap-1.5 p-1 rounded-pill bg-surface-2 border border-border overflow-x-auto self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setView('today')}
            className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
              view === 'today'
                ? 'bg-surface text-ink shadow-xs font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setView('upcoming')}
            className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
              view === 'upcoming'
                ? 'bg-surface text-ink shadow-xs font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setView('all')}
            className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all cursor-pointer min-h-[36px] ${
              view === 'all'
                ? 'bg-surface text-ink shadow-xs font-bold'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setView('matrix')}
            className="px-3.5 py-1.5 rounded-pill text-xs font-semibold text-ink-muted hover:text-ink transition-all cursor-pointer min-h-[36px]"
          >
            Eisenhower
          </button>
        </div>
      </div>

      {/* 2. Quick-Add Bar with NLP & Priority Selector */}
      {view !== 'all' || segment === 'todo' ? (
        <div className="space-y-2">
          {hasSnippetMatches && (
            <SnippetSuggestPill
              snippets={matchingSnippets}
              onSelect={applySnippet}
            />
          )}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={quickInputRef}
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={handleKeyDownQuickAdd}
                placeholder="+ Add task... e.g. Buy milk tomorrow 5pm #shopping p1 (#snippet)"
                className="w-full px-4 py-3 rounded-2xl border border-border bg-surface text-ink placeholder:text-ink-muted text-sm shadow-card focus:outline-none focus:border-accent"
              />
              {quickTitle.trim() && (
                <button
                  type="button"
                  onClick={() => handleQuickAdd()}
                  className="absolute right-2.5 top-2.5 px-3 py-1.5 rounded-pill bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer min-h-[32px]"
                >
                  Save
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
              {/* Priority quick selector */}
              <div className="inline-flex p-0.5 rounded-xl border border-border bg-surface-2">
                {(['p1', 'p2', 'p3', 'p4'] as const).map((p) => {
                  const meta = getPriorityMeta(p);
                  const isSelected = quickPriority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setQuickPriority(p)}
                      title={meta.name}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? meta.badgeBg + ' shadow-2xs font-extrabold'
                          : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      {meta.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Template picker button */}
              <button
                type="button"
                onClick={() => setIsTemplatePickerOpen(true)}
                className="p-2.5 rounded-xl border border-border bg-surface-2 hover:bg-surface text-ink transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="Add task from template"
              >
                <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Real-time NLP preview pill */}
          {parsedPreview?.previewLabel && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-accent-soft/40 border border-accent/20 text-xs text-ink animate-in fade-in duration-100">
              <span className="font-bold text-accent">Auto-detected:</span>
              <span className="font-medium">{parsedPreview.previewLabel}</span>
              <span className="text-ink-muted/70 ml-auto">Title: "{parsedPreview.title || '(empty)'}"</span>
            </div>
          )}
        </div>
      ) : null}

      {/* 3. Controls: Sub-segment (for All view), Grouping, Tag Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* All view Todo / Done switcher */}
        {view === 'all' && (
          <div className="inline-flex p-1 rounded-pill bg-surface-2 border border-border">
            <button
              type="button"
              onClick={() => setSegment('todo')}
              className={`px-3 py-1 rounded-pill text-xs font-semibold cursor-pointer transition-all ${
                segment === 'todo'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Todo ({todoTasks?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setSegment('done')}
              className={`px-3 py-1 rounded-pill text-xs font-semibold cursor-pointer transition-all ${
                segment === 'done'
                  ? 'bg-surface text-ink shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Done ({doneTasks?.length ?? 0})
            </button>
          </div>
        )}

        {/* Group by selector */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-ink-muted text-[11px] font-medium">Group by:</span>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupByType)}
            className="px-2.5 py-1 rounded-lg border border-border bg-surface text-ink text-xs font-semibold cursor-pointer focus:outline-none focus:border-accent"
          >
            <option value="none">None (Flat)</option>
            <option value="tag">Project / Tag</option>
            <option value="priority">Priority</option>
            <option value="date">Due Date</option>
          </select>
        </div>
      </div>

      {/* 4. Filter Tags Strip */}
      {availableTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-ink-muted text-[11px] font-medium shrink-0">Tags:</span>
          {availableTags.map((t) => {
            const isSelected = selectedTagFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTagFilter(isSelected ? null : t)}
                className={`px-2.5 py-1 rounded-pill text-xs font-medium border whitespace-nowrap transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-accent text-accent-ink border-accent font-semibold shadow-2xs'
                    : 'bg-surface-2/60 border-border text-ink-muted hover:text-ink'
                }`}
              >
                #{t}
              </button>
            );
          })}
          {selectedTagFilter && (
            <button
              type="button"
              onClick={() => setSelectedTagFilter(null)}
              className="text-[11px] text-accent hover:underline cursor-pointer ml-1 shrink-0"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* 5. Tasks List by Group */}
      {rawList === undefined ? (
        <div className="py-12 flex justify-center">
          <div className="text-sm text-ink-muted animate-pulse">Loading tasks...</div>
        </div>
      ) : filteredTasks.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-surface shadow-xs">
          <div className="w-12 h-12 rounded-full bg-accent-soft text-accent mx-auto flex items-center justify-center text-xl">
            {view === 'today' ? '☀️' : view === 'upcoming' ? '🗓️' : '✓'}
          </div>
          <div>
            <h3 className="text-base font-bold text-ink">
              {view === 'today'
                ? 'All clear for today!'
                : view === 'upcoming'
                ? 'No upcoming tasks'
                : 'No tasks found'}
            </h3>
            <p className="text-xs text-ink-muted mt-1 max-w-sm mx-auto">
              {view === 'today'
                ? 'Enjoy your day or type in the bar above to schedule something.'
                : 'Add tasks with due dates to see them scheduled here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedTasks.map((group) => (
            <div key={group.groupKey} className="space-y-2">
              {group.title && (
                <div className="flex items-center gap-2 pb-1 border-b border-border/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                    {group.title}
                  </h3>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${group.badgeColor || 'bg-surface-2 text-ink-muted'}`}>
                    {group.tasks.length}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                {group.tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    subtaskProgress={task.id ? allSubtaskProgress.get(task.id) : undefined}
                    isSubtasksOpen={Boolean(task.id && expandedSubtaskParents[task.id])}
                    onToggleComplete={handleToggleComplete}
                    onOpenEditor={openEditor}
                    onToggleSubtasksExpand={toggleSubtasksExpand}
                    onReschedule={setRescheduleTask}
                    onDeleteTask={handleDeleteTask}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warning Modal when completing task with open subtasks */}
      {warningTask && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setWarningTask(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface border border-border p-5 shadow-float space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-warning/15 text-warning flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-ink">Incomplete Subtasks</h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  "{warningTask.title}" has incomplete subtasks. Complete parent task anyway? Subtasks will remain as-is.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWarningTask(null)}
                className="px-3.5 py-1.5 rounded-pill text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer min-h-[36px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = warningTask;
                  setWarningTask(null);
                  executeToggleComplete(t);
                }}
                className="px-4 py-1.5 rounded-pill text-xs font-semibold bg-success text-white shadow-xs cursor-pointer min-h-[36px]"
              >
                Complete Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Reschedule Modal */}
      <QuickRescheduleModal
        task={rescheduleTask}
        isOpen={Boolean(rescheduleTask)}
        onClose={() => setRescheduleTask(null)}
      />

      {/* Task Editor Modal */}
      <TaskEditorModal
        task={selectedTask}
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedTask(null);
        }}
        onDelete={handleDeleteTask}
      />

      {/* Template Picker Sheet */}
      <TemplatePickerSheet
        isOpen={isTemplatePickerOpen}
        kind="task"
        onClose={() => setIsTemplatePickerOpen(false)}
        onSelectTemplate={handleApplyTemplate}
      />
    </div>
  );
});

export default TasksView;
