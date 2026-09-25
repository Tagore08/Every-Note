import type { CanvasDoc, Stroke } from '../../../types/canvas';
import type { ViewportTransform } from './transform';
import { renderStrokeToContext } from './strokeGeometry';

/**
 * Renders the static canvas layer (all committed strokes).
 * Only invoked when document strokes change or when the viewport transform changes.
 */
export function renderStaticLayer(
  canvas: HTMLCanvasElement,
  doc: CanvasDoc,
  transform: ViewportTransform,
  dpr = window.devicePixelRatio || 1
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

  ctx.restore();
  ctx.restore();
}

/**
 * Renders the active canvas layer (the stroke currently being drawn).
 * Cleared and redrawn on pointermove inside requestAnimationFrame.
 */
export function renderActiveLayer(
  canvas: HTMLCanvasElement,
  activeStroke: Stroke | null,
  transform: ViewportTransform,
  dpr = window.devicePixelRatio || 1
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

  if (activeStroke && activeStroke.points.length > 0) {
    ctx.save();
    ctx.translate(transform.panX, transform.panY);
    ctx.scale(transform.zoom, transform.zoom);

    // Clip to document page bounds
    ctx.beginPath();
    ctx.rect(0, 0, 3000, 2000);
    ctx.clip();

    renderStrokeToContext(ctx, activeStroke);
    ctx.restore();
  }

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
