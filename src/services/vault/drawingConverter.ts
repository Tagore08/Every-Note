import type { CanvasDoc, Stroke } from '../../types/canvas';

/**
 * Checks if a file name or content represents an Obsidian Drawing or Canvas file
 */
export function isDrawingFile(fileName: string, content?: string): boolean {
  const lower = fileName.toLowerCase();
  if (
    lower.endsWith('.canvas') ||
    lower.endsWith('.excalidraw') ||
    lower.endsWith('.excalidraw.md') ||
    lower.endsWith('.drawing') ||
    lower.endsWith('.drawing.md') ||
    lower.endsWith('.ink')
  ) {
    return true;
  }

  if (content) {
    // Check for Obsidian Excalidraw plugin markers
    if (content.includes('excalidraw-plugin:') || content.includes('# Drawing\n```json')) {
      return true;
    }
    // Check for raw Excalidraw or Canvas JSON content
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (
          parsed.type === 'excalidraw' ||
          Array.isArray(parsed.elements) ||
          Array.isArray(parsed.nodes)
        ) {
          return true;
        }
      } catch {
        // Not JSON
      }
    }
  }

  return false;
}

/**
 * Clean drawing title from filename
 */
export function cleanDrawingTitle(fileName: string): string {
  return fileName
    .replace(/\.(canvas|excalidraw\.md|excalidraw|drawing\.md|drawing|ink|md|txt)$/i, '')
    .trim();
}

/**
 * Parses Obsidian Excalidraw or Obsidian Canvas content into our app's CanvasDoc
 */
export function parseDrawingToCanvasDoc(content: string, _fileName?: string): CanvasDoc {
  const docWidth = 3000;
  const docHeight = 2000;
  const strokes: Stroke[] = [];

  // Try extracting JSON payload
  let jsonData: any = null;

  // 1. Direct JSON parse
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      jsonData = JSON.parse(trimmed);
    } catch {
      // Ignore
    }
  }

  // 2. Obsidian Excalidraw markdown block parse (%% # Drawing ```json ... ``` %%)
  if (!jsonData && (content.includes('```json') || content.includes('excalidraw-plugin'))) {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        jsonData = JSON.parse(jsonMatch[1]);
      } catch {
        // Fallback
      }
    }
  }

  // 3. Fallback: Search for any JSON object containing "elements" or "nodes"
  if (!jsonData) {
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const candidate = content.slice(firstBrace, lastBrace + 1);
        const parsed = JSON.parse(candidate);
        if (parsed.elements || parsed.nodes) {
          jsonData = parsed;
        }
      } catch {
        // Not JSON
      }
    }
  }

  if (jsonData) {
    // ── Case A: Excalidraw Drawing (elements array) ──────────────────────────
    if (Array.isArray(jsonData.elements)) {
      let strokeIndex = 0;
      for (const el of jsonData.elements) {
        if (!el || el.isDeleted) continue;

        const x = typeof el.x === 'number' ? el.x : 0;
        const y = typeof el.y === 'number' ? el.y : 0;
        const color = el.strokeColor || '#18181b';
        const size = Math.max(2, Math.min(24, (el.strokeWidth || 2) * 2));

        if (el.type === 'freedraw' && Array.isArray(el.points)) {
          // Freehand drawing stroke
          const points: [number, number, number][] = [];
          for (const pt of el.points) {
            if (Array.isArray(pt) && pt.length >= 2) {
              const px = Math.max(10, Math.min(docWidth - 10, x + pt[0]));
              const py = Math.max(10, Math.min(docHeight - 10, y + pt[1]));
              const pressure = typeof pt[2] === 'number' ? pt[2] : 0.5;
              points.push([px, py, pressure]);
            }
          }
          if (points.length > 0) {
            strokes.push({
              id: `excal_${strokeIndex++}_${el.id || Math.random().toString(36).slice(2, 7)}`,
              tool: 'pen',
              color,
              size,
              points,
            });
          }
        } else if ((el.type === 'line' || el.type === 'arrow') && Array.isArray(el.points)) {
          // Line or Arrow
          const points: [number, number, number][] = [];
          for (const pt of el.points) {
            if (Array.isArray(pt) && pt.length >= 2) {
              points.push([x + pt[0], y + pt[1], 0.6]);
            }
          }
          if (points.length >= 2) {
            strokes.push({
              id: `line_${strokeIndex++}`,
              tool: 'pen',
              color,
              size,
              points,
            });
          }
        } else if (el.type === 'rectangle' && typeof el.width === 'number' && typeof el.height === 'number') {
          // Convert rectangle boundary to a 4-point stroke loop
          const w = el.width;
          const h = el.height;
          strokes.push({
            id: `rect_${strokeIndex++}`,
            tool: 'pen',
            color,
            size,
            points: [
              [x, y, 0.5],
              [x + w, y, 0.5],
              [x + w, y + h, 0.5],
              [x, y + h, 0.5],
              [x, y, 0.5],
            ],
          });
        } else if (el.type === 'ellipse' && typeof el.width === 'number' && typeof el.height === 'number') {
          // Approximate ellipse perimeter with 16 points
          const rx = el.width / 2;
          const ry = el.height / 2;
          const cx = x + rx;
          const cy = y + ry;
          const points: [number, number, number][] = [];
          for (let i = 0; i <= 16; i++) {
            const theta = (i / 16) * 2 * Math.PI;
            points.push([cx + rx * Math.cos(theta), cy + ry * Math.sin(theta), 0.5]);
          }
          strokes.push({
            id: `ellipse_${strokeIndex++}`,
            tool: 'pen',
            color,
            size,
            points,
          });
        }
      }
    }

    // ── Case B: Obsidian Canvas (.canvas nodes and edges) ─────────────────────
    if (Array.isArray(jsonData.nodes)) {
      let nodeIndex = 0;
      for (const node of jsonData.nodes) {
        if (!node) continue;
        const x = typeof node.x === 'number' ? node.x + 500 : 500;
        const y = typeof node.y === 'number' ? node.y + 400 : 400;
        const w = typeof node.width === 'number' ? node.width : 250;
        const h = typeof node.height === 'number' ? node.height : 140;
        const color = node.color ? (node.color.startsWith('#') ? node.color : '#3b82f6') : '#18181b';

        // Draw card boundary stroke for canvas node
        strokes.push({
          id: `node_border_${nodeIndex++}`,
          tool: 'pen',
          color,
          size: 4,
          points: [
            [x, y, 0.5],
            [x + w, y, 0.5],
            [x + w, y + h, 0.5],
            [x, y + h, 0.5],
            [x, y, 0.5],
          ],
        });

        // Top accent line
        strokes.push({
          id: `node_accent_${nodeIndex++}`,
          tool: 'highlighter',
          color: node.color || '#3b82f6',
          size: 10,
          points: [
            [x + 10, y + 15, 0.5],
            [x + w - 10, y + 15, 0.5],
          ],
        });
      }

      // Draw connection lines for edges if any
      if (Array.isArray(jsonData.edges)) {
        const nodePosMap = new Map<string, { cx: number; cy: number }>();
        for (const n of jsonData.nodes) {
          if (n && n.id) {
            const nx = typeof n.x === 'number' ? n.x + 500 : 500;
            const ny = typeof n.y === 'number' ? n.y + 400 : 400;
            const nw = typeof n.width === 'number' ? n.width : 250;
            const nh = typeof n.height === 'number' ? n.height : 140;
            nodePosMap.set(n.id, { cx: nx + nw / 2, cy: ny + nh / 2 });
          }
        }

        let edgeIndex = 0;
        for (const edge of jsonData.edges) {
          const from = nodePosMap.get(edge.fromNode);
          const to = nodePosMap.get(edge.toNode);
          if (from && to) {
            strokes.push({
              id: `edge_${edgeIndex++}`,
              tool: 'pen',
              color: '#64748b',
              size: 4,
              points: [
                [from.cx, from.cy, 0.5],
                [to.cx, to.cy, 0.5],
              ],
            });
          }
        }
      }
    }

    // ── Case C: App's native CanvasDoc or strokes array ──────────────────────
    if (Array.isArray(jsonData.strokes)) {
      for (const s of jsonData.strokes) {
        if (s && Array.isArray(s.points)) {
          strokes.push({
            id: s.id || `stroke_${Math.random().toString(36).slice(2, 7)}`,
            tool: s.tool || 'pen',
            color: s.color || '#18181b',
            size: s.size || 8,
            points: s.points,
          });
        }
      }
    }
  }

  // If no strokes were parsed (or file was empty / custom format), provide initial canvas placeholder stroke
  if (strokes.length === 0) {
    const cx = docWidth / 2;
    const cy = docHeight / 2;
    strokes.push({
      id: 'init_drawing_placeholder',
      tool: 'pen',
      color: '#3b82f6',
      size: 4,
      points: [
        [cx - 100, cy, 0.5],
        [cx + 100, cy, 0.5],
      ],
    });
  }

  return {
    version: 1,
    width: docWidth,
    height: docHeight,
    bg: '#ffffff',
    strokes,
  };
}
