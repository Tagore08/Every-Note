import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../../../types/task';
import { isOverdue } from '../../../utils/format';
import { tasksRepo } from '../../../db/tasksRepo';
import { useSnackbar } from '../../../context/SnackbarContext';

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
      className="bg-surface border border-border rounded-card p-4 sm:p-5 shadow-card space-y-3"
    >
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-left cursor-pointer group"
        >
          <span className="text-base">⏰</span>
          <h3 className="text-sm font-bold text-ink uppercase tracking-wider group-hover:text-accent transition-colors">
            Due & Overdue
          </h3>
          <span className="text-xs text-ink-muted">({sortedTasks.length})</span>
          {onToggleCollapse && (
            <svg
              className={`w-4 h-4 text-ink-muted transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => navigate('/tasks')}
          className="text-xs font-semibold text-accent hover:underline cursor-pointer min-h-[36px] flex items-center"
        >
          View All Tasks →
        </button>
      </div>

      {!isCollapsed && (sortedTasks.length === 0 ? (
        <div className="py-3 text-center text-xs text-ink-muted italic">
          All clear! No tasks due today or overdue.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedTasks.map((task) => {
            const overdue = isOverdue(task.dueAt);

            return (
              <div
                key={`due-task-${task.id}`}
                role="button"
                tabIndex={0}
                onClick={() => onEditTask?.(task)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                  overdue
                    ? 'border-danger/40 bg-danger/5 hover:border-danger/60'
                    : 'border-border bg-surface-2/60 hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => handleToggleTask(task, e)}
                    className="w-5 h-5 rounded-lg border border-ink-muted/60 hover:border-accent flex items-center justify-center shrink-0 cursor-pointer"
                    aria-label="Complete task"
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-medium text-ink truncate">
                        {task.title}
                      </span>
                      {overdue && (
                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-danger/15 text-danger uppercase tracking-wider">
                          Overdue
                        </span>
                      )}
                      {task.priority && task.priority !== 'none' && (
                        <span className="text-[10px] text-ink-muted uppercase">
                          · {task.priority}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
