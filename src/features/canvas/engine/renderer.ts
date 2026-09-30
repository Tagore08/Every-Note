import type { CanvasDoc, CanvasElement, Stroke } from '../../../types/canvas';
import type { ViewportTransform } from './transform';
import { renderStrokeToContext } from './strokeGeometry';
import { renderElementToContext } from './excalidrawRenderer';

/**
 * Renders the static canvas layer (committed strokes and Excalidraw elements).
 * Only invoked when document strokes/elements change or when the viewport transform changes.
 */
export function renderStaticLayer(
  canvas: HTMLCanvasElement,
  doc: CanvasDoc,
  transform: ViewportTransform,
  dpr = window.devicePixelRatio || 1,
  selectedElementId?: string | null,
  gridMode: 'none' | 'dots' | 'grid' = 'dots'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  // Match backing store pixel size to device pixel ratio
  const pixelWidth = Math.floor(width * dpr);
  const pixelHeight = Math.floor(height * dpr);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  // Apply pan and zoom
  ctx.save();
  ctx.translate(transform.panX, transform.panY);
  ctx.scale(transform.zoom, transform.zoom);

  // Document page background
  ctx.fillStyle = doc.bg || '#ffffff';
  ctx.fillRect(0, 0, doc.width, doc.height);

  // Grid background
  if (gridMode === 'dots') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    const gap = 28;
    for (let x = gap; x < doc.width; x += gap) {
      for (let y = gap; y < doc.height; y += gap) {
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
  } else if (gridMode === 'grid') {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1 / transform.zoom;
    const gap = 28;
    ctx.beginPath();
    for (let x = gap; x < doc.width; x += gap) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, doc.height);
    }
    for (let y = gap; y < doc.height; y += gap) {
      ctx.moveTo(0, y);
      ctx.lineTo(doc.width, y);
    }
    ctx.stroke();
  }

  // Page border / subtle shadow outline
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 1 / transform.zoom;
  ctx.strokeRect(0, 0, doc.width, doc.height);

  // Clip rendering to document bounds
  ctx.beginPath();
  ctx.rect(0, 0, doc.width, doc.height);
  ctx.clip();

  // Draw committed strokes
  for (const stroke of doc.strokes) {
    renderStrokeToContext(ctx, stroke);
  }

  // Draw committed Excalidraw elements
  if (doc.elements) {
    for (const el of doc.elements) {
      const isSelected = el.id === selectedElementId;
      renderElementToContext(ctx, el, isSelected, transform.zoom);
    }
  }

  ctx.restore();
  ctx.restore();
}

/**
 * Renders the active canvas layer (the stroke or element currently being drawn or modified).
 * Cleared and redrawn on pointermove inside requestAnimationFrame.
 */
export function renderActiveLayer(
  canvas: HTMLCanvasElement,
  activeStroke: Stroke | null,
  transform: ViewportTransform,
  dpr = window.devicePixelRatio || 1,
  activeElement: CanvasElement | null = null,
  selectionBox: { x: number; y: number; width: number; height: number } | null = null
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  const pixelWidth = Math.floor(width * dpr);
  const pixelHeight = Math.floor(height * dpr);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(transform.panX, transform.panY);
  ctx.scale(transform.zoom, transform.zoom);

  // Clip to document page bounds
  ctx.beginPath();
  ctx.rect(0, 0, 3000, 2000);
  ctx.clip();

  // Render active freehand stroke
  if (activeStroke && activeStroke.points.length > 0) {
    renderStrokeToContext(ctx, activeStroke);
  }

  // Render active Excalidraw element being created or dragged
  if (activeElement) {
    renderElementToContext(ctx, activeElement, true, transform.zoom);
  }

  // Render marquee selection box
  if (selectionBox) {
    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5 / transform.zoom;
    ctx.setLineDash([4 / transform.zoom, 4 / transform.zoom]);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
    ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
    ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
    ctx.restore();
  }

  ctx.restore();
  ctx.restore();
}

/**
 * High-resolution offscreen render of the full document (2x default for export).
 */
export function renderDocToOffscreen(doc: CanvasDoc, scale = 2.0): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(doc.width * scale);
  canvas.height = Math.round(doc.height * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background
  ctx.fillStyle = doc.bg || '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Scale to doc space
  ctx.save();
  ctx.scale(scale, scale);

  for (const stroke of doc.strokes) {
    renderStrokeToContext(ctx, stroke);
  }

  if (doc.elements) {
    for (const el of doc.elements) {
      renderElementToContext(ctx, el, false, scale);
    }
  }

  ctx.restore();
  return canvas;
}

/**
 * Export document to PNG Blob at specified scale (default 2x).
 */
export async function exportDocToBlob(
  doc: CanvasDoc,
  scale = 2.0,
  type = 'image/png'
): Promise<Blob> {
  const offscreen = renderDocToOffscreen(doc, scale);
  return new Promise<Blob>((resolve, reject) => {
    offscreen.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate image blob from offscreen canvas'));
    }, type);
  });
}

/**
 * Generates a thumbnail PNG Blob (max 512px) for list view.
 */
export async function generateThumbnailBlob(
  doc: CanvasDoc,
  maxDimension = 512
): Promise<Blob> {
  const scale = maxDimension / Math.max(doc.width, doc.height);
  return await exportDocToBlob(doc, scale, 'image/png');
}

