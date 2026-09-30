import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../../../types/task';
import { isOverdue, formatRelativeTime } from '../../../utils/format';
import { tasksRepo } from '../../../db/tasksRepo';
import { useSnackbar } from '../../../context/SnackbarContext';
import { Check, Clock, ChevronRight, Tag } from 'lucide-react';

interface DueTasksSectionProps {
  tasks: Task[];
  onEditTask?: (task: Task) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DueTasksSection({
  tasks,
  onEditTask,
  isCollapsed,
  onToggleCollapse,
}: DueTasksSectionProps) {
  const navigate = useNavigate();
  const { showUndo } = useSnackbar();

  // Filter tasks that are todo and either due today or overdue
  const sortedTasks = useMemo(() => {
    const list = [...tasks];
    list.sort((a, b) => {
      const aOverdue = isOverdue(a.dueAt) ? 1 : 0;
      const bOverdue = isOverdue(b.dueAt) ? 1 : 0;
      if (bOverdue !== aOverdue) return bOverdue - aOverdue; // Overdue first!
      const aTime = a.dueAt ? new Date(a.dueAt).getTime() : 0;
      const bTime = b.dueAt ? new Date(b.dueAt).getTime() : 0;
      return aTime - bTime;
    });
    return list;
  }, [tasks]);

  const handleToggleTask = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.id) return;
    try {
      await tasksRepo.toggleTaskStatus(task.id, 'done');
      showUndo('Completed task', async () => {
        if (task.id) await tasksRepo.toggleTaskStatus(task.id, 'todo');
      });
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  return (
    <div
      data-testid="due-tasks-section"
      className="space-y-3"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between px-1">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2.5 text-left cursor-pointer group"
        >
          <div className="w-7 h-7 rounded-xl bg-accent-soft text-accent flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-ink tracking-tight">
              Due & Scheduled
            </h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 border border-border text-ink-muted">
              {sortedTasks.length}
            </span>
          </div>
          {onToggleCollapse && (
            <svg
              className={`w-3.5 h-3.5 text-ink-muted transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('/tasks')}
          className="text-xs font-semibold text-accent hover:opacity-80 cursor-pointer flex items-center gap-0.5"
        >
          <span>All Tasks</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {!isCollapsed && (sortedTasks.length === 0 ? (
        <div className="p-8 rounded-card border border-border bg-surface text-center space-y-2 shadow-xs">
          <span className="text-2xl">🎉</span>
          <p className="text-xs text-ink-muted font-medium">All clear! No pending tasks due today or overdue.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {sortedTasks.map((task) => {
            const overdue = isOverdue(task.dueAt);
            const isHighPriority = task.priority === 'high' || task.priority === 'p1' || Boolean(task.urgency);
            const needsAttention = overdue || isHighPriority;

            return (
              <div
                key={`due-task-${task.id}`}
                role="button"
                tabIndex={0}
                onClick={() => onEditTask?.(task)}
                className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 rounded-card border transition-all cursor-pointer shadow-card hover:shadow-float ${
                  needsAttention
                    ? 'border-rose-500/30 bg-rose-50/20 dark:bg-rose-950/10 hover:border-rose-500/50'
                    : 'border-border bg-surface hover:border-accent/40'
                }`}
              >
                {/* Left accent strip for GoodNotes notebook feel */}
                <div
                  className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${
                    overdue
                      ? 'bg-rose-500'
                      : isHighPriority
                      ? 'bg-amber-500'
                      : 'bg-accent/40'
                  }`}
                />

                {/* Main Card Content */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1 pl-2">
                  {/* Large Tactile Interactive Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleTask(task, e)}
                    className="w-6 h-6 rounded-xl border-2 border-border hover:border-accent flex items-center justify-center shrink-0 cursor-pointer bg-surface hover:bg-accent/15 transition-all mt-0.5 shadow-xs group-hover:scale-105 active:scale-95"
                    aria-label="Mark task done"
                  >
                    <Check className="w-3.5 h-3.5 text-accent opacity-0 hover:opacity-100 transition-opacity stroke-[3]" />
                  </button>

                  <div className="space-y-1.5 min-w-0 flex-1">
                    {/* Attention Badge & Priority */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {overdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                          <span>Overdue</span>
                        </span>
                      )}
                      {task.priority && task.priority !== 'none' && (
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            task.priority === 'p1' || task.priority === 'high'
                              ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                              : task.priority === 'p2' || task.priority === 'medium'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-surface-2 text-ink-muted'
                          }`}
                        >
                          {task.priority}
                        </span>
                      )}
                      {task.dueAt && (
                        <span className="text-[11px] text-ink-muted font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3 text-ink-faint" />
                          <span>{formatRelativeTime(new Date(task.dueAt))}</span>
                        </span>
                      )}
                    </div>

                    {/* Prominent Task Title */}
                    <h4 className="text-sm sm:text-base font-semibold text-ink group-hover:text-accent transition-colors leading-snug">
                      {task.title}
                    </h4>

                    {/* Dynamic Content Excerpt */}
                    {task.description && (
                      <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    {/* Tags Pills */}
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                        {task.tags.map((t) => (
                          <span
                            key={t}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-[10px] font-medium bg-surface-2 border border-border text-ink-muted"
                          >
                            <Tag className="w-2.5 h-2.5 opacity-60" />
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="hidden sm:flex items-center pr-2 pl-3 text-ink-faint group-hover:text-ink transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
