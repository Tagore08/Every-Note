import { useState, useRef, type KeyboardEvent, type TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '../../types/task';
import type { Template } from '../../types/template';
import { useTodoTasks, useDoneTasks, tasksRepo, useSubtaskProgress } from '../../db/tasksRepo';
import { parseQuickAdd } from '../../lib/quickAdd';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatDueDate, isOverdue, formatRelativeTime } from '../../utils/format';
import { TaskEditorModal } from '../tasks/TaskEditorModal';
import { TemplatePickerSheet } from '../../features/templates/TemplatePickerSheet';

function SubtaskProgressChip({ parentTaskId }: { parentTaskId?: number }) {
  const progress = useSubtaskProgress(parentTaskId);
  if (progress.total === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-2 text-ink-muted border border-border shrink-0"
      title={`${progress.completed} of ${progress.total} subtasks completed`}
    >
      <span>{progress.completed}/{progress.total}</span>
    </span>
  );
}

export function TasksView() {
  const [segment, setSegment] = useState<'todo' | 'done'>('todo');
  const [quickTitle, setQuickTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);
  const [warningTask, setWarningTask] = useState<Task | null>(null);

  const todoTasks = useTodoTasks();
  const doneTasks = useDoneTasks();
  const { showUndo } = useSnackbar();

  // Swipe detection for mobile
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipedTaskId = useRef<number | null>(null);

  // NLP preview calculation
  const parsedPreview = quickTitle.trim() ? parseQuickAdd(quickTitle) : null;

  const handleQuickAdd = async (e?: KeyboardEvent<HTMLInputElement>) => {
    if (e && e.key !== 'Enter') return;
    if (e) e.preventDefault();
    const clean = quickTitle.trim();
    if (!clean) return;

    const parsed = parseQuickAdd(clean);
    try {
      await tasksRepo.createTask({
        title: parsed.title || clean,
        dueAt: parsed.dueAt,
        tags: parsed.tags,
      });
      setQuickTitle('');
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleToggleComplete = async (task: Task) => {
    if (!task.id) return;
    if (task.status === 'todo') {
      const hasIncomplete = await tasksRepo.hasIncompleteSubtasks(task.id);
      if (hasIncomplete) {
        setWarningTask(task);
        return;
      }
    }
    await executeToggleComplete(task);
  };

  const executeToggleComplete = async (task: Task) => {
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
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    const taskToDelete = (todoTasks || []).concat(doneTasks || []).find((t) => t.id === taskId);
    if (!taskToDelete) return;

    try {
      await tasksRepo.deletePermanently(taskId);
      showUndo(`Deleted "${taskToDelete.title}"`, async () => {
        await tasksRepo.createTask(taskToDelete);
      });
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

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
      if (task.id) await tasksRepo.deleteTask(task.id);
    });
  };

  // Touch Swipe to Complete handlers
  const handleTouchStart = (e: TouchEvent, taskId?: number) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipedTaskId.current = taskId ?? null;
  };

  const handleTouchEnd = (e: TouchEvent, task: Task) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(diffX) > 60 && Math.abs(diffY) < 40) {
      if (diffX > 0 && task.status === 'todo') {
        handleToggleComplete(task);
      } else if (diffX < 0 && task.status === 'done') {
        handleToggleComplete(task);
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    swipedTaskId.current = null;
  };

  const openEditor = (task: Task) => {
    setSelectedTask(task);
    setIsEditorOpen(true);
  };

  const activeList = segment === 'todo' ? todoTasks : doneTasks;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header & Segmented Control */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            Tasks
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-2 text-ink border border-border">
            {todoTasks?.length ?? 0}
          </span>
        </div>

        {/* Segment Tabs & Matrix View Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex p-1 rounded-pill bg-surface-2 border border-border">
            <button
              type="button"
              onClick={() => setSegment('todo')}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
                segment === 'todo'
                  ? 'bg-surface text-ink shadow-card font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Todo ({todoTasks?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setSegment('done')}
              className={`px-3.5 py-1.5 rounded-pill text-xs font-semibold transition-all cursor-pointer min-h-[44px] ${
                segment === 'done'
                  ? 'bg-surface text-ink shadow-card font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Done ({doneTasks?.length ?? 0})
            </button>
          </div>

          <Link
            to="/matrix"
            className="p-2.5 rounded-pill text-ink-muted hover:text-ink bg-surface-2 hover:bg-surface border border-border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
            title="Eisenhower Matrix view"
            aria-label="Eisenhower Matrix view"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Quick-Add Bar with NLP and Template affordance */}
      {segment === 'todo' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={handleQuickAdd}
                placeholder="+ Add a task... e.g. Tomorrow 5pm #health @Work"
                className="w-full px-4 py-3 rounded-card border border-border bg-surface text-ink placeholder-ink-muted text-sm shadow-card focus:outline-none focus:border-accent"
              />
              {quickTitle.trim() && (
                <button
                  type="button"
                  onClick={() => handleQuickAdd()}
                  className="absolute right-2.5 top-2.5 px-3 py-1 rounded-pill bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                >
                  Save
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsTemplatePickerOpen(true)}
              className="px-3.5 py-3 rounded-card border border-border bg-surface-2 hover:bg-surface text-ink text-xs font-medium transition-colors shadow-card flex items-center gap-1.5 shrink-0 cursor-pointer min-h-[44px]"
              title="Add task from template"
            >
              <svg className="w-4 h-4 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
              <span className="hidden sm:inline">From template</span>
            </button>
          </div>

          {/* Real-time NLP preview chip */}
          {parsedPreview?.previewLabel && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs text-ink-muted animate-in fade-in duration-100">
              <span className="font-semibold text-accent">Detected:</span>
              <span>{parsedPreview.previewLabel}</span>
              <span className="text-ink-muted/60 ml-auto">Title: "{parsedPreview.title || '(none)'}"</span>
            </div>
          )}
        </div>
      )}

      {/* Tasks List */}
      {activeList === undefined ? (
        <div className="py-12 flex justify-center">
          <div className="text-sm text-ink-muted animate-pulse">Loading tasks...</div>
        </div>
      ) : activeList.length === 0 ? (
        /* Empty State */
        <div className="rounded-card border border-dashed border-border p-12 text-center space-y-3 bg-surface shadow-xs">
          <div className="w-12 h-12 rounded-full bg-accent-soft text-accent mx-auto flex items-center justify-center">
            {segment === 'todo' ? (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink">
              {segment === 'todo' ? 'All caught up!' : 'No completed tasks'}
            </h3>
            <p className="text-sm text-ink-muted mt-1 max-w-sm mx-auto">
              {segment === 'todo'
                ? 'You have zero pending tasks. Type in the bar above to add one.'
                : 'Tasks you complete will appear here.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {activeList.map((task) => {
            const overdue = segment === 'todo' && task.dueAt && isOverdue(task.dueAt);

            return (
              <div
                key={task.id}
                onTouchStart={(e) => handleTouchStart(e, task.id)}
                onTouchEnd={(e) => handleTouchEnd(e, task)}
                className={`group rounded-card border bg-surface p-3.5 shadow-card transition-all hover:border-accent/40 flex items-start gap-3 select-none ${
                  overdue
                    ? 'border-danger/40 bg-danger/5'
                    : 'border-border'
                }`}
              >
                {/* Circular checkbox: tap to complete */}
                <button
                  type="button"
                  onClick={() => handleToggleComplete(task)}
                  className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    task.status === 'done'
                      ? 'bg-success border-success text-accent-ink'
                      : overdue
                      ? 'border-danger hover:border-danger'
                      : 'border-border hover:border-accent'
                  }`}
                  aria-label={task.status === 'done' ? 'Mark task todo' : 'Mark task done'}
                >
                  {task.status === 'done' && (
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>

                {/* Task card body: tap to open editor */}
                <div
                  onClick={() => openEditor(task)}
                  className="flex-1 min-w-0 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={`text-sm font-medium leading-snug break-words ${
                          task.status === 'done'
                            ? 'line-through text-ink-muted'
                            : overdue
                            ? 'text-danger font-semibold'
                            : 'text-ink'
                        }`}
                      >
                        {task.title}
                      </p>

                      {/* Subtasks Progress Chip (e.g. 2/5) */}
                      {task.id && <SubtaskProgressChip parentTaskId={task.id} />}
                    </div>

                    {/* Due Date & Overdue Badge */}
                    {task.dueAt && (
                      <span
                        className={`text-xs shrink-0 font-medium ${
                          overdue
                            ? 'text-danger font-bold'
                            : 'text-ink-muted'
                        }`}
                      >
                        {overdue ? 'Overdue · ' : ''}
                        {formatDueDate(task.dueAt)}
                      </span>
                    )}
                  </div>

                  {/* Optional Metadata Row: tags, priority, source note */}
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-ink-muted">
                    {/* Priority Badge */}
                    {task.priority && task.priority !== 'none' && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          task.priority === 'high'
                            ? 'bg-danger/10 text-danger'
                            : task.priority === 'medium'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-accent/10 text-accent'
                        }`}
                      >
                        {task.priority}
                      </span>
                    )}

                    {/* Tag Pills */}
                    {task.tags &&
                      task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-[10px] bg-surface-2 text-ink-muted border border-border"
                        >
                          #{tag}
                        </span>
                      ))}

                    {/* Linked Note Chip */}
                    {typeof task.sourceNoteId === 'number' && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-accent">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>Note #{task.sourceNoteId}</span>
                      </span>
                    )}

                    {/* Done timestamp */}
                    {task.status === 'done' && task.completedAt && (
                      <span className="text-[10px] text-ink-muted">
                        · Completed {formatRelativeTime(task.completedAt)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
                <h3 className="text-sm font-bold text-ink">
                  Incomplete Subtasks
                </h3>
                <p className="text-xs text-ink-muted leading-relaxed">
                  "{warningTask.title}" has incomplete subtasks. Complete parent task anyway? Subtasks will remain as-is.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWarningTask(null)}
                className="px-3.5 py-1.5 rounded-pill text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer min-h-[44px]"
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
                className="px-4 py-1.5 rounded-pill text-xs font-semibold bg-success text-accent-ink shadow-card cursor-pointer min-h-[44px]"
              >
                Complete Anyway
              </button>
            </div>
          </div>
        </div>
      )}

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
}
export default TasksView;
