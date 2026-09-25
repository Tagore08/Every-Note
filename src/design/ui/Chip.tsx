import type { ReactNode } from 'react';

export interface ChipProps {
  label: string;
  active?: boolean;
  color?: string; // hex or token color
  icon?: ReactNode;
  onRemove?: () => void;
  onClick?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function Chip({
  label,
  active = false,
  color,
  icon,
  onRemove,
  onClick,
  size = 'md',
  className = '',
}: ChipProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-pill font-medium transition-all select-none ${
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
      } ${
        onClick ? 'cursor-pointer active:scale-95 min-h-[38px] sm:min-h-[42px]' : ''
      } ${
        active
          ? 'bg-accent text-accent-ink shadow-card font-semibold'
          : 'bg-surface-2 text-ink border border-border/70 hover:bg-surface-3 hover:border-border'
      } ${className}`}
      style={color && !active ? { borderColor: color, color } : undefined}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {color && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
      )}
      <span className="truncate">{label}</span>

      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 -mr-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors cursor-pointer min-w-[24px] min-h-[24px] flex items-center justify-center"
          aria-label={`Remove ${label}`}
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </Component>
  );
}
