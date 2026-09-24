import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOccurrencesForRange } from '../../db/eventsRepo';
import { useTasksDueForRange, tasksRepo } from '../../db/tasksRepo';
import { useScheduledNotesForRange } from '../../db/notesRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { EventEditorModal } from '../calendar/EventEditorModal';
import type { EventOccurrence } from '../../types/event';
import type { Task } from '../../types/task';
import {
  formatDateKey,
  isSameDay,
  formatDayHeader,
  formatEventTime,
  isOverdue,
  getContentSnippet,
} from '../../utils/format';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarView() {
  const navigate = useNavigate();
  const { showUndo } = useSnackbar();


  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  // Modal states
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<EventOccurrence | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Calculate full month grid bounds (including adjacent month pad days)
  const { gridStart, gridEnd, calendarDays } = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    // Day of week for 1st of month: 0 (Sun) to 6 (Sat). We want 0=Mon ... 6=Sun.
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;
    const gStart = new Date(currentYear, currentMonth, 1 - startDayOfWeek, 0, 0, 0, 0);

    const endDayOfWeek = (lastDay.getDay() + 6) % 7;
    const gEnd = new Date(currentYear, currentMonth + 1, 6 - endDayOfWeek, 23, 59, 59, 999);

    const days: Date[] = [];
    const cur = new Date(gStart);
    while (cur.getTime() <= gEnd.getTime()) {
      days.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }

    return { gridStart: gStart, gridEnd: gEnd, calendarDays: days };
  }, [currentYear, currentMonth]);

  // Reactive data for full visible grid
  const occurrences = useOccurrencesForRange(gridStart, gridEnd) ?? [];
  const tasksDue = useTasksDueForRange(gridStart, gridEnd) ?? [];
  const scheduledNotes = useScheduledNotesForRange(gridStart, gridEnd) ?? [];

  // Group items by dateKey for fast dot lookups
  const { eventDates, taskDates, noteDates } = useMemo(() => {
    const eSet = new Set<string>();
    for (const occ of occurrences) {
      eSet.add(occ.occurrenceDate);
    }

    const tSet = new Set<string>();
    for (const task of tasksDue) {
      if (task.dueAt) {
        tSet.add(formatDateKey(new Date(task.dueAt)));
      }
    }

    const nSet = new Set<string>();
    for (const note of scheduledNotes) {
      if (note.scheduledAt) {
        nSet.add(formatDateKey(new Date(note.scheduledAt)));
      }
    }

    return { eventDates: eSet, taskDates: tSet, noteDates: nSet };
  }, [occurrences, tasksDue, scheduledNotes]);

  // Items for currently selected day
  const selectedDateKey = formatDateKey(selectedDate);

  const dayOccurrences = useMemo(
    () => occurrences.filter((occ) => occ.occurrenceDate === selectedDateKey),
    [occurrences, selectedDateKey]
  );

  const dayTasks = useMemo(
    () =>
      tasksDue.filter(
        (task) => task.dueAt && formatDateKey(new Date(task.dueAt)) === selectedDateKey
      ),
    [tasksDue, selectedDateKey]
  );

  const dayNotes = useMemo(
    () =>
      scheduledNotes.filter(
        (note) => note.scheduledAt && formatDateKey(new Date(note.scheduledAt)) === selectedDateKey
      ),
    [scheduledNotes, selectedDateKey]
  );

  const totalDayItems = dayOccurrences.length + dayTasks.length + dayNotes.length;

  // Month navigation helpers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleGoToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleOpenNewEvent = () => {
    setSelectedOccurrence(null);
    setIsEventModalOpen(true);
  };

  const handleEditOccurrence = (occ: EventOccurrence) => {
    setSelectedOccurrence(occ);
    setIsEventModalOpen(true);
  };

  const handleToggleTask = async (task: Task) => {
    if (!task.id) return;
    const nextStatus = task.status === 'todo' ? 'done' : 'todo';
    try {
      await tasksRepo.toggleTaskStatus(task.id, nextStatus);
      showUndo(
        nextStatus === 'done' ? 'Completed task' : 'Marked task as todo',
        async () => {
          if (task.id) await tasksRepo.toggleTaskStatus(task.id, task.status);
        }
      );
    } catch (err) {
      console.error('Failed to toggle task in calendar:', err);
    }
  };

  const monthTitle = currentDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Calendar
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Events, due tasks, and scheduled notes
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGoToToday}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              aria-label="Previous month"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="px-3 text-xs font-bold text-slate-800 dark:text-slate-200 select-none min-w-[120px] text-center">
              {monthTitle}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              aria-label="Next month"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenNewEvent}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* Main Grid & Agenda Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Month View (Left / Top 7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          {/* Weekday labels */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Month grid days */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarDays.map((date) => {
              const key = formatDateKey(date);
              const isCurrentMonth = date.getMonth() === currentMonth;
              const isToday = isSameDay(date, new Date());
              const isSelected = isSameDay(date, selectedDate);

              const hasEvents = eventDates.has(key);
              const hasTasks = taskDates.has(key);
              const hasNotes = noteDates.has(key);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`relative flex flex-col items-center justify-between p-1 sm:p-2 rounded-xl transition-all cursor-pointer h-12 sm:h-14 ${
                    isSelected
                      ? 'bg-blue-500 text-white shadow-xs ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900'
                      : isToday
                        ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900/60'
                        : isCurrentMonth
                          ? 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          : 'opacity-35 hover:opacity-60 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-400'
                  }`}
                >
                  <span className={`text-xs sm:text-sm ${isToday && !isSelected ? 'font-bold' : ''}`}>
                    {date.getDate()}
                  </span>

                  {/* Indicator Dots */}
                  <div className="flex items-center gap-1 min-h-[6px]">
                    {hasEvents && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-blue-500'
                        }`}
                        title="Event"
                      />
                    )}
                    {hasTasks && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-amber-200' : 'bg-amber-500'
                        }`}
                        title="Task due"
                      />
                    )}
                    {hasNotes && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-purple-200' : 'bg-purple-500'
                        }`}
                        title="Scheduled note"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Dots Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Events</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Due Tasks</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>Notes</span>
            </div>
          </div>
        </div>

        {/* Day Agenda Panel (Right / 5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block">
                Day Agenda
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {formatDayHeader(selectedDate)}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleOpenNewEvent}
              className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
              title="Add event for this day"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>

          {/* Agenda Items List */}
          {totalDayItems === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No events, tasks, or notes scheduled for this day.
              </p>
              <button
                type="button"
                onClick={handleOpenNewEvent}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-1 cursor-pointer"
              >
                + Schedule an event
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {/* 1. Events */}
              {dayOccurrences.map((occ) => (
                <div
                  key={`occ-${occ.eventId}-${occ.occurrenceDate}`}
                  onClick={() => handleEditOccurrence(occ)}
                  className="p-3 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 hover:border-blue-400 dark:hover:border-blue-700 transition-all cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 dark:bg-blue-900/70 text-blue-700 dark:text-blue-300">
                      <span>Event</span>
                      {occ.recurrence !== 'none' && (
                        <svg className="w-3 h-3 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="17 1 21 5 17 9" />
                          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                          <polyline points="7 23 3 19 7 15" />
                          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      )}
                    </span>

                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {formatEventTime(occ.startAt, occ.endAt, occ.allDay)}
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                    {occ.title}
                  </h3>

                  {occ.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {occ.description}
                    </p>
                  )}

                  {occ.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {occ.tags.map((t) => (
                        <span key={t} className="text-[10px] text-blue-600 dark:text-blue-400">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* 2. Tasks Due */}
              {dayTasks.map((task) => {
                const pastDue = task.status === 'todo' && isOverdue(task.dueAt);
                return (
                  <div
                    key={`task-${task.id}`}
                    className={`p-3 rounded-xl border transition-all ${
                      task.status === 'done'
                        ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 opacity-70'
                        : pastDue
                          ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20'
                          : 'border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task)}
                        className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          task.status === 'done'
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-400 hover:border-blue-500'
                        }`}
                        aria-label={task.status === 'done' ? 'Mark todo' : 'Mark done'}
                      >
                        {task.status === 'done' && (
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                            Task
                          </span>
                          {task.priority && task.priority !== 'none' && (
                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize">
                              · {task.priority}
                            </span>
                          )}
                          {pastDue && (
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              · Overdue
                            </span>
                          )}
                        </div>

                        <span
                          className={`text-xs sm:text-sm font-medium block leading-snug truncate ${
                            task.status === 'done'
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* 3. Scheduled Notes */}
              {dayNotes.map((note) => (
                <div
                  key={`note-${note.id}`}
                  onClick={() => navigate(`/notes/${note.id}`)}
                  className="p-3 rounded-xl border border-purple-200/80 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 hover:border-purple-400 dark:hover:border-purple-700 transition-all cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                      <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span>Scheduled Note</span>
                    </span>

                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                      Tap to open
                    </span>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-snug truncate">
                    {note.title || 'Untitled Note'}
                  </h3>

                  {note.content && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {getContentSnippet(note.content, 2, 90)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Event Editor Modal */}
      <EventEditorModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        occurrence={selectedOccurrence}
        defaultDate={selectedDate}
      />
    </div>
  );
}
