import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import type { EventOccurrence } from '../../../types/event';
import type { Task } from '../../../types/task';
import { NowLine } from './NowLine';
import { EventChip } from './EventChip';
import { AllDayBand } from './AllDayBand';
import { layoutDayEvents, HOUR_HEIGHT } from '../lib/layoutEvents';
import {
  roundToSlot,
  formatTimeSlot,
  addHourToTimeSlot,
  isTodayInDays,
} from '../lib/calendarDate';
import { isSameDay, formatDateKey } from '../../../utils/format';

export interface TimeGridProps {
  days: Date[]; // 1, 3, or 7
  occurrences: EventOccurrence[];
  tasksDue?: Task[];
  onSlotClick: (targetDate: Date, startTimeStr: string, endTimeStr: string) => void;
  onEventClick: (occ: EventOccurrence) => void;
  onRescheduleEvent?: (
    occ: EventOccurrence,
    newStartAt: Date,
    newEndAt: Date | null
  ) => void;
  onToggleTask?: (task: Task) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function TimeGrid({
  days,
  occurrences,
  tasksDue = [],
  onSlotClick,
  onEventClick,
  onRescheduleEvent,
  onToggleTask,
}: TimeGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrolledOnceRef = useRef(false);

  // Desktop click-drag range creation state
  const [dragSelection, setDragSelection] = useState<{
    dayIndex: number;
    startMin: number;
    currentMin: number;
  } | null>(null);

  const isMouseDownRef = useRef(false);

  // Auto-scroll on mount to Now or 07:00
  useEffect(() => {
    if (scrolledOnceRef.current || !containerRef.current) return;

    const now = new Date();
    const hasToday = isTodayInDays(days);

    let targetMinutes = 7 * 60; // default 07:00
    if (hasToday) {
      const nowMin = now.getHours() * 60 + now.getMinutes();
      targetMinutes = Math.max(7 * 60, nowMin - 60); // 1 hour before now, or 07:00
    }

    const targetScrollTop = (targetMinutes / 60) * HOUR_HEIGHT;
    containerRef.current.scrollTop = targetScrollTop;
    scrolledOnceRef.current = true;
  }, [days]);

  // Compute layout for each visible day column
  const dayLayouts = useMemo(() => {
    return days.map((day) => {
      const dayKey = formatDateKey(day);
      // Filter occurrences that fall on this day
      const dayOccurrences = occurrences.filter((occ) => {
        if (occ.occurrenceDate === dayKey) return true;
        // Check if multi-day event spans across this day
        const s = new Date(occ.startAt);
        const e = occ.endAt ? new Date(occ.endAt) : s;
        return isSameDay(s, day) || isSameDay(e, day);
      });

      return layoutDayEvents(dayOccurrences, day);
    });
  }, [days, occurrences]);

  // Collect allDay events for the pinned band
  const allDayEvents = useMemo(() => {
    const list: EventOccurrence[] = [];
    for (const layout of dayLayouts) {
      for (const ev of layout.allDayEvents) {
        if (!list.some((existing) => existing.eventId === ev.eventId && existing.occurrenceDate === ev.occurrenceDate)) {
          list.push(ev);
        }
      }
    }
    return list;
  }, [dayLayouts]);

  // Slot mousedown for click / range creation (desktop)
  const handleColumnMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, dayIndex: number) => {
      if (e.button !== 0) return; // Primary button only

      const rect = e.currentTarget.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const hours = Math.floor(clickY / HOUR_HEIGHT);
      const minutes = clickY % HOUR_HEIGHT;
      const { hour: roundedH, minute: roundedM } = roundToSlot(hours, minutes, 30);
      const startMin = roundedH * 60 + roundedM;

      isMouseDownRef.current = true;
      setDragSelection({
        dayIndex,
        startMin,
        currentMin: startMin + 30,
      });

      const handleWindowMouseMove = (moveEvent: MouseEvent) => {
        if (!isMouseDownRef.current) return;
        const currentY = moveEvent.clientY - rect.top;
        const h = Math.max(0, Math.min(23, Math.floor(currentY / HOUR_HEIGHT)));
        const m = Math.max(0, currentY % HOUR_HEIGHT);
        const { hour: curH, minute: curM } = roundToSlot(h, m, 30);
        const curMin = curH * 60 + curM;

        setDragSelection((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            currentMin: curMin + (curMin >= prev.startMin ? 30 : 0),
          };
        });
      };

      const handleWindowMouseUp = () => {
        window.removeEventListener('mousemove', handleWindowMouseMove);
        window.removeEventListener('mouseup', handleWindowMouseUp);

        if (isMouseDownRef.current) {
          isMouseDownRef.current = false;
          setDragSelection((curr) => {
            if (curr) {
              const targetDate = days[curr.dayIndex];
              const minSlot = Math.min(curr.startMin, curr.currentMin);
              const maxSlot = Math.max(curr.startMin, curr.currentMin);

              const startH = Math.floor(minSlot / 60);
              const startM = minSlot % 60;
              const startStr = formatTimeSlot(startH, startM);

              let endStr: string;
              if (maxSlot - minSlot >= 30) {
                const endH = Math.min(23, Math.floor(maxSlot / 60));
                const endM = maxSlot % 60;
                endStr = formatTimeSlot(endH, endM);
              } else {
                endStr = addHourToTimeSlot(startStr);
              }

              onSlotClick(targetDate, startStr, endStr);
            }
            return null;
          });
        }
      };

      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
    },
    [days, onSlotClick]
  );

  return (
    <div
      data-testid="time-grid-engine"
      className="flex flex-col h-full bg-surface border border-border rounded-card overflow-hidden shadow-card"
    >
      {/* Pinned Day Column Headers */}
      <div className="flex border-b border-border bg-surface-2/80 select-none">
        {/* Left corner spacer matching hour labels rail */}
        <div className="w-12 sm:w-16 shrink-0 border-r border-border" />

        {/* Days Header */}
        <div className="flex-1 grid grid-flow-col auto-cols-fr divide-x divide-border">
          {days.map((day, idx) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={`header-${day.toISOString()}-${idx}`}
                className={`py-2 px-1 text-center transition-colors ${
                  isToday ? 'bg-accent-soft/40' : ''
                }`}
              >
                <div className="text-[11px] font-medium text-ink-muted uppercase">
                  {WEEKDAY_NAMES[day.getDay()]}
                </div>
                <div
                  className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-xs sm:text-sm font-bold mt-0.5 ${
                    isToday
                      ? 'bg-accent text-accent-ink shadow-xs'
                      : 'text-ink'
                  }`}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pinned All-Day Band */}
      <AllDayBand
        days={days}
        allDayEvents={allDayEvents}
        tasksDue={tasksDue}
        onEventClick={onEventClick}
        onToggleTask={onToggleTask}
      />

      {/* Scrolling 24-hour Grid Body */}
      <div
        ref={containerRef}
        data-testid="grid-scroll-container"
        className="flex-1 overflow-y-auto overflow-x-hidden relative"
      >
        <div className="flex" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {/* Left Rail: Hour Labels (60px/hour) */}
          <div className="w-12 sm:w-16 shrink-0 border-r border-border select-none bg-surface/50">
            {HOURS.map((h) => (
              <div
                key={`hour-${h}`}
                style={{ height: `${HOUR_HEIGHT}px` }}
                className="relative text-[10px] sm:text-[11px] font-medium text-ink-muted text-right pr-1.5 sm:pr-2.5 pt-1"
              >
                {formatTimeSlot(h, 0)}
              </div>
            ))}
          </div>

          {/* Grid Columns for visible days */}
          <div className="flex-1 grid grid-flow-col auto-cols-fr divide-x divide-border relative">
            {days.map((day, dayIndex) => {
              const isToday = isSameDay(day, new Date());
              const layout = dayLayouts[dayIndex];

              return (
                <div
                  key={`day-col-${day.toISOString()}-${dayIndex}`}
                  onMouseDown={(e) => handleColumnMouseDown(e, dayIndex)}
                  className="relative h-full select-none cursor-pointer"
                  title="Click or drag to create event"
                >
                  {/* Hour background grid lines + half-hour hairlines */}
                  {HOURS.map((h) => (
                    <div
                      key={`grid-line-${h}`}
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      className="border-b border-border/40 relative hover:bg-surface-2/40 transition-colors pointer-events-none"
                    >
                      {/* Half-hour dashed hairline */}
                      <div className="absolute top-[30px] left-0 right-0 border-b border-border/25 border-dashed" />
                    </div>
                  ))}

                  {/* Now Line (rendered only for today) */}
                  {isToday && <NowLine />}

                  {/* Timed Event Chips */}
                  {layout.timedEvents.map((positioned) => (
                    <EventChip
                      key={`ev-${positioned.occurrence.eventId}-${positioned.occurrence.occurrenceDate}`}
                      positioned={positioned}
                      onClick={onEventClick}
                      onReschedule={onRescheduleEvent}
                    />
                  ))}

                  {/* Drag-to-create Ghost Indicator */}
                  {dragSelection && dragSelection.dayIndex === dayIndex && (
                    <div
                      className="absolute left-1 right-1 rounded-lg bg-accent/20 border-2 border-accent border-dashed pointer-events-none z-30"
                      style={{
                        top: `${(Math.min(dragSelection.startMin, dragSelection.currentMin) / 60) * HOUR_HEIGHT}px`,
                        height: `${Math.max(
                          20,
                          (Math.abs(dragSelection.currentMin - dragSelection.startMin) / 60) * HOUR_HEIGHT
                        )}px`,
                      }}
                    >
                      <span className="p-1 text-[10px] font-bold text-accent block truncate">
                        {formatTimeSlot(
                          Math.floor(Math.min(dragSelection.startMin, dragSelection.currentMin) / 60),
                          Math.min(dragSelection.startMin, dragSelection.currentMin) % 60
                        )}
                        {' - '}
                        {formatTimeSlot(
                          Math.floor(Math.max(dragSelection.startMin, dragSelection.currentMin) / 60),
                          Math.max(dragSelection.startMin, dragSelection.currentMin) % 60
                        )}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
