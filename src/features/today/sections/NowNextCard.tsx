import { useMemo } from 'react';
import type { EventOccurrence } from '../../../types/event';
import type { RoutineRun, Routine } from '../../../types/routine';
import { ROUTINE_TIME_ANCHORS } from '../../../db/repos/routinesRepo';

interface NowNextCardProps {
  events: EventOccurrence[];
  routines: Routine[];
  routineRuns: RoutineRun[];
  onOpenEvent?: (occ: EventOccurrence) => void;
}

export function NowNextCard({
  events,
  routines,
  routineRuns,
  onOpenEvent,
}: NowNextCardProps) {
  const nextItem = useMemo(() => {
    const now = new Date();
    const nowTime = now.getTime();
    const threeHoursLater = nowTime + 3 * 60 * 60 * 1000;

    const candidates: {
      type: 'event' | 'routine';
      title: string;
      timeStr: string;
      targetTime: number;
      eventData?: EventOccurrence;
    }[] = [];

    // 1. Timed events today
    for (const ev of events) {
      if (ev.allDay) continue;
      const start = new Date(ev.startAt).getTime();
      if (start > nowTime && start <= threeHoursLater) {
        const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
        candidates.push({
          type: 'event',
          title: ev.title,
          timeStr: new Date(ev.startAt).toLocaleTimeString(undefined, timeOptions),
          targetTime: start,
          eventData: ev,
        });
      }
    }

    // 2. Incomplete routine runs
    const routinesMap = new Map(routines.map((r) => [r.id, r]));
    for (const run of routineRuns) {
      const routine = routinesMap.get(run.routineId);
      if (!routine) continue;

      const items = run.itemsSnapshot || routine.items || [];
      const isComplete = items.length > 0 && items.every((it) => run.itemState?.[it.uid]);
      if (isComplete) continue;

      const anchor = ROUTINE_TIME_ANCHORS[routine.timeOfDay];
      const runDate = new Date();
      runDate.setHours(anchor.hour, anchor.minute, 0, 0);
      const runTime = runDate.getTime();

      // Include if upcoming within 3h or currently in progress
      if (runTime > nowTime - 30 * 60 * 1000 && runTime <= threeHoursLater) {
        candidates.push({
          type: 'routine',
          title: `${routine.emoji || '☀️'} ${routine.name}`,
          timeStr: anchor.timeStr,
          targetTime: runTime,
        });
      }
    }

    candidates.sort((a, b) => a.targetTime - b.targetTime);
    return candidates[0] || null;
  }, [events, routines, routineRuns]);

  if (!nextItem) {
    return (
      <div
        data-testid="now-next-card"
        className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface shadow-xs text-xs text-ink-muted"
      >
        <span className="text-base">☕</span>
        <span>Nothing scheduled in the next 3 hours — enjoy your time.</span>
      </div>
    );
  }

  const now = new Date().getTime();
  const diffMinutes = Math.max(1, Math.round((nextItem.targetTime - now) / 60000));

  return (
    <div
      data-testid="now-next-card"
      onClick={() => {
        if (nextItem.type === 'event' && nextItem.eventData && onOpenEvent) {
          onOpenEvent(nextItem.eventData);
        }
      }}
      className={`flex items-center justify-between p-3.5 rounded-xl border border-accent/40 bg-accent-soft/30 shadow-xs text-xs sm:text-sm ${
        nextItem.type === 'event' ? 'cursor-pointer hover:border-accent' : ''
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
        <span className="font-bold uppercase tracking-wider text-[11px] text-accent">
          NEXT:
        </span>
        <span className="font-semibold text-ink truncate">
          {nextItem.title}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0 text-xs font-semibold text-accent">
        <span>{nextItem.timeStr}</span>
        <span className="text-ink-muted font-normal text-[11px]">
          ({diffMinutes <= 0 ? 'now' : `in ${diffMinutes}m`})
        </span>
      </div>
    </div>
  );
}
