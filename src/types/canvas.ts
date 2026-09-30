export type InkTool = 'pen' | 'brush' | 'highlighter' | 'eraser';

export type ExcalidrawTool =
  | 'select'
  | 'hand'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'pen'
  | 'brush'
  | 'highlighter'
  | 'text'
  | 'card'
  | 'eraser';

export interface Stroke {
  id: string;
  tool: InkTool;
  color: string;
  size: number; // px at zoom 1
  points: [number, number, number][]; // [x, y, pressure(0..1)] in doc space (3000x2000)
}

export type FillStyle = 'none' | 'solid' | 'semi' | 'hachure';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

export interface CanvasElement {
  id: string;
  type: 'rectangle' | 'diamond' | 'ellipse' | 'arrow' | 'line' | 'freedraw' | 'text' | 'card';
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number; // 0 = neat, 1 = sketchy, 2 = cartoon
  roundness: number; // 0 = sharp, 1 = rounded
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  points?: [number, number][]; // for arrows, lines, and freedraw
  noteId?: number;
  noteTitle?: string;
}

export interface CanvasDoc {
  version: 1 | 2;
  width: number; // 3000
  height: number; // 2000
  bg: string;
  strokes: Stroke[];
  elements?: CanvasElement[];
}

export interface CanvasEntity {
  id?: number;
  title: string;
  doc: CanvasDoc;
  thumbBlob?: Blob; // 512px PNG, regenerated on save (debounced)
  linkedNoteId?: number | null; // optional: a canvas belongs to a note
  tags: string[];
  createdAt: number;
  updatedAt: number;
  trashedAt?: number | null;
}
