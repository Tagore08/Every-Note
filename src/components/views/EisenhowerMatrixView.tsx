import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '../../types/task';
import { useTodoTasks, tasksRepo } from '../../db/tasksRepo';
import { useArea } from '../../db/repos/areasRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatDueDate, isOverdue } from '../../utils/format';
import { TaskEditorModal } from '../tasks/TaskEditorModal';

function AreaDot({ areaId }: { areaId?: number | null }) {
  const area = useArea(areaId);
  if (!area) return null;
  return (
    <span
      className="w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: area.color }}
      title={`Area: ${area.name}`}
    />
  );
}

interface QuadrantConfig {
  id: 'do' | 'schedule' | 'delegate' | 'delete';
  title: string;
  subtitle: string;
  importance: boolean;
  urgency: boolean;
  accentBg: string;
  accentBorder: string;
  badgeBg: string;
  badgeText: string;
  badgeLabel: string;
}

const QUADRANTS: QuadrantConfig[] = [
  {
    id: 'do',
    title: 'Do First',
    subtitle: 'Important & Urgent — do these immediately',
    importance: true,
    urgency: true,
    accentBg: 'bg-rose-50/60 dark:bg-rose-950/20',
    accentBorder: 'border-rose-200 dark:border-rose-900/50',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/60',
    badgeText: 'text-rose-700 dark:text-rose-300',
    badgeLabel: 'Urgent + Important',
  },
  {
    id: 'schedule',
    title: 'Schedule',
    subtitle: 'Important, Not Urgent — set a time to do these',
    importance: true,
    urgency: false,
    accentBg: 'bg-blue-50/60 dark:bg-blue-950/20',
    accentBorder: 'border-blue-200 dark:border-blue-900/50',
    badgeBg: 'bg-blue-100 dark:bg-blue-900/60',
    badgeText: 'text-blue-700 dark:text-blue-300',
    badgeLabel: 'Important',
  },
  {
    id: 'delegate',
    title: 'Delegate / Quick',
    subtitle: 'Urgent, Not Important — handle quickly or automate',
    importance: false,
    urgency: true,
    accentBg: 'bg-amber-50/60 dark:bg-amber-950/20',
    accentBorder: 'border-amber-200 dark:border-amber-900/50',
    badgeBg: 'bg-amber-100 dark:bg-amber-900/60',
    badgeText: 'text-amber-700 dark:text-amber-300',
    badgeLabel: 'Urgent',
  },
  {
    id: 'delete',
    title: 'Eliminate',
    subtitle: 'Neither Urgent nor Important — drop or reconsider',
    importance: false,
    urgency: false,
    accentBg: 'bg-slate-50/60 dark:bg-slate-900/40',
    accentBorder: 'border-slate-200 dark:border-slate-800',
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-600 dark:text-slate-400',
    badgeLabel: 'Neither',
  },
];

export function EisenhowerMatrixView() {
  const todoTasks = useTodoTasks() || [];
  const { showUndo, showSnackbar } = useSnackbar();

  // Task editor modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Drag over quadrant highlight
  const [dragOverQuadrant, setDragOverQuadrant] = useState<string | null>(null);

  // Mobile long-press move modal state
  const [movingTask, setMovingTask] = useState<Task | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inline quick-add per quadrant
  const [quickAddQuadrant, setQuickAddQuadrant] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Move task to a target quadrant
  const handleMoveTask = async (taskId: number, importance: boolean, urgency: boolean) => {
    try {
      await tasksRepo.updateTask(taskId, { importance, urgency });
      showSnackbar({ message: 'Task moved to new quadrant' });
    } catch (err) {
      console.error('Failed to move task:', err);
    }
  };

  // Delete task from matrix (trash + undo)
  const handleDeleteTask = async (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!task.id) return;
    const id = task.id;

    try {
      await tasksRepo.deleteTask(id);
      showUndo(`Moved "${task.title}" to trash`, async () => {
        await tasksRepo.updateTask(id, { trashedAt: null });
      });
    } catch (err) {
      console.error('Failed to delete task from matrix:', err);
    }
  };

  // 1-tap task completion
  const handleToggleComplete = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.id) return;
    const id = task.id;

    try {
      await tasksRepo.toggleTaskStatus(id, 'todo');
      showUndo(`Completed "${task.title}"`, async () => {
        await tasksRepo.toggleTaskStatus(id, 'done');
      });
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  // Desktop Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    e.dataTransfer.setData('text/plain', String(taskId));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, quadId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverQuadrant !== quadId) {
      setDragOverQuadrant(quadId);
    }
  };

  const handleDragLeave = () => {
    setDragOverQuadrant(null);
  };

  const handleDrop = (e: React.DragEvent, q: QuadrantConfig) => {
    e.preventDefault();
    setDragOverQuadrant(null);
    const rawId = e.dataTransfer.getData('text/plain');
    const taskId = Number(rawId);
    if (!isNaN(taskId) && taskId > 0) {
      handleMoveTask(taskId, q.importance, q.urgency);
    }
  };

  // Mobile Touch Long-Press handlers
  const handleTouchStart = (task: Task) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      // Vibrate slightly if available
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(40);
      }
      setMovingTask(task);
    }, 450);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Inline quick-add submit
  const handleQuickAddSubmit = async (q: QuadrantConfig, e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) return;

    try {
      await tasksRepo.createTask({
        title: quickAddTitle.trim(),
        importance: q.importance,
        urgency: q.urgency,
      });
      setQuickAddTitle('');
      setQuickAddQuadrant(null);
    } catch (err) {
      console.error('Failed to quick add task to matrix:', err);
    }
  };

  // Filter tasks per quadrant
  const getTasksForQuadrant = (importance: boolean, urgency: boolean): Task[] => {
    return todoTasks.filter(
      (t) => Boolean(t.importance) === importance && Boolean(t.urgency) === urgency
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Eisenhower Matrix
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Prioritize tasks by urgency and importance. Drag to reclassify.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle link back to task list */}
          <Link
            to="/tasks"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span>List View</span>
          </Link>
        </div>
      </div>

      {/* 2x2 Matrix Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {QUADRANTS.map((q) => {
          const tasks = getTasksForQuadrant(q.importance, q.urgency);
          const isOver = dragOverQuadrant === q.id;

          return (
            <div
              key={q.id}
              onDragOver={(e) => handleDragOver(e, q.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, q)}
              className={`rounded-2xl border-2 transition-all p-4 sm:p-5 flex flex-col min-h-[300px] ${
                isOver
                  ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 scale-[1.01] shadow-lg ring-2 ring-blue-400'
                  : `${q.accentBorder} ${q.accentBg}`
              }`}
            >
              {/* Quadrant Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {q.title}
                    </h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${q.badgeBg} ${q.badgeText}`}>
                      {tasks.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {q.subtitle}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setQuickAddQuadrant(quickAddQuadrant === q.id ? null : q.id);
                    setQuickAddTitle('');
                  }}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Add task to this quadrant"
                  aria-label="Add task"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>

              {/* Inline Quick Add Input */}
              {quickAddQuadrant === q.id && (
                <form
                  onSubmit={(e) => handleQuickAddSubmit(q, e)}
                  className="mb-3 flex items-center gap-2"
                >
                  <input
                    type="text"
                    autoFocus
                    value={quickAddTitle}
                    onChange={(e) => setQuickAddTitle(e.target.value)}
                    placeholder={`New task in "${q.title}"...`}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!quickAddTitle.trim()}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white disabled:opacity-40 cursor-pointer"
                  >
                    Add
                  </button>
                </form>
              )}

              {/* Task Items List */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                {tasks.length === 0 ? (
                  <div className="h-full flex items-center justify-center py-8 text-center">
                    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                      Drop tasks here or tap + to add
                    </span>
                  </div>
                ) : (
                  tasks.map((task) => {
                    const overdue = isOverdue(task.dueAt);

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => task.id && handleDragStart(e, task.id)}
                        onTouchStart={() => handleTouchStart(task)}
                        onTouchMove={handleTouchEnd}
                        onTouchEnd={handleTouchEnd}
                        onClick={() => {
                          setSelectedTask(task);
                          setIsEditorOpen(true);
                        }}
                        className="group relative p-3 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition-all cursor-grab active:cursor-grabbing space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Tap-to-complete circular checkbox */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleComplete(task, e)}
                              className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 hover:border-blue-500 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                              title="Complete task"
                              aria-label="Complete task"
                            >
                              <span className="w-2 h-2 rounded-full opacity-0 hover:opacity-100 bg-blue-500 transition-opacity" />
                            </button>

                            <AreaDot areaId={task.lifeAreaId} />

                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {task.title}
                            </span>
                          </div>

                          {/* Quick Card Actions */}
                          <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {/* Mobile move button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMovingTask(task);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                              title="Move to another quadrant"
                              aria-label="Move quadrant"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="19" cy="12" r="1" />
                                <circle cx="5" cy="12" r="1" />
                              </svg>
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteTask(task, e)}
                              className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                              title="Move to trash"
                              aria-label="Move to trash"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Metadata row: Due date & tags */}
                        {(task.dueAt || (task.tags && task.tags.length > 0)) && (
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px] pl-6.5">
                            {task.dueAt && (
                              <span
                                className={`px-1.5 py-0.5 rounded-md font-medium ${
                                  overdue
                                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                }`}
                              >
                                {formatDueDate(task.dueAt)}
                              </span>
                            )}
                            {task.tags?.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Editor Modal */}
      <TaskEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onDelete={async () => {
          if (selectedTask) {
            await handleDeleteTask(selectedTask);
          }
          setIsEditorOpen(false);
          setSelectedTask(null);
        }}
      />

      {/* Mobile "Move to..." Quadrant Modal */}
      {movingTask && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setMovingTask(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Move Task
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                "{movingTask.title}"
              </p>
            </div>

            <div className="space-y-2">
              {QUADRANTS.map((quad) => {
                const isCurrent =
                  Boolean(movingTask.importance) === quad.importance &&
                  Boolean(movingTask.urgency) === quad.urgency;

                return (
                  <button
                    key={quad.id}
                    type="button"
                    onClick={() => {
                      if (movingTask.id) {
                        handleMoveTask(movingTask.id, quad.importance, quad.urgency);
                      }
                      setMovingTask(null);
                    }}
                    className={`w-full text-left p-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                      isCurrent
                        ? `${quad.accentBorder} ${quad.accentBg} ${quad.badgeText} ring-2 ring-blue-400`
                        : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{quad.title}</div>
                      <div className="text-[10px] font-normal text-slate-400 dark:text-slate-500">
                        {quad.subtitle}
                      </div>
                    </div>
                    {isCurrent && <span className="text-sm">✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setMovingTask(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
