export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'circle' | 'rect';
}

export function Skeleton({ className = '', variant = 'text' }: SkeletonProps) {
  const variantStyles = {
    text:   'h-4 w-full rounded-md',
    card:   'h-24 w-full rounded-card',
    circle: 'w-10 h-10 rounded-full shrink-0',
    rect:   'h-10 w-full rounded-xl',
  };

  return (
    <div
      className={`skeleton-shimmer ${variantStyles[variant]} ${className}`}
      aria-hidden="true"
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5 max-w-md mx-auto p-4 sm:p-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between pb-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" variant="circle" />
      </div>

      {/* Capture bar skeleton */}
      <Skeleton variant="rect" className="h-14 rounded-2xl" />

      {/* Card skeletons */}
      <div className="space-y-3">
        <Skeleton variant="card" className="h-[100px]" />
        <Skeleton variant="card" className="h-[80px]" />
        <Skeleton variant="card" className="h-[80px]" />
      </div>

      {/* List skeletons */}
      <div className="space-y-2.5 pt-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-surface border border-border/50">
            <Skeleton variant="circle" className="w-8 h-8" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
