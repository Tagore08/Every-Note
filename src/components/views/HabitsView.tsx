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
    if (editingHabit?.id) {
      await habitsRepo.updateHabit(editingHabit.id, draft);
      showSnackbar({ message: 'Habit updated' });
    } else {
      await habitsRepo.createHabit(draft);
      showSnackbar({ message: 'Habit created' });
    }
  };

  const handleArchiveToggle = async (id: number, archived: boolean) => {
    if (archived) {
      await habitsRepo.archiveHabit(id);
      showUndo('Habit archived', async () => {
        await habitsRepo.unarchiveHabit(id);
      });
    } else {
      await habitsRepo.unarchiveHabit(id);
      showSnackbar({ message: 'Habit restored to active list' });
    }
  };

  const handleDeleteHabit = async (id: number) => {
    await habitsRepo.deleteHabit(id);
    showSnackbar({ message: 'Habit and history deleted' });
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
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Habits
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Build consistency, one day at a time.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white transition-all shadow-sm cursor-pointer self-start sm:self-auto"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Habit</span>
        </button>
      </div>

      {/* Today's Progress Card with Progress Ring */}
      {totalActive > 0 && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-950/40 dark:via-emerald-950/20 dark:to-transparent border border-emerald-500/20 shadow-xs">
          <div className="flex items-center gap-5">
            {/* Circular Progress Ring */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-18 h-18 -rotate-90 transform" viewBox="0 0 72 72">
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-slate-200 dark:text-slate-800/80"
                  fill="transparent"
                />
                <circle
                  cx="36"
                  cy="36"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="text-emerald-500 transition-all duration-700 ease-out"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                  {progressPercent}%
                </span>
              </div>
            </div>

            {/* Stats Breakdown */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">✨</span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Today's Progress
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  {completedTodayCount} of {totalActive} completed
                </span>
              </div>

              {/* Progress bar line */}
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700/60 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                {progressPercent === 100 ? (
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    All habits completed today! Keep the momentum going! 🔥
                  </span>
                ) : (
                  <span>
                    {totalActive - completedTodayCount} {totalActive - completedTodayCount === 1 ? 'habit' : 'habits'} remaining today
                  </span>
                )}

                {topStreakHabit && (
                  <span className="hidden sm:inline font-semibold text-amber-600 dark:text-amber-400">
                    🔥 Top streak: {topStreakHabit.currentStreak} {topStreakHabit.frequency === 'weekly' ? 'wks' : 'days'} ({topStreakHabit.name})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Bucket Navigation Pills */}
      {totalActive > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span>{bucket.icon}</span>
                <span>{bucket.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
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
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mx-auto flex items-center justify-center text-3xl">
            🎯
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-base text-slate-800 dark:text-slate-200">
              No active habits yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Track daily routines like drinking water, reading, or working out.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm cursor-pointer"
          >
            Create your first habit
          </button>
        </div>
      ) : filteredHabits.length === 0 ? (
        <div className="py-12 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800">
          <span className="text-2xl">
            {selectedBucket === 'morning' ? '🌅' : selectedBucket === 'afternoon' ? '☀️' : selectedBucket === 'evening' ? '🌙' : '✨'}
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            No habits scheduled for {selectedBucket}.
          </p>
          <button
            type="button"
            onClick={() => setSelectedBucket('all')}
            className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
          >
            View all habits
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHabits.map((habit) => {
            const isDone = habit.isDoneToday;
            const freqLabel = formatHabitSchedule(habit);
            const timeBadge = getTimeBucketBadge(habit.timeOfDay);
            const unitLabel = habit.frequency === 'weekly' ? 'wk' : 'd';
            const isHeatmapExpanded = Boolean(habit.id && expandedHeatmaps[habit.id]);

            return (
              <div
                key={habit.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                  isDone
                    ? 'border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                } shadow-xs space-y-4`}
              >
                {/* Top Section: Big Tap-to-Complete Circle + Habit Info */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Big Tap-to-Complete Circle */}
                    <button
                      type="button"
                      onClick={() => handleToggleToday(habit)}
                      title={isDone ? 'Mark as incomplete' : 'Complete today'}
                      aria-label={isDone ? `Mark ${habit.name} incomplete` : `Complete ${habit.name}`}
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                        isDone
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105 active:scale-95'
                          : 'border-2 border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-400 bg-slate-50 dark:bg-slate-800/80 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {isDone ? (
                        <svg className="w-6 h-6 sm:w-7 sm:h-7 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span className="text-xl sm:text-2xl select-none">
                          {habit.iconOrEmoji || '🎯'}
                        </span>
                      )}
                    </button>

                    {/* Habit Name & Badges */}
                    <div
                      className={`min-w-0 ${isHabitAnalytics ? 'cursor-pointer group/title' : ''}`}
                      onClick={() => {
                        if (isHabitAnalytics && habit.id) {
                          navigate(`/habits/${habit.id}`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <h2 className={`text-base font-bold text-slate-900 dark:text-white truncate ${
                          isHabitAnalytics ? 'group-hover/title:text-accent transition-colors' : ''
                        }`}>
                          {habit.name}
                        </h2>
                        {isDone && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 shrink-0">
                            Done
                          </span>
                        )}
                        {isHabitAnalytics && (
                          <span className="text-[10px] text-ink-muted opacity-0 group-hover/title:opacity-100 transition-opacity">
                            View analytics →
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 flex-wrap text-xs text-slate-500 dark:text-slate-400">
                        {/* Time bucket badge */}
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium flex items-center gap-1">
                          <span>{timeBadge.icon}</span>
                          <span>{timeBadge.label}</span>
                        </span>

                        {/* Frequency badge */}
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium">
                          {freqLabel}
                        </span>

                        {/* Reminder badge */}
                        {habit.reminderAt && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium flex items-center gap-1">
                            <span>⏰</span>
                            <span>{habit.reminderAt}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Streaks, Analytics & Edit */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <div
                      className={`text-right hidden sm:block ${isHabitAnalytics ? 'cursor-pointer hover:opacity-80' : ''}`}
                      onClick={() => {
                        if (isHabitAnalytics && habit.id) {
                          navigate(`/habits/${habit.id}`);
                        }
                      }}
                    >
                      <div className="flex items-center gap-1 justify-end font-bold text-sm text-amber-600 dark:text-amber-400">
                        <span>🔥</span>
                        <span>{habit.currentStreak} {unitLabel}</span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        🏆 Best: {habit.bestStreak} {unitLabel}
                      </div>
                    </div>

                    {isHabitAnalytics && habit.id && (
                      <button
                        type="button"
                        onClick={() => navigate(`/habits/${habit.id}`)}
                        className="p-2 rounded-xl text-ink-muted hover:text-accent hover:bg-surface-elevated transition-colors cursor-pointer"
                        title="View Analytics"
                        aria-label="View Analytics"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="20" x2="18" y2="10" />
                          <line x1="12" y1="20" x2="12" y2="4" />
                          <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(habit)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Edit Habit"
                      aria-label="Edit Habit"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Mobile Streaks Bar (visible on small screens) */}
                <div className="flex sm:hidden items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                    <span>🔥 Current:</span>
                    <span>{habit.currentStreak} {unitLabel}</span>
                  </div>
                  <div className="text-slate-400 dark:text-slate-500 font-medium">
                    🏆 Best: {habit.bestStreak} {unitLabel}
                  </div>
                </div>

                {/* Bottom Section: 30-day dots + Heatmap expand toggle */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    <span>30 days activity</span>
                    {habit.id && (
                      <button
                        type="button"
                        onClick={() => toggleHeatmap(habit.id!)}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isHeatmapExpanded ? 'Hide Heatmap' : 'Year Heatmap'}</span>
                        <svg
                          className={`w-3.5 h-3.5 transition-transform ${isHeatmapExpanded ? 'rotate-180' : ''}`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* 30 Dots Grid */}
                  <div className="flex items-center justify-between gap-1 sm:gap-1.5 overflow-x-auto py-1">
                    {habit.last30Days.map((day) => (
                      <div
                        key={day.date}
                        title={`${day.date}: ${day.done ? 'Completed ✓' : 'Not completed'}`}
                        className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${
                          day.done
                            ? 'bg-emerald-500'
                            : 'bg-slate-200 dark:bg-slate-700/80'
                        } ${
                          day.isToday
                            ? 'ring-2 ring-emerald-500/50 ring-offset-1 dark:ring-offset-slate-900'
                            : ''
                        }`}
                      />
                    ))}
                  </div>

                  {/* Expandable GitHub-style Contribution Graph */}
                  {isHeatmapExpanded && habit.id && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 animate-in fade-in duration-200">
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-1">
                        52-week contribution graph (tap any square to view or toggle)
                      </p>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-2 overflow-x-auto">
                        <Heatmap
                          logs={habit.logsMap || {}}
                          onToggleDate={(d) => handleToggleHabitDate(habit.id!, d)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Archived Habits Section */}
      {archivedHabits.length > 0 && (
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center justify-between w-full text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300">
                Archived Habits ({archivedHabits.length})
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-slate-400 transition-transform ${
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
            <div className="space-y-3">
              {archivedHabits.map((habit) => (
                <div
                  key={habit.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-75 hover:opacity-100 transition-opacity flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl p-2 rounded-lg bg-slate-200/50 dark:bg-slate-800">
                      {habit.iconOrEmoji || '🎯'}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {habit.name}
                      </h4>
                      <p className="text-xs text-slate-400">
                        Best streak: {habit.bestStreak}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => habit.id && handleArchiveToggle(habit.id, false)}
                      className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:border-blue-500 transition-colors cursor-pointer"
                    >
                      Unarchive
                    </button>
                    <button
                      type="button"
                      onClick={() => habit.id && handleDeleteHabit(habit.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
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
