import type { EventOccurrence } from '../../../types/event';
import type { Task } from '../../../types/task';
import { formatDateKey } from '../../../utils/format';

interface AllDayBandProps {
  days: Date[];
  allDayEvents: EventOccurrence[];
  tasksDue: Task[];
  onEventClick: (occ: EventOccurrence) => void;
  onToggleTask?: (task: Task) => void;
}

export function AllDayBand({
  days,
  allDayEvents,
  tasksDue,
  onEventClick,
  onToggleTask,
}: AllDayBandProps) {
  // Check if there are any all-day items across visible days
  const hasItems = days.some((day) => {
    const dayKey = formatDateKey(day);
    const hasEv = allDayEvents.some((ev) => ev.allDay && ev.occurrenceDate === dayKey);
    const hasTk = tasksDue.some(
      (t) => t.dueAt && formatDateKey(new Date(t.dueAt)) === dayKey
    );
    return hasEv || hasTk;
  });

  if (!hasItems) {
    return null;
  }

  return (
    <div
      data-testid="all-day-band"
      className="sticky top-0 z-30 flex border-b border-border bg-surface/95 backdrop-blur-xs shadow-xs"
    >
      {/* Left label gutter matching time-grid hour rail */}
      <div className="w-12 sm:w-16 shrink-0 py-2 px-1 text-center flex flex-col justify-center border-r border-border">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
          All Day
        </span>
      </div>

      {/* Day columns */}
      <div className="flex-1 grid grid-flow-col auto-cols-fr divide-x divide-border">
        {days.map((day, idx) => {
          const dayKey = formatDateKey(day);
          const dayEvents = allDayEvents.filter(
            (ev) => ev.allDay && ev.occurrenceDate === dayKey
          );
          const dayTasks = tasksDue.filter(
            (t) => t.dueAt && formatDateKey(new Date(t.dueAt)) === dayKey
          );

          return (
            <div key={`allday-${dayKey}-${idx}`} className="p-1 sm:p-1.5 space-y-1 min-h-[36px]">
              {/* All-day Events */}
              {dayEvents.map((occ) => {
                return (
                  <button
                    key={`allday-ev-${occ.eventId}-${occ.occurrenceDate}`}
                    type="button"
                    onClick={() => onEventClick(occ)}
                    className="w-full text-left px-2 py-1 rounded-md text-[11px] font-medium border-l-[3px] border-l-accent bg-accent-soft text-ink hover:opacity-85 transition-opacity truncate cursor-pointer shadow-2xs block"
                  >
                    {occ.title}
                  </button>
                );
              })}

              {/* Tasks due */}
              {dayTasks.map((task) => (
                <div
                  key={`allday-task-${task.id}`}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] bg-surface-2 border border-border truncate"
                >
                  {onToggleTask && (
                    <button
                      type="button"
                      onClick={() => onToggleTask(task)}
                      className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 cursor-pointer ${
                        task.status === 'done'
                          ? 'bg-success border-success text-white'
                          : 'border-ink-muted hover:border-accent'
                      }`}
                      aria-label="Toggle task"
                    >
                      {task.status === 'done' && (
                        <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  )}
                  <span
                    className={`truncate text-ink ${
                      task.status === 'done' ? 'line-through text-ink-muted opacity-60' : ''
                    }`}
                  >
                    {task.title}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
