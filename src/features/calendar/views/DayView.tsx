import { useMemo } from 'react';
import { TimeGrid } from '../grid/TimeGrid';
import type { EventOccurrence } from '../../../types/event';
import type { Task } from '../../../types/task';
import type { LifeArea } from '../../../types/area';

interface DayViewProps {
  currentDate: Date;
  occurrences: EventOccurrence[];
  tasksDue: Task[];
  areasMap?: Map<number, LifeArea>;
  onSlotClick: (targetDate: Date, startTimeStr: string, endTimeStr: string) => void;
  onEventClick: (occ: EventOccurrence) => void;
  onRescheduleEvent?: (
    occ: EventOccurrence,
    newStartAt: Date,
    newEndAt: Date | null
  ) => void;
  onToggleTask?: (task: Task) => void;
}

export function DayView({
  currentDate,
  occurrences,
  tasksDue,
  areasMap,
  onSlotClick,
  onEventClick,
  onRescheduleEvent,
  onToggleTask,
}: DayViewProps) {
  const days = useMemo(() => [currentDate], [currentDate]);

  return (
    <div className="h-[calc(100vh-210px)] min-h-[500px]">
      <TimeGrid
        days={days}
        occurrences={occurrences}
        tasksDue={tasksDue}
        areasMap={areasMap}
        onSlotClick={onSlotClick}
        onEventClick={onEventClick}
        onRescheduleEvent={onRescheduleEvent}
        onToggleTask={onToggleTask}
      />
    </div>
  );
}
