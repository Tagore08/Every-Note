import type { Stroke } from '../../../types/canvas';

export class CanvasHistory {
  private undoStack: Stroke[][] = [];
  private redoStack: Stroke[][] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity = 50, initialStrokes: Stroke[] = []) {
    this.maxCapacity = maxCapacity;
    this.undoStack = [initialStrokes];
  }

  getCurrent(): Stroke[] {
    return this.undoStack[this.undoStack.length - 1] || [];
  }

  push(strokes: Stroke[]): void {
    this.redoStack = [];
    this.undoStack.push(strokes);
    if (this.undoStack.length > this.maxCapacity + 1) {
      this.undoStack.shift();
    }
  }

  canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): Stroke[] | null {
    if (!this.canUndo()) return null;
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    return this.getCurrent();
  }

  redo(): Stroke[] | null {
    if (!this.canRedo()) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    return next;
  }

  reset(strokes: Stroke[] = []): void {
    this.undoStack = [strokes];
    this.redoStack = [];
  }
}
