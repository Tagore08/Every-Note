import type { ReactNode } from 'react';

export interface SectionHeaderProps {
  title: string;
  count?: number;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  className?: string;
}

export function SectionHeader({
  title,
  count,
  description,
  action,
  className = '',
}: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2 ${className}`}>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-ink-muted">
            {title}
          </h2>
          {typeof count === 'number' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-2 text-ink border border-border">
              {count}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-ink-muted mt-0.5">{description}</p>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-semibold text-accent hover:bg-accent-soft transition-colors cursor-pointer min-h-[44px]"
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
}
