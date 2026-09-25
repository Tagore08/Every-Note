import { useMemo } from 'react';
import { TimeGrid } from '../grid/TimeGrid';
import { getThreeDays } from '../lib/calendarDate';
import type { EventOccurrence } from '../../../types/event';
import type { Task } from '../../../types/task';

interface ThreeDayViewProps {
  currentDate: Date;
  occurrences: EventOccurrence[];
  tasksDue: Task[];
  onSlotClick: (targetDate: Date, startTimeStr: string, endTimeStr: string) => void;
  onEventClick: (occ: EventOccurrence) => void;
  onRescheduleEvent?: (
    occ: EventOccurrence,
    newStartAt: Date,
    newEndAt: Date | null
  ) => void;
  onToggleTask?: (task: Task) => void;
}

export function ThreeDayView({
  currentDate,
  occurrences,
  tasksDue,
  onSlotClick,
  onEventClick,
  onRescheduleEvent,
  onToggleTask,
}: ThreeDayViewProps) {
  const days = useMemo(() => getThreeDays(currentDate), [currentDate]);

  return (
    <div className="h-[calc(100vh-210px)] min-h-[500px]">
      <TimeGrid
        days={days}
        occurrences={occurrences}
        tasksDue={tasksDue}
        onSlotClick={onSlotClick}
        onEventClick={onEventClick}
        onRescheduleEvent={onRescheduleEvent}
        onToggleTask={onToggleTask}
      />
    </div>
  );
}
