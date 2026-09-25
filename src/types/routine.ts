export type RoutineItemKind = 'task' | 'habit' | 'journal' | 'note' | 'custom';

export interface RoutineItem {
  uid: string; // stable id for per-run state (crypto.randomUUID())
  kind: RoutineItemKind;
  refId?: number; // pointer: existing task/habit/note id (NOT copied)
  title: string; // display text (for custom steps, the task title)
  durationMin?: number;
}

export type RoutineTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'any';

export interface Routine {
  id?: number;
  name: string;
  emoji?: string;
  daysOfWeek: number[]; // 0=Sun … 6=Sat (multiEntry-indexed)
  timeOfDay: RoutineTimeOfDay;
  items: RoutineItem[]; // JSON array inside the row
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface RoutineRun {
  id?: number;
  routineId: number;
  date: string; // 'YYYY-MM-DD' local
  itemsSnapshot?: RoutineItem[]; // snapshot of routine items at time of run creation
  generatedTaskIds: number[]; // custom steps materialized as tasks (carry routineRunId)
  itemState: Record<string, boolean>; // uid → done (pointer items checked off without duplicating them)
  createdAt?: number;
}
