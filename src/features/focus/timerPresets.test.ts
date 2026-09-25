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
