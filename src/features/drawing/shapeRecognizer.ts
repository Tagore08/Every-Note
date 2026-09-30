export type RecognizedShape = 'circle' | 'rectangle' | 'line' | null;

export interface ShapeRecognitionResult {
  shape: RecognizedShape;
  points: [number, number, number][]; // [x, y, pressure]
}

/**
 * Recognizes if rough stroke points represent a circle, rectangle, or straight line,
 * and returns smoothed/perfected points.
 */
export function recognizeAndSnapShape(
  points: [number, number, number][]
): ShapeRecognitionResult {
  if (points.length < 8) {
    return { shape: null, points };
  }

  const n = points.length;
  const first = points[0];
  const last = points[n - 1];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let totalLength = 0;

  for (let i = 0; i < n; i++) {
    const [x, y] = points[i];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;

    if (i > 0) {
      totalLength += Math.hypot(x - points[i - 1][0], y - points[i - 1][1]);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const chordDist = Math.hypot(last[0] - first[0], last[1] - first[1]);
  const isClosed = chordDist < Math.max(25, 0.25 * Math.max(width, height));

  // ── 1. Straight Line Check ──────────────────────────────────────────────────
  if (!isClosed && chordDist > 40 && totalLength > 40) {
    let maxDeviation = 0;
    const dx = last[0] - first[0];
    const dy = last[1] - first[1];
    const len = Math.hypot(dx, dy);

    for (let i = 1; i < n - 1; i++) {
      const px = points[i][0] - first[0];
      const py = points[i][1] - first[1];
      // Perpendicular distance
      const dev = Math.abs(dx * py - dy * px) / len;
      if (dev > maxDeviation) maxDeviation = dev;
    }

    if (maxDeviation / len < 0.10) {
      // Snap to exact horizontal or vertical if close
      let endX = last[0];
      let endY = last[1];
      const angle = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
      if (angle < 8 || angle > 172) {
        endY = first[1]; // Horizontal snap
      } else if (Math.abs(angle - 90) < 8) {
        endX = first[0]; // Vertical snap
      }

      // Generate straight segment with pressure
      const snapped: [number, number, number][] = [];
      const steps = 16;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        snapped.push([
          first[0] + t * (endX - first[0]),
          first[1] + t * (endY - first[1]),
          first[2] ?? 0.5,
        ]);
      }
      return { shape: 'line', points: snapped };
    }
  }

  // ── 2. Closed Loop: Circle or Rectangle Check ──────────────────────────────
  if (isClosed && width > 20 && height > 20) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const avgRadius = (width + height) / 4;

    // Check circular variance
    let radiusDiffSum = 0;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(points[i][0] - cx, points[i][1] - cy);
      radiusDiffSum += Math.abs(d - avgRadius);
    }
    const avgRadiusDiff = radiusDiffSum / n;
    const aspectDiff = Math.abs(width - height) / Math.max(width, height);

    // Circle match: aspect ratio close to 1:1 and low radius variance
    if (aspectDiff < 0.35 && avgRadiusDiff / avgRadius < 0.22) {
      const circlePts: [number, number, number][] = [];
      const steps = 36;
      for (let s = 0; s <= steps; s++) {
        const theta = (s / steps) * 2 * Math.PI;
        circlePts.push([
          cx + avgRadius * Math.cos(theta),
          cy + avgRadius * Math.sin(theta),
          first[2] ?? 0.5,
        ]);
      }
      return { shape: 'circle', points: circlePts };
    }

    // Rectangle check: perimeter comparison
    const boxPerimeter = 2 * (width + height);
    if (Math.abs(totalLength - boxPerimeter) / boxPerimeter < 0.28) {
      const rectPts: [number, number, number][] = [];
      const corners = [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY],
      ];
      for (let c = 0; c < 4; c++) {
        const [x1, y1] = corners[c];
        const [x2, y2] = corners[c + 1];
        for (let s = 0; s < 6; s++) {
          const t = s / 6;
          rectPts.push([x1 + t * (x2 - x1), y1 + t * (y2 - y1), first[2] ?? 0.5]);
        }
      }
      rectPts.push([minX, minY, first[2] ?? 0.5]);
      return { shape: 'rectangle', points: rectPts };
    }
  }

  return { shape: null, points };
}
