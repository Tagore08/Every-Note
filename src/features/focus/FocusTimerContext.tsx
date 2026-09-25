import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import type { TimerPreset, FocusSessionKind } from '../../types/focus';
import { timerPresetsRepo, DEFAULT_TIMER_PRESETS } from '../../db/repos/timerPresetsRepo';
import { focusRepo } from '../../db/focusRepo';

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';
export type TimerStatus = 'idle' | 'running' | 'paused';

interface FocusTimerContextValue {
  mode: TimerMode;
  status: TimerStatus;
  remainingSeconds: number;
  currentCycle: number;
  totalCycles: number;
  preset: TimerPreset;
  presets: TimerPreset[];
  selectedTaskId: number | null;
  setSelectedTaskId: (id: number | null) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
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
  const [presets, setPresets] = useState<TimerPreset[]>([]);
  const [preset, setPreset] = useState<TimerPreset>({
    id: 1,
    ...DEFAULT_TIMER_PRESETS[0],
  });

  const [mode, setMode] = useState<TimerMode>('focus');
  const [status, setStatus] = useState<TimerStatus>('idle');
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  // Absolute end timestamp preventing drift
  const targetEndTimeRef = useRef<number | null>(null);
  const sessionStartTimeRef = useRef<Date | null>(null);

  const totalCycles = preset.cycles || 4;

  const getDurationForMode = useCallback(
    (m: TimerMode, p: TimerPreset): number => {
      switch (m) {
        case 'focus':
          return (p.focusMin || 25) * 60;
        case 'shortBreak':
          return (p.shortBreakMin || 5) * 60;
        case 'longBreak':
          return (p.longBreakMin || 15) * 60;
      }
    },
    []
  );

  const refreshPresets = useCallback(async () => {
    try {
      const all = await timerPresetsRepo.getAll();
      setPresets(all);
      const def = all.find((p) => p.isDefault) || all[0];
      if (def && status === 'idle') {
        setPreset(def);
        setRemainingSeconds(getDurationForMode(mode, def));
      }
    } catch (e) {
      console.error('Failed to load timer presets:', e);
    }
  }, [mode, status, getDurationForMode]);

  useEffect(() => {
    refreshPresets();
  }, [refreshPresets]);

  const selectPreset = (newPreset: TimerPreset) => {
    setPreset(newPreset);
    if (status === 'idle') {
      setRemainingSeconds(getDurationForMode(mode, newPreset));
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

    // Advance cycle / mode
    if (mode === 'focus') {
      if (currentCycle >= totalCycles) {
        setMode('longBreak');
        setRemainingSeconds(getDurationForMode('longBreak', preset));
        setCurrentCycle(1);
        if (preset.autoStartBreaks) {
          targetEndTimeRef.current = Date.now() + getDurationForMode('longBreak', preset) * 1000;
          sessionStartTimeRef.current = new Date();
          setStatus('running');
        } else {
          setStatus('idle');
        }
      } else {
        setMode('shortBreak');
        setRemainingSeconds(getDurationForMode('shortBreak', preset));
        if (preset.autoStartBreaks) {
          targetEndTimeRef.current = Date.now() + getDurationForMode('shortBreak', preset) * 1000;
          sessionStartTimeRef.current = new Date();
          setStatus('running');
        } else {
          setStatus('idle');
        }
      }
    } else {
      // Finished break -> next focus
      if (mode === 'shortBreak') {
        setCurrentCycle((c) => c + 1);
      }
      setMode('focus');
      setRemainingSeconds(getDurationForMode('focus', preset));
      if (preset.autoStartFocus) {
        targetEndTimeRef.current = Date.now() + getDurationForMode('focus', preset) * 1000;
        sessionStartTimeRef.current = new Date();
        setStatus('running');
      } else {
        setStatus('idle');
      }
    }
  }, [mode, preset, currentCycle, totalCycles, selectedTaskId, getDurationForMode]);

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
    sessionStartTimeRef.current = new Date();
    targetEndTimeRef.current = Date.now() + remainingSeconds * 1000;
    setStatus('running');
  };

  const pauseTimer = () => {
    if (targetEndTimeRef.current) {
      const diffSec = Math.max(0, Math.round((targetEndTimeRef.current - Date.now()) / 1000));
      setRemainingSeconds(diffSec);
      targetEndTimeRef.current = null;
    }
    setStatus('paused');
  };

  const resumeTimer = () => {
    targetEndTimeRef.current = Date.now() + remainingSeconds * 1000;
    setStatus('running');
  };

  const resetTimer = () => {
    targetEndTimeRef.current = null;
    setStatus('idle');
    setRemainingSeconds(getDurationForMode(mode, preset));
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
        selectedTaskId,
        setSelectedTaskId,
        startTimer,
        pauseTimer,
        resumeTimer,
        resetTimer,
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
