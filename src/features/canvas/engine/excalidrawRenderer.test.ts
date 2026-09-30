import { describe, it, expect } from 'vitest';
import { hitTestElement, hitTestHandle } from './excalidrawRenderer';
import { CanvasHistory } from './history';
import type { CanvasElement, Stroke } from '../../../types/canvas';

describe('Excalidraw Engine Hit-Testing', () => {
  it('correctly hit-tests rectangular element bounds', () => {
    const rect: CanvasElement = {
      id: 'rect-1',
      type: 'rectangle',
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      strokeColor: '#000',
      backgroundColor: 'transparent',
      fillStyle: 'none',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      roundness: 0,
    };

    // Inside rect
    expect(hitTestElement(rect, 150, 150)).toBe(true);
    // Boundary with padding
    expect(hitTestElement(rect, 96, 96)).toBe(true);
    // Outside
    expect(hitTestElement(rect, 50, 50)).toBe(false);
    expect(hitTestElement(rect, 350, 300)).toBe(false);
  });

  it('correctly hit-tests line and arrow segments', () => {
    const arrow: CanvasElement = {
      id: 'arrow-1',
      type: 'arrow',
      x: 50,
      y: 50,
      width: 100,
      height: 0,
      strokeColor: '#000',
      backgroundColor: 'transparent',
      fillStyle: 'none',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      roundness: 0,
      points: [[0, 0], [100, 0]],
    };

    // Near the arrow line (100, 52)
    expect(hitTestElement(arrow, 100, 52)).toBe(true);
    // Far away (100, 100)
    expect(hitTestElement(arrow, 100, 100)).toBe(false);
  });

  it('identifies resize handles on selected elements', () => {
    const el: CanvasElement = {
      id: 'shape-1',
      type: 'rectangle',
      x: 200,
      y: 200,
      width: 100,
      height: 100,
      strokeColor: '#000',
      backgroundColor: 'transparent',
      fillStyle: 'none',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 0,
      roundness: 0,
    };

    const zoom = 1.0;
    // South-East handle is near (304, 304) (width=100 + pad 4)
    expect(hitTestHandle(el, 304, 304, zoom)).toBe('se');
    // North-West handle is near (196, 196) (200 - pad 4)
    expect(hitTestHandle(el, 196, 196, zoom)).toBe('nw');
    // Middle of element should NOT hit a handle
    expect(hitTestHandle(el, 250, 250, zoom)).toBeNull();
  });
});

describe('Canvas History with Elements and Strokes', () => {
  it('manages undo and redo stacks for combined strokes and vector elements', () => {
    interface CanvasState {
      strokes: Stroke[];
      elements: CanvasElement[];
    }

    const initial: CanvasState = { strokes: [], elements: [] };
    const history = new CanvasHistory<CanvasState>(50, initial);

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);

    const el1: CanvasElement = {
      id: 'el-1',
      type: 'rectangle',
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      strokeColor: '#18181b',
      backgroundColor: 'transparent',
      fillStyle: 'none',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 1,
      roundness: 0,
    };

    const state1: CanvasState = { strokes: [], elements: [el1] };
    history.push(state1);

    expect(history.canUndo()).toBe(true);
    expect(history.getCurrent().elements.length).toBe(1);

    // Undo returns initial empty state
    const afterUndo = history.undo();
    expect(afterUndo?.elements.length).toBe(0);
    expect(history.canRedo()).toBe(true);

    // Redo restores state1
    const afterRedo = history.redo();
    expect(afterRedo?.elements.length).toBe(1);
    expect(afterRedo?.elements[0].id).toBe('el-1');
  });
});
