import { useMemo } from 'react';
import type { EventOccurrence } from '../../../types/event';
import type { Task } from '../../../types/task';
import type { Note } from '../../../types/note';
import { formatDateKey, isSameDay } from '../../../utils/format';

interface MonthViewProps {
  currentDate: Date;
  occurrences: EventOccurrence[];
  tasksDue: Task[];
  scheduledNotes: Note[];
  onSelectDay: (date: Date) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function MonthView({
  currentDate,
  occurrences,
  tasksDue,
  scheduledNotes,
  onSelectDay,
}: MonthViewProps) {
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // Calculate full month grid bounds (including adjacent month pad days)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

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

    return days;
  }, [currentYear, currentMonth]);

  // Index items by dateKey for fast lookup
  const itemsByDate = useMemo(() => {
    const evMap = new Map<string, EventOccurrence[]>();
    for (const occ of occurrences) {
      const list = evMap.get(occ.occurrenceDate) || [];
      list.push(occ);
      evMap.set(occ.occurrenceDate, list);
    }

    const tkMap = new Map<string, Task[]>();
    for (const task of tasksDue) {
      if (task.dueAt) {
        const key = formatDateKey(new Date(task.dueAt));
        const list = tkMap.get(key) || [];
        list.push(task);
        tkMap.set(key, list);
      }
    }

    const ntMap = new Map<string, Note[]>();
    for (const note of scheduledNotes) {
      if (note.scheduledAt) {
        const key = formatDateKey(new Date(note.scheduledAt));
        const list = ntMap.get(key) || [];
        list.push(note);
        ntMap.set(key, list);
      }
    }

    return { evMap, tkMap, ntMap };
  }, [occurrences, tasksDue, scheduledNotes]);

  return (
    <div
      data-testid="month-view"
      className="bg-surface border border-border rounded-card p-4 sm:p-5 shadow-card space-y-4"
    >
      {/* Weekday column labels */}
      <div className="grid grid-cols-7 mb-1 text-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-ink-muted py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Month grid days */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {calendarDays.map((date) => {
          const key = formatDateKey(date);
          const isCurrentMonth = date.getMonth() === currentMonth;
          const isToday = isSameDay(date, new Date());

          const dayEvents = itemsByDate.evMap.get(key) || [];
          const dayTasks = itemsByDate.tkMap.get(key) || [];
          const dayNotes = itemsByDate.ntMap.get(key) || [];

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDay(date)}
              title={`View ${date.toDateString()}`}
              className={`relative flex flex-col items-center justify-between p-1.5 sm:p-2.5 rounded-xl transition-all cursor-pointer min-h-[64px] sm:min-h-[80px] border ${
                isToday
                  ? 'bg-accent-soft/30 border-accent/40 font-bold text-accent'
                  : isCurrentMonth
                    ? 'bg-surface hover:bg-surface-2 border-border/60 text-ink hover:border-accent/40'
                    : 'bg-surface-2/40 opacity-40 hover:opacity-75 border-transparent text-ink-muted'
              }`}
            >
              <span
                className={`text-xs sm:text-sm ${
                  isToday
                    ? 'w-6 h-6 rounded-full bg-accent text-accent-ink flex items-center justify-center font-bold'
                    : ''
                }`}
              >
                {date.getDate()}
              </span>

              {/* Indicator Dots */}
              <div className="flex flex-wrap items-center justify-center gap-1 max-w-[80%] min-h-[10px]">
                {/* Event dots */}
                {dayEvents.slice(0, 4).map((ev, i) => (
                  <span
                    key={`ev-dot-${ev.eventId}-${i}`}
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-accent ring-1 ring-surface shrink-0"
                    title={ev.title}
                  />
                ))}

                {/* Due task dot */}
                {dayTasks.length > 0 && (
                  <span
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-warning ring-1 ring-surface shrink-0"
                    title={`${dayTasks.length} task(s) due`}
                  />
                )}

                {/* Scheduled note dot */}
                {dayNotes.length > 0 && (
                  <span
                    className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-purple-500 ring-1 ring-surface shrink-0"
                    title={`${dayNotes.length} note(s)`}
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Type Dots Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-3 border-t border-border text-[11px] text-ink-muted">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
          <span>Events</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning shrink-0" />
          <span>Due Tasks</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
          <span>Notes</span>
        </div>
      </div>
    </div>
  );
}
