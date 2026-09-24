import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUpcomingData, type UpcomingItem } from '../../db/upcomingRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { useHabitsTodaySummary } from '../../db/habitsRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { EventEditorModal } from '../calendar/EventEditorModal';
import { TaskEditorModal } from '../tasks/TaskEditorModal';
import type { EventOccurrence } from '../../types/event';
import type { Task } from '../../types/task';

export function UpcomingView() {
  const navigate = useNavigate();
  const { showUndo } = useSnackbar();
  const data = useUpcomingData();
  const habitsSummary = useHabitsTodaySummary();

  // Modals for editing items tapped from the view
  const [selectedOccurrence, setSelectedOccurrence] = useState<EventOccurrence | null>(null);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Time of day greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const todayFormatted = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const handleRowClick = (item: UpcomingItem) => {
    if (item.type === 'event' && item.eventOccurrence) {
      setSelectedOccurrence(item.eventOccurrence);
      setIsEventModalOpen(true);
    } else if (item.type === 'task' && item.task) {
      setSelectedTask(item.task);
      setIsTaskModalOpen(true);
    } else if (item.type === 'note' && item.note?.id) {
      navigate(`/notes/${item.note.id}`);
    }
  };

  const handleCompleteTask = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.id) return;

    try {
      await tasksRepo.toggleTaskStatus(task.id, 'done');
      showUndo('Completed task', async () => {
        if (task.id) await tasksRepo.toggleTaskStatus(task.id, 'todo');
      });
    } catch (err) {
      console.error('Failed to complete task from today view:', err);
    }
  };

  const handleDeleteTaskFromModal = async (id: number) => {
    try {
      await tasksRepo.deleteTask(id);
      setIsTaskModalOpen(false);
      setSelectedTask(null);
      showUndo('Task moved to trash', async () => {
        await tasksRepo.updateTask(id, { trashedAt: null });
      });
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto py-12 flex justify-center">
        <div className="text-sm text-ink-muted animate-pulse">Loading today's horizon...</div>
      </div>
    );
  }

  const { today, tomorrow, next7Days, later, counts } = data;
  const totalUpcoming = today.length + tomorrow.length + next7Days.length + later.length;

  // Build counts summary string
  const summaryParts: string[] = [];
  if (counts.todayEvents > 0) {
    summaryParts.push(`${counts.todayEvents} ${counts.todayEvents === 1 ? 'event' : 'events'}`);
  }
  if (counts.todayTasks > 0) {
    summaryParts.push(`${counts.todayTasks} due`);
  }
  if (counts.overdueTasks > 0) {
    summaryParts.push(`${counts.overdueTasks} overdue`);
  }
  if (habitsSummary.total > 0) {
    summaryParts.push(`${habitsSummary.completed}/${habitsSummary.total} habits`);
  }
  const summaryStr =
    summaryParts.length > 0 ? summaryParts.join(' · ') : 'All clear for today';

  const renderItemRow = (item: UpcomingItem, showDateBadge = false) => {
    return (
      <div
        key={item.id}
        onClick={() => handleRowClick(item)}
        className={`group flex items-center justify-between p-3.5 sm:p-4 rounded-card border transition-all cursor-pointer min-h-[48px] ${
          item.isOverdue
            ? 'border-danger/40 bg-surface hover:border-danger'
            : 'border-border bg-surface hover:border-accent/40 shadow-card'
        }`}
      >
        {/* Left: Checkbox (for task) or Type Icon + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
          {item.type === 'task' && item.task ? (
            <button
              type="button"
              onClick={(e) => handleCompleteTask(item.task!, e)}
              className="w-5 h-5 rounded-full border border-border hover:border-accent hover:bg-accent-soft shrink-0 transition-colors cursor-pointer min-w-[20px] min-h-[20px] flex items-center justify-center"
              title="Mark task done"
              aria-label="Mark task done"
            />
          ) : item.type === 'event' ? (
            <div className="w-6 h-6 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
              </svg>
            </div>
          ) : (
            <div className="w-6 h-6 rounded-lg bg-surface-2 text-ink-muted flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <span
              className={`text-sm font-medium block truncate ${
                item.isOverdue
                  ? 'text-danger font-semibold'
                  : 'text-ink group-hover:text-accent transition-colors'
              }`}
            >
              {item.title}
            </span>
          </div>
        </div>

        {/* Right: Type Badge, Time & Date Labels */}
        <div className="flex items-center gap-2 shrink-0">
          {showDateBadge && item.dateLabel && (
            <span className="text-[11px] font-medium text-ink-muted hidden sm:inline">
              {item.dateLabel}
            </span>
          )}

          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
              item.isOverdue
                ? 'bg-danger/10 text-danger font-bold'
                : 'text-ink-muted bg-surface-2'
            }`}
          >
            {item.timeLabel}
          </span>

          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-2 text-ink-muted border border-border hidden md:inline-flex">
            {item.type === 'event' ? 'Event' : item.type === 'task' ? 'Task' : 'Note'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header Greeting & Counts */}
      <div className="pb-4 border-b border-border">
        <span className="text-xs uppercase tracking-wider font-semibold text-ink-muted block">
          {todayFormatted}
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink mt-0.5">
          {greeting}
        </h1>
        <p className="text-xs sm:text-sm font-medium text-ink-muted mt-1">
          {summaryStr}
        </p>
      </div>

      {totalUpcoming === 0 && habitsSummary.total === 0 ? (
        /* Empty State */
        <div className="py-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface-2 mx-auto flex items-center justify-center text-ink-muted">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h3 className="font-semibold text-base text-ink">
            All clear
          </h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            You have no upcoming events, due tasks, or scheduled notes. Tap "+" or press N to capture anything.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1. Today Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-2">
                <span>Today</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-soft text-accent">
                  {today.length + (habitsSummary.total > 0 ? 1 : 0)}
                </span>
              </h2>
            </div>

            {/* Today → Habits row */}
            {habitsSummary.total > 0 && (
              <div
                onClick={() => navigate('/habits')}
                className="flex items-center justify-between p-3.5 sm:p-4 rounded-card border border-border bg-surface hover:border-accent/40 shadow-card transition-all cursor-pointer group min-h-[48px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-bold text-base">
                    🎯
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-accent">
                      Habits Today
                    </div>
                    <div className="text-sm font-semibold text-ink">
                      {habitsSummary.completed} of {habitsSummary.total} completed
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-2 text-ink border border-border">
                    {Math.round((habitsSummary.completed / habitsSummary.total) * 100)}%
                  </span>
                  <span className="text-ink-muted group-hover:text-accent transition-colors" aria-hidden="true">
                    →
                  </span>
                </div>
              </div>
            )}

            {today.length === 0 && habitsSummary.total === 0 ? (
              <div className="p-4 rounded-card border border-border text-xs text-ink-muted bg-surface/50 text-center">
                No scheduled events or tasks for today.
              </div>
            ) : (
              <div className="space-y-2">
                {today.map((item) => renderItemRow(item, false))}
              </div>
            )}
          </section>

          {/* 2. Tomorrow Section */}
          {tomorrow.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-2">
                <span>Tomorrow</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-2 text-ink border border-border">
                  {tomorrow.length}
                </span>
              </h2>
              <div className="space-y-2">
                {tomorrow.map((item) => renderItemRow(item, false))}
              </div>
            </section>
          )}

          {/* 3. Next 7 Days Section */}
          {next7Days.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-2">
                <span>Next 7 Days</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-2 text-ink border border-border">
                  {next7Days.length}
                </span>
              </h2>
              <div className="space-y-2">
                {next7Days.map((item) => renderItemRow(item, true))}
              </div>
            </section>
          )}

          {/* 4. Later Section */}
          {later.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-muted flex items-center gap-2">
                <span>Later</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-2 text-ink border border-border">
                  {later.length}
                </span>
              </h2>
              <div className="space-y-2">
                {later.map((item) => renderItemRow(item, true))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Item Modals */}
      {isEventModalOpen && selectedOccurrence && (
        <EventEditorModal
          isOpen={isEventModalOpen}
          occurrence={selectedOccurrence}
          onClose={() => {
            setIsEventModalOpen(false);
            setSelectedOccurrence(null);
          }}
        />
      )}

      {isTaskModalOpen && selectedTask && (
        <TaskEditorModal
          isOpen={isTaskModalOpen}
          task={selectedTask}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          onDelete={handleDeleteTaskFromModal}
        />
      )}
    </div>
  );
}

// Alias for v2 router
export const TodayView = UpcomingView;
