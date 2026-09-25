export interface WeekTrend {
  weekLabel: string;
  rate: number; // 0 to 100
  completed: number;
  target: number;
}

export function HabitTrendSparkline({ trends }: { trends: WeekTrend[] }) {
  if (trends.length === 0) return null;

  const width = 280;
  const height = 60;
  const paddingX = 12;
  const paddingY = 8;

  const points = trends.map((t, idx) => {
    const x = paddingX + (idx / Math.max(1, trends.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - (t.rate / 100) * (height - 2 * paddingY);
    return { x, y, ...t };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt.x},${pt.y}` : `${acc} L ${pt.x},${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>8-Week Completion Trend</span>
        <span className="font-semibold text-ink">
          {trends[trends.length - 1]?.rate ?? 0}% this week
        </span>
      </div>

      <div className="relative w-full overflow-hidden rounded-card bg-surface-2 p-2 border border-border">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16 overflow-visible">
          {/* Fill area */}
          <path
            d={areaD}
            fill="color-mix(in oklch, var(--color-accent) 15%, transparent)"
          />

          {/* Target 100% hairline */}
          <line
            x1={paddingX}
            y1={paddingY}
            x2={width - paddingX}
            y2={paddingY}
            stroke="var(--color-border)"
            strokeDasharray="3 3"
            strokeWidth="1"
          />

          {/* Stroke path */}
          <path
            d={pathD}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {points.map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r="3.5"
              fill="var(--color-surface)"
              stroke="var(--color-accent)"
              strokeWidth="2"
            />
          ))}
        </svg>

        {/* Week labels */}
        <div className="flex justify-between text-[10px] text-ink-muted px-2 pt-1 font-medium">
          <span>{trends[0]?.weekLabel}</span>
          <span>{trends[Math.floor(trends.length / 2)]?.weekLabel}</span>
          <span>{trends[trends.length - 1]?.weekLabel}</span>
        </div>
      </div>
    </div>
  );
}
