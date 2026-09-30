import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../db/database';
import { timerPresetsRepo, DEFAULT_TIMER_PRESETS } from '../../db/repos/timerPresetsRepo';
import {
  PLANT_LIBRARY,
  PLANT_CATEGORIES,
  getPlantById,
  getPlantsByCategory,
  DEFAULT_STARTER_PLANT_IDS,
} from './plants/plantLibrary';

describe('Timer Presets Repository & Database Integration', () => {
  beforeEach(async () => {
    await db.timerPresets.clear();
  });

  it('verifies standard preset configurations in DEFAULT_TIMER_PRESETS', () => {
    expect(DEFAULT_TIMER_PRESETS).toHaveLength(3);
    const names = DEFAULT_TIMER_PRESETS.map((p) => p.name);
    expect(names).toContain('Classic Pomodoro');
    expect(names).toContain('Deep Work');
    expect(names).toContain('Quick');

    const pomodoro = DEFAULT_TIMER_PRESETS.find((p) => p.name === 'Classic Pomodoro')!;
    expect(pomodoro.focusMin).toBe(25);
    expect(pomodoro.shortBreakMin).toBe(5);
    expect(pomodoro.longBreakMin).toBe(15);
    expect(pomodoro.cycles).toBe(4);
    expect(pomodoro.isDefault).toBe(true);

    const deepWork = DEFAULT_TIMER_PRESETS.find((p) => p.name === 'Deep Work')!;
    expect(deepWork.focusMin).toBe(50);
    expect(deepWork.shortBreakMin).toBe(10);
    expect(deepWork.longBreakMin).toBe(30);

    const quick = DEFAULT_TIMER_PRESETS.find((p) => p.name === 'Quick')!;
    expect(quick.focusMin).toBe(15);
    expect(quick.shortBreakMin).toBe(3);
    expect(quick.longBreakMin).toBe(0);
  });

  it('seeds default presets idempotently into the database', async () => {
    await timerPresetsRepo.seedDefaults();
    let presets = await timerPresetsRepo.getAll();
    expect(presets).toHaveLength(3);

    // Calling seedDefaults a second time should not duplicate
    await timerPresetsRepo.seedDefaults();
    presets = await timerPresetsRepo.getAll();
    expect(presets).toHaveLength(3);

    const defaultPreset = await timerPresetsRepo.getDefault();
    expect(defaultPreset.name).toBe('Classic Pomodoro');
    expect(defaultPreset.focusMin).toBe(25);
  });

  it('creates custom presets and supports switching the default preset', async () => {
    await timerPresetsRepo.seedDefaults();

    const created = await timerPresetsRepo.create({
      name: 'Ultra Sprint',
      focusMin: 10,
      shortBreakMin: 2,
      longBreakMin: 5,
      cycles: 3,
      autoStartBreaks: false,
      autoStartFocus: false,
      sound: true,
      isDefault: false,
    });

    expect(created).toBeDefined();
    expect(created.name).toBe('Ultra Sprint');
    expect(created.isDefault).toBe(false);

    // Switch default to Ultra Sprint
    await timerPresetsRepo.setDefault(created.id!);

    const newDefault = await timerPresetsRepo.getDefault();
    expect(newDefault.id).toBe(created.id);
    expect(newDefault.name).toBe('Ultra Sprint');

    // Previous default should now be false
    const all = await timerPresetsRepo.getAll();
    const oldDefault = all.find((p) => p.name === 'Classic Pomodoro');
    expect(oldDefault?.isDefault).toBe(false);
  });

  it('updates, duplicates, and deletes presets with fallback default re-assignment', async () => {
    await timerPresetsRepo.seedDefaults();
    const presets = await timerPresetsRepo.getAll();
    const deepWork = presets.find((p) => p.name === 'Deep Work')!;

    await timerPresetsRepo.update(deepWork.id!, { focusMin: 60, cycles: 3 });
    const updated = await db.timerPresets.get(deepWork.id!);
    expect(updated?.focusMin).toBe(60);
    expect(updated?.cycles).toBe(3);

    // Test duplicate
    const copy = await timerPresetsRepo.duplicate(deepWork.id!);
    expect(copy).toBeDefined();
    expect(copy?.name).toBe('Deep Work (Copy)');
    expect(copy?.focusMin).toBe(60);

    // Test deleting the default preset: should automatically promote remaining preset
    const currentDefault = await timerPresetsRepo.getDefault();
    await timerPresetsRepo.delete(currentDefault.id!);

    const nextDefault = await timerPresetsRepo.getDefault();
    expect(nextDefault.id).not.toBe(currentDefault.id);
    expect(nextDefault.isDefault).toBe(true);
  });
});

describe('Gamified Plant Library System Integration', () => {
  it('contains valid categories and starter plant varieties', () => {
    expect(PLANT_CATEGORIES).toHaveLength(3);
    const categoryIds = PLANT_CATEGORIES.map((c) => c.id);
    expect(categoryIds).toEqual(['low_water', 'moderate', 'high_water']);

    expect(DEFAULT_STARTER_PLANT_IDS).toHaveLength(3);
    DEFAULT_STARTER_PLANT_IDS.forEach((id) => {
      const plant = getPlantById(id);
      expect(plant).toBeDefined();
      expect(plant.id).toBe(id);
    });
  });

  it('correctly retrieves and classifies plants by hydration category', () => {
    const lowWater = getPlantsByCategory('low_water');
    const moderate = getPlantsByCategory('moderate');
    const highWater = getPlantsByCategory('high_water');

    expect(lowWater.length).toBeGreaterThanOrEqual(3);
    expect(moderate.length).toBeGreaterThanOrEqual(3);
    expect(highWater.length).toBeGreaterThanOrEqual(3);

    expect(lowWater.every((p) => p.category === 'low_water')).toBe(true);
    expect(moderate.every((p) => p.category === 'moderate')).toBe(true);
    expect(highWater.every((p) => p.category === 'high_water')).toBe(true);
  });

  it('falls back safely to default plant when invalid ID is requested', () => {
    const fallback = getPlantById('unknown_mystery_plant');
    expect(fallback).toBeDefined();
    expect(fallback.id).toBe(PLANT_LIBRARY[0].id);
  });
});
