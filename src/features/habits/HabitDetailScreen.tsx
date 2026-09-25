import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { habitsRepo, toLocalDateStr, parseLocalDateStr, addDays, getMondayOfWeek } from '../../db/habitsRepo';
import { StatCard } from '../../design/ui/StatCard';
import { Heatmap } from '../../design/ui/Heatmap';
import { SectionHeader } from '../../design/ui/SectionHeader';
import { HabitTrendSparkline, type WeekTrend } from './HabitTrendSparkline';
import { useSnackbar } from '../../context/SnackbarContext';

export function HabitDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const habitId = Number(id);

  const habit = useLiveQuery(async () => {
    if (!habitId) return null;
    return await db.habits.get(habitId);
  }, [habitId]);

  const habitLogs = useLiveQuery(async () => {
    if (!habitId) return [];
    return await db.habitLogs.where('habitId').equals(habitId).toArray();
  }, [habitId]);

  const todayStr = useMemo(() => toLocalDateStr(), []);

  // Map of date -> boolean
  const logsMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    if (habitLogs) {
      for (const log of habitLogs) {
        if (log.done) map[log.date] = true;
      }
    }
    return map;
  }, [habitLogs]);

  // Compute streaks
  const streakInfo = useMemo(() => {
    if (!habit || !habitLogs) {
      return { currentStreak: 0, bestStreak: 0 };
    }
    return habitsRepo.calculateHabitStreaks(habit.frequency, habitLogs, todayStr, habit.targetDaysPerWeek);
  }, [habit, habitLogs, todayStr]);

  // Compute 30-day completion rate
  const thirtyDayRate = useMemo(() => {
    if (!habit || !habitLogs) return 0;
    let scheduledDays = 0;
    let completedDays = 0;

    for (let i = 29; i >= 0; i--) {
      const d = addDays(parseLocalDateStr(todayStr), -i);
      const dStr = toLocalDateStr(d);
      const isWeekdayDate = d.getDay() !== 0 && d.getDay() !== 6;

      if (habit.frequency === 'daily') {
        scheduledDays++;
        if (logsMap[dStr]) completedDays++;
      } else if (habit.frequency === 'weekdays') {
        if (isWeekdayDate) {
          scheduledDays++;
          if (logsMap[dStr]) completedDays++;
        }
      } else if (habit.frequency === 'weekly') {
        scheduledDays++;
        if (logsMap[dStr]) completedDays++;
      }
    }

    if (scheduledDays === 0) return 0;
    return Math.round((completedDays / scheduledDays) * 100);
  }, [habit, habitLogs, logsMap, todayStr]);

  // Compute 8-week trend
  const trends: WeekTrend[] = useMemo(() => {
    if (!habit) return [];
    const list: WeekTrend[] = [];
    const today = parseLocalDateStr(todayStr);

    for (let w = 7; w >= 0; w--) {
      const weekDate = addDays(today, -w * 7);
      const monday = getMondayOfWeek(weekDate);
      let target = 7;
      if (habit.frequency === 'weekdays') target = 5;
      else if (habit.frequency === 'weekly') target = habit.targetDaysPerWeek || 3;

      let completed = 0;
      for (let d = 0; d < 7; d++) {
        const cur = addDays(monday, d);
        const curStr = toLocalDateStr(cur);
        if (logsMap[curStr]) completed++;
      }

      const rate = Math.min(100, Math.round((completed / Math.max(1, target)) * 100));
      list.push({
        weekLabel: monday.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
        rate,
        completed,
        target,
      });
    }

    return list;
  }, [habit, logsMap, todayStr]);

  const totalCompletions = useMemo(() => {
    return habitLogs?.filter((l) => l.done).length || 0;
  }, [habitLogs]);

  const handleToggleDate = async (dateStr: string) => {
    if (!habitId) return;
    const isDone = Boolean(logsMap[dateStr]);
    await habitsRepo.setHabitDone(habitId, dateStr, !isDone);
    showSnackbar({ message: !isDone ? 'Marked complete' : 'Marked incomplete' });
  };

  if (!habit) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-ink-muted">Loading habit details...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/habits')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink transition-colors px-2.5 py-1.5 rounded-pill bg-surface border border-border"
        >
          ← Back to Habits
        </button>

        <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-ink-muted border border-border">
          {habit.frequency === 'daily'
            ? 'Daily'
            : habit.frequency === 'weekdays'
            ? 'Weekdays'
            : `${habit.targetDaysPerWeek}x/week`}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-3xl p-2 rounded-card bg-surface-2 border border-border flex items-center justify-center w-14 h-14">
          {habit.iconOrEmoji || '🎯'}
        </span>
        <div>
          <h1 className="text-2xl font-bold text-ink">{habit.name}</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            {habit.archived ? 'Archived habit' : 'Active habit'}
          </p>
        </div>
      </div>

      {/* 4 StatCards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="30-Day Rate"
          value={`${thirtyDayRate}%`}
          subtext="Completion rate"
        />
        <StatCard
          label="Current Streak"
          value={`🔥 ${streakInfo.currentStreak}`}
          subtext="Consecutive"
        />
        <StatCard
          label="Best Streak"
          value={`🏆 ${streakInfo.bestStreak}`}
          subtext="All-time best"
        />
        <StatCard
          label="Total Logs"
          value={totalCompletions}
          subtext="Check-ins recorded"
        />
      </div>

      {/* 8-Week Trend Sparkline */}
      <div className="p-4 rounded-card bg-surface border border-border">
        <HabitTrendSparkline trends={trends} />
      </div>

      {/* 12-Month Calendar Heatmap */}
      <div className="p-4 rounded-card bg-surface border border-border space-y-3">
        <SectionHeader
          title="Consistency Heatmap"
          description="Yearly activity history. Tap any square to view or toggle that date."
        />
        <Heatmap logs={logsMap} onToggleDate={handleToggleDate} />
      </div>
    </div>
  );
}
