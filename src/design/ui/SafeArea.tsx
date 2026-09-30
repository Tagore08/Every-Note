import React, { forwardRef } from 'react';

export type SafeAreaEdge = 'top' | 'bottom' | 'left' | 'right';

export interface SafeAreaProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Safe area edges to apply insets to. Defaults to ['top'].
   */
  edges?: SafeAreaEdge[];
  /**
   * Component or element tag to render as. Defaults to 'div'.
   */
  as?: React.ElementType;
  /**
   * Whether to apply insets as padding or margin. Defaults to 'padding'.
   */
  insetType?: 'padding' | 'margin';
  /**
   * Additional manual offsets to combine with safe area insets.
   */
  offset?: {
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
  };
  children?: React.ReactNode;
}

function formatOffset(val?: number | string): string {
  if (val === undefined) return '0px';
  return typeof val === 'number' ? `${val}px` : val;
}

export const SafeArea = forwardRef<HTMLElement, SafeAreaProps>(function SafeArea(
  {
    edges = ['top'],
    as: Component = 'div',
    insetType = 'padding',
    offset = {},
    style,
    className = '',
    children,
    ...props
  },
  ref
) {
  const dynamicStyles: React.CSSProperties = { ...style };

  const isPadding = insetType === 'padding';

  if (edges.includes('top')) {
    const key = isPadding ? 'paddingTop' : 'marginTop';
    const existing = style?.[key];
    const extra = offset.top ? ` + ${formatOffset(offset.top)}` : '';
    dynamicStyles[key] = existing
      ? `calc(var(--safe-area-top, env(safe-area-inset-top, 0px)) + ${existing}${extra})`
      : `calc(var(--safe-area-top, env(safe-area-inset-top, 0px))${extra})`;
  }

  if (edges.includes('bottom')) {
    const key = isPadding ? 'paddingBottom' : 'marginBottom';
    const existing = style?.[key];
    const extra = offset.bottom ? ` + ${formatOffset(offset.bottom)}` : '';
    dynamicStyles[key] = existing
      ? `calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + ${existing}${extra})`
      : `calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px))${extra})`;
  }

  if (edges.includes('left')) {
    const key = isPadding ? 'paddingLeft' : 'marginLeft';
    const existing = style?.[key];
    const extra = offset.left ? ` + ${formatOffset(offset.left)}` : '';
    dynamicStyles[key] = existing
      ? `calc(var(--safe-area-left, env(safe-area-inset-left, 0px)) + ${existing}${extra})`
      : `calc(var(--safe-area-left, env(safe-area-inset-left, 0px))${extra})`;
  }

  if (edges.includes('right')) {
    const key = isPadding ? 'paddingRight' : 'marginRight';
    const existing = style?.[key];
    const extra = offset.right ? ` + ${formatOffset(offset.right)}` : '';
    dynamicStyles[key] = existing
      ? `calc(var(--safe-area-right, env(safe-area-inset-right, 0px)) + ${existing}${extra})`
      : `calc(var(--safe-area-right, env(safe-area-inset-right, 0px))${extra})`;
  }

  return (
    <Component
      ref={ref}
      style={dynamicStyles}
      className={className}
      {...props}
    >
      {children}
    </Component>
  );
});
