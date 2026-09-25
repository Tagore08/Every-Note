import { useNavigate } from 'react-router-dom';
import { useHabitsWithStats, habitsRepo } from '../../../db/habitsRepo';

export function HabitsRow() {
  const navigate = useNavigate();
  const { activeHabits, totalActive, completedTodayCount } = useHabitsWithStats();

  const handleToggle = async (habitId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await habitsRepo.toggleHabitToday(habitId);
    } catch (err) {
      console.error('Failed to toggle habit today:', err);
    }
  };

  if (activeHabits.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="habits-row-section"
      className="bg-surface border border-border rounded-card p-4 sm:p-5 shadow-card space-y-3"
    >
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
            Habits
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-accent-soft text-accent">
            {completedTodayCount}/{totalActive}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/habits')}
          className="text-xs font-semibold text-accent hover:underline cursor-pointer min-h-[36px] flex items-center"
        >
          View Habits →
        </button>
      </div>

      {/* Habit circles strip */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {activeHabits.map((h) => {
          const isDone = Boolean(h.isDoneToday);

          return (
            <button
              key={h.id}
              type="button"
              onClick={(e) => handleToggle(h.id!, e)}
              className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all cursor-pointer min-w-[64px] min-h-[64px] shrink-0 border ${
                isDone
                  ? 'border-success/40 bg-success/10 font-bold text-success'
                  : 'border-border bg-surface-2/60 hover:bg-surface-2 text-ink-muted hover:text-ink'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-transform active:scale-95 shadow-2xs ${
                  isDone
                    ? 'bg-success text-white ring-2 ring-success/30'
                    : 'border-2 border-dashed border-ink-muted/50 bg-surface'
                }`}
              >
                {isDone ? '✓' : h.name.slice(0, 2).toUpperCase()}
              </div>

              <span className="text-[11px] truncate max-w-[70px] text-center font-medium leading-tight">
                {h.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
