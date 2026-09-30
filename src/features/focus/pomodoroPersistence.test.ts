import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveActiveSession,
  loadActiveSession,
  FOCUS_ACTIVE_SESSION_KEY,
  type ActiveFocusSession,
} from './FocusTimerContext';

describe('Pomodoro Session Persistence', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const mockLocalStorage = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };
    (globalThis as any).localStorage = mockLocalStorage;
    if (typeof window !== 'undefined') {
      (window as any).localStorage = mockLocalStorage;
    }
  });

  it('saves and loads active focus session correctly', () => {
    const session: ActiveFocusSession = {
      targetEndTime: Date.now() + 1500 * 1000,
      sessionStartTime: new Date().toISOString(),
      mode: 'focus',
      status: 'running',
      remainingSeconds: 1500,
      currentCycle: 2,
      selectedTaskId: 42,
      selectedHabitId: 7,
      plantStage: 'growing',
      presetId: 1,
    };

    saveActiveSession(session);
    const loaded = loadActiveSession();

    expect(loaded).toEqual(session);
    expect(mockStorage[FOCUS_ACTIVE_SESSION_KEY]).toBeTruthy();
  });

  it('removes active session from storage when passed null', () => {
    saveActiveSession({
      targetEndTime: Date.now() + 1000,
      sessionStartTime: new Date().toISOString(),
      mode: 'focus',
      status: 'running',
      remainingSeconds: 1000,
      currentCycle: 1,
      selectedTaskId: null,
      selectedHabitId: null,
      plantStage: 'seed',
    });

    expect(mockStorage[FOCUS_ACTIVE_SESSION_KEY]).toBeDefined();

    saveActiveSession(null);
    expect(mockStorage[FOCUS_ACTIVE_SESSION_KEY]).toBeUndefined();
    expect(loadActiveSession()).toBeNull();
  });

  it('handles corrupted storage data gracefully', () => {
    mockStorage[FOCUS_ACTIVE_SESSION_KEY] = 'invalid-json-string{';
    expect(loadActiveSession()).toBeNull();
  });

  it('computes accurate drift-free remaining time upon rehydration', () => {
    const futureOffsetSec = 600; // 10 minutes
    const now = Date.now();
    const targetEndTime = now + futureOffsetSec * 1000;

    const session: ActiveFocusSession = {
      targetEndTime,
      sessionStartTime: new Date(now - 900 * 1000).toISOString(),
      mode: 'focus',
      status: 'running',
      remainingSeconds: 1500,
      currentCycle: 1,
      selectedTaskId: null,
      selectedHabitId: null,
      plantStage: 'growing',
    };

    saveActiveSession(session);
    const restored = loadActiveSession();
    expect(restored).not.toBeNull();

    // Verify calculated remaining time based on targetEndTime
    const diffSec = Math.max(0, Math.round((restored!.targetEndTime! - Date.now()) / 1000));
    expect(diffSec).toBeGreaterThanOrEqual(futureOffsetSec - 2);
    expect(diffSec).toBeLessThanOrEqual(futureOffsetSec + 2);
  });

  it('detects when session has expired while away', () => {
    const pastTargetEndTime = Date.now() - 30 * 1000; // expired 30s ago
    const session: ActiveFocusSession = {
      targetEndTime: pastTargetEndTime,
      sessionStartTime: new Date(Date.now() - 1530 * 1000).toISOString(),
      mode: 'focus',
      status: 'running',
      remainingSeconds: 1500,
      currentCycle: 1,
      selectedTaskId: null,
      selectedHabitId: null,
      plantStage: 'growing',
    };

    saveActiveSession(session);
    const restored = loadActiveSession();
    const diffSec = Math.max(0, Math.round((restored!.targetEndTime! - Date.now()) / 1000));
    expect(diffSec).toBe(0);
  });
});
