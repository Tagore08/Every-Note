export interface FocusSession {
  id?: number;
  startedAt: Date;
  minutes: number;
  taskId?: number | null;
  createdAt: Date;
}
