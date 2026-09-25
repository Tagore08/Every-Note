export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'circle' | 'rect';
}

export function Skeleton({ className = '', variant = 'text' }: SkeletonProps) {
  const variantStyles = {
    text: 'h-4 w-full rounded',
    card: 'h-24 w-full rounded-card',
    circle: 'w-10 h-10 rounded-full shrink-0',
    rect: 'h-10 w-full rounded-lg',
  };

  return (
    <div
      className={`bg-surface-2 animate-pulse ${variantStyles[variant]} ${className}`}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 max-w-4xl mx-auto p-4 sm:p-6 animate-pulse">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-52" />
        </div>
        <Skeleton className="h-10 w-24 rounded-pill" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
        <Skeleton variant="card" className="h-32" />
        <Skeleton variant="card" className="h-32" />
        <Skeleton variant="card" className="h-32" />
      </div>

      <div className="space-y-3 pt-4">
        <Skeleton variant="rect" className="h-16" />
        <Skeleton variant="rect" className="h-16" />
        <Skeleton variant="rect" className="h-16" />
      </div>
    </div>
  );
}
