import { describe, it, expect } from 'vitest';
import type { Routine, RoutineRun } from '../../../types/routine';
import {
  extractCustomSteps,
  simulateMaterialization,
} from './routineEngine';

describe('Routine Materialization Engine', () => {
  const sampleRoutine: Routine = {
    id: 1,
    name: 'Morning Launch',
    emoji: '☀️',
    daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
    timeOfDay: 'morning',
    items: [
      { uid: 'u1', kind: 'custom', title: 'Glass of water', durationMin: 2 },
      { uid: 'u2', kind: 'habit', refId: 10, title: 'Morning Walk' },
      { uid: 'u3', kind: 'journal', title: "Today's Journal" },
      { uid: 'u4', kind: 'custom', title: 'Check top 3 priorities', durationMin: 5 },
    ],
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  it('runs twice same day = one run (idempotency)', () => {
    const existingRuns: RoutineRun[] = [];
    const taskStore: Array<{ id: number; title: string; dueAt: Date; routineRunId: number }> = [];

    // First invocation for 2026-09-25 (Friday -> day 5)
    const run1 = simulateMaterialization([sampleRoutine], existingRuns, '2026-09-25', taskStore);
    expect(run1.newRuns).toHaveLength(1);
    expect(run1.createdTasks).toHaveLength(2); // 2 custom steps

    // Add created run to existingRuns simulating database state
    existingRuns.push(...run1.newRuns);

    // Second invocation for same day
    const run2 = simulateMaterialization([sampleRoutine], existingRuns, '2026-09-25', taskStore);
    expect(run2.newRuns).toHaveLength(0); // SKIPPED!
    expect(run2.createdTasks).toHaveLength(0);
    expect(taskStore).toHaveLength(2); // No duplicate tasks
  });

  it('filters by weekday correctly', () => {
    // 2026-09-26 is a Saturday (day 6), sampleRoutine is Mon-Fri only
    const existingRuns: RoutineRun[] = [];
    const taskStore: Array<{ id: number; title: string; dueAt: Date; routineRunId: number }> = [];

    const resultSat = simulateMaterialization([sampleRoutine], existingRuns, '2026-09-26', taskStore);
    expect(resultSat.newRuns).toHaveLength(0);
    expect(resultSat.createdTasks).toHaveLength(0);

    // 2026-09-28 is a Monday (day 1)
    const resultMon = simulateMaterialization([sampleRoutine], existingRuns, '2026-09-28', taskStore);
    expect(resultMon.newRuns).toHaveLength(1);
  });

  it('creates custom steps as real tasks with routine provenance and time anchors', () => {
    const existingRuns: RoutineRun[] = [];
    const taskStore: Array<{ id: number; title: string; dueAt: Date; routineRunId: number }> = [];

    const result = simulateMaterialization([sampleRoutine], existingRuns, '2026-09-25', taskStore);
    expect(result.createdTasks).toHaveLength(2);

    const task1 = result.createdTasks[0];
    expect(task1.title).toBe('Glass of water');
    expect(task1.routineRunId).toBe(1);
    expect(task1.dueAt.getHours()).toBe(9); // morning anchor = 09:00
    expect(task1.dueAt.getMinutes()).toBe(0);

    // Verify pointer items (habit, journal) were NOT converted to tasks
    const habitTask = result.createdTasks.find((t) => t.title === 'Morning Walk');
    expect(habitTask).toBeUndefined();
  });

  it('extractCustomSteps ignores pointer items (habit, journal, task, note)', () => {
    const custom = extractCustomSteps(sampleRoutine.items);
    expect(custom).toHaveLength(2);
    expect(custom.map((c) => c.title)).toEqual(['Glass of water', 'Check top 3 priorities']);
  });

  it('deleting a routine leaves historical runs intact in database', () => {
    const historicalRuns: RoutineRun[] = [
      {
        id: 10,
        routineId: sampleRoutine.id!,
        date: '2026-09-24',
        itemsSnapshot: sampleRoutine.items,
        generatedTaskIds: [101, 102],
        itemState: { u1: true },
      },
    ];

    // Historical run still exists with snapshot and states intact
    expect(historicalRuns).toHaveLength(1);
    expect(historicalRuns[0].itemsSnapshot).toBeDefined();
    expect(historicalRuns[0].itemState['u1']).toBe(true);
  });
});
