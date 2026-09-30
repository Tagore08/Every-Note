import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../db/database';
import { insightsRepo, computeDelta } from '../../db/repos/insightsRepo';
import type { Note } from '../../types/note';
import type { Task } from '../../types/task';

describe('Insights Selectors & Aggregation Integration', () => {
  beforeEach(async () => {
    await db.notes.clear();
    await db.tasks.clear();
    await db.events.clear();
    await db.habits.clear();
    await db.habitLogs.clear();
    await db.focusSessions.clear();
  });

  describe('computeDelta', () => {
    it('computes positive delta with up direction', () => {
      const res = computeDelta(15, 10);
      expect(res.current).toBe(15);
      expect(res.previous).toBe(10);
      expect(res.change).toBe(5);
      expect(res.direction).toBe('up');
    });

    it('computes negative delta with down direction', () => {
      const res = computeDelta(8, 12);
      expect(res.current).toBe(8);
      expect(res.previous).toBe(12);
      expect(res.change).toBe(-4);
      expect(res.direction).toBe('down');
    });

    it('computes equal delta with flat direction', () => {
      const res = computeDelta(20, 20);
      expect(res.change).toBe(0);
      expect(res.direction).toBe('flat');
    });
  });

  describe('calculateInsights Integration', () => {
    it('returns zeroed baselines gracefully on empty database', async () => {
      const insights = await insightsRepo.calculateInsights(new Date());
      expect(insights.captures.current).toBe(0);
      expect(insights.captures.previous).toBe(0);
      expect(insights.captures.direction).toBe('flat');
      expect(insights.tasksCompleted.current).toBe(0);
      expect(insights.tasksCompleted.byArea).toEqual([]);
      expect(insights.eventsCount.current).toBe(0);
      expect(insights.focusMinutes.current).toBe(0);
    });

    it('aggregates captures and ranks completed tasks by tag descending', async () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

      // Seed notes (2 this week, 1 previous week)
      await db.notes.bulkAdd([
        {
          title: 'Note 1',
          content: 'C1',
          tags: ['work'],
          createdAt: threeDaysAgo,
          updatedAt: threeDaysAgo,
        } as unknown as Note,
        {
          title: 'Note 2',
          content: 'C2',
          tags: ['personal'],
          createdAt: now,
          updatedAt: now,
        } as unknown as Note,
        {
          title: 'Note 3',
          content: 'C3',
          tags: ['work'],
          createdAt: tenDaysAgo,
          updatedAt: tenDaysAgo,
        } as unknown as Note,
      ]);

      // Seed completed tasks with tags this week
      await db.tasks.bulkAdd([
        {
          title: 'T1',
          status: 'done',
          tags: ['work'],
          createdAt: threeDaysAgo,
          completedAt: threeDaysAgo,
          updatedAt: threeDaysAgo,
        } as unknown as Task,
        {
          title: 'T2',
          status: 'done',
          tags: ['work'],
          createdAt: now,
          completedAt: now,
          updatedAt: now,
        } as unknown as Task,
        {
          title: 'T3',
          status: 'done',
          tags: ['health'],
          createdAt: now,
          completedAt: now,
          updatedAt: now,
        } as unknown as Task,
      ]);

      const insights = await insightsRepo.calculateInsights(now);

      // Captures: 2 notes + 3 tasks = 5 this week, 1 note = 1 last week
      expect(insights.captures.current).toBe(5);
      expect(insights.captures.previous).toBe(1);
      expect(insights.captures.change).toBe(4);
      expect(insights.captures.direction).toBe('up');

      // Completed tasks
      expect(insights.tasksCompleted.current).toBe(3);
      expect(insights.tasksCompleted.direction).toBe('up');

      // byArea: 'work' (2) should rank before 'health' (1)
      expect(insights.tasksCompleted.byArea).toHaveLength(2);
      expect(insights.tasksCompleted.byArea[0].areaName).toBe('work');
      expect(insights.tasksCompleted.byArea[0].count).toBe(2);
      expect(insights.tasksCompleted.byArea[1].areaName).toBe('health');
      expect(insights.tasksCompleted.byArea[1].count).toBe(1);
    });
  });
});
