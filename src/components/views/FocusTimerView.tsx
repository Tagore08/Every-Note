import { useState, useEffect, useRef } from 'react';
import { useFlag } from '../../app/flags';
import { useRecentFocusSessions, useWeeklyFocusStats, focusRepo } from '../../db/focusRepo';
import { useTodoTasks } from '../../db/tasksRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatRelativeTime } from '../../utils/format';
import { useFocusTimer } from '../../features/focus/FocusTimerContext';
import { PresetsSheet } from '../../features/focus/PresetsSheet';
import { WeeklyFocusChart } from '../../features/focus/WeeklyFocusChart';

export function FocusTimerView() {
  const isFocusPro = useFlag('focusPro');

  if (isFocusPro) {
    return <FocusProView />;
  }

  return <SimpleTimerView />;
}

// ==========================================
// Focus Pro Implementation (Phase 6)
// ==========================================
function FocusProView() {
  const { showSnackbar } = useSnackbar();
  const todoTasks = useTodoTasks() || [];
  const recentSessions = useRecentFocusSessions(20);
  const weeklyStats = useWeeklyFocusStats(7);

  const {
    mode,
    status,
    remainingSeconds,
    currentCycle,
    totalCycles,
    preset,
    selectedTaskId,
    setSelectedTaskId,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    skipStep,
  } = useFocusTimer();

  const [activeTab, setActiveTab] = useState<'timer' | 'history'>('timer');
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);

  // Screen Wake Lock
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const acquireLock = async () => {
      if (status === 'running' && 'wakeLock' in navigator && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {
          // Unsupported or denied
        }
      }
    };

    const releaseLock = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };

    if (status === 'running') {
      acquireLock();
    } else {
      releaseLock();
    }

    return () => {
      releaseLock();
    };
  }, [status]);

  const handleDeleteSession = async (id?: number) => {
    if (!id) return;
    try {
      await focusRepo.deleteSession(id);
      showSnackbar({ message: 'Session removed from history' });
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const selectedTask = todoTasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Focus Pro
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-pill bg-accent/15 text-accent tracking-wide">
              Pro
            </span>
          </div>
          <p className="text-xs sm:text-sm font-medium text-ink-muted mt-1">
            Interval cycles, timestamp-anchored timer & analytics.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center p-1 bg-surface-elevated rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'timer'
                ? 'bg-surface text-ink shadow-card'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Timer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-surface text-ink shadow-card'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <span>History</span>
            {recentSessions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-accent/20 text-accent font-bold">
                {recentSessions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'timer' ? (
        <div className="space-y-6">
          {/* Active Preset Chip & Mode / Cycle Status */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Preset Selector Button */}
            <button
              type="button"
              onClick={() => setIsPresetsOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-pill border border-border bg-surface hover:border-accent text-xs font-medium text-ink shadow-card transition-colors cursor-pointer min-h-[36px]"
            >
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="font-semibold">{preset.name}</span>
              <span className="text-ink-muted">
                ({preset.focusMin}/{preset.shortBreakMin}m)
              </span>
              <svg className="w-3.5 h-3.5 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Cycles dots */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-surface border border-border text-xs text-ink-muted shadow-card">
              <span className="font-semibold text-ink">Cycle {currentCycle}/{totalCycles}</span>
              <div className="flex items-center gap-1 ml-1">
                {Array.from({ length: totalCycles }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-2 h-2 rounded-full transition-all ${
                      i < currentCycle - 1
                        ? 'bg-accent'
                        : i === currentCycle - 1
                        ? 'bg-accent ring-2 ring-accent/30'
                        : 'bg-border'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Big Countdown Display Card */}
          <div className="relative p-8 sm:p-12 rounded-3xl bg-surface border border-border shadow-card flex flex-col items-center justify-center space-y-6 text-center">
            {/* Mode badge */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-pill bg-surface-elevated border border-border">
              <span
                className={`w-2.5 h-2.5 rounded-full ${status === 'running' ? 'animate-ping' : ''} ${
                  mode === 'focus' ? 'bg-accent' : 'bg-success'
                }`}
              />
              <span className="text-xs uppercase tracking-widest font-bold text-ink">
                {mode === 'focus'
                  ? 'Focus Interval'
                  : mode === 'shortBreak'
                  ? 'Short Break'
                  : 'Long Break'}
              </span>
            </div>

            {/* Giant Monospace Timer */}
            <div className="text-6xl sm:text-8xl font-black tracking-tight font-mono text-ink select-none">
              {timeFormatted}
            </div>

            {/* Optional Task Backlink */}
            {mode === 'focus' && (
              <div className="pt-1">
                {selectedTask ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-soft border border-accent/30 text-xs font-medium text-accent">
                    <span>🎯</span>
                    <span className="max-w-[200px] truncate">{selectedTask.title}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(null)}
                      className="hover:opacity-75 cursor-pointer ml-1"
                      title="Unlink task"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsTaskPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-ink-muted hover:text-ink border border-dashed border-border hover:border-accent transition-colors cursor-pointer"
                  >
                    <span>+</span>
                    <span>Link to task (optional)</span>
                  </button>
                )}
              </div>
            )}

            {/* Controls: Reset / Start-Pause-Resume / Skip */}
            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={resetTimer}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface-elevated border border-border transition-all cursor-pointer min-h-[44px]"
              >
                Reset
              </button>

              {status === 'idle' ? (
                <button
                  type="button"
                  onClick={startTimer}
                  className="px-8 py-3 rounded-2xl text-sm font-bold bg-accent text-accent-contrast hover:bg-accent-hover transition-all shadow-md active:scale-95 cursor-pointer min-h-[44px]"
                >
                  Start
                </button>
              ) : status === 'paused' ? (
                <button
                  type="button"
                  onClick={resumeTimer}
                  className="px-8 py-3 rounded-2xl text-sm font-bold bg-accent text-accent-contrast hover:bg-accent-hover transition-all shadow-md active:scale-95 cursor-pointer min-h-[44px]"
                >
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={pauseTimer}
                  className="px-8 py-3 rounded-2xl text-sm font-bold bg-warning text-black hover:opacity-90 transition-all shadow-md active:scale-95 cursor-pointer min-h-[44px]"
                >
                  Pause
                </button>
              )}

              <button
                type="button"
                onClick={skipStep}
                title="Skip to next stage"
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface-elevated border border-border transition-all cursor-pointer min-h-[44px]"
              >
                Skip ⏭
              </button>
            </div>

            {/* Background survival notice */}
            {status === 'running' && (
              <p className="text-[11px] text-ink-muted flex items-center gap-1 pt-1">
                <span>💡 Survives tab switches & background throttling</span>
              </p>
            )}
          </div>

          {/* Weekly Stats Bar Chart */}
          <WeeklyFocusChart stats={weeklyStats} />
        </div>
      ) : (
        /* History Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-ink-muted font-medium">
            <span>Recent Sessions (Last 20)</span>
            <span>Total logged: {recentSessions.length}</span>
          </div>

          {recentSessions.length === 0 ? (
            <div className="py-16 text-center space-y-3 p-6 rounded-card border border-border bg-surface">
              <div className="w-12 h-12 rounded-full bg-surface-elevated mx-auto flex items-center justify-center text-xl">
                ⏱️
              </div>
              <h3 className="font-semibold text-sm text-ink">
                No focus sessions yet
              </h3>
              <p className="text-xs text-ink-muted max-w-xs mx-auto">
                Completed focus countdowns are automatically logged here with presets.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3.5 rounded-card border border-border bg-surface flex items-center justify-between gap-3 shadow-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-bold text-xs shrink-0">
                      {session.minutes}m
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-ink">
                          {session.minutes} minutes focus
                        </span>
                        {session.presetName && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-pill bg-accent-soft text-accent border border-accent/20">
                            {session.presetName}
                          </span>
                        )}
                        {session.taskTitle && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-elevated text-ink truncate border border-border">
                            🎯 {session.taskTitle}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {new Date(session.startedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(session.startedAt).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        ({formatRelativeTime(session.startedAt)})
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSession(session.id)}
                    className="p-1.5 text-ink-muted hover:text-danger rounded-lg transition-colors cursor-pointer"
                    title="Remove session"
                    aria-label="Remove session"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Presets Sheet */}
      <PresetsSheet isOpen={isPresetsOpen} onClose={() => setIsPresetsOpen(false)} />

      {/* Task Picker Modal */}
      {isTaskPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsTaskPickerOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface border border-border p-5 shadow-2xl space-y-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-ink">
                Link to Task
              </h3>
              <button
                type="button"
                onClick={() => setIsTaskPickerOpen(false)}
                className="text-ink-muted hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
              {todoTasks.length === 0 ? (
                <p className="text-xs text-ink-muted py-4 text-center">
                  No active todo tasks found.
                </p>
              ) : (
                todoTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(t.id ?? null);
                      setIsTaskPickerOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${
                      selectedTaskId === t.id
                        ? 'border-accent bg-accent-soft text-accent font-bold'
                        : 'border-border text-ink hover:bg-surface-elevated'
                    }`}
                  >
                    <span className="truncate">{t.title}</span>
                    {selectedTaskId === t.id && <span>✓</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Simple Timer Implementation (Stage 10 Fallback)
// ==========================================
type SimpleTimerMode = 'focus' | 'break';

function SimpleTimerView() {
  const { showSnackbar } = useSnackbar();
  const todoTasks = useTodoTasks() || [];
  const recentSessions = useRecentFocusSessions(20);

  const [activeTab, setActiveTab] = useState<'timer' | 'history'>('timer');
  const [mode, setMode] = useState<SimpleTimerMode>('focus');
  const [focusMinutes, setFocusMinutes] = useState(25);
  const breakMinutes = 5;

  const currentDurationSeconds = mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;
  const [timeLeft, setTimeLeft] = useState(currentDurationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const sessionStartTimeRef = useRef<Date | null>(null);

  const playChime = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      playTone(587.33, 0, 0.4);
      playTone(880.0, 0.2, 0.8);
    } catch {
      // AudioContext unavailable
    }
  };

  useEffect(() => {
    const acquireLock = async () => {
      if (isRunning && 'wakeLock' in navigator && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {
          // Unsupported or denied
        }
      }
    };

    const releaseLock = () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };

    if (isRunning) {
      acquireLock();
    } else {
      releaseLock();
    }

    return () => {
      releaseLock();
    };
  }, [isRunning]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      setHasCompleted(true);
      playChime();

      if (mode === 'focus') {
        const startedAt =
          sessionStartTimeRef.current || new Date(Date.now() - focusMinutes * 60 * 1000);
        focusRepo
          .logFocusSession({
            startedAt,
            minutes: focusMinutes,
            taskId: selectedTaskId,
          })
          .then(() => {
            showSnackbar({
              message: `Completed ${focusMinutes}m focus session! Logged to history.`,
            });
          });
      } else {
        showSnackbar({
          message: 'Break finished! Ready for the next focus session.',
        });
      }
    }
  }, [timeLeft, isRunning, mode, focusMinutes, selectedTaskId, showSnackbar]);

  const handleStart = () => {
    if (!sessionStartTimeRef.current && timeLeft === currentDurationSeconds) {
      sessionStartTimeRef.current = new Date();
    }
    setHasCompleted(false);
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setHasCompleted(false);
    sessionStartTimeRef.current = null;
    setTimeLeft(currentDurationSeconds);
  };

  const switchMode = (newMode: SimpleTimerMode, newMinutes?: number) => {
    setIsRunning(false);
    setHasCompleted(false);
    sessionStartTimeRef.current = null;
    setMode(newMode);
    if (newMode === 'focus' && newMinutes) {
      setFocusMinutes(newMinutes);
      setTimeLeft(newMinutes * 60);
    } else if (newMode === 'focus') {
      setTimeLeft(focusMinutes * 60);
    } else {
      setTimeLeft(breakMinutes * 60);
    }
  };

  const handleDeleteSession = async (id?: number) => {
    if (!id) return;
    try {
      await focusRepo.deleteSession(id);
      showSnackbar({ message: 'Session removed from history' });
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const selectedTask = todoTasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Focus Timer
          </h1>
          <p className="text-xs sm:text-sm font-medium text-ink-muted mt-1">
            Deep, uninterrupted work sessions.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center p-1 bg-surface-elevated rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'timer'
                ? 'bg-surface text-ink shadow-card'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            Timer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-surface text-ink shadow-card'
                : 'text-ink-muted hover:text-ink'
            }`}
          >
            <span>History</span>
            {recentSessions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-accent/20 text-accent font-bold">
                {recentSessions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'timer' ? (
        <div className="space-y-8">
          {/* Mode Switcher & Presets */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex p-1 bg-surface-elevated rounded-xl border border-border">
              <button
                type="button"
                onClick={() => switchMode('focus')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'focus'
                    ? 'bg-accent text-accent-contrast shadow-card'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Focus ({focusMinutes}m)
              </button>
              <button
                type="button"
                onClick={() => switchMode('break')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'break'
                    ? 'bg-success text-white shadow-card'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                Break (5m)
              </button>
            </div>

            {mode === 'focus' && !isRunning && (
              <div className="flex items-center gap-1">
                {[15, 25, 45, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode('focus', m)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      focusMinutes === m
                        ? 'border-accent bg-accent-soft text-accent font-bold'
                        : 'border-border text-ink-muted hover:bg-surface-elevated'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Big Countdown Display Card */}
          <div className="relative p-8 sm:p-12 rounded-3xl bg-surface border border-border shadow-card flex flex-col items-center justify-center space-y-6 text-center">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'animate-ping' : ''} ${
                  mode === 'focus' ? 'bg-accent' : 'bg-success'
                }`}
              />
              <span className="text-xs uppercase tracking-widest font-bold text-ink-muted">
                {mode === 'focus' ? 'Focus Session' : 'Rest & Recharge'}
              </span>
            </div>

            <div className="text-6xl sm:text-8xl font-black tracking-tight font-mono text-ink select-none">
              {timeFormatted}
            </div>

            {mode === 'focus' && (
              <div className="pt-2">
                {selectedTask ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-soft border border-accent/30 text-xs font-medium text-accent">
                    <span>🎯</span>
                    <span className="max-w-[200px] truncate">{selectedTask.title}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(null)}
                      className="hover:opacity-75 cursor-pointer ml-1"
                      title="Unlink task"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsTaskPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-ink-muted hover:text-ink border border-dashed border-border hover:border-accent transition-colors cursor-pointer"
                  >
                    <span>+</span>
                    <span>Link to task (optional)</span>
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 pt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-ink-muted hover:bg-surface-elevated border border-border transition-all cursor-pointer"
              >
                Reset
              </button>

              {!isRunning ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className={`px-8 py-3 rounded-2xl text-sm font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer ${
                    mode === 'focus'
                      ? 'bg-accent text-accent-contrast hover:bg-accent-hover'
                      : 'bg-success text-white hover:opacity-90'
                  }`}
                >
                  Start
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="px-8 py-3 rounded-2xl text-sm font-bold bg-warning text-black hover:opacity-90 transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Pause
                </button>
              )}
            </div>

            {isRunning && (
              <p className="text-[11px] text-ink-muted flex items-center gap-1 pt-2">
                <span>💡 Screen stays awake while timer runs</span>
              </p>
            )}
          </div>

          {hasCompleted && (
            <div className="p-5 rounded-2xl bg-success/15 border border-success/30 text-center space-y-3 animate-in fade-in duration-300">
              <div className="text-2xl">🎉</div>
              <h3 className="font-bold text-base text-ink">
                {mode === 'focus' ? 'Focus Session Completed!' : 'Break Finished!'}
              </h3>
              <p className="text-xs text-ink-muted">
                {mode === 'focus'
                  ? 'Great effort! Take a quick 5-minute break to rest your eyes.'
                  : 'Ready to dive back into deep work?'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                {mode === 'focus' ? (
                  <button
                    type="button"
                    onClick={() => {
                      switchMode('break');
                      handleStart();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-success text-white hover:opacity-90 shadow-card transition-all cursor-pointer"
                  >
                    Start 5-min Break
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      switchMode('focus');
                      handleStart();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-accent text-accent-contrast hover:bg-accent-hover shadow-card transition-all cursor-pointer"
                  >
                    Start Next Focus Session
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* History Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-ink-muted font-medium">
            <span>Recent Sessions (Last 20)</span>
            <span>Total logged: {recentSessions.length}</span>
          </div>

          {recentSessions.length === 0 ? (
            <div className="py-16 text-center space-y-3 p-6 rounded-card border border-border bg-surface">
              <div className="w-12 h-12 rounded-full bg-surface-elevated mx-auto flex items-center justify-center text-xl">
                ⏱️
              </div>
              <h3 className="font-semibold text-sm text-ink">
                No focus sessions yet
              </h3>
              <p className="text-xs text-ink-muted max-w-xs mx-auto">
                Completed focus countdowns are automatically logged here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3.5 rounded-card border border-border bg-surface flex items-center justify-between gap-3 shadow-card"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-bold text-xs shrink-0">
                      {session.minutes}m
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {session.minutes} minutes focus
                        </span>
                        {session.taskTitle && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-elevated text-ink truncate border border-border">
                            🎯 {session.taskTitle}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted">
                        {new Date(session.startedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(session.startedAt).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        ({formatRelativeTime(session.startedAt)})
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSession(session.id)}
                    className="p-1.5 text-ink-muted hover:text-danger rounded-lg transition-colors cursor-pointer"
                    title="Remove session"
                    aria-label="Remove session"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task Picker Modal */}
      {isTaskPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsTaskPickerOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface border border-border p-5 shadow-2xl space-y-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-sm text-ink">
                Link to Task
              </h3>
              <button
                type="button"
                onClick={() => setIsTaskPickerOpen(false)}
                className="text-ink-muted hover:text-ink text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
              {todoTasks.length === 0 ? (
                <p className="text-xs text-ink-muted py-4 text-center">
                  No active todo tasks found.
                </p>
              ) : (
                todoTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(t.id ?? null);
                      setIsTaskPickerOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl text-xs font-medium border transition-all cursor-pointer flex items-center justify-between ${
                      selectedTaskId === t.id
                        ? 'border-accent bg-accent-soft text-accent font-bold'
                        : 'border-border text-ink hover:bg-surface-elevated'
                    }`}
                  >
                    <span className="truncate">{t.title}</span>
                    {selectedTaskId === t.id && <span>✓</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
