import { useState, useMemo, useCallback } from 'react';
import { useOccurrencesForRange, eventsRepo } from '../../db/eventsRepo';
import { useTasksDueForRange, tasksRepo } from '../../db/tasksRepo';
import { useScheduledNotesForRange } from '../../db/notesRepo';
import { useActiveAreas } from '../../db/repos/areasRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { Segmented, type SegmentOption } from '../../design/ui/Segmented';
import { EventEditorModal } from '../../components/calendar/EventEditorModal';
import { DayView } from './views/DayView';
import { ThreeDayView } from './views/ThreeDayView';
import { WeekView } from './views/WeekView';
import { MonthView } from './views/MonthView';
import { TimelineView } from './views/TimelineView';
import {
  startOfDay,
  endOfDay,
  addDays,
  getThreeDays,
  getWeekDays,
} from './lib/calendarDate';
import { localDateStr, parseLocalDateStr } from '../../lib/date';
import type { EventOccurrence } from '../../types/event';
import type { Task } from '../../types/task';
import type { LifeArea } from '../../types/area';

export type CalendarViewType = 'day' | '3day' | 'week' | 'month' | 'timeline';

const VIEW_STORAGE_KEY = 'notes_calendar_view';

const VIEW_OPTIONS: SegmentOption<CalendarViewType>[] = [
  { value: 'day', label: 'Day' },
  { value: '3day', label: '3-Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'timeline', label: 'Timeline' },
];

export function CalendarScreen() {
  const { showSnackbar, showUndo } = useSnackbar();

  // Persist chosen view per EXPANSION_PLAN §5.3
  const [activeView, setActiveView] = useState<CalendarViewType>(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY) as CalendarViewType | null;
      if (saved && ['day', '3day', 'week', 'month', 'timeline'].includes(saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    // Default to week view on desktop/tablet, day on small screens
    return typeof window !== 'undefined' && window.innerWidth < 640 ? 'day' : 'week';
  });

  const handleViewChange = useCallback((newView: CalendarViewType) => {
    setActiveView(newView);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, newView);
    } catch {
      // ignore
    }
  }, []);

  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Modal states for creating / editing events
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [selectedOccurrence, setSelectedOccurrence] = useState<EventOccurrence | null>(null);
  const [modalDefaultDate, setModalDefaultDate] = useState<Date>(() => new Date());
  const [modalStartTime, setModalStartTime] = useState<string | undefined>(undefined);
  const [modalEndTime, setModalEndTime] = useState<string | undefined>(undefined);

  // Compute bounded date ranges for queries
  const { queryStart, queryEnd } = useMemo(() => {
    if (activeView === 'day') {
      return { queryStart: startOfDay(currentDate), queryEnd: endOfDay(currentDate) };
    }
    if (activeView === '3day') {
      const three = getThreeDays(currentDate);
      return { queryStart: startOfDay(three[0]), queryEnd: endOfDay(three[2]) };
    }
    if (activeView === 'week') {
      const week = getWeekDays(currentDate, true);
      return { queryStart: startOfDay(week[0]), queryEnd: endOfDay(week[6]) };
    }
    if (activeView === 'month') {
      const y = currentDate.getFullYear();
      const m = currentDate.getMonth();
      const first = new Date(y, m, 1);
      const last = new Date(y, m + 1, 0);
      const startOffset = (first.getDay() + 6) % 7;
      const endOffset = (last.getDay() + 6) % 7;
      return {
        queryStart: startOfDay(addDays(first, -startOffset)),
        queryEnd: endOfDay(addDays(last, 6 - endOffset)),
      };
    }
    // Timeline view: today -> +30 days
    const today = startOfDay(new Date());
    return { queryStart: today, queryEnd: endOfDay(addDays(today, 30)) };
  }, [activeView, currentDate]);

  // Reactive range-bounded queries
  const occurrences = useOccurrencesForRange(queryStart, queryEnd) ?? [];
  const tasksDue = useTasksDueForRange(queryStart, queryEnd) ?? [];
  const scheduledNotes = useScheduledNotesForRange(queryStart, queryEnd) ?? [];
  const activeAreas = useActiveAreas();

  const areasMap = useMemo(() => {
    const map = new Map<number, LifeArea>();
    for (const a of activeAreas) {
      if (a.id) map.set(a.id, a);
    }
    return map;
  }, [activeAreas]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setCurrentDate((prev) => {
      if (activeView === 'day') return addDays(prev, -1);
      if (activeView === '3day') return addDays(prev, -3);
      if (activeView === 'week') return addDays(prev, -7);
      if (activeView === 'month') {
        return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      }
      return addDays(prev, -14);
    });
  }, [activeView]);

  const handleNext = useCallback(() => {
    setCurrentDate((prev) => {
      if (activeView === 'day') return addDays(prev, 1);
      if (activeView === '3day') return addDays(prev, 3);
      if (activeView === 'week') return addDays(prev, 7);
      if (activeView === 'month') {
        return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      }
      return addDays(prev, 14);
    });
  }, [activeView]);

  const handleGoToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleDatePicked = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const d = parseLocalDateStr(e.target.value);
    if (!isNaN(d.getTime())) {
      setCurrentDate(d);
    }
  }, []);

  // Modal interaction callbacks
  const handleOpenNewEvent = useCallback(() => {
    setSelectedOccurrence(null);
    setModalDefaultDate(currentDate);
    setModalStartTime(undefined);
    setModalEndTime(undefined);
    setIsEventModalOpen(true);
  }, [currentDate]);

  const handleSlotClick = useCallback(
    (targetDate: Date, startTimeStr: string, endTimeStr: string) => {
      setSelectedOccurrence(null);
      setModalDefaultDate(targetDate);
      setModalStartTime(startTimeStr);
      setModalEndTime(endTimeStr);
      setIsEventModalOpen(true);
    },
    []
  );

  const handleEventClick = useCallback((occ: EventOccurrence) => {
    setSelectedOccurrence(occ);
    setIsEventModalOpen(true);
  }, []);

  // Desktop drag-to-reschedule callback
  const handleRescheduleEvent = useCallback(
    async (occ: EventOccurrence, newStartAt: Date, newEndAt: Date | null) => {
      const eventId = occ.eventId;
      const isRecurring = occ.recurrence !== 'none';

      try {
        if (isRecurring) {
          // Add exception for this occurrence
          await eventsRepo.addEventException(eventId, {
            date: occ.occurrenceDate,
            startAt: newStartAt,
            endAt: newEndAt ?? undefined,
          });
          showSnackbar({ message: 'Rescheduled recurring occurrence' });
        } else {
          const oldStart = occ.startAt;
          const oldEnd = occ.endAt;
          await eventsRepo.updateEvent(eventId, {
            startAt: newStartAt,
            endAt: newEndAt,
          });
          showUndo('Event rescheduled', async () => {
            await eventsRepo.updateEvent(eventId, {
              startAt: oldStart,
              endAt: oldEnd,
            });
          });
        }
      } catch (err) {
        console.error('Failed to reschedule event:', err);
      }
    },
    [showSnackbar, showUndo]
  );

  // Task toggle
  const handleToggleTask = useCallback(
    async (task: Task) => {
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
        console.error('Failed to toggle task:', err);
      }
    },
    [showUndo]
  );

  // Header Title Range
  const headerDateLabel = useMemo(() => {
    const optsMonth: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    const optsShort: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };

    if (activeView === 'day') {
      return currentDate.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (activeView === '3day') {
      const three = getThreeDays(currentDate);
      return `${three[0].toLocaleDateString(undefined, optsShort)} – ${three[2].toLocaleDateString(undefined, optsShort)}`;
    }
    if (activeView === 'week') {
      const week = getWeekDays(currentDate, true);
      return `${week[0].toLocaleDateString(undefined, optsShort)} – ${week[6].toLocaleDateString(undefined, optsShort)}, ${week[6].getFullYear()}`;
    }
    if (activeView === 'month') {
      return currentDate.toLocaleDateString(undefined, optsMonth);
    }
    return 'Timeline (Next 14 Days)';
  }, [activeView, currentDate]);

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-8">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
        {/* Title & Date Range Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 border border-border rounded-xl p-0.5 bg-surface shadow-2xs">
            <button
              type="button"
              onClick={handlePrev}
              className="p-2 hover:bg-surface-2 text-ink-muted hover:text-ink rounded-lg transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label="Previous period"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={handleGoToToday}
              className="px-2.5 py-1 text-xs font-semibold text-ink hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="p-2 hover:bg-surface-2 text-ink-muted hover:text-ink rounded-lg transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label="Next period"
            >
              ›
            </button>
          </div>

          {/* Jump-to-date picker */}
          <div className="relative flex items-center">
            <span className="text-sm sm:text-base font-bold text-ink select-none pr-2">
              {headerDateLabel}
            </span>
            <label
              className="p-1.5 rounded-lg border border-border bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink transition-colors cursor-pointer"
              title="Jump to date"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <input
                type="date"
                value={localDateStr(currentDate)}
                onChange={handleDatePicked}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        {/* View Switcher & Add Button */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Segmented<CalendarViewType>
            options={VIEW_OPTIONS}
            value={activeView}
            onChange={handleViewChange}
            size="sm"
            ariaLabel="Calendar view modes"
          />

          <button
            type="button"
            onClick={handleOpenNewEvent}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-xs font-semibold bg-accent text-accent-ink hover:opacity-90 shadow-xs transition-opacity cursor-pointer min-h-[44px]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* Main View Router */}
      <div>
        {activeView === 'day' && (
          <DayView
            currentDate={currentDate}
            occurrences={occurrences}
            tasksDue={tasksDue}
            areasMap={areasMap}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
            onRescheduleEvent={handleRescheduleEvent}
            onToggleTask={handleToggleTask}
          />
        )}

        {activeView === '3day' && (
          <ThreeDayView
            currentDate={currentDate}
            occurrences={occurrences}
            tasksDue={tasksDue}
            areasMap={areasMap}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
            onRescheduleEvent={handleRescheduleEvent}
            onToggleTask={handleToggleTask}
          />
        )}

        {activeView === 'week' && (
          <WeekView
            currentDate={currentDate}
            occurrences={occurrences}
            tasksDue={tasksDue}
            areasMap={areasMap}
            onSlotClick={handleSlotClick}
            onEventClick={handleEventClick}
            onRescheduleEvent={handleRescheduleEvent}
            onToggleTask={handleToggleTask}
          />
        )}

        {activeView === 'month' && (
          <MonthView
            currentDate={currentDate}
            occurrences={occurrences}
            tasksDue={tasksDue}
            scheduledNotes={scheduledNotes}
            areas={activeAreas}
            areasMap={areasMap}
            onSelectDay={(date) => {
              setCurrentDate(date);
              handleViewChange('day');
            }}
          />
        )}

        {activeView === 'timeline' && (
          <TimelineView
            currentDate={currentDate}
            occurrences={occurrences}
            tasksDue={tasksDue}
            scheduledNotes={scheduledNotes}
            areasMap={areasMap}
            onEventClick={handleEventClick}
            onToggleTask={handleToggleTask}
          />
        )}
      </div>

      {/* Event Editor Modal */}
      <EventEditorModal
        isOpen={isEventModalOpen}
        onClose={() => setIsEventModalOpen(false)}
        occurrence={selectedOccurrence}
        defaultDate={modalDefaultDate}
        defaultStartTime={modalStartTime}
        defaultEndTime={modalEndTime}
      />
    </div>
  );
}
