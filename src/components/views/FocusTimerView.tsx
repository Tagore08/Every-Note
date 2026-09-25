import { useState, useEffect, useRef } from 'react';
import { useFocusTimer, type PlantType } from '../../features/focus/FocusTimerContext';
import { useTodoTasks } from '../../db/tasksRepo';
import { PresetsSheet } from '../../features/focus/PresetsSheet';
import { PlantCanvas } from '../../features/focus/plants/PlantCanvas';

export function FocusTimerView() {
  const {
    mode,
    status,
    remainingSeconds,
    currentCycle,
    totalCycles,
    preset,
    presets,
    selectedTaskId,
    setSelectedTaskId,
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
    selectPreset,
  } = useFocusTimer();

  const todoTasks = useTodoTasks() || [];
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);
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

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isIdle = status === 'idle';
  const isBreak = mode === 'shortBreak' || mode === 'longBreak';

  const handleGiveUpClick = () => {
    // If running in focus mode, ask confirm or wither
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

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20 pt-2 select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Focus Mode</span>
            <span className="text-xl">🌱</span>
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Stay focused and watch your plant flourish.
          </p>
        </div>

        {/* Cycle Progress Dots */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 self-start sm:self-auto">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Cycle {currentCycle} of {totalCycles}
          </span>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalCycles }).map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-all ${
                  i + 1 < currentCycle
                    ? 'bg-emerald-500'
                    : i + 1 === currentCycle
                    ? 'bg-blue-600 ring-2 ring-blue-400/40'
                    : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Preset Switcher Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {presets.slice(0, 3).map((p) => {
            const isSelected = preset.id === p.id;
            return (
              <button
                key={p.name}
                type="button"
                disabled={isRunning}
                onClick={() => selectPreset(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                }`}
              >
                <span>{p.name}</span>
                <span className={`ml-1 text-[11px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                  ({p.focusMin}m)
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={isRunning}
          onClick={() => setIsPresetsOpen(true)}
          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <span>More Presets ▾</span>
        </button>
      </div>

      {/* Main Focus Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center justify-center space-y-6">
        {/* Mode Pill Indicator */}
        <div className="flex items-center gap-2">
          {mode === 'focus' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Focus Session</span>
            </span>
          ) : mode === 'shortBreak' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              <span>☕</span>
              <span>Short Break</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-500/30">
              <span>🌴</span>
              <span>Long Break</span>
            </span>
          )}
        </div>

        {/* The Animated Plant */}
        <PlantCanvas
          plantType={plantType}
          onSelectPlant={(type: PlantType) => setPlantType(type)}
          progress={progress}
          stage={plantStage}
          isTimerRunning={isRunning}
        />

        {/* Digital Time Readout */}
        <div className="text-center space-y-1">
          <div className="text-5xl sm:text-6xl font-black tracking-tight tabular-nums text-slate-900 dark:text-white">
            {timeFormatted}
          </div>

          {/* Plant status text message */}
          <div className="min-h-[24px]">
            {plantStage === 'withered' ? (
              <p className="text-xs sm:text-sm font-semibold text-rose-600 dark:text-rose-400 animate-in fade-in">
                Plant withered from breaking focus early. Every attempt helps you grow!
              </p>
            ) : plantStage === 'bloomed' ? (
              <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in">
                Congratulations! Your plant is fully bloomed! 🎉
              </p>
            ) : isRunning ? (
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {isBreak ? 'Rest and recharge your mind ☕' : 'Stay in flow — your plant is growing strong 🌱'}
              </p>
            ) : isPaused ? (
              <p className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400">
                Timer paused. Resume when you're ready.
              </p>
            ) : (
              <p className="text-xs sm:text-sm text-slate-400">
                Press start to begin nurturing your plant.
              </p>
            )}
          </div>
        </div>

        {/* Linked Task Selector */}
        {todoTasks.length > 0 && isIdle && plantStage !== 'withered' && (
          <div className="relative w-full max-w-xs">
            <button
              type="button"
              onClick={() => setIsTaskPickerOpen(!isTaskPickerOpen)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between gap-2 transition-all cursor-pointer"
            >
              <span className="truncate">
                {selectedTask ? `🎯 ${selectedTask.title}` : 'Select a task to focus on...'}
              </span>
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {isTaskPickerOpen && (
              <div className="absolute top-full mt-1 inset-x-0 z-30 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-48 overflow-y-auto p-1 space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskId(null);
                    setIsTaskPickerOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                >
                  No specific task
                </button>
                {todoTasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTaskId(t.id || null);
                      setIsTaskPickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded-lg truncate transition-colors cursor-pointer ${
                      selectedTaskId === t.id
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 font-semibold'
                        : 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Task Chip during active run */}
        {selectedTask && !isIdle && (
          <div className="px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <span>🎯</span>
            <span className="truncate max-w-[220px]">{selectedTask.title}</span>
          </div>
        )}

        {/* Control Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          {plantStage === 'withered' ? (
            <button
              type="button"
              onClick={resetPlant}
              className="px-6 py-3 rounded-2xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>🌱</span>
              <span>Plant a New Seed</span>
            </button>
          ) : plantStage === 'bloomed' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resetPlant}
                className="px-6 py-3 rounded-2xl text-sm font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span>🌱</span>
                <span>Plant Another Seed</span>
              </button>
              {isBreak && !isRunning && (
                <button
                  type="button"
                  onClick={startTimer}
                  className="px-5 py-3 rounded-2xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-2"
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
              className="px-8 py-3.5 rounded-2xl text-sm font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white transition-all shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>{isBreak ? 'Start Break' : 'Start Focus'}</span>
            </button>
          ) : isRunning ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={pauseTimer}
                className="px-6 py-3 rounded-2xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                <span>Pause</span>
              </button>

              <button
                type="button"
                onClick={isBreak ? skipStep : handleGiveUpClick}
                className="px-5 py-3 rounded-2xl text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
              >
                {isBreak ? 'Skip Break' : 'Give Up'}
              </button>
            </div>
          ) : isPaused ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resumeTimer}
                className="px-7 py-3 rounded-2xl text-sm font-bold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white transition-all shadow-md cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>Resume</span>
              </button>

              <button
                type="button"
                onClick={isBreak ? skipStep : handleGiveUpClick}
                className="px-5 py-3 rounded-2xl text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
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

      {/* Presets Management Sheet */}
      <PresetsSheet
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
      />
    </div>
  );
}
