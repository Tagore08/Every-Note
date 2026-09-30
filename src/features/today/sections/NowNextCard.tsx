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
        className="flex items-center gap-3 p-4 rounded-card border border-border/50 bg-surface shadow-xs text-xs text-ink-muted"
      >
        <span className="text-lg">☕</span>
        <span className="leading-relaxed">Nothing scheduled in the next 3 hours — enjoy your time.</span>
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
      className={`flex items-center justify-between p-4 rounded-card border border-accent/25 bg-gradient-to-r from-accent-soft/40 to-accent-soft/10 shadow-xs ${
        nextItem.type === 'event' ? 'cursor-pointer hover:border-accent/40 transition-colors' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Animated pulse dot */}
        <span className="relative shrink-0 flex">
          <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping absolute opacity-40" />
          <span className="w-2.5 h-2.5 rounded-full bg-accent relative" />
        </span>

        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-accent mb-0.5">
            Up Next
          </div>
          <div className="font-semibold text-sm text-ink truncate">
            {nextItem.title}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0 ml-3">
        <span className="text-sm font-bold text-accent">{nextItem.timeStr}</span>
        <span className="text-[10px] text-ink-faint font-medium">
          {diffMinutes <= 0 ? 'now' : `in ${diffMinutes}m`}
        </span>
      </div>
    </div>
  );
}
