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
    <div className={`flex items-center justify-between gap-4 py-1.5 ${className}`}>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint">
            {title}
          </h2>
          {typeof count === 'number' && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-soft text-accent">
              {count}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:opacity-80 transition-opacity cursor-pointer min-h-[36px] px-1"
        >
          {action.icon}
          <span>{action.label}</span>
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
