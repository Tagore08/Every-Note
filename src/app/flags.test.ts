import { describe, it, expect, beforeEach } from 'vitest';
import {
  FEATURE_FLAGS,
  FLAG_INFO,
  getDefaultFlags,
  getStoredFlags,
  setFlag,
  saveFlags,
} from './flags';

describe('Feature Flags System', () => {
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

  it('does not contain obsolete insights flag', () => {
    expect((FEATURE_FLAGS as readonly string[]).includes('insights' as any)).toBe(false);
    expect('insights' in FLAG_INFO).toBe(false);
  });

  it('defaults journal, canvas, graph, and routines to true', () => {
    const defaults = getDefaultFlags();
    expect(defaults.journal).toBe(true);
    expect(defaults.canvas).toBe(true);
    expect(defaults.graph).toBe(true);
    expect(defaults.routines).toBe(true);

    // Other flags default to false
    expect(defaults.calendarPro).toBe(false);
    expect(defaults.focusPro).toBe(false);
    expect(defaults.habitAnalytics).toBe(false);
    expect(defaults.smartInbox).toBe(false);
  });

  it('returns default flags when localStorage is empty', () => {
    const flags = getStoredFlags();
    expect(flags.journal).toBe(true);
    expect(flags.canvas).toBe(true);
    expect(flags.calendarPro).toBe(false);
  });

  it('persists and restores flag updates', () => {
    setFlag('calendarPro', true);
    setFlag('journal', false);

    const flags = getStoredFlags();
    expect(flags.calendarPro).toBe(true);
    expect(flags.journal).toBe(false);
    expect(flags.canvas).toBe(true); // Unmodified remains default true
  });

  it('recovers gracefully from malformed localStorage data', () => {
    localStorage.setItem('notes_app_feature_flags_v2', 'invalid-json{{');
    const flags = getStoredFlags();
    expect(flags.journal).toBe(true);
    expect(flags.canvas).toBe(true);
  });

  it('saves full flags dictionary', () => {
    const custom = getDefaultFlags();
    custom.focusPro = true;
    saveFlags(custom);

    const stored = getStoredFlags();
    expect(stored.focusPro).toBe(true);
    expect(stored.routines).toBe(true);
  });
});
