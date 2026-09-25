export type InkTool = 'pen' | 'brush' | 'highlighter' | 'eraser';

export interface Stroke {
  id: string;
  tool: InkTool;
  color: string;
  size: number; // px at zoom 1
  points: [number, number, number][]; // [x, y, pressure(0..1)] in doc space (3000x2000)
}

export interface CanvasDoc {
  version: 1;
  width: number; // 3000
  height: number; // 2000
  bg: string;
  strokes: Stroke[];
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
