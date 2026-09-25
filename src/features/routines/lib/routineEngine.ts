import type { Routine, RoutineItem, RoutineTimeOfDay, RoutineRun } from '../../../types/routine';
import { parseLocalDateStr } from '../../../lib/date';
import { ROUTINE_TIME_ANCHORS } from '../../../db/repos/routinesRepo';

/**
 * Checks whether an active routine should be materialized for the given local date.
 * - Must be active
 * - Date's weekday (0=Sun..6=Sat) must be in routine.daysOfWeek
 * - [routineId+dateStr] must not already exist in existingRunKeys (idempotency key)
 */
export function shouldMaterializeRoutine(
  routine: Routine,
  dateStr: string,
  existingRunKeys: Set<string>
): boolean {
  if (!routine.active || !routine.id) {
    return false;
  }

  const compoundKey = `${routine.id}:${dateStr}`;
  if (existingRunKeys.has(compoundKey)) {
    return false;
  }

  const dateObj = parseLocalDateStr(dateStr);
  const weekday = dateObj.getDay();
  return Array.isArray(routine.daysOfWeek) && routine.daysOfWeek.includes(weekday);
}

/**
 * Computes anchor Date (dueAt) for a routine on a given dateStr.
 */
export function computeRoutineDueAt(dateStr: string, timeOfDay: RoutineTimeOfDay): Date {
  const d = parseLocalDateStr(dateStr);
  const anchor = ROUTINE_TIME_ANCHORS[timeOfDay] || ROUTINE_TIME_ANCHORS.morning;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), anchor.hour, anchor.minute, 0, 0);
}

/**
 * Extracts custom steps that must be converted to real tasks.
 * Pointer items (kind !== 'custom') are excluded so they are never duplicated.
 */
export function extractCustomSteps(items: RoutineItem[]): RoutineItem[] {
  return items.filter((it) => it.kind === 'custom');
}

/**
 * In-memory simulation of the materialization engine contract for deterministic unit testing.
 */
export function simulateMaterialization(
  routines: Routine[],
  existingRuns: RoutineRun[],
  dateStr: string,
  taskStore: Array<{ id: number; title: string; dueAt: Date; routineRunId: number }>
): {
  newRuns: RoutineRun[];
  createdTasks: Array<{ id: number; title: string; dueAt: Date; routineRunId: number }>;
} {
  const runKeys = new Set(existingRuns.map((r) => `${r.routineId}:${r.date}`));
  const newRuns: RoutineRun[] = [];
  const createdTasks: Array<{ id: number; title: string; dueAt: Date; routineRunId: number }> = [];

  let nextRunId = existingRuns.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;
  let nextTaskId = taskStore.reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;

  for (const routine of routines) {
    if (!shouldMaterializeRoutine(routine, dateStr, runKeys)) {
      continue;
    }

    const runId = nextRunId++;
    const dueAt = computeRoutineDueAt(dateStr, routine.timeOfDay);
    const customSteps = extractCustomSteps(routine.items);

    const generatedTaskIds: number[] = [];
    for (const step of customSteps) {
      const taskId = nextTaskId++;
      const task = {
        id: taskId,
        title: step.title,
        dueAt,
        routineRunId: runId,
      };
      taskStore.push(task);
      createdTasks.push(task);
      generatedTaskIds.push(taskId);
    }

    const run: RoutineRun = {
      id: runId,
      routineId: routine.id!,
      date: dateStr,
      itemsSnapshot: [...routine.items],
      generatedTaskIds,
      itemState: {},
      createdAt: Date.now(),
    };

    newRuns.push(run);
    runKeys.add(`${routine.id}:${dateStr}`);
  }

  return { newRuns, createdTasks };
}
