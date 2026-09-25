import { getStroke } from 'perfect-freehand';
import type { Stroke } from '../../../types/canvas';

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function getSvgPathFromStroke(outlinePoints: number[][]): string {
  if (!outlinePoints || outlinePoints.length === 0) return '';
  const d: (number | string)[] = [];
  const [firstX, firstY] = outlinePoints[0];
  d.push('M', firstX, firstY, 'Q');
  for (let i = 0; i < outlinePoints.length; i++) {
    const [x0, y0] = outlinePoints[i];
    const [x1, y1] = outlinePoints[(i + 1) % outlinePoints.length];
    d.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  d.push('Z');
  return d.join(' ');
}

export function getStrokeOutline(stroke: Stroke, isMouse = false): number[][] {
  if (!stroke.points || stroke.points.length === 0) return [];

  let size = stroke.size;
  let thinning = 0.6;
  let smoothing = 0.5;
  let streamline = 0.4;
  let simulatePressure = isMouse;

  if (stroke.tool === 'highlighter') {
    size = stroke.size * 3;
    thinning = 0;
    smoothing = 0.5;
    streamline = 0.7;
    simulatePressure = false;
  } else if (stroke.tool === 'brush') {
    // Deterministic slight size jitter from stroke id
    const hash = Math.abs(hashString(stroke.id || 'brush')) % 100;
    const jitter = (hash / 100 - 0.5) * 0.16; // -8% to +8%
    size = stroke.size * (1 + jitter);
    thinning = 0.85;
    smoothing = 0.5;
    streamline = 0.6;
    simulatePressure = isMouse;
  } else {
    // Pen
    thinning = 0.6;
    smoothing = 0.5;
    streamline = 0.4;
    simulatePressure = isMouse;
  }

  // perfect-freehand accepts [x, y, pressure]
  return getStroke(stroke.points, {
    size,
    thinning,
    smoothing,
    streamline,
    simulatePressure,
    last: true,
  });
}

export function renderStrokeToContext(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  cachedPath?: Path2D
): void {
  if (!stroke.points || stroke.points.length === 0) return;

  ctx.save();

  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = 'multiply';
  } else {
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.fillStyle = stroke.color;

  const path = cachedPath ?? new Path2D(getSvgPathFromStroke(getStrokeOutline(stroke)));
  ctx.fill(path);

  ctx.restore();
}

/**
 * Calculates distance from point (px, py) to line segment (x1, y1)-(x2, y2).
 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(px - projX, py - projY);
}

/**
 * Fast stroke bounding box computation for hit-test culling.
 */
export function getStrokeBounds(stroke: Stroke): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of stroke.points) {
    const x = pt[0];
    const y = pt[1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Hit test a stroke against an eraser point in document space.
 * Tolerance is stroke.size / 2 + 4px (or highlighter size).
 */
export function hitTestStroke(
  stroke: Stroke,
  docPoint: [number, number],
  eraserRadius = 10
): boolean {
  if (!stroke.points || stroke.points.length === 0) return false;

  const [px, py] = docPoint;
  const effectiveSize = stroke.tool === 'highlighter' ? stroke.size * 3 : stroke.size;
  const tolerance = effectiveSize / 2 + eraserRadius + 4;

  const bounds = getStrokeBounds(stroke);
  if (
    px < bounds.minX - tolerance ||
    px > bounds.maxX + tolerance ||
    py < bounds.minY - tolerance ||
    py > bounds.maxY + tolerance
  ) {
    return false;
  }

  const pts = stroke.points;
  if (pts.length === 1) {
    return Math.hypot(px - pts[0][0], py - pts[0][1]) <= tolerance;
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const d = pointToSegmentDistance(
      px,
      py,
      pts[i][0],
      pts[i][1],
      pts[i + 1][0],
      pts[i + 1][1]
    );
    if (d <= tolerance) {
      return true;
    }
  }

  return false;
}
