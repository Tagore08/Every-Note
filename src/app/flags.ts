import { useState, useEffect, useCallback } from 'react';

// Single source of truth — EXPANSION_PLAN §2.4
export const FEATURE_FLAGS = [
  'canvas',
  'journal',
  'graph',
  'routines',
  'calendarPro',
  'focusPro',
  'habitAnalytics',
  'smartInbox',
] as const;

export type Flag = (typeof FEATURE_FLAGS)[number];

export interface FlagInfo {
  id: Flag;
  label: string;
  description: string;
  phase: string;
}

export const FLAG_INFO: Record<Flag, FlagInfo> = {
  canvas: {
    id: 'canvas',
    label: 'Canvas & Ink',
    description: 'Pressure-sensitive vector drawing, sketches, tools & note embeds',
    phase: 'Phase 5',
  },
  journal: {
    id: 'journal',
    label: 'Journal',
    description: 'Distraction-free daily journal entries, mood tracking & prompts',
    phase: 'Phase 2A',
  },
  graph: {
    id: 'graph',
    label: 'Knowledge Graph',
    description: 'Interactive visual wikilinks network & bidirectional backlinks',
    phase: 'Phase 2B',
  },
  routines: {
    id: 'routines',
    label: 'Routines & Today',
    description: 'Morning & evening routine checklists with daily task materialization',
    phase: 'Phase 4',
  },
  calendarPro: {
    id: 'calendarPro',
    label: 'Calendar Pro',
    description: 'Multi-day time-grid engine with day, 3-day, week & timeline views',
    phase: 'Phase 3',
  },
  focusPro: {
    id: 'focusPro',
    label: 'Focus Pro',
    description: 'Customizable Pomodoro timer presets, cycles & session history',
    phase: 'Phase 6',
  },
  habitAnalytics: {
    id: 'habitAnalytics',
    label: 'Habit Analytics',
    description: '12-month GitHub-style habit heatmap, streaks & trend analysis',
    phase: 'Phase 6',
  },
  smartInbox: {
    id: 'smartInbox',
    label: 'Smart Inbox & Tasks',
    description: 'Tag classification, task subtasks, NLP quick-add & templates',
    phase: 'Phase 1',
  },
};

const STORAGE_KEY = 'notes_app_feature_flags_v2';
const EVENT_NAME = 'notes_app_flags_changed';

export function getDefaultFlags(): Record<Flag, boolean> {
  return {
    canvas: true,
    journal: true,
    graph: true,
    routines: true,
    calendarPro: false,
    focusPro: false,
    habitAnalytics: false,
    smartInbox: false,
  };
}

export function getStoredFlags(): Record<Flag, boolean> {
  const defaults = getDefaultFlags();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const flags = { ...defaults };
    for (const flag of FEATURE_FLAGS) {
      if (typeof parsed[flag] === 'boolean') {
        flags[flag] = parsed[flag];
      }
    }
    return flags;
  } catch {
    return defaults;
  }
}

export function saveFlags(flags: Record<Flag, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(EVENT_NAME));
    }
  } catch (err) {
    console.error('Failed to save feature flags:', err);
  }
}

export function getFlag(flag: Flag): boolean {
  return getStoredFlags()[flag] ?? false;
}

export function setFlag(flag: Flag, enabled: boolean): void {
  const current = getStoredFlags();
  current[flag] = enabled;
  saveFlags(current);
}

export function useFlag(flag: Flag): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => getFlag(flag));

  useEffect(() => {
    const handler = () => {
      setEnabled(getFlag(flag));
    };
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, [flag]);

  return enabled;
}

export function useFeatureFlags() {
  const [flags, setFlagsState] = useState<Record<Flag, boolean>>(() => getStoredFlags());

  const refresh = useCallback(() => {
    setFlagsState(getStoredFlags());
  }, []);

  useEffect(() => {
    window.addEventListener(EVENT_NAME, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT_NAME, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const toggleFlag = useCallback((flag: Flag) => {
    const current = getStoredFlags();
    current[flag] = !current[flag];
    saveFlags(current);
  }, []);

  const updateFlag = useCallback((flag: Flag, val: boolean) => {
    const current = getStoredFlags();
    current[flag] = val;
    saveFlags(current);
  }, []);

  const resetAllFlags = useCallback(() => {
    saveFlags(getDefaultFlags());
  }, []);

  return {
    flags,
    toggleFlag,
    updateFlag,
    resetAllFlags,
  };
}
