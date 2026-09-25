import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  children,
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variantStyles = {
    primary:
      'bg-accent text-accent-ink hover:opacity-95 active:scale-[0.98] shadow-card font-semibold border border-transparent',
    secondary:
      'bg-surface-2 text-ink hover:bg-surface-3 active:scale-[0.98] border border-border font-medium',
    ghost:
      'bg-transparent text-ink-muted hover:text-ink hover:bg-surface-2 active:scale-[0.98] font-medium border border-transparent',
    danger:
      'bg-danger/10 text-danger hover:bg-danger/20 active:scale-[0.98] font-medium border border-danger/20',
  }[variant];

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 min-h-[36px] rounded-md gap-1.5',
    md: 'text-sm px-4 py-2 min-h-[44px] rounded-lg gap-2',
    lg: 'text-base px-5 py-2.5 min-h-[50px] rounded-xl gap-2.5',
  }[size];

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center transition-all select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${variantStyles} ${sizeStyles} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && iconRight && <span className="shrink-0">{iconRight}</span>}
    </button>
  );
}
