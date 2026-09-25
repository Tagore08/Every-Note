export interface ViewportTransform {
  panX: number;
  panY: number;
  zoom: number; // 0.25 to 4.0
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4.0;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToDoc(
  screenX: number,
  screenY: number,
  transform: ViewportTransform
): [number, number] {
  const { panX, panY, zoom } = transform;
  const docX = (screenX - panX) / zoom;
  const docY = (screenY - panY) / zoom;
  return [docX, docY];
}

export function docToScreen(
  docX: number,
  docY: number,
  transform: ViewportTransform
): [number, number] {
  const { panX, panY, zoom } = transform;
  const screenX = docX * zoom + panX;
  const screenY = docY * zoom + panY;
  return [screenX, screenY];
}

export function zoomAt(
  transform: ViewportTransform,
  screenFocalX: number,
  screenFocalY: number,
  rawNewZoom: number
): ViewportTransform {
  const newZoom = clampZoom(rawNewZoom);
  if (Math.abs(newZoom - transform.zoom) < 0.0001) {
    return transform;
  }

  // Document coordinate under the focal point before zoom
  const [docX, docY] = screenToDoc(screenFocalX, screenFocalY, transform);

  // New pan coordinates so the same document point stays under the focal point
  const panX = screenFocalX - docX * newZoom;
  const panY = screenFocalY - docY * newZoom;

  return { panX, panY, zoom: newZoom };
}

export function panBy(
  transform: ViewportTransform,
  deltaScreenX: number,
  deltaScreenY: number
): ViewportTransform {
  return {
    ...transform,
    panX: transform.panX + deltaScreenX,
    panY: transform.panY + deltaScreenY,
  };
}

export function fitToScreen(
  docWidth: number,
  docHeight: number,
  screenWidth: number,
  screenHeight: number,
  padding = 32
): ViewportTransform {
  const availableW = Math.max(10, screenWidth - padding * 2);
  const availableH = Math.max(10, screenHeight - padding * 2);
  const scale = clampZoom(Math.min(availableW / docWidth, availableH / docHeight));
  const panX = (screenWidth - docWidth * scale) / 2;
  const panY = (screenHeight - docHeight * scale) / 2;
  return { panX, panY, zoom: scale };
}
