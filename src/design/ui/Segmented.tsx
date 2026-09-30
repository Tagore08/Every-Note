import type { ReactNode } from 'react';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export interface SegmentedProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}

export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex p-1 rounded-xl bg-surface-2/80 border border-border/50 gap-0.5 ${className}`}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-200 cursor-pointer
              ${size === 'sm' ? 'px-3 py-1 text-xs min-h-[34px]' : 'px-3.5 py-1.5 text-xs sm:text-sm min-h-[40px]'}
              ${isActive
                ? 'bg-surface text-accent shadow-card font-semibold'
                : 'text-ink-muted hover:text-ink hover:bg-surface/50'
              }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'bg-surface-3 text-ink-muted'
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
