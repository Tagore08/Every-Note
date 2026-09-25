import { db } from '../database';
import { toLocalDateStr, addDays } from '../habitsRepo';
import { areasRepo } from './areasRepo';
import { notesRepo } from '../notesRepo';

export interface AreaTaskCount {
  areaId: number | null;
  areaName: string;
  color: string;
  count: number;
}

export interface MetricDelta {
  current: number;
  previous: number;
  change: number; // current - previous
  direction: 'up' | 'down' | 'flat';
}

export interface ComputedInsights {
  date: string;
  captures: MetricDelta;
  tasksCompleted: MetricDelta & { byArea: AreaTaskCount[] };
  eventsCount: MetricDelta;
  focusMinutes: MetricDelta;
  habitConsistency: MetricDelta; // percentage 0-100
  journalStreak: { current: number; totalEntries: number };
}

export function computeDelta(current: number, previous: number): MetricDelta {
  const change = current - previous;
  const direction: 'up' | 'down' | 'flat' = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
  return { current, previous, change, direction };
}

export const insightsRepo = {
  /**
   * Pure calculation of insights for a given date window.
   */
  async calculateInsights(referenceDate: Date = new Date()): Promise<ComputedInsights> {
    const todayStr = toLocalDateStr(referenceDate);
    const nowMs = referenceDate.getTime();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const twoWeeksAgoMs = nowMs - 2 * oneWeekMs;
    const oneWeekAgoMs = nowMs - oneWeekMs;

    // 1. Captures (notes + tasks created)
    const allNotes = await db.notes.toArray();
    const allTasks = await db.tasks.toArray();

    const notesThisWeek = allNotes.filter((n) => new Date(n.createdAt).getTime() >= oneWeekAgoMs).length;
    const tasksThisWeek = allTasks.filter((t) => new Date(t.createdAt).getTime() >= oneWeekAgoMs).length;
    const currentCaptures = notesThisWeek + tasksThisWeek;

    const notesPrevWeek = allNotes.filter((n) => {
      const t = new Date(n.createdAt).getTime();
      return t >= twoWeeksAgoMs && t < oneWeekAgoMs;
    }).length;
    const tasksPrevWeek = allTasks.filter((task) => {
      const tm = new Date(task.createdAt).getTime();
      return tm >= twoWeeksAgoMs && tm < oneWeekAgoMs;
    }).length;
    const prevCaptures = notesPrevWeek + tasksPrevWeek;

    // 2. Tasks completed
    const activeAreas = await areasRepo.getActiveAreas();
    const areasMap = new Map<number, { name: string; color: string }>();
    activeAreas.forEach((a) => {
      if (a.id) areasMap.set(a.id, { name: a.name, color: a.color });
    });

    const completedThisWeek = allTasks.filter((t) => {
      if (t.status !== 'done' || !t.completedAt) return false;
      return new Date(t.completedAt).getTime() >= oneWeekAgoMs;
    });

    const completedPrevWeek = allTasks.filter((t) => {
      if (t.status !== 'done' || !t.completedAt) return false;
      const tm = new Date(t.completedAt).getTime();
      return tm >= twoWeeksAgoMs && tm < oneWeekAgoMs;
    });

    // Breakdown by area
    const areaCounts = new Map<number | null, number>();
    for (const t of completedThisWeek) {
      const aid = t.lifeAreaId ?? null;
      areaCounts.set(aid, (areaCounts.get(aid) || 0) + 1);
    }

    const byArea: AreaTaskCount[] = [];
    areaCounts.forEach((count, aid) => {
      const areaInfo = aid !== null ? areasMap.get(aid) : null;
      byArea.push({
        areaId: aid,
        areaName: areaInfo ? areaInfo.name : 'No Area',
        color: areaInfo ? areaInfo.color : 'var(--color-ink-muted)',
        count,
      });
    });
    byArea.sort((a, b) => b.count - a.count);

    // 3. Calendar events
    const allEvents = await db.events.toArray();
    const eventsThisWeek = allEvents.filter((e) => new Date(e.startAt).getTime() >= oneWeekAgoMs).length;
    const eventsPrevWeek = allEvents.filter((e) => {
      const tm = new Date(e.startAt).getTime();
      return tm >= twoWeeksAgoMs && tm < oneWeekAgoMs;
    }).length;

    // 4. Focus minutes
    const allSessions = await db.focusSessions.toArray();
    const focusThisWeek = allSessions
      .filter((s) => (!s.kind || s.kind === 'focus') && new Date(s.startedAt).getTime() >= oneWeekAgoMs)
      .reduce((sum, s) => sum + s.minutes, 0);

    const focusPrevWeek = allSessions
      .filter((s) => {
        const tm = new Date(s.startedAt).getTime();
        return (!s.kind || s.kind === 'focus') && tm >= twoWeeksAgoMs && tm < oneWeekAgoMs;
      })
      .reduce((sum, s) => sum + s.minutes, 0);

    // 5. Habit consistency (30d)
    const allHabits = await db.habits.where('archived').equals(0 as any).toArray();
    const allLogs = await db.habitLogs.toArray();
    const logsMap = new Set<string>();
    allLogs.forEach((l) => {
      if (l.done) logsMap.add(`${l.habitId}_${l.date}`);
    });

    let scheduledDaysCurrent = 0;
    let completedDaysCurrent = 0;
    let scheduledDaysPrev = 0;
    let completedDaysPrev = 0;

    for (const h of allHabits) {
      if (!h.id) continue;
      // 0 to 29 days ago (current 30d)
      for (let i = 0; i < 30; i++) {
        const d = addDays(referenceDate, -i);
        const dStr = toLocalDateStr(d);
        const isWk = d.getDay() !== 0 && d.getDay() !== 6;

        if (h.frequency === 'daily' || (h.frequency === 'weekdays' && isWk) ) {
          scheduledDaysCurrent++;
          if (logsMap.has(`${h.id}_${dStr}`)) completedDaysCurrent++;
        }
      }
      // 30 to 59 days ago (prev 30d)
      for (let i = 30; i < 60; i++) {
        const d = addDays(referenceDate, -i);
        const dStr = toLocalDateStr(d);
        const isWk = d.getDay() !== 0 && d.getDay() !== 6;

        if (h.frequency === 'daily' || (h.frequency === 'weekdays' && isWk) ) {
          scheduledDaysPrev++;
          if (logsMap.has(`${h.id}_${dStr}`)) completedDaysPrev++;
        }
      }
    }

    const currentConsistency = scheduledDaysCurrent > 0 ? Math.round((completedDaysCurrent / scheduledDaysCurrent) * 100) : 0;
    const prevConsistency = scheduledDaysPrev > 0 ? Math.round((completedDaysPrev / scheduledDaysPrev) * 100) : 0;

    // 6. Journal streak & entries
    const currentStreak = await notesRepo.getJournalStreak();
    const allJournalEntries = await db.notes.filter((n) => n.kind === 'journal' && n.trashedAt === null).toArray();
    const totalJournalEntries = allJournalEntries.length;

    return {
      date: todayStr,
      captures: computeDelta(currentCaptures, prevCaptures),
      tasksCompleted: {
        ...computeDelta(completedThisWeek.length, completedPrevWeek.length),
        byArea,
      },
      eventsCount: computeDelta(eventsThisWeek, eventsPrevWeek),
      focusMinutes: computeDelta(focusThisWeek, focusPrevWeek),
      habitConsistency: computeDelta(currentConsistency, prevConsistency),
      journalStreak: { current: currentStreak, totalEntries: totalJournalEntries },
    };
  },

  /**
   * Day-keyed memoized selector retrieving cached insights from appMeta or computing on date change.
   */
  async getInsights(referenceDate: Date = new Date(), forceRefresh = false): Promise<ComputedInsights> {
    const todayStr = toLocalDateStr(referenceDate);
    const cacheKey = `insights_cache_${todayStr}`;

    if (!forceRefresh) {
      try {
        const cached = await db.appMeta.get(cacheKey);
        if (cached && cached.value) {
          return cached.value as ComputedInsights;
        }
      } catch (e) {
        console.debug('Failed to read insights cache:', e);
      }
    }

    // Compute fresh
    const computed = await this.calculateInsights(referenceDate);

    // Save to cache
    try {
      await db.appMeta.put({
        key: cacheKey,
        value: computed,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.debug('Failed to write insights cache:', e);
    }

    return computed;
  },
};
