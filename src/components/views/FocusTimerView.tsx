import { useState, useEffect, useRef } from 'react';
import { useRecentFocusSessions, focusRepo } from '../../db/focusRepo';
import { useTodoTasks } from '../../db/tasksRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatRelativeTime } from '../../utils/format';

type TimerMode = 'focus' | 'break';

export function FocusTimerView() {
  const { showSnackbar } = useSnackbar();
  const todoTasks = useTodoTasks() || [];
  const recentSessions = useRecentFocusSessions(20);

  // Active view tab: 'timer' or 'history'
  const [activeTab, setActiveTab] = useState<'timer' | 'history'>('timer');

  // Timer configuration
  const [mode, setMode] = useState<TimerMode>('focus');
  const [focusMinutes, setFocusMinutes] = useState(25);
  const breakMinutes = 5;

  const currentDurationSeconds = mode === 'focus' ? focusMinutes * 60 : breakMinutes * 60;
  const [timeLeft, setTimeLeft] = useState(currentDurationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);

  // Linked task (optional)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);

  // Screen Wake Lock reference
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const sessionStartTimeRef = useRef<Date | null>(null);

  // Sound chime helper via Web Audio API
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

      playTone(587.33, 0, 0.4); // D5
      playTone(880.00, 0.2, 0.8); // A5
    } catch {
      // AudioContext unavailable or blocked by browser policy
    }
  };

  // Wake Lock management
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

  // Timer countdown loop
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

  // Handle timer completion
  useEffect(() => {
    if (timeLeft === 0 && isRunning) {
      setIsRunning(false);
      setHasCompleted(true);
      playChime();

      if (mode === 'focus') {
        const startedAt = sessionStartTimeRef.current || new Date(Date.now() - focusMinutes * 60 * 1000);
        focusRepo.logFocusSession({
          startedAt,
          minutes: focusMinutes,
          taskId: selectedTaskId,
        }).then(() => {
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

  const switchMode = (newMode: TimerMode, newMinutes?: number) => {
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

  // Time calculations
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const selectedTask = todoTasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Focus Timer
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Deep, uninterrupted work sessions.
          </p>
        </div>

        {/* Tab switch: Timer / History */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60">
          <button
            type="button"
            onClick={() => setActiveTab('timer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'timer'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Timer
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>History</span>
            {recentSessions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300">
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
            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => switchMode('focus')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'focus'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Focus ({focusMinutes}m)
              </button>
              <button
                type="button"
                onClick={() => switchMode('break')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mode === 'break'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Break (5m)
              </button>
            </div>

            {/* Focus duration presets (when in focus mode and not running) */}
            {mode === 'focus' && !isRunning && (
              <div className="flex items-center gap-1">
                {[15, 25, 45, 60].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode('focus', m)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      focusMinutes === m
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700/60 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Big Countdown Display Card */}
          <div className="relative p-8 sm:p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center space-y-6 text-center">
            {/* Mode badge */}
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'animate-ping' : ''} ${mode === 'focus' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
              <span className="text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500">
                {mode === 'focus' ? 'Focus Session' : 'Rest & Recharge'}
              </span>
            </div>

            {/* Giant Monospace Timer */}
            <div className="text-6xl sm:text-8xl font-black tracking-tight font-mono text-slate-900 dark:text-white select-none">
              {timeFormatted}
            </div>

            {/* Optional Task Backlink */}
            {mode === 'focus' && (
              <div className="pt-2">
                {selectedTask ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-medium text-blue-700 dark:text-blue-300">
                    <span>🎯</span>
                    <span className="max-w-[200px] truncate">{selectedTask.title}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(null)}
                      className="hover:text-blue-900 dark:hover:text-blue-100 cursor-pointer ml-1"
                      title="Unlink task"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsTaskPickerOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-400 transition-colors cursor-pointer"
                  >
                    <span>+</span>
                    <span>Link to task (optional)</span>
                  </button>
                )}
              </div>
            )}

            {/* Controls: Start / Pause / Reset */}
            <div className="flex items-center gap-4 pt-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              >
                Reset
              </button>

              {!isRunning ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className={`px-8 py-3 rounded-2xl text-sm font-bold text-white transition-all shadow-md active:scale-95 cursor-pointer ${
                    mode === 'focus'
                      ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20'
                  }`}
                >
                  Start
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePause}
                  className="px-8 py-3 rounded-2xl text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                >
                  Pause
                </button>
              )}
            </div>

            {/* Wake lock indicator */}
            {isRunning && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1 pt-2">
                <span>💡 Screen stays awake while timer runs</span>
              </p>
            )}
          </div>

          {/* Completion Celebration & Break Offer */}
          {hasCompleted && (
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-3 animate-in fade-in duration-300">
              <div className="text-2xl">🎉</div>
              <h3 className="font-bold text-base text-emerald-900 dark:text-emerald-200">
                {mode === 'focus' ? 'Focus Session Completed!' : 'Break Finished!'}
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
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
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
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
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
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
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Recent Sessions (Last 20)</span>
            <span>Total logged: {recentSessions.length}</span>
          </div>

          {recentSessions.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-xl">
                ⏱️
              </div>
              <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                No focus sessions yet
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Completed focus countdowns are automatically logged here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {session.minutes}m
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {session.minutes} minutes focus
                        </span>
                        {session.taskTitle && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 truncate">
                            🎯 {session.taskTitle}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
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
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsTaskPickerOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl space-y-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Link to Task
              </h3>
              <button
                type="button"
                onClick={() => setIsTaskPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
              {todoTasks.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
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
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
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
