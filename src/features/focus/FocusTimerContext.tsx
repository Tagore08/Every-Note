import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { TimerPreset, FocusSessionKind } from '../../types/focus';
import { timerPresetsRepo, DEFAULT_TIMER_PRESETS } from '../../db/repos/timerPresetsRepo';
import { focusRepo } from '../../db/focusRepo';
import { habitsRepo, toLocalDateStr } from '../../db/habitsRepo';

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';
export type TimerStatus = 'idle' | 'running' | 'paused';
export type PlantType = string;
export type PlantStage = 'seed' | 'growing' | 'bloomed' | 'withered';

export interface ActiveFocusSession {
  targetEndTime: number | null;
  sessionStartTime: string;
  mode: TimerMode;
  status: TimerStatus;
  remainingSeconds: number;
  currentCycle: number;
  selectedTaskId: number | null;
  selectedHabitId: number | null;
  plantStage: PlantStage;
  presetId?: number;
}

export const FOCUS_ACTIVE_SESSION_KEY = 'notes_app_focus_active_session';

export function saveActiveSession(session: ActiveFocusSession | null): void {
  try {
    if (session) {
      localStorage.setItem(FOCUS_ACTIVE_SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(FOCUS_ACTIVE_SESSION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadActiveSession(): ActiveFocusSession | null {
  try {
    const raw = localStorage.getItem(FOCUS_ACTIVE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

interface FocusTimerContextValue {
  mode: TimerMode;
  status: TimerStatus;
  remainingSeconds: number;
  currentCycle: number;
  totalCycles: number;
  preset: TimerPreset;
  presets: TimerPreset[];
  customFocusMinutes: number;
  setCustomFocusMinutes: (min: number) => void;
  selectedTaskId: number | null;
  setSelectedTaskId: (id: number | null) => void;
  selectedHabitId: number | null;
  setSelectedHabitId: (id: number | null) => void;
  plantType: PlantType;
  setPlantType: (type: PlantType) => void;
  plantStage: PlantStage;
  progress: number;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  giveUpTimer: () => void;
  resetPlant: () => void;
  skipStep: () => void;
  selectPreset: (preset: TimerPreset) => void;
  refreshPresets: () => Promise<void>;
}

const FocusTimerContext = createContext<FocusTimerContextValue | null>(null);

function playCompletionChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Frequency sweep: 523.25Hz (C5) to 659.25Hz (E5)
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.35);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  } catch (e) {
    console.debug('WebAudio chime unavailable:', e);
  }
}

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const [initialSession] = useState<ActiveFocusSession | null>(() => {
    const saved = loadActiveSession();
    if (!saved) return null;
    if (saved.status === 'running' && saved.targetEndTime) {
      const now = Date.now();
      if (saved.targetEndTime > now) {
        return {
          ...saved,
          remainingSeconds: Math.round((saved.targetEndTime - now) / 1000),
        };
      } else {
        return {
          ...saved,
          remainingSeconds: 0,
        };
      }
    }
    return saved;
  });

  const [presets, setPresets] = useState<TimerPreset[]>([]);
  const [preset, setPreset] = useState<TimerPreset>({
    id: 1,
    ...DEFAULT_TIMER_PRESETS[0],
  });

  const [customFocusMinutes, setCustomFocusMinutesState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('notes_app_focus_custom_minutes');
      return saved ? Math.max(1, Math.min(240, Number(saved))) : 25;
    } catch {
      return 25;
    }
  });

  const [mode, setMode] = useState<TimerMode>(() => initialSession?.mode || 'focus');
  const [status, setStatus] = useState<TimerStatus>(() => initialSession?.status || 'idle');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (initialSession) return initialSession.remainingSeconds;
    try {
      const saved = localStorage.getItem('notes_app_focus_custom_minutes');
      return saved ? Math.max(1, Math.min(240, Number(saved))) * 60 : 25 * 60;
    } catch {
      return 25 * 60;
    }
  });
  const [currentCycle, setCurrentCycle] = useState<number>(() => initialSession?.currentCycle || 1);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(() => initialSession?.selectedTaskId ?? null);
  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(() => initialSession?.selectedHabitId ?? null);

  // Gamification Plant State
  const [plantType, setPlantTypeState] = useState<PlantType>(() => {
    try {
      return localStorage.getItem('notes_app_focus_plant') || 'bonsai';
    } catch {
      return 'bonsai';
    }
  });
  const [plantStage, setPlantStage] = useState<PlantStage>(() => initialSession?.plantStage || 'seed');

  const setPlantType = (t: PlantType) => {
    setPlantTypeState(t);
    try {
      localStorage.setItem('notes_app_focus_plant', t);
    } catch {
      // storage unavailable
    }
  };

  const setCustomFocusMinutes = useCallback((min: number) => {
    const valid = Math.max(1, Math.min(240, min));
    setCustomFocusMinutesState(valid);
    try {
      localStorage.setItem('notes_app_focus_custom_minutes', String(valid));
    } catch {
      // storage unavailable
    }
    if (status === 'idle' && mode === 'focus') {
      setRemainingSeconds(valid * 60);
      if (plantStage === 'bloomed' || plantStage === 'withered') {
        setPlantStage('seed');
      }
    }
  }, [status, mode, plantStage]);

  // Absolute end timestamp preventing drift
  const targetEndTimeRef = useRef<number | null>(initialSession?.targetEndTime ?? null);
  const sessionStartTimeRef = useRef<Date | null>(
    initialSession?.sessionStartTime ? new Date(initialSession.sessionStartTime) : null
  );

  const totalCycles = preset.cycles || 4;

  const getDurationForMode = useCallback(
    (m: TimerMode, p: TimerPreset): number => {
      switch (m) {
        case 'focus':
          return customFocusMinutes * 60;
        case 'shortBreak':
          return (p.shortBreakMin || 5) * 60;
        case 'longBreak':
          return (p.longBreakMin || 15) * 60;
      }
    },
    [customFocusMinutes]
  );

  const totalModeDuration = getDurationForMode(mode, preset);
  const elapsed = Math.max(0, totalModeDuration - remainingSeconds);
  const progress = totalModeDuration > 0 ? Math.min(1, elapsed / totalModeDuration) : 0;

  const refreshPresets = useCallback(async () => {
    try {
      const all = await timerPresetsRepo.getAll();
      setPresets(all);
      if (initialSession?.presetId) {
        const matching = all.find((p) => p.id === initialSession.presetId);
        if (matching) setPreset(matching);
      } else {
        const def = all.find((p) => p.isDefault) || all[0];
        if (def && status === 'idle') {
          setPreset(def);
          setRemainingSeconds(getDurationForMode(mode, def));
        }
      }
    } catch (e) {
      console.error('Failed to load timer presets:', e);
    }
  }, [mode, status, getDurationForMode, initialSession]);

  useEffect(() => {
    refreshPresets();
  }, [refreshPresets]);

  const selectPreset = (newPreset: TimerPreset) => {
    setPreset(newPreset);
    if (status === 'idle') {
      setRemainingSeconds(getDurationForMode(mode, newPreset));
      if (plantStage === 'bloomed' || plantStage === 'withered') {
        setPlantStage('seed');
      }
    }
  };

  const handleSessionComplete = useCallback(async () => {
    targetEndTimeRef.current = null;
    const sessionKind: FocusSessionKind = mode === 'focus' ? 'focus' : 'break';
    const minutes = Math.max(
      1,
      Math.round(getDurationForMode(mode, preset) / 60)
    );

    if (preset.sound) {
      playCompletionChime();
    }

    if (Notification && Notification.permission === 'granted') {
      try {
        new Notification(mode === 'focus' ? 'Focus Session Complete!' : 'Break Over!', {
          body: mode === 'focus' ? 'Time for a well-deserved break.' : 'Ready to focus again?',
        });
      } catch {
        // notification suppressed
      }
    }

    // Log to DB
    try {
      await focusRepo.logFocusSession({
        startedAt: sessionStartTimeRef.current || new Date(),
        minutes,
        taskId: selectedTaskId,
        presetId: preset.id,
        kind: sessionKind,
      });
    } catch (e) {
      console.error('Failed to log focus session:', e);
    }

    // Auto-complete selected habit if linked
    if (mode === 'focus' && selectedHabitId) {
      try {
        await habitsRepo.setHabitDone(selectedHabitId, toLocalDateStr(), true);
      } catch (err) {
        console.error('Failed to mark linked habit as completed:', err);
      }
    }

    // Advance cycle / mode
    if (mode === 'focus') {
      setPlantStage('bloomed');
      if (currentCycle >= totalCycles) {
        setMode('longBreak');
        const dur = getDurationForMode('longBreak', preset);
        setRemainingSeconds(dur);
        setCurrentCycle(1);
        if (preset.autoStartBreaks) {
          const nextTarget = Date.now() + dur * 1000;
          targetEndTimeRef.current = nextTarget;
          const nextStart = new Date();
          sessionStartTimeRef.current = nextStart;
          setStatus('running');
          saveActiveSession({
            targetEndTime: nextTarget,
            sessionStartTime: nextStart.toISOString(),
            mode: 'longBreak',
            status: 'running',
            remainingSeconds: dur,
            currentCycle: 1,
            selectedTaskId,
            selectedHabitId,
            plantStage: 'bloomed',
            presetId: preset.id,
          });
        } else {
          setStatus('idle');
          saveActiveSession(null);
        }
      } else {
        setMode('shortBreak');
        const dur = getDurationForMode('shortBreak', preset);
        setRemainingSeconds(dur);
        if (preset.autoStartBreaks) {
          const nextTarget = Date.now() + dur * 1000;
          targetEndTimeRef.current = nextTarget;
          const nextStart = new Date();
          sessionStartTimeRef.current = nextStart;
          setStatus('running');
          saveActiveSession({
            targetEndTime: nextTarget,
            sessionStartTime: nextStart.toISOString(),
            mode: 'shortBreak',
            status: 'running',
            remainingSeconds: dur,
            currentCycle,
            selectedTaskId,
            selectedHabitId,
            plantStage: 'bloomed',
            presetId: preset.id,
          });
        } else {
          setStatus('idle');
          saveActiveSession(null);
        }
      }
    } else {
      // Finished break -> next focus
      const nextCycle = mode === 'shortBreak' ? currentCycle + 1 : currentCycle;
      if (mode === 'shortBreak') {
        setCurrentCycle(nextCycle);
      }
      setMode('focus');
      const dur = getDurationForMode('focus', preset);
      setRemainingSeconds(dur);
      if (preset.autoStartFocus) {
        const nextTarget = Date.now() + dur * 1000;
        targetEndTimeRef.current = nextTarget;
        const nextStart = new Date();
        sessionStartTimeRef.current = nextStart;
        setStatus('running');
        saveActiveSession({
          targetEndTime: nextTarget,
          sessionStartTime: nextStart.toISOString(),
          mode: 'focus',
          status: 'running',
          remainingSeconds: dur,
          currentCycle: nextCycle,
          selectedTaskId,
          selectedHabitId,
          plantStage: 'seed',
          presetId: preset.id,
        });
      } else {
        setStatus('idle');
        saveActiveSession(null);
      }
    }
  }, [mode, preset, currentCycle, totalCycles, selectedTaskId, selectedHabitId, getDurationForMode]);

  // Main countdown loop with absolute timestamp synchronization
  useEffect(() => {
    if (status !== 'running') return;

    const interval = setInterval(() => {
      if (!targetEndTimeRef.current) return;
      const now = Date.now();
      const diffSec = Math.max(0, Math.round((targetEndTimeRef.current - now) / 1000));
      setRemainingSeconds(diffSec);

      if (diffSec <= 0) {
        clearInterval(interval);
        handleSessionComplete();
      }
    }, 250);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && targetEndTimeRef.current) {
        const now = Date.now();
        const diffSec = Math.max(0, Math.round((targetEndTimeRef.current - now) / 1000));
        setRemainingSeconds(diffSec);
        if (diffSec <= 0) {
          handleSessionComplete();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status, handleSessionComplete]);

  const startTimer = () => {
    const startTime = new Date();
    const targetEnd = Date.now() + remainingSeconds * 1000;
    sessionStartTimeRef.current = startTime;
    targetEndTimeRef.current = targetEnd;
    setStatus('running');
    const nextPlantStage = mode === 'focus' ? 'growing' : plantStage;
    if (mode === 'focus') {
      setPlantStage('growing');
    }
    saveActiveSession({
      targetEndTime: targetEnd,
      sessionStartTime: startTime.toISOString(),
      mode,
      status: 'running',
      remainingSeconds,
      currentCycle,
      selectedTaskId,
      selectedHabitId,
      plantStage: nextPlantStage,
      presetId: preset.id,
    });
  };

  const pauseTimer = () => {
    let diffSec = remainingSeconds;
    if (targetEndTimeRef.current) {
      diffSec = Math.max(0, Math.round((targetEndTimeRef.current - Date.now()) / 1000));
      setRemainingSeconds(diffSec);
      targetEndTimeRef.current = null;
    }
    setStatus('paused');
    saveActiveSession({
      targetEndTime: null,
      sessionStartTime: (sessionStartTimeRef.current || new Date()).toISOString(),
      mode,
      status: 'paused',
      remainingSeconds: diffSec,
      currentCycle,
      selectedTaskId,
      selectedHabitId,
      plantStage,
      presetId: preset.id,
    });
  };

  const resumeTimer = () => {
    const targetEnd = Date.now() + remainingSeconds * 1000;
    targetEndTimeRef.current = targetEnd;
    setStatus('running');
    const nextPlantStage =
      mode === 'focus' && plantStage !== 'bloomed' && plantStage !== 'withered' ? 'growing' : plantStage;
    if (mode === 'focus' && plantStage !== 'bloomed' && plantStage !== 'withered') {
      setPlantStage('growing');
    }
    saveActiveSession({
      targetEndTime: targetEnd,
      sessionStartTime: (sessionStartTimeRef.current || new Date()).toISOString(),
      mode,
      status: 'running',
      remainingSeconds,
      currentCycle,
      selectedTaskId,
      selectedHabitId,
      plantStage: nextPlantStage,
      presetId: preset.id,
    });
  };

  const resetTimer = () => {
    targetEndTimeRef.current = null;
    setStatus('idle');
    setRemainingSeconds(getDurationForMode(mode, preset));
    setPlantStage('seed');
    saveActiveSession(null);
  };

  const giveUpTimer = () => {
    targetEndTimeRef.current = null;
    setStatus('idle');
    if (mode === 'focus') {
      setPlantStage('withered');
    }
    setRemainingSeconds(getDurationForMode(mode, preset));
    saveActiveSession(null);
  };

  const resetPlant = () => {
    targetEndTimeRef.current = null;
    setStatus('idle');
    setMode('focus');
    setRemainingSeconds(getDurationForMode('focus', preset));
    setPlantStage('seed');
    saveActiveSession(null);
  };

  const skipStep = () => {
    targetEndTimeRef.current = null;
    setStatus('idle');
    if (mode === 'focus') {
      if (currentCycle >= totalCycles) {
        setMode('longBreak');
        setRemainingSeconds(getDurationForMode('longBreak', preset));
        setCurrentCycle(1);
      } else {
        setMode('shortBreak');
        setRemainingSeconds(getDurationForMode('shortBreak', preset));
      }
    } else {
      if (mode === 'shortBreak') {
        setCurrentCycle((c) => c + 1);
      }
      setMode('focus');
      setRemainingSeconds(getDurationForMode('focus', preset));
    }
    saveActiveSession(null);
  };

  return (
    <FocusTimerContext.Provider
      value={{
        mode,
        status,
        remainingSeconds,
        currentCycle,
        totalCycles,
        preset,
        presets,
        customFocusMinutes,
        setCustomFocusMinutes,
        selectedTaskId,
        setSelectedTaskId,
        selectedHabitId,
        setSelectedHabitId,
        plantType,
        setPlantType,
        plantStage,
        progress,
        startTimer,
        pauseTimer,
        resumeTimer,
        resetTimer,
        giveUpTimer,
        resetPlant,
        skipStep,
        selectPreset,
        refreshPresets,
      }}
    >
      {children}
    </FocusTimerContext.Provider>
  );
}

export function useFocusTimer(): FocusTimerContextValue {
  const context = useContext(FocusTimerContext);
  if (!context) {
    throw new Error('useFocusTimer must be used within FocusTimerProvider');
  }
  return context;
}
