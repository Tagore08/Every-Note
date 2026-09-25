import { useNavigate } from 'react-router-dom';
import { useWeeklyFocusStats } from '../../../db/focusRepo';
import { useHabitsWithStats } from '../../../db/habitsRepo';
import { useJournalStreak } from '../../../db/notesRepo';

interface TodayInsightsWidgetProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function TodayInsightsWidget({
  isCollapsed,
  onToggleCollapse,
}: TodayInsightsWidgetProps = {}) {
  const navigate = useNavigate();
  const { totalMinutes, days } = useWeeklyFocusStats(1);
  const { activeHabits, completedTodayCount } = useHabitsWithStats();
  const journalStreak = useJournalStreak();

  // Focus time today
  const todayFocusMinutes = days[0]?.minutes || totalMinutes || 0;

  // Best habit streak among active habits
  const topHabitStreak = activeHabits.reduce((max, h) => Math.max(max, h.currentStreak || 0), 0);

  return (
    <div
      data-testid="today-insights-section"
      className="bg-surface border border-border rounded-card p-4 sm:p-5 shadow-card space-y-3"
    >
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-left cursor-pointer group"
        >
          <span className="text-base">📊</span>
          <h3 className="text-sm font-bold text-ink uppercase tracking-wider group-hover:text-accent transition-colors">
            Insights & Streaks
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
        </button>
        <button
          type="button"
          onClick={() => navigate('/insights')}
          className="text-xs font-semibold text-accent hover:underline cursor-pointer min-h-[36px] flex items-center"
        >
          View Insights →
        </button>
      </div>

      {!isCollapsed && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Habit Streak */}
          <div className="p-3.5 rounded-2xl bg-surface-2/50 border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Habit Streak</span>
              <span>🔥</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-ink">{topHabitStreak}</span>
              <span className="text-xs text-ink-muted">days</span>
            </div>
            <span className="text-[10px] text-ink-muted mt-1 truncate">
              {completedTodayCount} of {activeHabits.length} done today
            </span>
          </div>

          {/* Journal Streak */}
          <div className="p-3.5 rounded-2xl bg-surface-2/50 border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Journal Streak</span>
              <span>✍️</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-ink">{journalStreak}</span>
              <span className="text-xs text-ink-muted">days</span>
            </div>
            <span className="text-[10px] text-ink-muted mt-1">Daily reflections</span>
          </div>

          {/* Focus Time */}
          <div className="p-3.5 rounded-2xl bg-surface-2/50 border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Focus Today</span>
              <span>⏱️</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-ink">{todayFocusMinutes}</span>
              <span className="text-xs text-ink-muted">mins</span>
            </div>
            <span className="text-[10px] text-ink-muted mt-1">Deep work session</span>
          </div>

          {/* Habit Completion Rate */}
          <div className="p-3.5 rounded-2xl bg-surface-2/50 border border-border flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Completion</span>
              <span>🎯</span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-ink">
                {activeHabits.length > 0 ? Math.round((completedTodayCount / activeHabits.length) * 100) : 0}%
              </span>
              <span className="text-xs text-ink-muted">rate</span>
            </div>
            <span className="text-[10px] text-ink-muted mt-1">Today's momentum</span>
          </div>
        </div>
      )}
    </div>
  );
}
