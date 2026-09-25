import { useNavigate } from 'react-router-dom';
import type { EventOccurrence } from '../../../types/event';
import { formatEventTime } from '../../../utils/format';

interface ScheduleRailProps {
  events: EventOccurrence[];
  onOpenEvent?: (occ: EventOccurrence) => void;
}

export function ScheduleRail({
  events,
  onOpenEvent,
}: ScheduleRailProps) {
  const navigate = useNavigate();

  return (
    <div
      data-testid="schedule-rail"
      className="bg-surface border border-border rounded-card p-4 sm:p-5 shadow-card space-y-3"
    >
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-base">📅</span>
          <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
            Schedule
          </h3>
          <span className="text-xs text-ink-muted">({events.length})</span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/calendar')}
          className="text-xs font-semibold text-accent hover:underline cursor-pointer min-h-[36px] flex items-center"
        >
          View Calendar →
        </button>
      </div>

      {events.length === 0 ? (
        <div className="py-3 text-center text-xs text-ink-muted italic">
          No events scheduled for today.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {events.map((ev) => {
            return (
              <div
                key={`today-ev-${ev.eventId}-${ev.occurrenceDate}`}
                role="button"
                tabIndex={0}
                onClick={() => onOpenEvent?.(ev)}
                className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-2/60 hover:bg-surface-2 transition-all cursor-pointer gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0 bg-accent"
                  />
                  <span className="text-xs font-semibold text-ink truncate">
                    {ev.title}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-ink-muted shrink-0">
                  {formatEventTime(ev.startAt, ev.endAt, ev.allDay)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
