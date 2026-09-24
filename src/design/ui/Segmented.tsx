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
      className={`inline-flex p-1 rounded-pill bg-surface-2 border border-border ${className}`}
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
            className={`relative flex items-center justify-center gap-2 px-3.5 rounded-pill font-medium text-xs sm:text-sm transition-all cursor-pointer min-h-[44px] ${
              size === 'sm' ? 'py-1' : 'py-1.5'
            } ${
              isActive
                ? 'bg-surface text-ink shadow-card font-semibold'
                : 'text-ink-muted hover:text-ink hover:bg-surface/50'
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'bg-surface text-ink-muted'
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
