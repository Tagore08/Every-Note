import type { ReactNode } from 'react';

export interface StatDelta {
  value: string | number;
  trend: 'up' | 'down' | 'neutral';
}

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  delta?: StatDelta;
  subtext?: string;
  onClick?: () => void;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  delta,
  subtext,
  onClick,
  className = '',
}: StatCardProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`p-4 rounded-card bg-surface border border-border/70 shadow-card flex flex-col justify-between text-left transition-all ${
        onClick ? 'hover:shadow-float hover:-translate-y-0.5 cursor-pointer active:scale-[0.99] active:translate-y-0 min-h-[44px]' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint">
          {label}
        </span>
        {icon && (
          <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent-soft to-surface-2 flex items-center justify-center text-accent shrink-0">
            {icon}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">
          {value}
        </div>
        {delta && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
              delta.trend === 'up'
                ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400'
                : delta.trend === 'down'
                ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                : 'bg-surface-2 text-ink-muted'
            }`}
          >
            {delta.trend === 'up' && '↑'}
            {delta.trend === 'down' && '↓'}
            {delta.value}
          </span>
        )}
      </div>

      {subtext && (
        <p className="text-xs text-ink-muted mt-1.5 leading-relaxed">{subtext}</p>
      )}
    </Component>
  );
}
