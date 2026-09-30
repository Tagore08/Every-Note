import type { Stroke } from '../../../types/canvas';

export class CanvasHistory<T = Stroke[]> {
  private undoStack: T[] = [];
  private redoStack: T[] = [];
  private readonly maxCapacity: number;

  constructor(maxCapacity = 50, initialState?: T) {
    this.maxCapacity = maxCapacity;
    if (initialState !== undefined) {
      this.undoStack = [initialState];
    }
  }

  getCurrent(): T {
    return this.undoStack[this.undoStack.length - 1];
  }

  push(state: T): void {
    this.redoStack = [];
    this.undoStack.push(state);
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

  undo(): T | null {
    if (!this.canUndo()) return null;
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);
    return this.getCurrent();
  }

  redo(): T | null {
    if (!this.canRedo()) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    return next;
  }

  reset(state: T = [] as unknown as T): void {
    this.undoStack = [state];
    this.redoStack = [];
  }
}

