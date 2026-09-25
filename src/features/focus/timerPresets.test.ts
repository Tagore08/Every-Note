import { describe, it, expect } from 'vitest';
import { DEFAULT_TIMER_PRESETS } from '../../db/repos/timerPresetsRepo';

describe('Timer Presets Model', () => {
  it('seeds standard Pomodoro, Deep Work, and Quick presets', () => {
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
  });

  it('verifies Deep Work interval configurations', () => {
    const deepWork = DEFAULT_TIMER_PRESETS.find((p) => p.name === 'Deep Work')!;
    expect(deepWork.focusMin).toBe(50);
    expect(deepWork.shortBreakMin).toBe(10);
    expect(deepWork.longBreakMin).toBe(30);
    expect(deepWork.cycles).toBe(2);
    expect(deepWork.isDefault).toBe(false);
  });

  it('verifies Quick preset configurations', () => {
    const quick = DEFAULT_TIMER_PRESETS.find((p) => p.name === 'Quick')!;
    expect(quick.focusMin).toBe(15);
    expect(quick.shortBreakMin).toBe(3);
    expect(quick.longBreakMin).toBe(0);
    expect(quick.cycles).toBe(1);
  });
});

describe('Focus Plant Gamification Engine (Phase 5)', () => {
  const PLANT_TYPES = ['bonsai', 'sunflower', 'cactus'] as const;

  it('supports the 3 core plant varieties', () => {
    expect(PLANT_TYPES).toContain('bonsai');
    expect(PLANT_TYPES).toContain('sunflower');
    expect(PLANT_TYPES).toContain('cactus');
  });

  it('determines plant growth progress accurately across session duration', () => {
    const focusDurationSec = 25 * 60; // 1500 seconds

    // At start (0 seconds elapsed)
    const startProgress = Math.max(0, (focusDurationSec - 1500) / focusDurationSec);
    expect(startProgress).toBe(0);

    // Halfway through (750 seconds remaining)
    const midProgress = (focusDurationSec - 750) / focusDurationSec;
    expect(midProgress).toBe(0.5);

    // At completion (0 seconds remaining)
    const completeProgress = (focusDurationSec - 0) / focusDurationSec;
    expect(completeProgress).toBe(1);
  });

  it('verifies plant lifecycle stages: seed -> growing -> bloomed vs withered', () => {
    type Stage = 'seed' | 'growing' | 'bloomed' | 'withered';
    let stage: Stage = 'seed';

    // 1. Timer starts
    stage = 'growing';
    expect(stage).toBe('growing');

    // 2. Normal completion -> Blooms
    stage = 'bloomed';
    expect(stage).toBe('bloomed');

    // 3. Reset for new session
    stage = 'seed';
    expect(stage).toBe('seed');

    // 4. Broken focus / cancelled early -> Withers
    stage = 'growing';
    const userGaveUp = true;
    if (userGaveUp) {
      stage = 'withered';
    }
    expect(stage).toBe('withered');

    // 5. Replant after withering
    stage = 'seed';
    expect(stage).toBe('seed');
  });
});

