import { useState, useEffect, useRef } from 'react';
import { useFocusTimer } from '../../features/focus/FocusTimerContext';
import { useTodoTasks } from '../../db/tasksRepo';
import { useHabitsWithStats } from '../../db/habitsRepo';
import { PlantCanvas } from '../../features/focus/plants/PlantCanvas';
import { PlantLibraryModal } from '../../features/focus/plants/PlantLibraryModal';
import {
  DEFAULT_STARTER_PLANT_IDS,
  getPlantById,
  PLANT_CATEGORIES,
} from '../../features/focus/plants/plantLibrary';

export function FocusTimerView() {
  const {
    mode,
    status,
    remainingSeconds,
    currentCycle,
    totalCycles,
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
    giveUpTimer,
    resetPlant,
    skipStep,
  } = useFocusTimer();

  const todoTasks = useTodoTasks() || [];
  const { activeHabits } = useHabitsWithStats();

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [targetType, setTargetType] = useState<'task' | 'habit' | 'none'>('task');
  const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);
  const [showGiveUpConfirm, setShowGiveUpConfirm] = useState(false);

  // Screen Wake Lock while timer is running
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

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const selectedTask = todoTasks.find((t) => t.id === selectedTaskId);
  const selectedHabit = activeHabits.find((h) => h.id === selectedHabitId);

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';
  const isBreak = mode === 'shortBreak' || mode === 'longBreak';

  // 3 starter plants to display at the start of a session
  // If user selected a plant not in the default 3, include their selection as the middle/featured plant!
  const starterPlantIds: string[] = DEFAULT_STARTER_PLANT_IDS.includes(plantType as any)
    ? DEFAULT_STARTER_PLANT_IDS
    : [DEFAULT_STARTER_PLANT_IDS[0], plantType, DEFAULT_STARTER_PLANT_IDS[2]];

  const handleGiveUpClick = () => {
    if (isRunning || isPaused) {
      if (progress > 0.05) {
        setShowGiveUpConfirm(true);
      } else {
        giveUpTimer();
      }
    }
  };

  const confirmGiveUp = () => {
    setShowGiveUpConfirm(false);
    giveUpTimer();
  };

  const adjustMinutes = (delta: number) => {
    setCustomFocusMinutes(Math.max(1, Math.min(240, customFocusMinutes + delta)));
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24 pt-1 select-none">
      {/* Subheader Toolbar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
        <p className="text-xs font-medium text-ink-muted">
          Stay in flow and watch your plant flourish. 🌱
        </p>

        {/* Cycle Progress Dots */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-2 border border-border/60">
          <span className="text-[11px] font-medium text-ink-muted">
            Cycle {currentCycle}/{totalCycles}
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalCycles }).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i + 1 < currentCycle
                    ? 'bg-success'
                    : i + 1 === currentCycle
                    ? 'bg-accent ring-2 ring-accent/30'
                    : 'bg-surface-3'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ================================================================
          MINIMALIST ALL-IN-ONE SESSION SETUP (APPEARS ONLY AT START: status === 'idle')
          ================================================================ */}
      {isIdle && plantStage !== 'withered' && (
        <div className="p-4 rounded-xl bg-surface border border-border/80 shadow-xs space-y-3.5 animate-in fade-in duration-200">
          {/* Top Row: Focus Duration (Tactile Minimalist Pill Stepper) */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm">⏱️</span>
              <span className="text-xs font-semibold text-ink">
                Duration
              </span>
            </div>

            {/* Stepper controls */}
            <div className="flex items-center bg-surface-2 p-1 rounded-full border border-border/70">
              <button
                type="button"
                onClick={() => adjustMinutes(-5)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface active:scale-95 transition-all cursor-pointer min-h-[36px] min-w-[36px]"
                title="-5m"
                aria-label="Decrease 5 minutes"
              >
                -5
              </button>
              <div className="flex items-center justify-center px-3 min-w-[64px]">
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={customFocusMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setCustomFocusMinutes(val);
                  }}
                  className="w-8 text-center font-semibold text-sm text-ink bg-transparent focus:outline-none"
                  aria-label="Duration in minutes"
                />
                <span className="text-xs font-medium text-ink-muted">min</span>
              </div>
              <button
                type="button"
                onClick={() => adjustMinutes(5)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-ink-muted hover:text-ink hover:bg-surface active:scale-95 transition-all cursor-pointer min-h-[36px] min-w-[36px]"
                title="+5m"
                aria-label="Increase 5 minutes"
              >
                +5
              </button>
            </div>
          </div>

          {/* Middle Row: 3 Plant Choices */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink flex items-center gap-1.5">
                <span>🌱</span>
                <span>Select Companion</span>
              </span>
              <button
                type="button"
                onClick={() => setIsLibraryOpen(true)}
                className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
              >
                All 13 Plants ▾
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {starterPlantIds.map((pId) => {
                const p = getPlantById(pId);
                const isSelected = plantType === p.id;
                const cat = PLANT_CATEGORIES.find((c) => c.id === p.category);

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlantType(p.id)}
                    className={`py-2 px-2.5 rounded-xl border text-center transition-all flex items-center gap-2 cursor-pointer min-h-[46px] ${
                      isSelected
                        ? 'border-accent bg-accent-soft text-ink font-semibold'
                        : 'border-border/60 bg-surface-2/60 text-ink-muted hover:border-border hover:text-ink'
                    }`}
                  >
                    <span className="text-lg shrink-0">{p.icon}</span>
                    <div className="min-w-0 text-left flex-1">
                      <span className="text-xs font-medium truncate block text-ink">
                        {p.name}
                      </span>
                      <span className="text-[10px] text-ink-muted truncate block">
                        {cat?.badge || 'Daily Care'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Row: Target (Task / Habit / None) */}
          <div className="pt-2 border-t border-border/40 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-ink flex items-center gap-1.5">
                <span>🎯</span>
                <span>Focus Target</span>
              </span>

              {/* Segmented type selector */}
              <div className="flex items-center p-0.5 rounded-lg bg-surface-2 border border-border/60 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setTargetType('task');
                    setSelectedHabitId(null);
                  }}
                  className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                    targetType === 'task'
                      ? 'bg-surface text-ink font-semibold shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Task
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetType('habit');
                    setSelectedTaskId(null);
                  }}
                  className={`px-2.5 py-0.5 rounded-md transition-all cursor-pointer ${
                    targetType === 'habit'
                      ? 'bg-surface text-ink font-semibold shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  Habit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetType('none');
                    setSelectedTaskId(null);
                    setSelectedHabitId(null);
                  }}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    targetType === 'none'
                      ? 'bg-surface text-ink font-semibold shadow-xs'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  None
                </button>
              </div>
            </div>

            {targetType !== 'none' && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTargetDropdownOpen(!isTargetDropdownOpen)}
                  className="w-full px-3 py-2 rounded-xl border border-border/70 bg-surface hover:bg-surface-2 text-xs font-medium text-ink flex items-center justify-between gap-2 transition-all cursor-pointer min-h-[38px]"
                >
                  <span className="truncate">
                    {targetType === 'task'
                      ? selectedTask
                        ? `🎯 ${selectedTask.title}`
                        : 'Select a task to link...'
                      : selectedHabit
                      ? `${selectedHabit.iconOrEmoji || '⚡'} ${selectedHabit.name}`
                      : 'Select a habit to link...'}
                  </span>
                  <svg className="w-3.5 h-3.5 text-ink-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isTargetDropdownOpen && (
                  <div className="absolute top-full mt-1 inset-x-0 z-30 bg-surface rounded-xl border border-border shadow-card max-h-48 overflow-y-auto p-1 space-y-0.5 animate-in fade-in duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        if (targetType === 'task') setSelectedTaskId(null);
                        else setSelectedHabitId(null);
                        setIsTargetDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-surface-2 text-ink-muted cursor-pointer"
                    >
                      No specific {targetType}
                    </button>

                    {targetType === 'task' ? (
                      todoTasks.length === 0 ? (
                        <p className="p-2.5 text-xs text-ink-muted text-center">No active tasks found</p>
                      ) : (
                        todoTasks.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setSelectedTaskId(t.id || null);
                              setIsTargetDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg truncate transition-colors cursor-pointer ${
                              selectedTaskId === t.id
                                ? 'bg-accent-soft text-accent font-semibold'
                                : 'text-ink hover:bg-surface-2'
                            }`}
                          >
                            {t.title}
                          </button>
                        ))
                      )
                    ) : activeHabits.length === 0 ? (
                      <p className="p-2.5 text-xs text-ink-muted text-center">No active habits found</p>
                    ) : (
                      activeHabits.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => {
                            setSelectedHabitId(h.id || null);
                            setIsTargetDropdownOpen(false);
                          }}
                          className={`w-full text-left px-3 py-1.5 text-xs rounded-lg truncate transition-colors flex items-center gap-2 cursor-pointer ${
                            selectedHabitId === h.id
                              ? 'bg-accent-soft text-accent font-semibold'
                              : 'text-ink hover:bg-surface-2'
                          }`}
                        >
                          <span>{h.iconOrEmoji || '⚡'}</span>
                          <span className="truncate">{h.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          MAIN FOCUS ENVIRONMENT CARD
          ================================================================ */}
      <div className="p-4 sm:p-6 rounded-2xl bg-surface border border-border/80 shadow-xs flex flex-col items-center justify-center space-y-4">
        {/* Mode Pill Indicator */}
        <div className="flex items-center gap-2">
          {mode === 'focus' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Focus Session</span>
            </span>
          ) : mode === 'shortBreak' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              <span>☕</span>
              <span>Short Break</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
              <span>🌴</span>
              <span>Long Break</span>
            </span>
          )}

          {/* Active linked task / habit chip during timer run */}
          {!isIdle && (selectedTask || selectedHabit) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-surface-2 text-ink-muted border border-border/60 truncate max-w-[180px]">
              {selectedTask ? (
                <>
                  <span>🎯</span>
                  <span className="truncate">{selectedTask.title}</span>
                </>
              ) : selectedHabit ? (
                <>
                  <span>{selectedHabit.iconOrEmoji || '⚡'}</span>
                  <span className="truncate">{selectedHabit.name}</span>
                </>
              ) : null}
            </span>
          )}
        </div>

        {/* Dynamic Sky & Balcony Plant Environment */}
        <PlantCanvas
          plantType={plantType}
          progress={progress}
          stage={plantStage}
          isTimerRunning={isRunning}
        />

        {/* Digital Time Readout */}
        <div className="text-center space-y-1">
          <div className="text-5xl sm:text-6xl font-light tracking-tight tabular-nums text-ink">
            {timeFormatted}
          </div>

          {/* Plant status text message */}
          <div className="min-h-[22px]">
            {plantStage === 'withered' ? (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400 animate-in fade-in">
                Plant withered from breaking focus early. Every attempt helps you grow!
              </p>
            ) : plantStage === 'bloomed' ? (
              <p className="text-xs font-semibold text-success animate-in fade-in">
                Congratulations! Your plant is fully bloomed! 🎉
              </p>
            ) : isRunning ? (
              <p className="text-xs text-ink-muted">
                {isBreak ? 'Rest and recharge your mind ☕' : 'Stay in flow — your plant is growing strong 🌱'}
              </p>
            ) : isPaused ? (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Timer paused. Resume when you're ready.
              </p>
            ) : (
              <p className="text-xs text-ink-muted">
                Press start to begin nurturing your plant on the balcony.
              </p>
            )}
          </div>
        </div>

        {/* Control Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          {plantStage === 'withered' ? (
            <button
              type="button"
              onClick={resetPlant}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-accent text-accent-ink hover:opacity-90 active:scale-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer min-h-[42px]"
            >
              <span>🌱</span>
              <span>Plant a New Seed</span>
            </button>
          ) : plantStage === 'bloomed' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resetPlant}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-accent text-accent-ink hover:opacity-90 active:scale-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer min-h-[42px]"
              >
                <span>🌱</span>
                <span>Plant Another Seed</span>
              </button>
              {isBreak && !isRunning && (
                <button
                  type="button"
                  onClick={startTimer}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-ink transition-all cursor-pointer flex items-center gap-2 min-h-[42px]"
                >
                  <span>☕</span>
                  <span>Start Break</span>
                </button>
              )}
            </div>
          ) : isIdle ? (
            <button
              type="button"
              onClick={startTimer}
              className="px-8 py-3 rounded-full text-xs font-semibold bg-accent text-accent-ink hover:opacity-90 active:scale-95 transition-all shadow-xs flex items-center gap-2 cursor-pointer min-h-[44px]"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>{isBreak ? 'Start Break' : 'Start Focus'}</span>
            </button>
          ) : isRunning ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={pauseTimer}
                className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-surface-2 hover:bg-surface-3 text-ink transition-all cursor-pointer flex items-center gap-2 min-h-[42px]"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                <span>Pause</span>
              </button>

              <button
                type="button"
                onClick={isBreak ? skipStep : handleGiveUpClick}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer min-h-[42px]"
              >
                {isBreak ? 'Skip Break' : 'Give Up'}
              </button>
            </div>
          ) : isPaused ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resumeTimer}
                className="px-7 py-2.5 rounded-xl text-xs font-semibold bg-accent text-accent-ink hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer flex items-center gap-2 min-h-[42px]"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Resume</span>
              </button>

              <button
                type="button"
                onClick={isBreak ? skipStep : handleGiveUpClick}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer min-h-[42px]"
              >
                {isBreak ? 'Skip Break' : 'Give Up'}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Give Up Confirmation Dialog */}
      {showGiveUpConfirm && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900/60 space-y-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🥀</span>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                Are you sure you want to give up?
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                Leaving focus early will cause your plant to wither. Stay a little longer to help it bloom!
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowGiveUpConfirm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Keep Focusing
            </button>
            <button
              type="button"
              onClick={confirmGiveUp}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
            >
              Yes, Give Up
            </button>
          </div>
        </div>
      )}

      {/* Plant Library Modal */}
      <PlantLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        selectedPlantId={plantType}
        onSelectPlant={(pId) => setPlantType(pId)}
      />
    </div>
  );
}
