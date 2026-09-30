import { describe, it, expect } from 'vitest';
import {
  clampZoom,
  screenToDoc,
  docToScreen,
  zoomAt,
  panBy,
  fitToScreen,
  type ViewportTransform,
} from './transform';
import {
  getSvgPathFromStroke,
  getStrokeOutline,
  hitTestStroke,
  pointToSegmentDistance,
} from './strokeGeometry';
import { CanvasHistory } from './history';
import type { Stroke } from '../../../types/canvas';

describe('Canvas Engine Transform', () => {
  it('clamps zoom between 0.25 and 4.0', () => {
    expect(clampZoom(0.1)).toBe(0.25);
    expect(clampZoom(0.25)).toBe(0.25);
    expect(clampZoom(1.5)).toBe(1.5);
    expect(clampZoom(4.0)).toBe(4.0);
    expect(clampZoom(5.2)).toBe(4.0);
  });

  it('converts screen to doc and doc to screen symmetrically', () => {
    const transform: ViewportTransform = { panX: 100, panY: 50, zoom: 2.0 };
    const docPt: [number, number] = [350, 450];

    const [screenX, screenY] = docToScreen(docPt[0], docPt[1], transform);
    expect(screenX).toBe(350 * 2.0 + 100); // 800
    expect(screenY).toBe(450 * 2.0 + 50);  // 950

    const [convertedDocX, convertedDocY] = screenToDoc(screenX, screenY, transform);
    expect(convertedDocX).toBe(350);
    expect(convertedDocY).toBe(450);
  });

  it('zooms towards a focal point preserving the document point under the cursor', () => {
    const initial: ViewportTransform = { panX: 0, panY: 0, zoom: 1.0 };
    const focalX = 500;
    const focalY = 300;

    // Before zoom, doc point under focal is (500, 300)
    const zoomed = zoomAt(initial, focalX, focalY, 2.0);
    expect(zoomed.zoom).toBe(2.0);

    // After zoom, screenToDoc of (500, 300) must still be (500, 300)
    const [docX, docY] = screenToDoc(focalX, focalY, zoomed);
    expect(docX).toBe(500);
    expect(docY).toBe(300);
  });

  it('pans correctly with panBy', () => {
    const initial: ViewportTransform = { panX: 100, panY: 100, zoom: 1.0 };
    const panned = panBy(initial, 50, -25);
    expect(panned.panX).toBe(150);
    expect(panned.panY).toBe(75);
  });

  it('fits 3000x2000 virtual document centered on screen', () => {
    const fit = fitToScreen(3000, 2000, 1000, 800, 0);
    // scale should be min(1000/3000, 800/2000) = min(0.3333, 0.4) = 0.3333...
    expect(fit.zoom).toBeCloseTo(1 / 3, 2);
    expect(fit.panX).toBeCloseTo(0, 1);
    expect(fit.panY).toBeGreaterThan(0); // vertically centered
  });
});

describe('Stroke Geometry & Hit-Testing', () => {
  it('generates non-empty outline and SVG path for pen stroke', () => {
    const stroke: Stroke = {
      id: 'stroke-1',
      tool: 'pen',
      color: '#000000',
      size: 8,
      points: [
        [100, 100, 0.5],
        [120, 110, 0.7],
        [150, 130, 0.6],
      ],
    };

    const outline = getStrokeOutline(stroke, true);
    expect(outline.length).toBeGreaterThan(0);

    const path = getSvgPathFromStroke(outline);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
  });

  it('calculates point to segment distance accurately', () => {
    // Horizontal segment from (10, 0) to (20, 0)
    expect(pointToSegmentDistance(15, 5, 10, 0, 20, 0)).toBe(5);
    // Left of segment
    expect(pointToSegmentDistance(5, 0, 10, 0, 20, 0)).toBe(5);
    // Right of segment
    expect(pointToSegmentDistance(25, 0, 10, 0, 20, 0)).toBe(5);
  });

  it('hit tests stroke against eraser point accurately', () => {
    const stroke: Stroke = {
      id: 'stroke-test',
      tool: 'pen',
      color: '#111111',
      size: 10,
      points: [
        [100, 100, 0.5],
        [200, 100, 0.5],
      ],
    };

    // Close to midpoint (150, 105) -> should hit
    expect(hitTestStroke(stroke, [150, 105], 10)).toBe(true);

    // Far away (150, 200) -> should miss
    expect(hitTestStroke(stroke, [150, 200], 10)).toBe(false);
  });
});

describe('Canvas History', () => {
  it('manages undo and redo stacks correctly up to capacity', () => {
    const strokeA: Stroke = {
      id: 'a',
      tool: 'pen',
      color: '#000',
      size: 4,
      points: [[1, 1, 0.5]],
    };
    const strokeB: Stroke = {
      id: 'b',
      tool: 'pen',
      color: '#000',
      size: 4,
      points: [[2, 2, 0.5]],
    };

    const history = new CanvasHistory<Stroke[]>(50, []);
    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    // Push first stroke
    history.push([strokeA]);
    expect(history.canUndo()).toBe(true);
    expect(history.getCurrent()).toEqual([strokeA]);

    // Push second stroke
    history.push([strokeA, strokeB]);
    expect(history.getCurrent()).toEqual([strokeA, strokeB]);

    // Undo step
    const afterUndo = history.undo();
    expect(afterUndo).toEqual([strokeA]);
    expect(history.canRedo()).toBe(true);

    // Redo step
    const afterRedo = history.redo();
    expect(afterRedo).toEqual([strokeA, strokeB]);
    expect(history.canRedo()).toBe(false);

    // Undo again, then push new stroke -> redo stack cleared
    history.undo();
    history.push([strokeB]);
    expect(history.canRedo()).toBe(false);
    expect(history.getCurrent()).toEqual([strokeB]);
  });
});
