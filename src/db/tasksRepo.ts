import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './database';
import type { Task, TaskStatus } from '../types/task';
import type { Note } from '../types/note';

export const tasksRepo = {
  /**
   * Fast task creation (e.g. from quick-add bar or modal).
   */
  async createTask(draft: Partial<Task>): Promise<Task> {
    const now = new Date();
    const newTask: Task = {
      title: draft.title?.trim() || 'Untitled Task',
      description: draft.description?.trim() || '',
      status: draft.status || 'todo',
      priority: draft.priority || 'none',
      dueAt: draft.dueAt ? new Date(draft.dueAt) : null,
      completedAt: draft.status === 'done' ? draft.completedAt || now : null,
      createdAt: now,
      updatedAt: now,
      importance: Boolean(draft.importance),
      urgency: Boolean(draft.urgency),
      tags: Array.isArray(draft.tags) ? draft.tags : [],
      trashedAt: null,
      sourceNoteId: typeof draft.sourceNoteId === 'number' ? draft.sourceNoteId : null,
      personId: typeof draft.personId === 'number' ? draft.personId : null,
      parentTaskId: typeof draft.parentTaskId === 'number' ? draft.parentTaskId : null,
      routineRunId: typeof draft.routineRunId === 'number' ? draft.routineRunId : null,
      sortOrder: typeof draft.sortOrder === 'number' ? draft.sortOrder : 0,
      estimatedMin: typeof draft.estimatedMin === 'number' ? draft.estimatedMin : undefined,
    };

    const id = await db.tasks.add(newTask);
    return { ...newTask, id: id as number };
  },

  /**
   * Converts a Note to a Task.
   * Derives title from note title or first non-empty line of content.
   * Note content becomes task description.
   * Copies tags and preserves informational link via sourceNoteId.
   */
  async createTaskFromNote(note: Note): Promise<Task> {
    let title = note.title?.trim();
    let description = note.content || '';

    if (!title) {
      if (description) {
        const firstLine = description.trim().split('\n')[0].trim();
        title = firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine;
      } else {
        title = 'Untitled Task';
      }
    }

    return await this.createTask({
      title,
      description,
      tags: note.tags ? [...note.tags] : [],
      sourceNoteId: note.id,
      personId: note.personId,
    });
  },

  /**
   * Fetch a single task by ID.
   */
  async getTaskById(id: number): Promise<Task | undefined> {
    return await db.tasks.get(id);
  },

  /**
   * Update fields on an existing task. Automatically bumps updatedAt.
   */
  async updateTask(id: number, changes: Partial<Omit<Task, 'id' | 'createdAt'>>): Promise<void> {
    const cleanChanges: Partial<Task> = {
      ...changes,
      updatedAt: new Date(),
    };
    if (changes.dueAt !== undefined) {
      cleanChanges.dueAt = changes.dueAt ? new Date(changes.dueAt) : null;
    }
    if (changes.completedAt !== undefined) {
      cleanChanges.completedAt = changes.completedAt ? new Date(changes.completedAt) : null;
    }
    await db.tasks.update(id, cleanChanges);
  },

  /**
   * Toggle task status between 'todo' and 'done'.
   * Sets completedAt when done, clears it when marked todo.
   */
  async toggleTaskStatus(id: number, currentStatus: TaskStatus): Promise<TaskStatus> {
    const nextStatus: TaskStatus = currentStatus === 'todo' ? 'done' : 'todo';
    const now = new Date();
    await db.tasks.update(id, {
      status: nextStatus,
      completedAt: nextStatus === 'done' ? now : null,
      updatedAt: now,
    });
    return nextStatus;
  },

  /**
   * Soft-delete or permanently delete task.
   */
  async deleteTask(id: number): Promise<void> {
    await db.tasks.delete(id);
  },

  async deletePermanently(id: number): Promise<void> {
    await db.tasks.delete(id);
  },

  /**
   * Returns active top-level todo tasks (status === 'todo', trashedAt === null, parentTaskId == null).
   * Sorted with due dates first (soonest first), then by recency.
   */
  async getTodoTasks(): Promise<Task[]> {
    const tasks = await db.tasks
      .filter((task) => task.status === 'todo' && (!task.trashedAt || task.trashedAt === null) && (!task.parentTaskId))
      .toArray();

    return tasks.sort((a, b) => {
      // 1. Tasks with due dates come before tasks without due dates
      if (a.dueAt && !b.dueAt) return -1;
      if (!a.dueAt && b.dueAt) return 1;
      if (a.dueAt && b.dueAt) {
        const timeA = new Date(a.dueAt).getTime();
        const timeB = new Date(b.dueAt).getTime();
        if (timeA !== timeB) return timeA - timeB;
      }
      // 2. Secondary sort: newest createdAt first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  },

  /**
   * Returns completed top-level tasks (status === 'done', trashedAt === null, parentTaskId == null).
   * Sorted newest completedAt first.
   */
  async getDoneTasks(): Promise<Task[]> {
    const tasks = await db.tasks
      .filter((task) => task.status === 'done' && (!task.trashedAt || task.trashedAt === null) && (!task.parentTaskId))
      .toArray();

    return tasks.sort((a, b) => {
      const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  },

  /**
   * Returns total count of active top-level todo tasks for navigation badges.
   */
  async getTodoCount(): Promise<number> {
    return await db.tasks
      .filter((task) => task.status === 'todo' && (!task.trashedAt || task.trashedAt === null) && (!task.parentTaskId))
      .count();
  },

  /**
   * Subtasks for a specific parent task.
   */
  async getSubtasks(parentTaskId: number): Promise<Task[]> {
    const subtasks = await db.tasks
      .filter((t) => t.parentTaskId === parentTaskId && (!t.trashedAt || t.trashedAt === null))
      .toArray();
    return subtasks.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  /**
   * Quick subtask creation.
   */
  async createSubtask(parentTaskId: number, title: string, options?: Partial<Task>): Promise<Task> {
    const count = await db.tasks.where('parentTaskId').equals(parentTaskId).count();
    return await this.createTask({
      title,
      parentTaskId,
      sortOrder: count,
      ...options,
    });
  },

  /**
   * Returns progress counts { total, completed } for subtasks of a parent.
   */
  async getSubtaskProgress(parentTaskId: number): Promise<{ total: number; completed: number }> {
    const subtasks = await db.tasks
      .filter((t) => t.parentTaskId === parentTaskId && (!t.trashedAt || t.trashedAt === null))
      .toArray();
    const total = subtasks.length;
    const completed = subtasks.filter((t) => t.status === 'done').length;
    return { total, completed };
  },

  /**
   * Checks if a parent task has any incomplete subtasks.
   */
  async hasIncompleteSubtasks(parentTaskId: number): Promise<boolean> {
    const subtasks = await db.tasks
      .filter((t) => t.parentTaskId === parentTaskId && (!t.trashedAt || t.trashedAt === null))
      .toArray();
    return subtasks.some((t) => t.status === 'todo');
  },

  /**
   * Reorders subtasks.
   */
  async reorderSubtasks(orderedIds: number[]): Promise<void> {
    await db.transaction('rw', db.tasks, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.tasks.update(orderedIds[i], { sortOrder: i });
      }
    });
  },

  /**
   * Retrieves all tasks for JSON backup export.
   */
  async getAllTasksForExport(): Promise<Task[]> {
    return await db.tasks.toArray();
  },

  /**
   * Imports tasks supporting 'merge' or 'replace' strategy.
   */
  async importTasks(
    rawTasks: Partial<Task>[],
    strategy: 'merge' | 'replace'
  ): Promise<number> {
    const sanitized: Task[] = rawTasks.map((raw) => {
      const createdAt = raw.createdAt ? new Date(raw.createdAt) : new Date();
      const updatedAt = raw.updatedAt ? new Date(raw.updatedAt) : new Date();
      const dueAt = raw.dueAt ? new Date(raw.dueAt) : null;
      const completedAt = raw.completedAt ? new Date(raw.completedAt) : null;
      const trashedAt = raw.trashedAt ? new Date(raw.trashedAt) : null;

      return {
        id: typeof raw.id === 'number' ? raw.id : undefined,
        title: typeof raw.title === 'string' ? raw.title : 'Untitled Task',
        description: typeof raw.description === 'string' ? raw.description : '',
        status: raw.status === 'done' ? 'done' : 'todo',
        priority: raw.priority || 'none',
        dueAt: isNaN(dueAt?.getTime() ?? 0) ? null : dueAt,
        completedAt: isNaN(completedAt?.getTime() ?? 0) ? null : completedAt,
        createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt,
        updatedAt: isNaN(updatedAt.getTime()) ? new Date() : updatedAt,
        importance: Boolean(raw.importance),
        urgency: Boolean(raw.urgency),
        tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
        trashedAt: isNaN(trashedAt?.getTime() ?? 0) ? null : trashedAt,
        sourceNoteId: typeof raw.sourceNoteId === 'number' ? raw.sourceNoteId : null,
        personId: typeof raw.personId === 'number' ? raw.personId : null,
        parentTaskId: typeof raw.parentTaskId === 'number' ? raw.parentTaskId : null,
        routineRunId: typeof raw.routineRunId === 'number' ? raw.routineRunId : null,
        sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : 0,
        estimatedMin: typeof raw.estimatedMin === 'number' ? raw.estimatedMin : undefined,
      };
    });

    if (strategy === 'replace') {
      await db.tasks.clear();
      if (sanitized.length > 0) {
        await db.tasks.bulkAdd(sanitized);
      }
      return sanitized.length;
    }

    // Merge strategy
    let imported = 0;
    for (const task of sanitized) {
      if (typeof task.id === 'number') {
        const existing = await db.tasks.get(task.id);
        if (existing) {
          if (new Date(task.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
            await db.tasks.put(task);
            imported++;
          }
        } else {
          await db.tasks.put(task);
          imported++;
        }
      } else {
        await db.tasks.add(task);
        imported++;
      }
    }
    return imported;
  },

  /**
   * Retrieves tasks due within a specific date range [start, end].
   */
  async getTasksDueForRange(start: Date, end: Date): Promise<Task[]> {
    const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0).getTime();
    const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999).getTime();

    return await db.tasks
      .filter((task) => {
        if (task.trashedAt || !task.dueAt) return false;
        const dueTime = new Date(task.dueAt).getTime();
        return dueTime >= startTime && dueTime <= endTime;
      })
      .toArray();
  },

  /**
   * Danger zone wipe: clears all tasks.
   */
  async deleteAllTasks(): Promise<void> {
    await db.tasks.clear();
  },
};

/**
 * Reactive hooks using useLiveQuery
 */
export function useTodoTasks(): Task[] | undefined {
  return useLiveQuery(() => tasksRepo.getTodoTasks());
}

export function useDoneTasks(): Task[] | undefined {
  return useLiveQuery(() => tasksRepo.getDoneTasks());
}

export function useTodoCount(): number {
  const count = useLiveQuery(() => tasksRepo.getTodoCount());
  return count ?? 0;
}

export function useTask(id: number | null | undefined): Task | null | undefined {
  return useLiveQuery(async () => {
    if (typeof id !== 'number' || isNaN(id)) return null;
    const task = await tasksRepo.getTaskById(id);
    return task ?? null;
  }, [id]);
}

export function useSubtasks(parentTaskId: number | null | undefined): Task[] {
  const subtasks = useLiveQuery(async () => {
    if (typeof parentTaskId !== 'number' || isNaN(parentTaskId)) return [];
    return await tasksRepo.getSubtasks(parentTaskId);
  }, [parentTaskId]);
  return subtasks ?? [];
}

export function useSubtaskProgress(parentTaskId: number | null | undefined): { total: number; completed: number } {
  const progress = useLiveQuery(async () => {
    if (typeof parentTaskId !== 'number' || isNaN(parentTaskId)) return { total: 0, completed: 0 };
    return await tasksRepo.getSubtaskProgress(parentTaskId);
  }, [parentTaskId]);
  return progress ?? { total: 0, completed: 0 };
}

export function useTasksDueForRange(start: Date, end: Date): Task[] | undefined {
  const s = start.getTime();
  const e = end.getTime();
  return useLiveQuery(
    () => tasksRepo.getTasksDueForRange(new Date(s), new Date(e)),
    [s, e]
  );
}

