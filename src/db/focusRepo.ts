import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import type { FocusSession, FocusSessionKind } from '../types/focus';

export interface FocusSessionWithTask extends FocusSession {
  taskTitle?: string;
  presetName?: string;
}

export interface DayFocusStat {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Mon", "Tue", etc.
  minutes: number;
}

export interface WeeklyFocusStats {
  days: DayFocusStat[];
  totalMinutes: number;
  dailyAverageMinutes: number;
}

export const focusRepo = {
  /**
   * Log a completed focus session.
   */
  async logFocusSession(draft: {
    startedAt: Date;
    minutes: number;
    taskId?: number | null;
    presetId?: number | null;
    kind?: FocusSessionKind;
  }): Promise<FocusSession> {
    const now = new Date();
    const session: FocusSession = {
      startedAt: new Date(draft.startedAt),
      minutes: Math.max(1, Math.round(draft.minutes)),
      taskId: typeof draft.taskId === 'number' ? draft.taskId : null,
      presetId: typeof draft.presetId === 'number' ? draft.presetId : null,
      kind: draft.kind || 'focus',
      createdAt: now,
    };

    const id = await db.focusSessions.add(session);
    return { ...session, id: Number(id) };
  },

  /**
   * Get daily focus minutes for the last N days (default 7).
   */
  async getWeeklyFocusStats(daysCount = 7): Promise<WeeklyFocusStats> {
    const all = await db.focusSessions.toArray();
    const focusOnly = all.filter((s) => !s.kind || s.kind === 'focus');

    const resultDays: DayFocusStat[] = [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayLabel = dayLabels[d.getDay()];

      const dayMinutes = focusOnly
        .filter((s) => {
          const sDate = new Date(s.startedAt);
          const sYear = sDate.getFullYear();
          const sMonth = String(sDate.getMonth() + 1).padStart(2, '0');
          const sDay = String(sDate.getDate()).padStart(2, '0');
          return `${sYear}-${sMonth}-${sDay}` === dateStr;
        })
        .reduce((sum, s) => sum + s.minutes, 0);

      resultDays.push({
        date: dateStr,
        dayLabel,
        minutes: dayMinutes,
      });
    }

    const totalMinutes = resultDays.reduce((sum, d) => sum + d.minutes, 0);
    const dailyAverageMinutes = Math.round(totalMinutes / (daysCount || 1));

    return {
      days: resultDays,
      totalMinutes,
      dailyAverageMinutes,
    };
  },

  /**
   * Get the most recent focus sessions (default last 20).
   */
  async getRecentSessions(limit = 20): Promise<FocusSession[]> {
    const all = await db.focusSessions.toArray();
    return all
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
  },

  /**
   * Delete a focus session by ID.
   */
  async deleteSession(id: number): Promise<void> {
    await db.focusSessions.delete(id);
  },

  /**
   * Export all focus sessions.
   */
  async getAllSessionsForExport(): Promise<FocusSession[]> {
    return await db.focusSessions.toArray();
  },

  /**
   * Import focus sessions from backup.
   */
  async importSessions(
    sessions: FocusSession[],
    strategy: 'merge' | 'replace'
  ): Promise<number> {
    return await db.transaction('rw', db.focusSessions, async () => {
      if (strategy === 'replace') {
        await db.focusSessions.clear();
      }

      let count = 0;
      for (const s of sessions) {
        const item: FocusSession = {
          ...s,
          startedAt: s.startedAt ? new Date(s.startedAt) : new Date(),
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        };

        if (strategy === 'replace' && typeof item.id === 'number') {
          await db.focusSessions.put(item);
          count++;
        } else {
          delete item.id;
          await db.focusSessions.add(item);
          count++;
        }
      }
      return count;
    });
  },

  /**
   * Wipe all focus sessions (Danger Zone).
   */
  async deleteAllSessions(): Promise<void> {
    await db.focusSessions.clear();
  },
};

/**
 * Reactive hook: get recent focus sessions with enriched task title.
 */
export function useRecentFocusSessions(limit = 20): FocusSessionWithTask[] {
  const result = useLiveQuery(
    async () => {
      const all = await db.focusSessions.toArray();
      const sorted = all
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, limit);

      // Collect task IDs to resolve titles in one pass
      const taskIds = Array.from(
        new Set(sorted.map((s) => s.taskId).filter((id): id is number => typeof id === 'number'))
      );

      const taskTitleMap = new Map<number, string>();
      if (taskIds.length > 0) {
        const tasks = await db.tasks.where('id').anyOf(taskIds).toArray();
        for (const t of tasks) {
          if (t.id) taskTitleMap.set(t.id, t.title);
        }
      }

      // Collect preset IDs to resolve names in one pass
      const presetIds = Array.from(
        new Set(
          sorted
            .map((s) => s.presetId)
            .filter((id): id is number => typeof id === 'number')
        )
      );

      const presetNameMap = new Map<number, string>();
      if (presetIds.length > 0) {
        const presets = await db.timerPresets.where('id').anyOf(presetIds).toArray();
        for (const p of presets) {
          if (p.id) presetNameMap.set(p.id, p.name);
        }
      }

      return sorted.map((s) => ({
        ...s,
        taskTitle: s.taskId ? taskTitleMap.get(s.taskId) : undefined,
        presetName: s.presetId ? presetNameMap.get(s.presetId) : undefined,
      }));
    },
    [limit],
    []
  );

  return result ?? [];
}

/**
 * Reactive hook: get weekly focus statistics.
 */
export function useWeeklyFocusStats(daysCount = 7): WeeklyFocusStats {
  const result = useLiveQuery(
    async () => {
      return await focusRepo.getWeeklyFocusStats(daysCount);
    },
    [daysCount],
    {
      days: [],
      totalMinutes: 0,
      dailyAverageMinutes: 0,
    }
  );

  return (
    result ?? {
      days: [],
      totalMinutes: 0,
      dailyAverageMinutes: 0,
    }
  );
}
