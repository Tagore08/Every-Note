import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database';
import type { TimerPreset } from '../../types/focus';

export const DEFAULT_TIMER_PRESETS: Omit<TimerPreset, 'id'>[] = [
  {
    name: 'Classic Pomodoro',
    focusMin: 25,
    shortBreakMin: 5,
    longBreakMin: 15,
    cycles: 4,
    autoStartBreaks: true,
    autoStartFocus: false,
    sound: true,
    isDefault: true,
  },
  {
    name: 'Deep Work',
    focusMin: 50,
    shortBreakMin: 10,
    longBreakMin: 30,
    cycles: 2,
    autoStartBreaks: true,
    autoStartFocus: false,
    sound: true,
    isDefault: false,
  },
  {
    name: 'Quick',
    focusMin: 15,
    shortBreakMin: 3,
    longBreakMin: 0,
    cycles: 1,
    autoStartBreaks: false,
    autoStartFocus: false,
    sound: true,
    isDefault: false,
  },
];

export const timerPresetsRepo = {
  /**
   * Seed default presets idempotently on first load.
   */
  async seedDefaults(): Promise<void> {
    const count = await db.timerPresets.count();
    if (count > 0) return;

    for (const preset of DEFAULT_TIMER_PRESETS) {
      await db.timerPresets.add(preset as TimerPreset);
    }
  },

  async getAll(): Promise<TimerPreset[]> {
    return await db.timerPresets.toArray();
  },

  async getDefault(): Promise<TimerPreset> {
    const defaultPreset = await db.timerPresets.filter((p) => Boolean(p.isDefault)).first();
    if (defaultPreset) return defaultPreset;

    const first = await db.timerPresets.toCollection().first();
    if (first) return first;

    return {
      id: 1,
      ...DEFAULT_TIMER_PRESETS[0],
    };
  },

  async create(draft: Omit<TimerPreset, 'id'>): Promise<TimerPreset> {
    if (draft.isDefault) {
      // Clear previous default
      await db.timerPresets.toCollection().modify({ isDefault: false });
    }
    const id = await db.timerPresets.add(draft as TimerPreset);
    return { ...draft, id: Number(id) };
  },

  async update(id: number, updates: Partial<TimerPreset>): Promise<void> {
    if (updates.isDefault) {
      await db.timerPresets.toCollection().modify({ isDefault: false });
    }
    await db.timerPresets.update(id, updates);
  },

  async setDefault(id: number): Promise<void> {
    await db.timerPresets.toCollection().modify({ isDefault: false });
    await db.timerPresets.update(id, { isDefault: true });
  },

  async duplicate(id: number): Promise<TimerPreset | null> {
    const source = await db.timerPresets.get(id);
    if (!source) return null;

    const { id: _id, ...rest } = source;
    const copy = {
      ...rest,
      name: `${source.name} (Copy)`,
      isDefault: false,
    };
    const newId = await db.timerPresets.add(copy as TimerPreset);
    return { ...copy, id: Number(newId) };
  },

  
  async getAllPresetsForExport(): Promise<TimerPreset[]> {
    return await db.timerPresets.toArray();
  },

  async importPresets(presets: TimerPreset[], strategy: 'merge' | 'replace'): Promise<number> {
    if (strategy === 'replace') {
      await db.timerPresets.clear();
      for (const p of presets) {
        const copy = { ...p };
        delete (copy as any).id;
        await db.timerPresets.add(copy as TimerPreset);
      }
      return presets.length;
    }
    let count = 0;
    for (const p of presets) {
      const copy = { ...p };
      delete (copy as any).id;
      await db.timerPresets.add(copy as TimerPreset);
      count++;
    }
    return count;
  },

  async deleteAllAndReseed(): Promise<void> {
    await db.timerPresets.clear();
    for (const preset of DEFAULT_TIMER_PRESETS) {
      await db.timerPresets.add(preset as TimerPreset);
    }
  },
  async delete(id: number): Promise<void> {
    const preset = await db.timerPresets.get(id);
    if (!preset) return;
    await db.timerPresets.delete(id);

    // If deleted was default, make first remaining default
    if (preset.isDefault) {
      const remaining = await db.timerPresets.toCollection().first();
      if (remaining && remaining.id) {
        await db.timerPresets.update(remaining.id, { isDefault: true });
      }
    }
  },
};

export function useTimerPresets(): TimerPreset[] {
  return useLiveQuery(() => db.timerPresets.toArray(), []) || [];
}

export function useDefaultTimerPreset(): TimerPreset | undefined {
  return useLiveQuery(async () => {
    return await timerPresetsRepo.getDefault();
  }, []);
}
