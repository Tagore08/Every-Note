export type StickyColor = 'yellow' | 'peach' | 'mint' | 'blue' | 'lavender' | 'pink' | 'slate';
export type StickyFontFamily = 'sans' | 'serif' | 'mono' | 'handwriting';
export type StickyFontSize = 'sm' | 'md' | 'lg';

export interface StickyNote {
  id?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: StickyColor;
  textColor?: string;
  fontFamily?: StickyFontFamily;
  fontSize?: StickyFontSize;
  content: string;
  showTimestamp?: boolean;
  drawingSvg?: string; // Embedded vector drawing SVG
  drawingStrokes?: string; // Serialized strokes for re-editing
  zIndex?: number;
  createdAt: Date;
  updatedAt: Date;
}
