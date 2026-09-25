import type { WeeklyFocusStats } from '../../db/focusRepo';

export function WeeklyFocusChart({ stats }: { stats: WeeklyFocusStats }) {
  const { days, totalMinutes, dailyAverageMinutes } = stats;

  const maxMinutes = Math.max(60, ...days.map((d) => d.minutes));
  const chartHeight = 90;
  const barWidth = 24;
  const chartWidth = days.length * 40;

  return (
    <div className="p-4 rounded-card bg-surface border border-border space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Past 7 Days
          </h4>
          <p className="text-lg font-bold text-ink mt-0.5">
            {totalMinutes} <span className="text-xs font-normal text-ink-muted">min total</span>
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-ink-muted">Daily Avg</span>
          <p className="text-sm font-semibold text-ink">
            {dailyAverageMinutes} <span className="text-[11px] font-normal text-ink-muted">m/day</span>
          </p>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight + 25}`}
          className="w-full h-28 overflow-visible"
        >
          {days.map((day, idx) => {
            const x = idx * 40 + 8;
            const barHeight = Math.round((day.minutes / maxMinutes) * chartHeight);
            const y = chartHeight - barHeight;

            return (
              <g key={day.date} className="group cursor-pointer">
                {/* Background track */}
                <rect
                  x={x}
                  y={0}
                  width={barWidth}
                  height={chartHeight}
                  rx={4}
                  fill="var(--color-surface-2)"
                />

                {/* Value bar */}
                {day.minutes > 0 && (
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx={4}
                    fill="var(--color-accent)"
                    className="transition-all duration-300"
                  />
                )}

                {/* Minutes hover badge / label */}
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  fill="var(--color-ink-muted)"
                  fontSize="9"
                  fontWeight="600"
                  className={day.minutes > 0 ? 'opacity-100' : 'opacity-0'}
                >
                  {day.minutes > 0 ? `${day.minutes}m` : ''}
                </text>

                {/* Day label */}
                <text
                  x={x + barWidth / 2}
                  y={chartHeight + 16}
                  textAnchor="middle"
                  fill="var(--color-ink-muted)"
                  fontSize="10"
                  fontWeight="500"
                >
                  {day.dayLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
