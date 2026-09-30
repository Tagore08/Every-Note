import { describe, it, expect } from 'vitest';
import {
  isDrawingFile,
  cleanDrawingTitle,
  parseDrawingToCanvasDoc,
} from './drawingConverter';

describe('drawingConverter', () => {
  it('correctly identifies drawing and canvas files by extension and content', () => {
    expect(isDrawingFile('architecture.canvas')).toBe(true);
    expect(isDrawingFile('mindmap.excalidraw')).toBe(true);
    expect(isDrawingFile('sketch.excalidraw.md')).toBe(true);
    expect(isDrawingFile('wireframe.drawing')).toBe(true);
    expect(isDrawingFile('handwriting.ink')).toBe(true);
    expect(isDrawingFile('regular_note.md')).toBe(false);

    // Markdown file with Obsidian Excalidraw plugin marker
    const excalidrawMd = `---
excalidraw-plugin: parsed
tags: [drawing]
---
# Drawing
\`\`\`json
{"type": "excalidraw", "elements": []}
\`\`\``;
    expect(isDrawingFile('some_note.md', excalidrawMd)).toBe(true);

    // Raw Canvas JSON
    const canvasJson = JSON.stringify({
      nodes: [{ id: '1', type: 'text', text: 'Hello', x: 0, y: 0, width: 200, height: 100 }],
      edges: [],
    });
    expect(isDrawingFile('note.txt', canvasJson)).toBe(true);
  });

  it('cleans drawing file titles properly', () => {
    expect(cleanDrawingTitle('Project Diagram.canvas')).toBe('Project Diagram');
    expect(cleanDrawingTitle('User Flow.excalidraw.md')).toBe('User Flow');
    expect(cleanDrawingTitle('Whiteboard.excalidraw')).toBe('Whiteboard');
    expect(cleanDrawingTitle('Wireframe.drawing')).toBe('Wireframe');
  });

  it('converts Obsidian Excalidraw elements to CanvasDoc strokes', () => {
    const excalidrawContent = JSON.stringify({
      type: 'excalidraw',
      version: 2,
      elements: [
        {
          id: 'stroke1',
          type: 'freedraw',
          x: 100,
          y: 200,
          strokeColor: '#ef4444',
          strokeWidth: 3,
          points: [
            [0, 0],
            [10, 15],
            [30, 40],
          ],
        },
        {
          id: 'line1',
          type: 'line',
          x: 50,
          y: 60,
          strokeColor: '#3b82f6',
          strokeWidth: 2,
          points: [
            [0, 0],
            [100, 100],
          ],
        },
        {
          id: 'rect1',
          type: 'rectangle',
          x: 300,
          y: 400,
          width: 150,
          height: 80,
          strokeColor: '#10b981',
          strokeWidth: 2,
        },
      ],
    });

    const doc = parseDrawingToCanvasDoc(excalidrawContent, 'sketch.excalidraw');
    expect(doc.version).toBe(1);
    expect(doc.width).toBe(3000);
    expect(doc.height).toBe(2000);
    expect(doc.strokes.length).toBe(3);

    // Freehand stroke points check
    const freedraw = doc.strokes[0];
    expect(freedraw.tool).toBe('pen');
    expect(freedraw.color).toBe('#ef4444');
    expect(freedraw.points.length).toBe(3);
    expect(freedraw.points[0][0]).toBe(100);
    expect(freedraw.points[0][1]).toBe(200);

    // Line check
    const line = doc.strokes[1];
    expect(line.points.length).toBe(2);

    // Rectangle check (closed loop of 5 points)
    const rect = doc.strokes[2];
    expect(rect.points.length).toBe(5);
  });

  it('converts Obsidian Canvas (.canvas) nodes and edges to CanvasDoc strokes', () => {
    const canvasContent = JSON.stringify({
      nodes: [
        {
          id: 'nodeA',
          x: 100,
          y: 100,
          width: 200,
          height: 120,
          type: 'text',
          text: 'Idea A',
          color: '#8b5cf6',
        },
        {
          id: 'nodeB',
          x: 500,
          y: 100,
          width: 200,
          height: 120,
          type: 'text',
          text: 'Idea B',
        },
      ],
      edges: [
        {
          id: 'edge1',
          fromNode: 'nodeA',
          toNode: 'nodeB',
        },
      ],
    });

    const doc = parseDrawingToCanvasDoc(canvasContent, 'mindmap.canvas');
    expect(doc.version).toBe(1);
    expect(doc.strokes.length).toBeGreaterThanOrEqual(4); // 2 borders, 2 accents, 1 edge
  });
});
