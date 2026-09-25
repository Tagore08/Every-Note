export type TaskStatus = 'todo' | 'done';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';

export interface Task {
  id?: number;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  dueAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  importance: boolean; // For future Eisenhower matrix
  urgency: boolean;    // For future Eisenhower matrix
  tags: string[];
  trashedAt?: Date | null;
  sourceNoteId?: number | null; // Informational backlink to source note
  personId?: number | null;
  lifeAreaId?: number | null;
  parentTaskId?: number | null;
  routineRunId?: number | null;
  sortOrder?: number;
  estimatedMin?: number;
}
