import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUpcomingData, type UpcomingItem } from '../../db/upcomingRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { EventEditorModal } from '../calendar/EventEditorModal';
import { TaskEditorModal } from '../tasks/TaskEditorModal';
import type { EventOccurrence } from '../../types/event';
import type { Task } from '../../types/task';

export function UpcomingView() {
  const navigate = useNavigate();
  const { showUndo } = useSnackbar();
  const data = useUpcomingData();

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
      console.error('Failed to complete task from upcoming view:', err);
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
        <div className="text-sm text-slate-400 animate-pulse">Loading upcoming items...</div>
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
  const summaryStr =
    summaryParts.length > 0 ? summaryParts.join(' · ') : 'All clear for today';

  const renderItemRow = (item: UpcomingItem, showDateBadge = false) => {
    return (
      <div
        key={item.id}
        onClick={() => handleRowClick(item)}
        className={`group flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
          item.isOverdue
            ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 hover:border-rose-300 dark:hover:border-rose-800'
            : item.type === 'event'
              ? 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-300 dark:hover:border-blue-800/60 shadow-xs'
              : item.type === 'task'
                ? 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-800/60 shadow-xs'
                : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300 dark:hover:border-purple-800/60 shadow-xs'
        }`}
      >
        {/* Left: Checkbox (for task) or Type Icon + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
          {item.type === 'task' && item.task ? (
            <button
              type="button"
              onClick={(e) => handleCompleteTask(item.task!, e)}
              className="w-4 h-4 rounded-full border border-slate-400 dark:border-slate-500 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0 transition-colors cursor-pointer"
              title="Mark task done"
              aria-label="Mark task done"
            />
          ) : item.type === 'event' ? (
            <div className="w-5 h-5 rounded-md bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5 rounded-md bg-purple-50 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
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
                  ? 'text-rose-900 dark:text-rose-200 font-semibold'
                  : 'text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'
              }`}
            >
              {item.title}
            </span>
          </div>
        </div>

        {/* Right: Type Badge, Time & Date Labels */}
        <div className="flex items-center gap-2 shrink-0">
          {showDateBadge && item.dateLabel && (
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
              {item.dateLabel}
            </span>
          )}

          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
              item.isOverdue
                ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold'
                : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80'
            }`}
          >
            {item.timeLabel}
          </span>

          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold hidden md:inline-flex ${
              item.type === 'event'
                ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                : item.type === 'task'
                  ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                  : 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300'
            }`}
          >
            {item.type === 'event' ? 'Event' : item.type === 'task' ? 'Task' : 'Note'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header Greeting & Counts */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500 block">
          {todayFormatted}
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
          {greeting}
        </h1>
        <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
          {summaryStr}
        </p>
      </div>

      {totalUpcoming === 0 ? (
        /* Empty State */
        <div className="py-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-slate-400">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h3 className="font-semibold text-base text-slate-800 dark:text-slate-200">
            All clear
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            You have no upcoming events, due tasks, or scheduled notes. Tap "+" or press Cmd+K to capture anything.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1. Today Section */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                <span>Today</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                  {today.length}
                </span>
              </h2>
            </div>

            {today.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-2 italic">
                Nothing scheduled for today.
              </p>
            ) : (
              <div className="space-y-2">
                {today.map((item) => renderItemRow(item, false))}
              </div>
            )}
          </section>

          {/* 2. Tomorrow Section */}
          {tomorrow.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Tomorrow</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {tomorrow.length}
                  </span>
                </h2>
              </div>

              <div className="space-y-2">
                {tomorrow.map((item) => renderItemRow(item, false))}
              </div>
            </section>
          )}

          {/* 3. Next 7 Days Section */}
          {next7Days.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Next 7 Days</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {next7Days.length}
                  </span>
                </h2>
              </div>

              <div className="space-y-2">
                {next7Days.map((item) => renderItemRow(item, true))}
              </div>
            </section>
          )}

          {/* 4. Later Section */}
          {later.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Later</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {later.length}
                  </span>
                </h2>
              </div>

              <div className="space-y-2">
                {later.map((item) => renderItemRow(item, true))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Event Editor Modal */}
      <EventEditorModal
        isOpen={isEventModalOpen}
        onClose={() => {
          setIsEventModalOpen(false);
          setSelectedOccurrence(null);
        }}
        occurrence={selectedOccurrence}
      />

      {/* Task Editor Modal */}
      <TaskEditorModal
        task={selectedTask}
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setSelectedTask(null);
        }}
        onDelete={handleDeleteTaskFromModal}
      />
    </div>
  );
}
