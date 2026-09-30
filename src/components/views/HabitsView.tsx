import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlag } from '../../app/flags';
import {
  useHabitsWithStats,
  habitsRepo,
  toLocalDateStr,
} from '../../db/habitsRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { HabitEditorModal } from '../habits/HabitEditorModal';
import { Heatmap } from '../../design/ui/Heatmap';
import type { Habit, HabitWithStats, HabitFrequency, HabitTimeOfDay } from '../../types/habit';

type FilterTimeBucket = 'all' | 'morning' | 'afternoon' | 'evening' | 'anytime';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatHabitSchedule(habit: Habit): string {
  if (habit.frequency === 'daily') return 'Daily';
  if (habit.frequency === 'weekdays') return 'Mon - Fri';
  if (habit.frequency === 'weekly') return `${habit.targetDaysPerWeek || 3}x / week`;
  if (habit.frequency === 'custom') {
    if (!habit.customDays || habit.customDays.length === 0) return 'Custom';
    if (habit.customDays.length === 7) return 'Daily';
    return habit.customDays.map((d) => DAY_NAMES[d]).join(', ');
  }
  return 'Daily';
}

function getTimeBucketBadge(timeOfDay?: HabitTimeOfDay): { label: string; icon: string } {
  switch (timeOfDay) {
    case 'morning':
      return { label: 'Morning', icon: '🌅' };
    case 'afternoon':
      return { label: 'Afternoon', icon: '☀️' };
    case 'evening':
      return { label: 'Evening', icon: '🌙' };
    case 'anytime':
    default:
      return { label: 'Anytime', icon: '✨' };
  }
}

export function HabitsView() {
  const navigate = useNavigate();
  const isHabitAnalytics = useFlag('habitAnalytics');
  const { showUndo, showSnackbar } = useSnackbar();
  const {
    activeHabits,
    archivedHabits,
    totalActive,
    completedTodayCount,
  } = useHabitsWithStats();

  // Modals & filter state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<FilterTimeBucket>('all');
  const [expandedHeatmaps, setExpandedHeatmaps] = useState<Record<number, boolean>>({});

  const handleOpenCreate = () => {
    setEditingHabit(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setIsModalOpen(true);
  };

  const toggleHeatmap = (habitId: number) => {
    setExpandedHeatmaps((prev) => ({ ...prev, [habitId]: !prev[habitId] }));
  };

  const handleToggleHabitDate = async (habitId: number, dateStr: string) => {
    try {
      const isDone = await habitsRepo.toggleHabitDate(habitId, dateStr);
      showSnackbar({ message: isDone ? 'Marked as completed' : 'Marked as incomplete' });
    } catch (err) {
      console.error('Failed to toggle habit date:', err);
      showSnackbar({ message: 'Failed to update habit date' });
    }
  };

  const handleSaveHabit = async (draft: {
    name: string;
    iconOrEmoji: string;
    frequency: HabitFrequency;
    targetDaysPerWeek?: number;
    customDays?: number[];
    timeOfDay?: HabitTimeOfDay;
    reminderAt?: string | null;
  }) => {
    try {
      if (editingHabit?.id) {
        await habitsRepo.updateHabit(editingHabit.id, draft);
        showSnackbar({ message: 'Habit updated' });
      } else {
        await habitsRepo.createHabit(draft);
        showSnackbar({ message: 'Habit created' });
      }
    } catch (err) {
      console.error('Failed to save habit:', err);
      showSnackbar({ message: 'Failed to save habit' });
    }
  };

  const handleArchiveToggle = async (id: number, archived: boolean) => {
    try {
      if (archived) {
        await habitsRepo.archiveHabit(id);
        showUndo('Habit archived', async () => {
          await habitsRepo.unarchiveHabit(id);
        });
      } else {
        await habitsRepo.unarchiveHabit(id);
        showSnackbar({ message: 'Habit restored to active list' });
      }
    } catch (err) {
      console.error('Failed to archive/unarchive habit:', err);
      showSnackbar({ message: 'Failed to update habit archive state' });
    }
  };

  const handleDeleteHabit = async (id: number) => {
    try {
      await habitsRepo.deleteHabit(id);
      showSnackbar({ message: 'Habit and history deleted' });
    } catch (err) {
      console.error('Failed to delete habit:', err);
      showSnackbar({ message: 'Failed to delete habit' });
    }
  };

  const handleToggleToday = async (habit: HabitWithStats) => {
    if (!habit.id) return;
    const todayStr = toLocalDateStr();
    const wasDone = habit.isDoneToday;

    try {
      await habitsRepo.toggleHabitToday(habit.id);

      const message = wasDone
        ? `Marked "${habit.name}" as not done`
        : `Completed "${habit.name}"! 🎉`;

      showUndo(message, async () => {
        if (habit.id) {
          await habitsRepo.setHabitDone(habit.id, todayStr, wasDone);
        }
      });
    } catch (err) {
      console.error('Failed to toggle habit:', err);
      showSnackbar({ message: 'Failed to update habit' });
    }
  };

  const progressPercent =
    totalActive > 0 ? Math.round((completedTodayCount / totalActive) * 100) : 0;

  // Time bucket counts & filtering
  const bucketCounts = useMemo(() => {
    const counts: Record<FilterTimeBucket, number> = {
      all: activeHabits.length,
      morning: 0,
      afternoon: 0,
      evening: 0,
      anytime: 0,
    };
    for (const h of activeHabits) {
      const bucket = h.timeOfDay || 'anytime';
      if (bucket in counts) {
        counts[bucket]++;
      }
    }
    return counts;
  }, [activeHabits]);

  const filteredHabits = useMemo(() => {
    if (selectedBucket === 'all') return activeHabits;
    return activeHabits.filter((h) => (h.timeOfDay || 'anytime') === selectedBucket);
  }, [activeHabits, selectedBucket]);

  // Top streak highlight
  const topStreakHabit = useMemo(() => {
    if (activeHabits.length === 0) return null;
    const sorted = [...activeHabits].sort((a, b) => b.currentStreak - a.currentStreak);
    return sorted[0]?.currentStreak > 0 ? sorted[0] : null;
  }, [activeHabits]);

  // SVG circular ring properties
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressPercent / 100);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-24">
      {/* Subheader Toolbar */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <p className="text-xs font-medium text-ink-muted">
          Build consistency, one day at a time.
        </p>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-accent-ink hover:opacity-90 active:scale-95 transition-all shadow-xs cursor-pointer min-h-[36px]"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Habit</span>
        </button>
      </div>

      {/* Today's Flow Card - Flat, Elegant & Calm */}
      {totalActive > 0 && (
        <div className="p-4 rounded-xl bg-surface border border-border/80 shadow-xs">
          <div className="flex items-center gap-4">
            {/* Circular Progress Ring (Stroke 3.5px) */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-13 h-13 -rotate-90 transform" viewBox="0 0 72 72">
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="3.5"
                  className="text-border"
                  fill="transparent"
                />
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="text-accent transition-all duration-700 ease-out"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-semibold text-ink">
                  {progressPercent}%
                </span>
              </div>
            </div>

            {/* Single Clean Line Stats */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-ink">
                    Today's Flow
                  </span>
                </div>
                <div className="text-[11px] font-medium text-ink-muted">
                  <span>{completedTodayCount} of {totalActive} completed</span>
                  {totalActive - completedTodayCount > 0 && (
                    <span> · {totalActive - completedTodayCount} left</span>
                  )}
                  {topStreakHabit && (
                    <span className="hidden xs:inline"> · 🔥 {topStreakHabit.currentStreak}{topStreakHabit.frequency === 'weekly' ? 'w' : 'd'} streak</span>
                  )}
                </div>
              </div>

              {/* Minimalist Progress Line */}
              <div className="w-full h-1 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {progressPercent === 100 && (
                <p className="text-[11px] font-medium text-success pt-0.5">
                  All habits completed today! Keep the momentum! 🎉
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Time Bucket Navigation - Clean Segmented Control */}
      {totalActive > 0 && (
        <div className="flex items-center p-1 rounded-xl bg-surface-2/80 border border-border/60 gap-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'All', icon: '📋', count: bucketCounts.all },
            { id: 'morning', label: 'Morning', icon: '🌅', count: bucketCounts.morning },
            { id: 'afternoon', label: 'Afternoon', icon: '☀️', count: bucketCounts.afternoon },
            { id: 'evening', label: 'Evening', icon: '🌙', count: bucketCounts.evening },
            { id: 'anytime', label: 'Anytime', icon: '✨', count: bucketCounts.anytime },
          ].map((bucket) => {
            const isSelected = selectedBucket === bucket.id;
            return (
              <button
                key={bucket.id}
                type="button"
                onClick={() => setSelectedBucket(bucket.id as FilterTimeBucket)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer min-h-[34px] ${
                  isSelected
                    ? 'bg-surface text-ink font-semibold shadow-xs'
                    : 'text-ink-muted hover:text-ink hover:bg-surface/50'
                }`}
              >
                <span className="text-xs">{bucket.icon}</span>
                <span>{bucket.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isSelected
                      ? 'bg-accent-soft text-accent'
                      : 'bg-surface-3 text-ink-muted'
                  }`}
                >
                  {bucket.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active Habits List */}
      {activeHabits.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-2 mx-auto flex items-center justify-center text-2xl">
            🎯
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-base text-ink">
              No active habits yet
            </h3>
            <p className="text-xs text-ink-muted max-w-sm mx-auto">
              Track daily routines like drinking water, reading, or working out.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-accent text-accent-ink hover:opacity-90 transition-all shadow-xs cursor-pointer min-h-[38px]"
          >
            Create your first habit
          </button>
        </div>
      ) : filteredHabits.length === 0 ? (
        <div className="py-10 text-center space-y-2 bg-surface rounded-xl border border-border/70">
          <span className="text-xl">
            {selectedBucket === 'morning' ? '🌅' : selectedBucket === 'afternoon' ? '☀️' : selectedBucket === 'evening' ? '🌙' : '✨'}
          </span>
          <p className="text-xs text-ink-muted font-medium">
            No habits scheduled for {selectedBucket}.
          </p>
          <button
            type="button"
            onClick={() => setSelectedBucket('all')}
            className="text-xs text-accent font-medium hover:underline cursor-pointer"
          >
            View all habits
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start">
          {filteredHabits.map((habit) => {
            const isDone = habit.isDoneToday;
            const freqLabel = formatHabitSchedule(habit);
            const timeBadge = getTimeBucketBadge(habit.timeOfDay);
            const unitLabel = habit.frequency === 'weekly' ? 'wk' : 'd';
            const isHeatmapExpanded = Boolean(habit.id && expandedHeatmaps[habit.id]);

            return (
              <div
                key={habit.id}
                className={`group relative p-3.5 rounded-xl transition-all border ${
                  isDone
                    ? 'border-success/30 bg-success/5 shadow-xs'
                    : 'border-border/70 bg-surface hover:border-border'
                } space-y-2.5`}
              >
                {/* Main Card Content */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Compact Tap-to-Complete Circle */}
                    <button
                      type="button"
                      onClick={() => handleToggleToday(habit)}
                      title={isDone ? 'Mark as incomplete' : 'Complete today'}
                      aria-label={isDone ? `Mark ${habit.name} incomplete` : `Complete ${habit.name}`}
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                        isDone
                          ? 'bg-success text-white shadow-xs active:scale-95'
                          : 'border border-border/80 hover:border-accent bg-surface-2/60 hover:bg-surface active:scale-95'
                      }`}
                    >
                      {isDone ? (
                        <svg className="w-4 h-4 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className="text-base select-none">
                          {habit.iconOrEmoji || '🎯'}
                        </span>
                      )}
                    </button>

                    {/* Habit Title & Muted Tags */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3
                          onClick={() => {
                            if (isHabitAnalytics && habit.id) {
                              navigate(`/habits/${habit.id}`);
                            }
                          }}
                          className={`text-sm font-medium text-ink truncate ${
                            isHabitAnalytics ? 'cursor-pointer hover:text-accent' : ''
                          }`}
                        >
                          {habit.name}
                        </h3>

                        {isDone && (
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-success/15 text-success border border-success/20">
                            Done
                          </span>
                        )}
                      </div>

                      {/* Muted Tag Pills */}
                      <div className="flex items-center gap-1 mt-1 flex-wrap text-[11px] text-ink-muted">
                        <span className="px-1.5 py-0.5 rounded-md bg-surface-2 text-[10px] font-medium text-ink-muted flex items-center gap-0.5">
                          <span>{timeBadge.icon}</span>
                          <span>{timeBadge.label}</span>
                        </span>

                        <span className="px-1.5 py-0.5 rounded-md bg-surface-2 text-[10px] font-medium text-ink-muted">
                          {freqLabel}
                        </span>

                        {habit.reminderAt && (
                          <span className="px-1.5 py-0.5 rounded-md bg-surface-2 text-[10px] font-medium text-ink-muted flex items-center gap-0.5">
                            <span>⏰</span>
                            <span>{habit.reminderAt}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Inline Streak Badge & Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {habit.currentStreak > 0 && (
                      <div
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium"
                        title={`Current streak: ${habit.currentStreak} ${unitLabel}`}
                      >
                        <span>🔥</span>
                        <span>{habit.currentStreak}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(habit)}
                      className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                      title="Edit Habit"
                      aria-label="Edit Habit"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Footer Bar: Expandable Activity Graph Trigger */}
                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-ink-muted">
                  <button
                    type="button"
                    onClick={() => habit.id && toggleHeatmap(habit.id)}
                    className="flex items-center gap-1 text-[11px] font-normal text-ink-muted hover:text-ink transition-colors cursor-pointer"
                  >
                    <span>{isHeatmapExpanded ? 'Hide activity matrix' : 'View activity matrix'}</span>
                    <svg
                      className={`w-3 h-3 transition-transform ${isHeatmapExpanded ? 'rotate-180' : ''}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  <span className="text-[10px] text-ink-faint">
                    Best: {habit.bestStreak} {unitLabel}
                  </span>
                </div>

                {/* Expandable Activity Matrix */}
                {isHeatmapExpanded && habit.id && (
                  <div className="pt-2 animate-in fade-in duration-200">
                    <div className="rounded-xl border border-border/80 bg-surface-2/40 p-2 overflow-x-auto">
                      <Heatmap
                        range="month"
                        logs={habit.logsMap || {}}
                        onToggleDate={(d) => habit.id && handleToggleHabitDate(habit.id, d)}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Archived Habits Section */}
      {archivedHabits.length > 0 && (
        <div className="pt-6 border-t border-border/60 space-y-3">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center justify-between w-full text-left cursor-pointer group py-1"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted group-hover:text-ink">
                Archived Habits ({archivedHabits.length})
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-ink-muted transition-transform ${
                showArchived ? 'rotate-180' : ''
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showArchived && (
            <div className="space-y-2">
              {archivedHabits.map((habit) => (
                <div
                  key={habit.id}
                  className="p-3.5 rounded-xl border border-border/60 bg-surface opacity-80 hover:opacity-100 transition-opacity flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg p-2 rounded-lg bg-surface-2">
                      {habit.iconOrEmoji || '🎯'}
                    </span>
                    <div>
                      <h4 className="text-sm font-medium text-ink">
                        {habit.name}
                      </h4>
                      <p className="text-xs text-ink-muted">
                        Best streak: {habit.bestStreak}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => habit.id && handleArchiveToggle(habit.id, false)}
                      className="px-3 py-1.5 text-xs font-medium bg-surface-2 border border-border/60 text-ink rounded-lg hover:border-accent transition-colors cursor-pointer min-h-[34px]"
                    >
                      Unarchive
                    </button>
                    <button
                      type="button"
                      onClick={() => habit.id && handleDeleteHabit(habit.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer min-h-[34px] min-w-[34px] flex items-center justify-center"
                      title="Delete permanently"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Habit Create / Edit Modal */}
      <HabitEditorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        habit={editingHabit}
        onSave={handleSaveHabit}
        onArchiveToggle={handleArchiveToggle}
        onDelete={handleDeleteHabit}
      />
    </div>
  );
}
