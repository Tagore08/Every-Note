import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import type { FocusSession } from '../types/focus';

export interface FocusSessionWithTask extends FocusSession {
  taskTitle?: string;
}

export const focusRepo = {
  /**
   * Log a completed focus session.
   */
  async logFocusSession(draft: {
    startedAt: Date;
    minutes: number;
    taskId?: number | null;
  }): Promise<FocusSession> {
    const now = new Date();
    const session: FocusSession = {
      startedAt: new Date(draft.startedAt),
      minutes: Math.max(1, Math.round(draft.minutes)),
      taskId: typeof draft.taskId === 'number' ? draft.taskId : null,
      createdAt: now,
    };

    const id = await db.focusSessions.add(session);
    return { ...session, id: Number(id) };
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

      return sorted.map((s) => ({
        ...s,
        taskTitle: s.taskId ? taskTitleMap.get(s.taskId) : undefined,
      }));
    },
    [limit],
    []
  );

  return result ?? [];
}
