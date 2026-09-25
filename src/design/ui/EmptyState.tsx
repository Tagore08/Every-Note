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
      className={`p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-sm mx-auto space-y-4 ${className}`}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-surface-2 border border-border flex items-center justify-center text-ink-muted shadow-xs">
          {icon}
        </div>
      )}

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-ink tracking-tight">{title}</h3>
        <p className="text-sm text-ink-muted leading-relaxed">{description}</p>
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-pill bg-accent text-accent-ink text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-card cursor-pointer min-h-[44px]"
        >
          <span>{action.label}</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
