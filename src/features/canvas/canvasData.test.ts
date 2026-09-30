import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../db/database';
import { canvasRepo, createDefaultCanvasDoc } from '../../db/repos/canvasRepo';
import type { CanvasDoc, Stroke } from '../../types/canvas';

describe('Canvas Repository & Data Integration', () => {
  beforeEach(async () => {
    await db.canvases.clear();
  });

  it('creates default canvas doc with 3000x2000 fixed dimensions and custom background', () => {
    const defaultDoc = createDefaultCanvasDoc();
    expect(defaultDoc.version).toBe(1);
    expect(defaultDoc.width).toBe(3000);
    expect(defaultDoc.height).toBe(2000);
    expect(defaultDoc.bg).toBe('#ffffff');
    expect(defaultDoc.strokes).toEqual([]);

    const darkDoc = createDefaultCanvasDoc('#1e1e2e');
    expect(darkDoc.bg).toBe('#1e1e2e');
  });

  it('creates, retrieves, and persists a canvas in Dexie database', async () => {
    const created = await canvasRepo.createCanvas({
      title: 'Architecture Blueprint',
      tags: ['#System', 'Architecture '],
      linkedNoteId: 42,
    });

    expect(created.id).toBeDefined();
    expect(created.title).toBe('Architecture Blueprint');
    expect(created.tags).toEqual(['system', 'architecture']);
    expect(created.linkedNoteId).toBe(42);
    expect(created.trashedAt).toBeNull();

    const fetched = await canvasRepo.getCanvasById(created.id!);
    expect(fetched).toBeDefined();
    expect(fetched?.title).toBe('Architecture Blueprint');
    expect(fetched?.tags).toEqual(['system', 'architecture']);
  });

  it('updates canvas strokes and document structure', async () => {
    const canvas = await canvasRepo.createCanvas({ title: 'Sketch Pad' });
    const stroke: Stroke = {
      id: 's1',
      tool: 'pen',
      color: '#ff0000',
      size: 4,
      points: [
        [10, 10, 0.5],
        [20, 25, 0.7],
      ],
    };

    const newDoc: CanvasDoc = {
      ...canvas.doc,
      strokes: [stroke],
    };

    await canvasRepo.updateCanvasDoc(canvas.id!, newDoc);

    const updated = await canvasRepo.getCanvasById(canvas.id!);
    expect(updated?.doc.strokes).toHaveLength(1);
    expect(updated?.doc.strokes[0].id).toBe('s1');
    expect(updated?.doc.strokes[0].tool).toBe('pen');
  });

  it('handles soft-delete (trash), restoration, and permanent removal', async () => {
    const canvas = await canvasRepo.createCanvas({ title: 'Temporary Wireframe' });
    expect(canvas.trashedAt).toBeNull();

    await canvasRepo.trashCanvas(canvas.id!);
    const trashed = await canvasRepo.getCanvasById(canvas.id!);
    expect(trashed?.trashedAt).not.toBeNull();

    const activeList = await canvasRepo.getAllCanvases(false);
    expect(activeList.find((c) => c.id === canvas.id)).toBeUndefined();

    const trashedList = await canvasRepo.getTrashedCanvases();
    expect(trashedList.find((c) => c.id === canvas.id)).toBeDefined();

    await canvasRepo.restoreCanvas(canvas.id!);
    const restored = await canvasRepo.getCanvasById(canvas.id!);
    expect(restored?.trashedAt).toBeNull();

    await canvasRepo.deleteCanvasPermanently(canvas.id!);
    const deleted = await canvasRepo.getCanvasById(canvas.id!);
    expect(deleted).toBeUndefined();
  });

  it('filters canvases linked to specific parent notes', async () => {
    await canvasRepo.createCanvas({ title: 'Canvas A', linkedNoteId: 101 });
    await canvasRepo.createCanvas({ title: 'Canvas B', linkedNoteId: 101 });
    await canvasRepo.createCanvas({ title: 'Canvas C', linkedNoteId: 202 });

    const note101Canvases = await canvasRepo.getCanvasesForNote(101);
    expect(note101Canvases).toHaveLength(2);
    expect(note101Canvases.map((c) => c.title)).toContain('Canvas A');
    expect(note101Canvases.map((c) => c.title)).toContain('Canvas B');

    const note202Canvases = await canvasRepo.getCanvasesForNote(202);
    expect(note202Canvases).toHaveLength(1);
    expect(note202Canvases[0].title).toBe('Canvas C');
  });
});
