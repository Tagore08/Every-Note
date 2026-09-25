import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: ReactNode;
  className?: string;
}

export function Card({
  variant = 'default',
  padding = 'md',
  children,
  className = '',
  ...props
}: CardProps) {
  const variantStyles = {
    default:
      'bg-surface text-ink border border-border/80 shadow-card rounded-card transition-shadow',
    flat:
      'bg-surface-2 text-ink border border-border/50 rounded-card',
    interactive:
      'bg-surface text-ink border border-border/80 shadow-card rounded-card hover:shadow-float active:scale-[0.99] transition-all cursor-pointer select-none',
  }[variant];

  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4 sm:p-5',
    lg: 'p-6',
  }[padding];

  return (
    <div
      className={`${variantStyles} ${paddingStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 mb-3 ${className}`}>
      <div>
        <h3 className="font-semibold text-sm sm:text-base text-ink tracking-tight">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
