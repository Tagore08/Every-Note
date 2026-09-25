import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Routine, RoutineRun, RoutineItem, RoutineTimeOfDay } from '../../../types/routine';
import type { Task } from '../../../types/task';
import { routinesRepo } from '../../../db/repos/routinesRepo';
import { tasksRepo } from '../../../db/tasksRepo';
import { habitsRepo } from '../../../db/habitsRepo';
import { useSnackbar } from '../../../context/SnackbarContext';

interface RoutineCardProps {
  routines: Routine[];
  routineRuns: RoutineRun[];
  tasks: Task[];
  currentTimeOfDay: RoutineTimeOfDay;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function RoutineCard({
  routines,
  routineRuns,
  tasks,
  currentTimeOfDay,
  isCollapsed,
  onToggleCollapse,
}: RoutineCardProps) {
  const navigate = useNavigate();
  const { showUndo } = useSnackbar();

  // Map runs by routineId
  const runsMap = useMemo(() => {
    return new Map(routineRuns.map((r) => [r.routineId, r]));
  }, [routineRuns]);

  // Active routines that have a run today or are scheduled today
  const activeTodayRoutines = useMemo(() => {
    return routines.filter((r) => runsMap.has(r.id!));
  }, [routines, runsMap]);

  // Select routine matching currentTimeOfDay, or first available
  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(() => {
    const matching = activeTodayRoutines.find((r) => r.timeOfDay === currentTimeOfDay);
    return matching?.id || activeTodayRoutines[0]?.id || null;
  });

  const activeRoutine = useMemo(() => {
    return activeTodayRoutines.find((r) => r.id === selectedRoutineId) || activeTodayRoutines[0] || null;
  }, [activeTodayRoutines, selectedRoutineId]);

  if (!activeRoutine || !activeRoutine.id) {
    return null;
  }

  const run = runsMap.get(activeRoutine.id);
  if (!run) return null;

  const items = run.itemsSnapshot || activeRoutine.items || [];
  const itemState = run.itemState || {};

  // Find generated tasks for custom steps
  const generatedTasksMap = new Map<string, Task>();
  for (const t of tasks) {
    if (t.routineRunId === run.id) {
      generatedTasksMap.set(t.title, t);
    }
  }

  const handleToggleStep = async (item: RoutineItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!run.id) return;

    const currentDone = Boolean(itemState[item.uid]);
    const nextDone = !currentDone;

    try {
      // 1. Update run itemState
      await routinesRepo.updateRunItemState(run.id, item.uid, nextDone);

      // 2. Handle item kind side-effects
      if (item.kind === 'custom') {
        const task = generatedTasksMap.get(item.title);
        if (task && task.id) {
          const nextStatus = nextDone ? 'done' : 'todo';
          await tasksRepo.toggleTaskStatus(task.id, nextStatus);
        }
      } else if (item.kind === 'habit' && item.refId) {
        await habitsRepo.toggleHabitToday(item.refId);
      } else if (item.kind === 'task' && item.refId) {
        const nextStatus = nextDone ? 'done' : 'todo';
        await tasksRepo.toggleTaskStatus(item.refId, nextStatus);
        showUndo(nextDone ? 'Completed task' : 'Task marked todo', async () => {
          if (item.refId) await tasksRepo.toggleTaskStatus(item.refId, currentDone ? 'done' : 'todo');
        });
      }
    } catch (err) {
      console.error('Failed to toggle routine item:', err);
    }
  };

  const handleItemClick = (item: RoutineItem) => {
    if (item.kind === 'journal') {
      navigate('/journal');
    } else if (item.kind === 'note' && item.refId) {
      navigate(`/notes/${item.refId}`);
    }
  };

  // Compute progress
  const totalItems = items.length;
  let doneItems = 0;
  for (const it of items) {
    if (itemState[it.uid]) doneItems++;
  }
  const isAllComplete = totalItems > 0 && doneItems === totalItems;

  return (
    <div
      data-testid="today-routine-card"
      className="bg-surface border border-border rounded-card p-4 sm:p-5 shadow-card space-y-4"
    >
      {/* Top Header & Routine Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-left cursor-pointer group"
        >
          <span className="text-xl">{activeRoutine.emoji || '☀️'}</span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                ROUTINE
              </span>
              {activeRoutine.timeOfDay === currentTimeOfDay && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-accent-soft text-accent">
                  Current
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-bold text-ink leading-tight group-hover:text-accent transition-colors">
                {activeRoutine.name}
              </h3>
              {onToggleCollapse && (
                <svg
                  className={`w-4 h-4 text-ink-muted transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </div>
          </div>
        </button>

        {/* Routine switcher if multiple routines today */}
        {activeTodayRoutines.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto">
            {activeTodayRoutines.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRoutineId(r.id!)}
                className={`px-2.5 py-1 rounded-pill text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer min-h-[36px] ${
                  r.id === activeRoutine.id
                    ? 'bg-accent text-accent-ink shadow-2xs'
                    : 'bg-surface-2 text-ink-muted hover:text-ink'
                }`}
              >
                {r.emoji} {r.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!isCollapsed && (
        <>
          {/* Routine Items Checklist */}
          <div className="space-y-2">
            {items.map((item) => {
              const isDone = Boolean(itemState[item.uid]);

              return (
                <div
                  key={item.uid}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${
                    isDone
                      ? 'border-border/60 bg-surface-2/30 opacity-70'
                      : 'border-border bg-surface hover:border-accent/40 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => handleToggleStep(item, e)}
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        isDone
                          ? 'bg-success border-success text-white'
                          : 'border-ink-muted/60 hover:border-accent'
                      }`}
                      aria-label="Toggle step completion"
                    >
                      {isDone && (
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs sm:text-sm font-medium truncate ${
                            isDone ? 'line-through text-ink-muted' : 'text-ink'
                          }`}
                        >
                          {item.title}
                        </span>
                        {item.durationMin && (
                          <span className="text-[10px] text-ink-muted shrink-0">
                            · {item.durationMin}m
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action hint for pointers */}
                  {item.kind === 'journal' && (
                    <span className="text-[11px] font-semibold text-accent shrink-0">
                      Open →
                    </span>
                  )}
                  {item.kind === 'note' && (
                    <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 shrink-0">
                      Note →
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Progress Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-ink-muted">
            <span>
              {doneItems} of {totalItems} completed
            </span>
            {isAllComplete ? (
              <span className="font-bold text-success flex items-center gap-1">
                ✓ Routine Complete!
              </span>
            ) : (
              <span className="text-ink-muted">
                {totalItems - doneItems} steps remaining
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
