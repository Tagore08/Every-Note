import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database';
import { tasksRepo } from '../tasksRepo';
import { localDateStr, parseLocalDateStr } from '../../lib/date';
import type {
  Routine,
  RoutineRun,
  RoutineItem,
  RoutineTimeOfDay,
} from '../../types/routine';
import type { Template } from '../../types/template';
import { templatesRepo } from './templatesRepo';

export interface RoutineTimelineItem {
  id: string | number;
  title: string;
  time?: string;
  completed?: boolean;
}

// Settings-tunable anchor hours per EXPANSION_PLAN §675
export const ROUTINE_TIME_ANCHORS: Record<RoutineTimeOfDay, { hour: number; minute: number; timeStr: string }> = {
  morning: { hour: 9, minute: 0, timeStr: '09:00' },
  afternoon: { hour: 14, minute: 0, timeStr: '14:00' },
  evening: { hour: 19, minute: 0, timeStr: '19:00' },
  any: { hour: 12, minute: 0, timeStr: '12:00' },
};

export const routinesRepo = {
  /**
   * Retrieves all routines.
   */
  async getAllRoutines(): Promise<Routine[]> {
    return db.routines.toArray();
  },

  /**
   * Retrieves active routines.
   */
  async getActiveRoutines(): Promise<Routine[]> {
    return db.routines.filter((r) => r.active).toArray();
  },

  /**
   * Retrieves a single routine by ID.
   */
  async getRoutineById(id: number): Promise<Routine | undefined> {
    return db.routines.get(id);
  },

  /**
   * Creates a new routine.
   */
  async createRoutine(draft: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'>): Promise<Routine> {
    const now = Date.now();
    const newRoutine: Routine = {
      name: draft.name.trim() || 'Untitled Routine',
      emoji: draft.emoji || '☀️',
      daysOfWeek: Array.isArray(draft.daysOfWeek) ? [...draft.daysOfWeek] : [1, 2, 3, 4, 5],
      timeOfDay: draft.timeOfDay || 'morning',
      items: Array.isArray(draft.items) ? draft.items : [],
      active: draft.active !== false,
      createdAt: now,
      updatedAt: now,
    };

    const id = await db.routines.add(newRoutine);
    return { ...newRoutine, id: id as number };
  },

  /**
   * Updates an existing routine.
   * Note on editing semantics (§679): Editing does NOT change past/existing runs.
   */
  async updateRoutine(id: number, changes: Partial<Omit<Routine, 'id' | 'createdAt'>>): Promise<void> {
    await db.routines.update(id, {
      ...changes,
      updatedAt: Date.now(),
    });
  },

  /**
   * Toggles routine active state.
   */
  async toggleRoutineActive(id: number, active: boolean): Promise<void> {
    await db.routines.update(id, {
      active,
      updatedAt: Date.now(),
    });
  },

  /**
   * Deletes a routine permanently.
   * Safety rule (§677): leaves existing routineRuns intact.
   */
  async deleteRoutine(id: number): Promise<void> {
    await db.routines.delete(id);
  },

  /**
   * Retrieves run for a specific routine and date.
   */
  async getRunByRoutineAndDate(routineId: number, dateStr: string): Promise<RoutineRun | undefined> {
    return db.routineRuns.where('[routineId+date]').equals([routineId, dateStr]).first();
  },

  /**
   * Retrieves all runs for a specific date.
   */
  async getRunsForDate(dateStr: string): Promise<RoutineRun[]> {
    return db.routineRuns.where('date').equals(dateStr).toArray();
  },

  /**
   * Toggles an item's completion state within a routine run.
   */
  async updateRunItemState(runId: number, itemUid: string, done: boolean): Promise<void> {
    const run = await db.routineRuns.get(runId);
    if (!run) return;

    const itemState = { ...(run.itemState || {}) };
    if (done) {
      itemState[itemUid] = true;
    } else {
      delete itemState[itemUid];
    }

    await db.routineRuns.update(runId, { itemState });
  },

  /**
   * Materialization Engine (§671):
   * Runs for today (or requested dateStr).
   * Checks [routineId+date] compound unique key for idempotency.
   * Custom steps become real tasks carrying routineRunId.
   * Pointer items are read live without duplication.
   */
  async materializeRoutinesFor(dateStr: string): Promise<RoutineRun[]> {
    const dateObj = parseLocalDateStr(dateStr);
    const dayOfWeek = dateObj.getDay(); // 0=Sun … 6=Sat

    // Query active routines matching this weekday
    const allRoutines = await db.routines.toArray();
    const activeMatching = allRoutines.filter(
      (r) => r.active && Array.isArray(r.daysOfWeek) && r.daysOfWeek.includes(dayOfWeek)
    );

    const materializedRuns: RoutineRun[] = [];

    for (const routine of activeMatching) {
      if (!routine.id) continue;

      // 1. Idempotency Check: if run for [routineId+date] already exists, skip!
      const existingRun = await db.routineRuns
        .where('[routineId+date]')
        .equals([routine.id, dateStr])
        .first();

      if (existingRun) {
        materializedRuns.push(existingRun);
        continue;
      }

      // 2. Create the run row snapshotting current routine items
      const itemsSnapshot = [...(routine.items || [])];
      const anchor = ROUTINE_TIME_ANCHORS[routine.timeOfDay] || ROUTINE_TIME_ANCHORS.morning;
      const dueAt = new Date(
        dateObj.getFullYear(),
        dateObj.getMonth(),
        dateObj.getDate(),
        anchor.hour,
        anchor.minute,
        0,
        0
      );

      const generatedTaskIds: number[] = [];

      const runDraft: Omit<RoutineRun, 'id'> = {
        routineId: routine.id,
        date: dateStr,
        itemsSnapshot,
        generatedTaskIds: [],
        itemState: {},
        createdAt: Date.now(),
      };

      const runId = (await db.routineRuns.add(runDraft as RoutineRun)) as number;

      // 3. Materialize custom steps as real tasks with routine provenance
      for (const item of itemsSnapshot) {
        if (item.kind === 'custom') {
          const createdTask = await tasksRepo.createTask({
            title: item.title,
            dueAt,
            routineRunId: runId,
            estimatedMin: item.durationMin,
          });
          if (createdTask.id) {
            generatedTaskIds.push(createdTask.id);
          }
        }
        // Pointer items (task, habit, journal, note) are NOT copied — read live!
      }

      if (generatedTaskIds.length > 0) {
        await db.routineRuns.update(runId, { generatedTaskIds });
      }

      const completedRun: RoutineRun = {
        ...runDraft,
        id: runId,
        generatedTaskIds,
      };

      materializedRuns.push(completedRun);
    }

    return materializedRuns;
  },

  /**
   * Integration with Timeline view (§680):
   * Returns routine blocks for a given date.
   */
  async itemsFor(date: Date): Promise<RoutineTimelineItem[]> {
    const dateStr = localDateStr(date);
    const runs = await this.getRunsForDate(dateStr);
    const items: RoutineTimelineItem[] = [];

    for (const run of runs) {
      const routine = await db.routines.get(run.routineId);
      if (!routine) continue;

      const anchor = ROUTINE_TIME_ANCHORS[routine.timeOfDay] || ROUTINE_TIME_ANCHORS.morning;
      const snapshot = run.itemsSnapshot || routine.items || [];

      // Check overall progress
      const total = snapshot.length;
      let completedCount = 0;
      for (const it of snapshot) {
        if (run.itemState?.[it.uid]) completedCount++;
      }

      items.push({
        id: `routine-block-${run.id}`,
        title: `${routine.emoji || '☀️'} ${routine.name} (${completedCount}/${total})`,
        time: anchor.timeStr,
        completed: total > 0 && completedCount === total,
      });
    }

    return items;
  },

  /**
   * Routine Templates: Save routine as template.
   */
  async saveRoutineAsTemplate(routine: Routine, templateName?: string): Promise<Template> {
    return templatesRepo.createTemplate({
      kind: 'routine',
      name: templateName?.trim() || routine.name,
      body: {
        title: routine.name,
        items: routine.items.map((it) => ({ ...it })),
      },
    });
  },

  /**
   * Routine Templates: Create routine from template.
   */
  async createRoutineFromTemplate(
    template: Template,
    timeOfDay: RoutineTimeOfDay = 'morning',
    daysOfWeek: number[] = [1, 2, 3, 4, 5]
  ): Promise<Routine> {
    const rawItems = template.body.items || [];
    const items: RoutineItem[] = rawItems.map((raw: any) => ({
      uid: raw.uid || crypto.randomUUID(),
      kind: raw.kind || 'custom',
      refId: raw.refId,
      title: raw.title || 'Step',
      durationMin: raw.durationMin,
    }));

    return this.createRoutine({
      name: template.name,
      emoji: '☀️',
      timeOfDay,
      daysOfWeek,
      items,
      active: true,
    });
  },
};

/**
 * Reactive hooks
 */
export function useAllRoutines(): Routine[] {
  const routines = useLiveQuery(() => routinesRepo.getAllRoutines());
  return routines ?? [];
}

export function useActiveRoutines(): Routine[] {
  const routines = useLiveQuery(() => routinesRepo.getActiveRoutines());
  return routines ?? [];
}

export function useRoutine(id: number | null | undefined): Routine | null {
  const routine = useLiveQuery(async () => {
    if (typeof id !== 'number' || isNaN(id)) return null;
    return (await routinesRepo.getRoutineById(id)) ?? null;
  }, [id]);
  return routine ?? null;
}

export function useRunsForDate(dateStr: string): RoutineRun[] {
  const runs = useLiveQuery(async () => {
    return routinesRepo.getRunsForDate(dateStr);
  }, [dateStr]);
  return runs ?? [];
}
