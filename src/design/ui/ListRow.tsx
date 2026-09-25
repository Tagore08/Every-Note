import type { HTMLAttributes, ReactNode } from 'react';

export interface ListRowProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'onClick'> {
  leftSlot?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  rightSlot?: ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  active?: boolean;
  density?: 'compact' | 'normal' | 'spacious';
  className?: string;
}

export function ListRow({
  leftSlot,
  title,
  subtitle,
  rightSlot,
  onClick,
  active = false,
  density = 'normal',
  className = '',
  ...props
}: ListRowProps) {
  const densityStyles = {
    compact: 'py-2 px-3 min-h-[40px]',
    normal: 'py-2.5 px-3.5 min-h-[48px]',
    spacious: 'py-3.5 px-4 min-h-[56px]',
  }[density];

  const content = (
    <>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {leftSlot && <div className="shrink-0 text-ink-muted">{leftSlot}</div>}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink truncate leading-tight">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-ink-muted truncate mt-0.5 leading-normal">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {rightSlot && (
        <div className="shrink-0 flex items-center gap-2 text-xs text-ink-muted">
          {rightSlot}
        </div>
      )}
    </>
  );

  const baseClasses = `w-full flex items-center justify-between gap-3 text-left rounded-lg transition-colors ${densityStyles} ${
    active ? 'bg-accent-soft text-accent font-medium' : 'text-ink'
  } ${className}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClasses} cursor-pointer active:scale-[0.99] hover:bg-surface-2`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={baseClasses} {...props}>
      {content}
    </div>
  );
}
