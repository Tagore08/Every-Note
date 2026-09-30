import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`py-12 px-6 text-center flex flex-col items-center justify-center max-w-xs mx-auto gap-5 ${className}`}
    >
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-soft to-surface-2 border border-accent/20 flex items-center justify-center text-accent shadow-card">
          <span className="w-7 h-7 flex items-center justify-center">
            {icon}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-ink tracking-tight">{title}</h3>
        <p className="text-sm text-ink-muted leading-relaxed">{description}</p>
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-accent text-accent-ink text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-card cursor-pointer min-h-[44px]"
        >
          <span>{action.label}</span>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}
    </div>
  );
}
