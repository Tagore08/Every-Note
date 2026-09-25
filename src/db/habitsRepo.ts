import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import type {
  Habit,
  HabitLog,
  HabitFrequency,
  HabitTimeOfDay,
  HabitStreakResult,
  HabitWithStats,
} from '../types/habit';

/**
 * Format a Date object as 'YYYY-MM-DD' in local time.
 */
export function toLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse a 'YYYY-MM-DD' string into a local Date object.
 */
export function parseLocalDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Add N days to a Date object without mutating it.
 */
export function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
}

/**
 * Returns true if the date is Monday through Friday.
 */
export function isWeekday(d: Date): boolean {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

/**
 * Returns the Monday date of the week containing date `d`.
 */
export function getMondayOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay(); // 0 is Sun, 1 is Mon...
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

/**
 * STREAK CALCULATION ENGINE
 *
 * Computes currentStreak and bestStreak for a habit based on frequency:
 * - 'daily': Consecutive calendar days done. Today counts if done; if today is
 *   not yet done, the streak continues from yesterday's completion.
 * - 'weekdays': Consecutive weekdays (Mon-Fri) done. Weekends (Sat/Sun) do not
 *   break streaks nor are they required.
 * - 'weekly': Consecutive weeks meeting targetDaysPerWeek (Mon-Sun). If the
 *   current week has not yet met the target, the streak stays intact based on
 *   the previous week's success.
 */
export function calculateHabitStreaks(
  habitOrFreq: Habit | HabitFrequency | 'weekly_target',
  logs: HabitLog[],
  todayStr: string = toLocalDateStr(),
  targetDaysPerWeekArg?: number
): HabitStreakResult {
  const frequency: HabitFrequency = typeof habitOrFreq === 'string'
    ? (habitOrFreq === 'weekly_target' ? 'weekly' : habitOrFreq)
    : habitOrFreq.frequency;
  const targetDaysSetting = typeof habitOrFreq === 'object'
    ? habitOrFreq.targetDaysPerWeek
    : targetDaysPerWeekArg;
  // Collect all distinct dates where done === true
  const doneDates = new Set<string>();
  for (const log of logs) {
    if (log.done) {
      doneDates.add(log.date);
    }
  }

  if (doneDates.size === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  const today = parseLocalDateStr(todayStr);

  // -------------------------------------------------------------
  // 1. DAILY FREQUENCY
  // -------------------------------------------------------------
  if (frequency === 'daily') {
    // Current streak
    let currentStreak = 0;
    if (doneDates.has(todayStr)) {
      currentStreak = 1;
      let checkDate = addDays(today, -1);
      while (doneDates.has(toLocalDateStr(checkDate))) {
        currentStreak++;
        checkDate = addDays(checkDate, -1);
      }
    } else {
      // Today is not done yet. Check if yesterday was completed.
      const yesterday = addDays(today, -1);
      if (doneDates.has(toLocalDateStr(yesterday))) {
        currentStreak = 1;
        let checkDate = addDays(yesterday, -1);
        while (doneDates.has(toLocalDateStr(checkDate))) {
          currentStreak++;
          checkDate = addDays(checkDate, -1);
        }
      }
    }

    // Best streak: find maximum consecutive run across all logged days up to today
    const sortedDates = Array.from(doneDates).sort();
    const earliest = parseLocalDateStr(sortedDates[0]);
    let bestStreak = 0;
    let run = 0;
    let cursor = earliest;

    while (cursor <= today) {
      const cStr = toLocalDateStr(cursor);
      if (doneDates.has(cStr)) {
        run++;
        if (run > bestStreak) bestStreak = run;
      } else {
        run = 0;
      }
      cursor = addDays(cursor, 1);
    }

    bestStreak = Math.max(bestStreak, currentStreak);
    return { currentStreak, bestStreak };
  }

  // -------------------------------------------------------------
  // 2. WEEKDAYS FREQUENCY (Mon-Fri)
  // -------------------------------------------------------------
  if (frequency === 'weekdays') {
    // Current streak
    let currentStreak = 0;

    if (isWeekday(today)) {
      if (doneDates.has(todayStr)) {
        currentStreak = 1;
        let checkDate = addDays(today, -1);
        while (true) {
          if (isWeekday(checkDate)) {
            if (doneDates.has(toLocalDateStr(checkDate))) {
              currentStreak++;
            } else {
              break;
            }
          }
          checkDate = addDays(checkDate, -1);
        }
      } else {
        // Today is not done yet: find previous weekday
        let prevWeekday = addDays(today, -1);
        while (!isWeekday(prevWeekday)) {
          prevWeekday = addDays(prevWeekday, -1);
        }
        if (doneDates.has(toLocalDateStr(prevWeekday))) {
          currentStreak = 1;
          let checkDate = addDays(prevWeekday, -1);
          while (true) {
            if (isWeekday(checkDate)) {
              if (doneDates.has(toLocalDateStr(checkDate))) {
                currentStreak++;
              } else {
                break;
              }
            }
            checkDate = addDays(checkDate, -1);
          }
        }
      }
    } else {
      // Today is a weekend (Sat or Sun): check Friday (most recent weekday)
      let lastFriday = addDays(today, -1);
      while (!isWeekday(lastFriday)) {
        lastFriday = addDays(lastFriday, -1);
      }
      if (doneDates.has(toLocalDateStr(lastFriday))) {
        currentStreak = 1;
        let checkDate = addDays(lastFriday, -1);
        while (true) {
          if (isWeekday(checkDate)) {
            if (doneDates.has(toLocalDateStr(checkDate))) {
              currentStreak++;
            } else {
              break;
            }
          }
          checkDate = addDays(checkDate, -1);
        }
      }
    }

    // Best streak: scan all weekdays from earliest done date to today
    const sortedDates = Array.from(doneDates).sort();
    const earliest = parseLocalDateStr(sortedDates[0]);
    let bestStreak = 0;
    let run = 0;
    let cursor = earliest;

    while (cursor <= today) {
      if (isWeekday(cursor)) {
        const cStr = toLocalDateStr(cursor);
        if (doneDates.has(cStr)) {
          run++;
          if (run > bestStreak) bestStreak = run;
        } else {
          run = 0;
        }
      }
      cursor = addDays(cursor, 1);
    }

    bestStreak = Math.max(bestStreak, currentStreak);
    return { currentStreak, bestStreak };
  }

  // -------------------------------------------------------------
  // 3. WEEKLY FREQUENCY (Target days per week, Mon-Sun)
  // -------------------------------------------------------------
  if (frequency === 'weekly' || (frequency as string) === 'weekly_target') {
    const targetDays =
      targetDaysSetting && targetDaysSetting >= 1 && targetDaysSetting <= 7 ? targetDaysSetting
        : 3;

  // Group done dates by Monday of their week
  const weekDoneCount = new Map<string, number>();
  for (const dStr of doneDates) {
    const monday = getMondayOfWeek(parseLocalDateStr(dStr));
    const mStr = toLocalDateStr(monday);
    weekDoneCount.set(mStr, (weekDoneCount.get(mStr) || 0) + 1);
  }

  const thisMonday = getMondayOfWeek(today);
  const thisMondayStr = toLocalDateStr(thisMonday);
  const currentWeekDone = weekDoneCount.get(thisMondayStr) || 0;

  // Current streak
  let currentStreak = 0;
  if (currentWeekDone >= targetDays) {
    currentStreak = 1;
    let prevMonday = addDays(thisMonday, -7);
    while ((weekDoneCount.get(toLocalDateStr(prevMonday)) || 0) >= targetDays) {
      currentStreak++;
      prevMonday = addDays(prevMonday, -7);
    }
  } else {
    // Current week not yet completed: check if previous week met target
    const prevMonday = addDays(thisMonday, -7);
    if ((weekDoneCount.get(toLocalDateStr(prevMonday)) || 0) >= targetDays) {
      currentStreak = 1;
      let checkMonday = addDays(prevMonday, -7);
      while ((weekDoneCount.get(toLocalDateStr(checkMonday)) || 0) >= targetDays) {
        currentStreak++;
        checkMonday = addDays(checkMonday, -7);
      }
    }
  }

  // Best streak: scan week by week from earliest week to this week
  const sortedDates = Array.from(doneDates).sort();
  const earliestMonday = getMondayOfWeek(parseLocalDateStr(sortedDates[0]));
  let bestStreak = 0;
  let run = 0;
  let cursorMonday = earliestMonday;

  while (cursorMonday <= thisMonday) {
    const mStr = toLocalDateStr(cursorMonday);
    const count = weekDoneCount.get(mStr) || 0;
    if (count >= targetDays) {
      run++;
      if (run > bestStreak) bestStreak = run;
    } else {
      run = 0;
    }
    cursorMonday = addDays(cursorMonday, 7);
  }

    bestStreak = Math.max(bestStreak, currentStreak);
    return { currentStreak, bestStreak };
  }

  // -------------------------------------------------------------
  // 4. CUSTOM DAYS FREQUENCY
  // -------------------------------------------------------------
  if (frequency === 'custom') {
    const customDaysArr = (typeof habitOrFreq === 'object' && Array.isArray(habitOrFreq.customDays) && habitOrFreq.customDays.length > 0)
      ? habitOrFreq.customDays
      : [1, 2, 3, 4, 5];
    const customDaysSet = new Set(customDaysArr);
    const isCustomDay = (d: Date) => customDaysSet.has(d.getDay());

    let currentStreak = 0;

    if (isCustomDay(today)) {
      if (doneDates.has(todayStr)) {
        currentStreak = 1;
        let checkDate = addDays(today, -1);
        while (true) {
          if (isCustomDay(checkDate)) {
            if (doneDates.has(toLocalDateStr(checkDate))) {
              currentStreak++;
            } else {
              break;
            }
          }
          checkDate = addDays(checkDate, -1);
        }
      } else {
        let prevDay = addDays(today, -1);
        while (!isCustomDay(prevDay)) {
          prevDay = addDays(prevDay, -1);
        }
        if (doneDates.has(toLocalDateStr(prevDay))) {
          currentStreak = 1;
          let checkDate = addDays(prevDay, -1);
          while (true) {
            if (isCustomDay(checkDate)) {
              if (doneDates.has(toLocalDateStr(checkDate))) {
                currentStreak++;
              } else {
                break;
              }
            }
            checkDate = addDays(checkDate, -1);
          }
        }
      }
    } else {
      let lastScheduled = addDays(today, -1);
      while (!isCustomDay(lastScheduled)) {
        lastScheduled = addDays(lastScheduled, -1);
      }
      if (doneDates.has(toLocalDateStr(lastScheduled))) {
        currentStreak = 1;
        let checkDate = addDays(lastScheduled, -1);
        while (true) {
          if (isCustomDay(checkDate)) {
            if (doneDates.has(toLocalDateStr(checkDate))) {
              currentStreak++;
            } else {
              break;
            }
          }
          checkDate = addDays(checkDate, -1);
        }
      }
    }

    const sortedDates = Array.from(doneDates).sort();
    const earliest = parseLocalDateStr(sortedDates[0]);
    let bestStreak = 0;
    let run = 0;
    let cursor = earliest;

    while (cursor <= today) {
      if (isCustomDay(cursor)) {
        const cStr = toLocalDateStr(cursor);
        if (doneDates.has(cStr)) {
          run++;
          if (run > bestStreak) bestStreak = run;
        } else {
          run = 0;
        }
      }
      cursor = addDays(cursor, 1);
    }

    bestStreak = Math.max(bestStreak, currentStreak);
    return { currentStreak, bestStreak };
  }

  return { currentStreak: 0, bestStreak: 0 };
}

/**
 * Generates the last 30 days grid ending today.
 */
export function generateLast30Days(
  doneDates: Set<string>,
  todayStr: string = toLocalDateStr()
): Array<{ date: string; done: boolean; isToday: boolean; isFuture: boolean }> {
  const today = parseLocalDateStr(todayStr);
  const result: Array<{ date: string; done: boolean; isToday: boolean; isFuture: boolean }> = [];

  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    const dStr = toLocalDateStr(d);
    result.push({
      date: dStr,
      done: doneDates.has(dStr),
      isToday: dStr === todayStr,
      isFuture: false,
    });
  }

  return result;
}

export const habitsRepo = {
  /**
   * Create a new habit.
   */
  async createHabit(draft: {
    name: string;
    iconOrEmoji?: string;
    frequency: HabitFrequency;
    targetDaysPerWeek?: number;
    customDays?: number[];
    timeOfDay?: HabitTimeOfDay;
    reminderAt?: string | null;
  }): Promise<Habit> {
    const now = new Date();
    const newHabit: Habit = {
      name: draft.name.trim(),
      iconOrEmoji: draft.iconOrEmoji?.trim() || '🎯',
      frequency: draft.frequency,
      targetDaysPerWeek:
        draft.frequency === 'weekly' ? Math.max(1, Math.min(7, draft.targetDaysPerWeek || 3)) : undefined,
      customDays:
        draft.frequency === 'custom' ? (draft.customDays && draft.customDays.length > 0 ? draft.customDays : [1, 2, 3, 4, 5]) : undefined,
      timeOfDay: draft.timeOfDay || 'anytime',
      reminderAt: draft.reminderAt || null,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };

    const id = await db.habits.add(newHabit);
    return { ...newHabit, id: Number(id) };
  },

  /**
   * Fetch a habit by ID.
   */
  async getHabitById(id: number): Promise<Habit | undefined> {
    return await db.habits.get(id);
  },

  /**
   * Update fields on an existing habit.
   */
  async updateHabit(
    id: number,
    changes: Partial<Omit<Habit, 'id' | 'createdAt'>>
  ): Promise<void> {
    await db.habits.update(id, {
      ...changes,
      updatedAt: new Date(),
    });
  },

  /**
   * Archive a habit (hides from main screen but retains all logs).
   */
  async archiveHabit(id: number): Promise<void> {
    await db.habits.update(id, {
      archived: true,
      updatedAt: new Date(),
    });
  },

  /**
   * Unarchive a habit.
   */
  async unarchiveHabit(id: number): Promise<void> {
    await db.habits.update(id, {
      archived: false,
      updatedAt: new Date(),
    });
  },

  /**
   * Permanently delete a habit and all of its historical logs.
   */
  async deleteHabit(id: number): Promise<void> {
    await db.transaction('rw', db.habits, db.habitLogs, async () => {
      await db.habitLogs.where('habitId').equals(id).delete();
      await db.habits.delete(id);
    });
  },

  /**
   * Retrieves any routines that reference this habit.
   */
  async getRoutinesReferencingHabit(habitId: number): Promise<any[]> {
    try {
      const routines = await db.routines.toArray();
      return routines.filter((r) =>
        r.items && r.items.some((it: any) => it.kind === 'habit' && it.refId === habitId)
      );
    } catch {
      return [];
    }
  },

  /**
   * Toggle today's completion status for a habit.
   * Returns the new done state (boolean).
   */
  async toggleHabitToday(habitId: number): Promise<boolean> {
    const todayStr = toLocalDateStr();
    return await this.toggleHabitDate(habitId, todayStr);
  },

  /**
   * Toggle completion status for a specific date.
   */
  async toggleHabitDate(habitId: number, dateStr: string): Promise<boolean> {
    const existing = await db.habitLogs
      .where({ habitId, date: dateStr })
      .first();

    if (existing && existing.id) {
      const nextDone = !existing.done;
      await db.habitLogs.update(existing.id, {
        done: nextDone,
      });
      return nextDone;
    } else {
      await db.habitLogs.add({
        habitId,
        date: dateStr,
        done: true,
        createdAt: new Date(),
      });
      return true;
    }
  },

  /**
   * Set completion status explicitly for a specific date (used for undo).
   */
  async setHabitDone(habitId: number, dateStr: string, done: boolean): Promise<void> {
    const existing = await db.habitLogs
      .where({ habitId, date: dateStr })
      .first();

    if (existing && existing.id) {
      await db.habitLogs.update(existing.id, { done });
    } else if (done) {
      await db.habitLogs.add({
        habitId,
        date: dateStr,
        done: true,
        createdAt: new Date(),
      });
    }
  },

  /**
   * Get all habits for export.
   */
  async getAllHabitsForExport(): Promise<Habit[]> {
    return await db.habits.toArray();
  },

  /**
   * Get all habit logs for export.
   */
  async getAllHabitLogsForExport(): Promise<HabitLog[]> {
    return await db.habitLogs.toArray();
  },

  /**
   * Import habits and logs.
   */
  async importHabits(
    habits: Habit[],
    logs: HabitLog[],
    strategy: 'merge' | 'replace'
  ): Promise<{ habitsCount: number; logsCount: number }> {
    return await db.transaction('rw', db.habits, db.habitLogs, async () => {
      if (strategy === 'replace') {
        await db.habits.clear();
        await db.habitLogs.clear();
      }

      // Track mapped IDs if merging with new IDs
      const idMap = new Map<number, number>();

      let habitsCount = 0;
      for (const h of habits) {
        const item: Habit = {
          ...h,
          createdAt: h.createdAt ? new Date(h.createdAt) : new Date(),
          updatedAt: h.updatedAt ? new Date(h.updatedAt) : new Date(),
        };

        if (strategy === 'replace' && typeof item.id === 'number') {
          await db.habits.put(item);
          habitsCount++;
        } else {
          const oldId = item.id;
          delete item.id;
          const newId = await db.habits.add(item);
          if (oldId !== undefined) {
            idMap.set(oldId, Number(newId));
          }
          habitsCount++;
        }
      }

      let logsCount = 0;
      for (const l of logs) {
        const targetHabitId =
          strategy === 'replace' ? l.habitId : idMap.get(l.habitId) ?? l.habitId;

        const logItem: HabitLog = {
          ...l,
          habitId: targetHabitId,
          createdAt: l.createdAt ? new Date(l.createdAt) : new Date(),
        };

        if (strategy === 'replace' && typeof logItem.id === 'number') {
          await db.habitLogs.put(logItem);
          logsCount++;
        } else {
          delete logItem.id;
          // Avoid duplicate log for same [habitId+date]
          const existing = await db.habitLogs
            .where({ habitId: targetHabitId, date: logItem.date })
            .first();
          if (!existing) {
            await db.habitLogs.add(logItem);
            logsCount++;
          }
        }
      }

      return { habitsCount, logsCount };
    });
  },

  /**
   * Wipe all habits and logs (Danger Zone).
   */
  async deleteAllHabits(): Promise<void> {
    await db.transaction('rw', db.habits, db.habitLogs, async () => {
      await db.habitLogs.clear();
      await db.habits.clear();
    });
  },

  /**
   * Get active habits with reminder times for background notification scheduler.
   */
  async getActiveHabitsWithReminders(): Promise<Habit[]> {
    const habits = await db.habits.filter((h) => !h.archived && !!h.reminderAt).toArray();
    return habits;
  },

  /**
   * Pure selector / query: get comprehensive analytics for a single habit.
   */
  async getHabitAnalytics(habitId: number): Promise<HabitAnalytics | null> {
    const habit = await db.habits.get(habitId);
    if (!habit) return null;

    const logs = await db.habitLogs.where('habitId').equals(habitId).toArray();
    const doneLogs = logs.filter((l) => l.done);
    const doneDates = new Set<string>(doneLogs.map((l) => l.date));
    const todayStr = toLocalDateStr();
    const today = parseLocalDateStr(todayStr);

    const { currentStreak, bestStreak } = calculateHabitStreaks(habit, logs, todayStr);

    // 1. Total completions
    const totalCompletions = doneDates.size;

    // 2. 30-day completion percentage
    let targetDays30d = 30;
    let actualDays30d = 0;

    if (habit.frequency === 'weekdays') {
      let weekdaysCount = 0;
      for (let i = 0; i < 30; i++) {
        const d = addDays(today, -i);
        if (isWeekday(d)) {
          weekdaysCount++;
          if (doneDates.has(toLocalDateStr(d))) {
            actualDays30d++;
          }
        }
      }
      targetDays30d = weekdaysCount || 1;
    } else if (habit.frequency === 'weekly') {
      const targetWeekly = habit.targetDaysPerWeek || 3;
      targetDays30d = Math.round(targetWeekly * (30 / 7));
      for (let i = 0; i < 30; i++) {
        const d = addDays(today, -i);
        if (doneDates.has(toLocalDateStr(d))) {
          actualDays30d++;
        }
      }
    } else {
      // Daily
      targetDays30d = 30;
      for (let i = 0; i < 30; i++) {
        const d = addDays(today, -i);
        if (doneDates.has(toLocalDateStr(d))) {
          actualDays30d++;
        }
      }
    }

    const completionRate30d = Math.min(100, Math.round((actualDays30d / targetDays30d) * 100));

    // 3. 8-week trend sparkline
    const sparkline8Weeks: Array<{
      weekLabel: string;
      count: number;
      target: number;
      percentage: number;
    }> = [];

    const thisMonday = getMondayOfWeek(today);
    const weeklyTarget =
      habit.frequency === 'weekly'
        ? habit.targetDaysPerWeek || 3
        : habit.frequency === 'weekdays'
        ? 5
        : 7;

    for (let w = 7; w >= 0; w--) {
      const monday = addDays(thisMonday, -w * 7);
      let count = 0;

      for (let d = 0; d < 7; d++) {
        const curDay = addDays(monday, d);
        if (habit.frequency === 'weekdays' && !isWeekday(curDay)) {
          continue;
        }
        if (doneDates.has(toLocalDateStr(curDay))) {
          count++;
        }
      }

      const percentage = Math.min(100, Math.round((count / weeklyTarget) * 100));
      const weekLabel = `${monday.getMonth() + 1}/${monday.getDate()}`;

      sparkline8Weeks.push({
        weekLabel,
        count,
        target: weeklyTarget,
        percentage,
      });
    }

    // 4. 12-month Heatmap (last 365 days / 52 weeks)
    const heatmapData = new Map<string, { date: string; level: 0 | 1 | 2 | 3 | 4; label?: string }>();
    const totalDays = 52 * 7;
    const startDay = addDays(today, -totalDays);

    for (let i = 0; i <= totalDays; i++) {
      const cur = addDays(startDay, i);
      const dStr = toLocalDateStr(cur);
      const isDone = doneDates.has(dStr);

      heatmapData.set(dStr, {
        date: dStr,
        level: isDone ? 4 : 0,
        label: isDone ? 'Completed' : 'Missed',
      });
    }

    return {
      habit,
      totalCompletions,
      currentStreak,
      bestStreak,
      completionRate30d,
      sparkline8Weeks,
      heatmapData,
    };
  },

  calculateHabitStreaks,
};

export interface HabitAnalytics {
  habit: Habit;
  totalCompletions: number;
  currentStreak: number;
  bestStreak: number;
  completionRate30d: number;
  sparkline8Weeks: Array<{
    weekLabel: string;
    count: number;
    target: number;
    percentage: number;
  }>;
  heatmapData: Map<string, { date: string; level: 0 | 1 | 2 | 3 | 4; label?: string }>;
}

/**
 * Reactive hook: get analytics for a specific habit.
 */
export function useHabitAnalytics(habitId: number | null): {
  analytics: HabitAnalytics | null;
  isLoading: boolean;
} {
  const result = useLiveQuery(
    async () => {
      if (!habitId) return null;
      return await habitsRepo.getHabitAnalytics(habitId);
    },
    [habitId],
    null
  );

  return {
    analytics: result,
    isLoading: result === null && !!habitId,
  };
}

/**
 * Reactive hook: get all habits with calculated streak stats and last-30-days grid.
 */
export function useHabitsWithStats(): {
  activeHabits: HabitWithStats[];
  archivedHabits: HabitWithStats[];
  totalActive: number;
  completedTodayCount: number;
} {
  const result = useLiveQuery(
    async () => {
      const allHabits = await db.habits.toArray();
      const allLogs = await db.habitLogs.toArray();

      const todayStr = toLocalDateStr();

      // Group logs by habitId
      const logsByHabit = new Map<number, HabitLog[]>();
      for (const log of allLogs) {
        const arr = logsByHabit.get(log.habitId) || [];
        arr.push(log);
        logsByHabit.set(log.habitId, arr);
      }

      const activeList: HabitWithStats[] = [];
      const archivedList: HabitWithStats[] = [];
      let completedToday = 0;

      for (const habit of allHabits) {
        if (!habit.id) continue;
        const habitLogs = logsByHabit.get(habit.id) || [];

        // Check if done today & map all logs
        const doneDates = new Set<string>();
        const logsMap: Record<string, boolean> = {};
        for (const log of habitLogs) {
          if (log.done) {
            doneDates.add(log.date);
            logsMap[log.date] = true;
          }
        }
        const isDoneToday = doneDates.has(todayStr);

        // Streaks
        const { currentStreak, bestStreak } = calculateHabitStreaks(habit, habitLogs, todayStr);

        // Last 30 days grid
        const last30Days = generateLast30Days(doneDates, todayStr);

        const habitWithStats: HabitWithStats = {
          ...habit,
          isDoneToday,
          currentStreak,
          bestStreak,
          last30Days,
          logsMap,
        };

        if (habit.archived) {
          archivedList.push(habitWithStats);
        } else {
          activeList.push(habitWithStats);
          if (isDoneToday) {
            completedToday++;
          }
        }
      }

      // Sort active by createdAt ascending (custom consistent order)
      activeList.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      archivedList.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      return {
        activeHabits: activeList,
        archivedHabits: archivedList,
        totalActive: activeList.length,
        completedTodayCount: completedToday,
      };
    },
    [],
    {
      activeHabits: [],
      archivedHabits: [],
      totalActive: 0,
      completedTodayCount: 0,
    }
  );

  return (
    result ?? {
      activeHabits: [],
      archivedHabits: [],
      totalActive: 0,
      completedTodayCount: 0,
    }
  );
}

/**
 * Reactive hook: summary of today's habits for UpcomingView and top headers.
 */
export function useHabitsTodaySummary(): {
  total: number;
  completed: number;
  allDone: boolean;
} {
  const result = useLiveQuery(
    async () => {
      const activeHabits = await db.habits.filter((h) => !h.archived).toArray();
      if (activeHabits.length === 0) {
        return { total: 0, completed: 0, allDone: false };
      }

      const todayStr = toLocalDateStr();
      const todayLogs = await db.habitLogs
        .where('date')
        .equals(todayStr)
        .filter((l) => l.done)
        .toArray();

      const doneHabitIds = new Set(todayLogs.map((l) => l.habitId));
      let completedCount = 0;

      for (const h of activeHabits) {
        if (h.id && doneHabitIds.has(h.id)) {
          completedCount++;
        }
      }

      return {
        total: activeHabits.length,
        completed: completedCount,
        allDone: activeHabits.length > 0 && completedCount === activeHabits.length,
      };
    },
    [],
    { total: 0, completed: 0, allDone: false }
  );

  return result ?? { total: 0, completed: 0, allDone: false };
}
