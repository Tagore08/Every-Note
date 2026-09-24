import { useState, useRef, type KeyboardEvent, type TouchEvent } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '../../types/task';
import { useTodoTasks, useDoneTasks, tasksRepo } from '../../db/tasksRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatDueDate, isOverdue, formatRelativeTime } from '../../utils/format';
import { TaskEditorModal } from '../tasks/TaskEditorModal';

export function TasksView() {
  const [segment, setSegment] = useState<'todo' | 'done'>('todo');
  const [quickTitle, setQuickTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const todoTasks = useTodoTasks();
  const doneTasks = useDoneTasks();
  const { showUndo } = useSnackbar();

  // Swipe detection for mobile
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipedTaskId = useRef<number | null>(null);

  const handleQuickAdd = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const clean = quickTitle.trim();
      if (!clean) return;

      try {
        await tasksRepo.createTask({ title: clean });
        setQuickTitle('');
      } catch (err) {
        console.error('Failed to create task:', err);
      }
    }
  };

  const handleToggleComplete = async (task: Task) => {
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

    // Detect horizontal swipe (at least 60px horizontal, less than 40px vertical)
    if (Math.abs(diffX) > 60 && Math.abs(diffY) < 40) {
      if (diffX > 0 && task.status === 'todo') {
        // Swipe right -> complete
        handleToggleComplete(task);
      } else if (diffX < 0 && task.status === 'done') {
        // Swipe left -> revert to todo
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Tasks
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
            {todoTasks?.length ?? 0}
          </span>
        </div>

        {/* Segment Tabs & Matrix View Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setSegment('todo')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                segment === 'todo'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Todo ({todoTasks?.length ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setSegment('done')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                segment === 'done'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Done ({doneTasks?.length ?? 0})
            </button>
          </div>

          <Link
            to="/matrix"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
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

      {/* Quick-Add Bar (title only, Enter to save) */}
      {segment === 'todo' && (
        <div className="relative">
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={handleQuickAdd}
            placeholder="+ Add a task... (press Enter to save)"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          {quickTitle.trim() && (
            <kbd className="absolute right-3 top-3 text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
              ↵ Enter
            </kbd>
          )}
        </div>
      )}

      {/* Tasks List */}
      {activeList === undefined ? (
        <div className="py-12 flex justify-center">
          <div className="text-sm text-slate-400 animate-pulse">Loading tasks...</div>
        </div>
      ) : activeList.length === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3 bg-white/50 dark:bg-slate-900/30">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
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
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {segment === 'todo' ? 'All caught up!' : 'No completed tasks'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
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
                className={`group rounded-xl border bg-white dark:bg-slate-900 p-3.5 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700 flex items-start gap-3 select-none ${
                  overdue
                    ? 'border-red-200/90 dark:border-red-900/60 bg-red-50/10 dark:bg-red-950/10'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Circular checkbox: tap to complete */}
                <button
                  type="button"
                  onClick={() => handleToggleComplete(task)}
                  className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                    task.status === 'done'
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : overdue
                      ? 'border-red-400 hover:border-red-600 dark:border-red-600 dark:hover:border-red-400'
                      : 'border-slate-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400'
                  }`}
                  aria-label={task.status === 'done' ? 'Mark task todo' : 'Mark task done'}
                >
                  {task.status === 'done' && (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
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
                    <p
                      className={`text-sm font-medium leading-snug break-words ${
                        task.status === 'done'
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : overdue
                          ? 'text-red-700 dark:text-red-300 font-semibold'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {task.title}
                    </p>

                    {/* Due Date & Overdue Badge (Feature 4) */}
                    {task.dueAt && (
                      <span
                        className={`text-xs shrink-0 font-medium ${
                          overdue
                            ? 'text-red-600 dark:text-red-400 font-bold'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {overdue ? 'Overdue · ' : ''}
                        {formatDueDate(task.dueAt)}
                      </span>
                    )}
                  </div>

                  {/* Optional Metadata Row: tags, priority, source note */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                    {/* Priority Badge */}
                    {task.priority && task.priority !== 'none' && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          task.priority === 'high'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                            : task.priority === 'medium'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
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
                          className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        >
                          #{tag}
                        </span>
                      ))}

                    {/* Linked Note Chip */}
                    {typeof task.sourceNoteId === 'number' && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span>Note #{task.sourceNoteId}</span>
                      </span>
                    )}

                    {/* Done timestamp */}
                    {task.status === 'done' && task.completedAt && (
                      <span className="text-[10px] text-slate-400">
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
    </div>
  );
}
