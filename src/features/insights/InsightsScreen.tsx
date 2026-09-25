import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { insightsRepo, type ComputedInsights } from '../../db/repos/insightsRepo';
import { useSnackbar } from '../../context/SnackbarContext';

function DeltaBadge({
  delta,
  unit = '',
  invertPositive = false,
}: {
  delta: { change: number; direction: 'up' | 'down' | 'flat' };
  unit?: string;
  invertPositive?: boolean;
}) {
  if (delta.direction === 'flat') {
    return (
      <span className="text-[11px] font-semibold text-ink-muted inline-flex items-center gap-0.5">
        <span>—</span> 0{unit} vs last wk
      </span>
    );
  }

  const isUp = delta.direction === 'up';
  // Normally up is good, unless invertPositive is true
  const isGood = invertPositive ? !isUp : isUp;

  return (
    <span
      className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${
        isGood ? 'text-success' : 'text-danger'
      }`}
    >
      <span>{isUp ? '↑' : '↓'}</span>
      <span>
        {Math.abs(delta.change)}
        {unit} vs last wk
      </span>
    </span>
  );
}

export function InsightsScreen() {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [insights, setInsights] = useState<ComputedInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadInsights = useCallback(async (force = false) => {
    try {
      setIsLoading(true);
      const data = await insightsRepo.getInsights(new Date(), force);
      setInsights(data);
    } catch (e) {
      console.error('Failed to load insights:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const handleRefresh = async () => {
    await loadInsights(true);
    showSnackbar({ message: 'Insights recomputed' });
  };

  if (isLoading && !insights) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <p className="text-sm text-ink-muted">Calculating personal insights...</p>
      </div>
    );
  }

  if (!insights) return null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Personal Insights</h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Weekly trends, productivity flow, and habit consistency
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          className="px-3 py-1.5 rounded-pill text-xs font-semibold bg-surface border border-border text-ink hover:bg-surface-2 transition-colors cursor-pointer"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Grid of 6 Computed Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Captures Card */}
        <div
          onClick={() => navigate('/inbox')}
          className="p-4 rounded-card bg-surface border border-border hover:border-accent/40 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Captures
            </span>
            <DeltaBadge delta={insights.captures} />
          </div>
          <p className="text-2xl font-bold text-ink">{insights.captures.current}</p>
          <p className="text-xs text-ink-muted">
            Notes and tasks captured in the last 7 days
          </p>
        </div>

        {/* 2. Tasks Completed Card */}
        <div
          onClick={() => navigate('/tasks')}
          className="p-4 rounded-card bg-surface border border-border hover:border-accent/40 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Tasks Done
            </span>
            <DeltaBadge delta={insights.tasksCompleted} />
          </div>
          <p className="text-2xl font-bold text-ink">{insights.tasksCompleted.current}</p>

          {/* Area Breakdown Stacked Dots */}
          {insights.tasksCompleted.byArea.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                {insights.tasksCompleted.byArea.slice(0, 4).map((area, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-surface-2 border border-border font-medium"
                    title={`${area.areaName}: ${area.count} completed`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: area.color }}
                    />
                    <span>{area.areaName} ({area.count})</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-muted">Completed tasks this week</p>
          )}
        </div>

        {/* 3. Calendar Events Card */}
        <div
          onClick={() => navigate('/calendar')}
          className="p-4 rounded-card bg-surface border border-border hover:border-accent/40 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Events
            </span>
            <DeltaBadge delta={insights.eventsCount} />
          </div>
          <p className="text-2xl font-bold text-ink">{insights.eventsCount.current}</p>
          <p className="text-xs text-ink-muted">
            Scheduled calendar events this week
          </p>
        </div>

        {/* 4. Focus Minutes Card */}
        <div
          onClick={() => navigate('/focus')}
          className="p-4 rounded-card bg-surface border border-border hover:border-accent/40 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Focus Time
            </span>
            <DeltaBadge delta={insights.focusMinutes} unit="m" />
          </div>
          <p className="text-2xl font-bold text-ink">
            {insights.focusMinutes.current}{' '}
            <span className="text-sm font-normal text-ink-muted">min</span>
          </p>
          <p className="text-xs text-ink-muted">
            Focus sessions recorded this week
          </p>
        </div>

        {/* 5. Habit Consistency Card */}
        <div
          onClick={() => navigate('/habits')}
          className="p-4 rounded-card bg-surface border border-border hover:border-accent/40 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Habit Adherence
            </span>
            <DeltaBadge delta={insights.habitConsistency} unit="%" />
          </div>
          <p className="text-2xl font-bold text-ink">
            {insights.habitConsistency.current}%
          </p>
          <p className="text-xs text-ink-muted">
            Trailing 30-day scheduled habit completion rate
          </p>
        </div>

        {/* 6. Journal Reflections Card */}
        <div
          onClick={() => navigate('/journal')}
          className="p-4 rounded-card bg-surface border border-border hover:border-accent/40 cursor-pointer transition-all space-y-2"
        >
          <div className="flex items-start justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Journal
            </span>
            <span className="text-xs font-bold text-accent">
              🔥 {insights.journalStreak.current} day streak
            </span>
          </div>
          <p className="text-2xl font-bold text-ink">
            {insights.journalStreak.totalEntries}{' '}
            <span className="text-sm font-normal text-ink-muted">entries</span>
          </p>
          <p className="text-xs text-ink-muted">
            Daily reflection history
          </p>
        </div>
      </div>
    </div>
  );
}
