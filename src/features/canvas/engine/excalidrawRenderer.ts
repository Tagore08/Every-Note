import type { CanvasElement } from '../../../types/canvas';

export type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w' | 'rotation';


/**
 * Draws sketchy lines for Excalidraw's iconic hachure fill
 */
function drawHachure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  gap = 12
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.45;

  const diag = Math.hypot(w, h);
  const count = Math.ceil((w + h) / gap);

  ctx.beginPath();
  for (let i = -count; i <= count; i++) {
    const x0 = x + i * gap;
    const y0 = y;
    const x1 = x0 + diag;
    const y1 = y0 + diag;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Sets stroke style (solid, dashed, dotted)
 */
function applyStrokeStyle(ctx: CanvasRenderingContext2D, style: string, width: number) {
  if (style === 'dashed') {
    ctx.setLineDash([width * 3, width * 2]);
  } else if (style === 'dotted') {
    ctx.setLineDash([width, width * 1.5]);
  } else {
    ctx.setLineDash([]);
  }
}

/**
 * Renders an Excalidraw element to a 2D canvas context
 */
export function renderElementToContext(
  ctx: CanvasRenderingContext2D,
  el: CanvasElement,
  isSelected = false,
  zoom = 1
): void {
  ctx.save();

  const strokeWidth = el.strokeWidth || 2;
  const strokeColor = el.strokeColor || '#18181b';
  const bgColor = el.backgroundColor || 'transparent';
  const fillStyle = el.fillStyle || 'none';

  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = strokeColor;
  applyStrokeStyle(ctx, el.strokeStyle || 'solid', strokeWidth);

  switch (el.type) {
    case 'rectangle': {
      // 1. Fill
      if (fillStyle === 'solid') {
        ctx.fillStyle = bgColor;
        if (el.roundness > 0) {
          ctx.beginPath();
          ctx.roundRect(el.x, el.y, el.width, el.height, Math.min(16, el.width / 4, el.height / 4));
          ctx.fill();
        } else {
          ctx.fillRect(el.x, el.y, el.width, el.height);
        }
      } else if (fillStyle === 'semi') {
        ctx.fillStyle = bgColor;
        ctx.globalAlpha = 0.35;
        if (el.roundness > 0) {
          ctx.beginPath();
          ctx.roundRect(el.x, el.y, el.width, el.height, Math.min(16, el.width / 4, el.height / 4));
          ctx.fill();
        } else {
          ctx.fillRect(el.x, el.y, el.width, el.height);
        }
        ctx.globalAlpha = 1.0;
      } else if (fillStyle === 'hachure') {
        drawHachure(ctx, el.x, el.y, el.width, el.height, strokeColor);
      }

      // 2. Stroke
      ctx.beginPath();
      if (el.roundness > 0) {
        ctx.roundRect(el.x, el.y, el.width, el.height, Math.min(16, el.width / 4, el.height / 4));
      } else {
        ctx.rect(el.x, el.y, el.width, el.height);
      }
      ctx.stroke();

      // If sketchy roughness, add a subtle second pass
      if (el.roughness > 0) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        const jitter = el.roughness * 1.5;
        ctx.rect(el.x - jitter, el.y + jitter, el.width + jitter * 0.5, el.height - jitter * 0.5);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'diamond': {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;

      ctx.beginPath();
      ctx.moveTo(cx, el.y);
      ctx.lineTo(el.x + el.width, cy);
      ctx.lineTo(cx, el.y + el.height);
      ctx.lineTo(el.x, cy);
      ctx.closePath();

      if (fillStyle === 'solid') {
        ctx.fillStyle = bgColor;
        ctx.fill();
      } else if (fillStyle === 'semi') {
        ctx.fillStyle = bgColor;
        ctx.globalAlpha = 0.35;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      } else if (fillStyle === 'hachure') {
        drawHachure(ctx, el.x, el.y, el.width, el.height, strokeColor);
      }

      ctx.stroke();
      break;
    }

    case 'ellipse': {
      const rx = Math.max(1, Math.abs(el.width) / 2);
      const ry = Math.max(1, Math.abs(el.height) / 2);
      const cx = el.x + rx;
      const cy = el.y + ry;

      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);

      if (fillStyle === 'solid') {
        ctx.fillStyle = bgColor;
        ctx.fill();
      } else if (fillStyle === 'semi') {
        ctx.fillStyle = bgColor;
        ctx.globalAlpha = 0.35;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      } else if (fillStyle === 'hachure') {
        drawHachure(ctx, el.x, el.y, el.width, el.height, strokeColor);
      }

      ctx.stroke();

      if (el.roughness > 0) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        ctx.ellipse(cx + 0.8, cy - 0.8, rx - 0.5, ry + 0.5, 0, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.restore();
      }
      break;
    }

    case 'line':
    case 'arrow': {
      const pts = el.points && el.points.length >= 2 ? el.points : [[0, 0], [el.width, el.height]];
      ctx.beginPath();
      ctx.moveTo(el.x + pts[0][0], el.y + pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(el.x + pts[i][0], el.y + pts[i][1]);
      }
      ctx.stroke();

      // Draw Arrow Head
      if (el.type === 'arrow' && pts.length >= 2) {
        const last = pts[pts.length - 1];
        const prev = pts[pts.length - 2];
        const endX = el.x + last[0];
        const endY = el.y + last[1];
        const prevX = el.x + prev[0];
        const prevY = el.y + prev[1];

        const angle = Math.atan2(endY - prevY, endX - prevX);
        const headLen = Math.max(10, strokeWidth * 3.5);

        ctx.save();
        ctx.fillStyle = strokeColor;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - headLen * Math.cos(angle - Math.PI / 6),
          endY - headLen * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          endX - headLen * Math.cos(angle + Math.PI / 6),
          endY - headLen * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      break;
    }

    case 'text': {
      const fontSize = el.fontSize || 20;
      const text = el.text || 'Text';
      ctx.font = `500 ${fontSize}px "Caveat", "Segoe Print", "Comic Sans MS", cursive, sans-serif`;
      ctx.fillStyle = strokeColor;
      ctx.textBaseline = 'top';

      const lines = text.split('\n');
      const lineHeight = fontSize * 1.25;
      lines.forEach((line, idx) => {
        ctx.fillText(line, el.x, el.y + idx * lineHeight);
      });
      break;
    }

    case 'card': {
      // Obsidian Note Card Element
      const w = Math.max(180, el.width);
      const h = Math.max(100, el.height);

      // Card Background
      ctx.fillStyle = el.backgroundColor || '#ffffff';
      ctx.beginPath();
      ctx.roundRect(el.x, el.y, w, h, 14);
      ctx.fill();

      // Top color accent bar
      ctx.fillStyle = el.strokeColor || '#3b82f6';
      ctx.beginPath();
      ctx.roundRect(el.x, el.y, w, 28, [14, 14, 0, 0]);
      ctx.fill();

      // Note icon & title in header bar
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      const cardTitle = el.noteTitle || el.text || 'Obsidian Note';
      ctx.fillText(`📄 ${cardTitle.slice(0, 24)}`, el.x + 10, el.y + 14);

      // Card border
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeStyle = isSelected ? '#3b82f6' : 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.roundRect(el.x, el.y, w, h, 14);
      ctx.stroke();

      // Snippet content lines placeholder
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.textBaseline = 'top';
      ctx.fillText(el.text ? el.text.slice(0, 80) : 'Double-click to open note in editor…', el.x + 12, el.y + 38);
      break;
    }
  }

  // Draw Selection Bounding Box & Handles
  if (isSelected) {
    drawSelectionBox(ctx, el, zoom);
  }

  ctx.restore();
}

/**
 * Draws the dashed selection bounding box and 8 interactive resize handles
 */
function drawSelectionBox(ctx: CanvasRenderingContext2D, el: CanvasElement, zoom: number): void {
  ctx.save();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);

  const pad = 4 / zoom;
  const x = el.x - pad;
  const y = el.y - pad;
  const w = el.width + pad * 2;
  const h = el.height + pad * 2;

  ctx.strokeRect(x, y, w, h);

  // Resize handle points
  const handleSize = 8 / zoom;
  const half = handleSize / 2;
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1.5 / zoom;

  const points = [
    { x, y },                       // nw
    { x: x + w / 2, y },            // n
    { x: x + w, y },                // ne
    { x: x + w, y: y + h / 2 },     // e
    { x: x + w, y: y + h },         // se
    { x: x + w / 2, y: y + h },     // s
    { x, y: y + h },                // sw
    { x, y: y + h / 2 },            // w
  ];

  for (const pt of points) {
    ctx.beginPath();
    ctx.rect(pt.x - half, pt.y - half, handleSize, handleSize);
    ctx.fill();
    ctx.stroke();
  }

  // Rotation Handle at top
  const rotY = y - 18 / zoom;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, rotY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + w / 2, rotY, 4 / zoom, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/**
 * Tests if world coordinates (x, y) hit element
 */
export function hitTestElement(el: CanvasElement, x: number, y: number): boolean {
  const pad = Math.max(8, (el.strokeWidth || 2) * 2);

  if (el.type === 'line' || el.type === 'arrow') {
    const pts = el.points && el.points.length >= 2 ? el.points : [[0, 0], [el.width, el.height]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = [el.x + pts[i][0], el.y + pts[i][1]];
      const p2 = [el.x + pts[i + 1][0], el.y + pts[i + 1][1]];
      const dist = pointToSegmentDist(x, y, p1[0], p1[1], p2[0], p2[1]);
      if (dist <= pad) return true;
    }
    return false;
  }

  // Rectangular / Ellipse bounds
  const minX = Math.min(el.x, el.x + el.width) - pad;
  const maxX = Math.max(el.x, el.x + el.width) + pad;
  const minY = Math.min(el.y, el.y + el.height) - pad;
  const maxY = Math.max(el.y, el.y + el.height) + pad;

  return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

/**
 * Tests if point hits one of the resize handles of a selected element
 */
export function hitTestHandle(
  el: CanvasElement,
  x: number,
  y: number,
  zoom: number
): ResizeHandle | null {
  const handleSize = 14 / zoom;
  const pad = 4 / zoom;
  const left = el.x - pad;
  const top = el.y - pad;
  const right = el.x + el.width + pad;
  const bottom = el.y + el.height + pad;
  const midX = (left + right) / 2;
  const midY = (top + bottom) / 2;

  const handles: { handle: ResizeHandle; x: number; y: number }[] = [
    { handle: 'nw', x: left, y: top },
    { handle: 'ne', x: right, y: top },
    { handle: 'se', x: right, y: bottom },
    { handle: 'sw', x: left, y: bottom },
    { handle: 'n', x: midX, y: top },
    { handle: 's', x: midX, y: bottom },
    { handle: 'w', x: left, y: midY },
    { handle: 'e', x: right, y: midY },
  ];

  for (const h of handles) {
    if (Math.abs(x - h.x) <= handleSize && Math.abs(y - h.y) <= handleSize) {
      return h.handle;
    }
  }

  // Check rotation handle
  const rotY = top - 18 / zoom;
  if (Math.hypot(x - midX, y - rotY) <= handleSize) {
    return 'rotation';
  }

  return null;
}

function pointToSegmentDist(
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
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
