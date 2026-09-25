import { describe, it, expect } from 'vitest';
import { createDefaultCanvasDoc } from '../../db/repos/canvasRepo';
import type { CanvasDoc, CanvasEntity, Stroke } from '../../types/canvas';

describe('Canvas Data Model', () => {
  it('creates default canvas doc with 3000x2000 fixed virtual page dimensions', () => {
    const doc = createDefaultCanvasDoc();
    expect(doc.version).toBe(1);
    expect(doc.width).toBe(3000);
    expect(doc.height).toBe(2000);
    expect(doc.bg).toBe('#ffffff');
    expect(doc.strokes).toEqual([]);
  });

  it('preserves stroke immutability and doc structure during stroke updates', () => {
    const doc: CanvasDoc = createDefaultCanvasDoc();
    const stroke1: Stroke = {
      id: 's1',
      tool: 'pen',
      color: '#18181b',
      size: 8,
      points: [
        [100, 100, 0.5],
        [105, 108, 0.6],
      ],
    };

    const stroke2: Stroke = {
      id: 's2',
      tool: 'highlighter',
      color: 'oklch(0.64 0.13 60)',
      size: 16,
      points: [
        [200, 200, 0.5],
        [250, 200, 0.5],
      ],
    };

    const updatedDoc: CanvasDoc = {
      ...doc,
      strokes: [...doc.strokes, stroke1, stroke2],
    };

    expect(doc.strokes).toHaveLength(0); // Original unchanged
    expect(updatedDoc.strokes).toHaveLength(2);
    expect(updatedDoc.strokes[0].tool).toBe('pen');
    expect(updatedDoc.strokes[1].tool).toBe('highlighter');
  });

  it('supports linking a canvas to a parent note with provenance', () => {
    const entity: CanvasEntity = {
      id: 42,
      title: 'Architecture Diagram',
      doc: createDefaultCanvasDoc(),
      linkedNoteId: 108,
      tags: ['design', 'v2'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trashedAt: null,
    };

    expect(entity.linkedNoteId).toBe(108);
    expect(entity.tags).toContain('design');
    expect(entity.trashedAt).toBeNull();
  });
});
