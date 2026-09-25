import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database';
import type { LifeArea } from '../../types/area';

export const DEFAULT_LIFE_AREAS: Omit<LifeArea, 'id' | 'createdAt'>[] = [
  {
    name: 'Health',
    color: 'var(--area-1, oklch(0.62 0.16 25))',
    icon: 'Heart',
    sortOrder: 0,
    archived: false,
  },
  {
    name: 'Work',
    color: 'var(--area-2, oklch(0.58 0.13 250))',
    icon: 'Briefcase',
    sortOrder: 1,
    archived: false,
  },
  {
    name: 'Personal',
    color: 'var(--area-3, oklch(0.66 0.14 145))',
    icon: 'User',
    sortOrder: 2,
    archived: false,
  },
  {
    name: 'Finance',
    color: 'var(--area-4, oklch(0.64 0.13 60))',
    icon: 'DollarSign',
    sortOrder: 3,
    archived: false,
  },
  {
    name: 'Learning',
    color: 'var(--area-5, oklch(0.60 0.14 310))',
    icon: 'BookOpen',
    sortOrder: 4,
    archived: false,
  },
  {
    name: 'Home',
    color: 'var(--area-6, oklch(0.63 0.10 200))',
    icon: 'Home',
    sortOrder: 5,
    archived: false,
  },
  {
    name: 'Relationships',
    color: 'var(--area-7, oklch(0.61 0.17 0))',
    icon: 'Users',
    sortOrder: 6,
    archived: false,
  },
];

export const areasRepo = {
  /**
   * Seeds the 7 default life areas if lifeAreas table is empty. Idempotent.
   */
  async seedDefaults(): Promise<void> {
    const count = await db.lifeAreas.count();
    if (count === 0) {
      const now = Date.now();
      await db.lifeAreas.bulkAdd(
        DEFAULT_LIFE_AREAS.map((area) => ({
          ...area,
          createdAt: now,
        }))
      );
    }
  },

  /**
   * Retrieves all areas including archived, sorted by sortOrder.
   */
  async getAllAreas(): Promise<LifeArea[]> {
    const areas = await db.lifeAreas.toArray();
    return areas.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /**
   * Retrieves active (non-archived) life areas, sorted by sortOrder.
   */
  async getActiveAreas(): Promise<LifeArea[]> {
    const areas = await db.lifeAreas
      .filter((a) => !a.archived)
      .toArray();
    return areas.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  /**
   * Retrieves a single life area by ID.
   */
  async getAreaById(id: number): Promise<LifeArea | undefined> {
    return await db.lifeAreas.get(id);
  },

  /**
   * Creates a new custom life area.
   */
  async createArea(draft: Omit<LifeArea, 'id' | 'createdAt'>): Promise<LifeArea> {
    const now = Date.now();
    const count = await db.lifeAreas.count();
    const newArea: LifeArea = {
      name: draft.name.trim(),
      color: draft.color || 'var(--area-8, oklch(0.60 0.03 262))',
      icon: draft.icon || 'Folder',
      sortOrder: draft.sortOrder ?? count,
      archived: Boolean(draft.archived),
      createdAt: now,
    };
    const id = await db.lifeAreas.add(newArea);
    return { ...newArea, id: id as number };
  },

  /**
   * Updates an existing area.
   */
  async updateArea(id: number, changes: Partial<Omit<LifeArea, 'id' | 'createdAt'>>): Promise<void> {
    await db.lifeAreas.update(id, changes);
  },

  /**
   * Archives a life area.
   */
  async archiveArea(id: number): Promise<void> {
    await db.lifeAreas.update(id, { archived: true });
  },

  /**
   * Unarchives a life area.
   */
  async unarchiveArea(id: number): Promise<void> {
    await db.lifeAreas.update(id, { archived: false });
  },

  /**
   * Deletes a life area permanently.
   */
  async deleteArea(id: number): Promise<void> {
    await db.lifeAreas.delete(id);
  },

  /**
   * Reorders life areas.
   */
  async reorderAreas(orderedIds: number[]): Promise<void> {
    await db.transaction('rw', db.lifeAreas, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.lifeAreas.update(orderedIds[i], { sortOrder: i });
      }
    });
  },

  /**
   * Export all life areas.
   */
  async getAllAreasForExport(): Promise<LifeArea[]> {
    return await db.lifeAreas.toArray();
  },

  /**
   * Import life areas supporting merge or replace.
   */
  async importAreas(
    rawAreas: Partial<LifeArea>[],
    strategy: 'merge' | 'replace'
  ): Promise<number> {
    const sanitized: LifeArea[] = rawAreas.map((raw, idx) => ({
      id: typeof raw.id === 'number' ? raw.id : undefined,
      name: typeof raw.name === 'string' ? raw.name.trim() : 'Unnamed Area',
      color: typeof raw.color === 'string' ? raw.color : 'var(--area-1)',
      icon: typeof raw.icon === 'string' ? raw.icon : 'Folder',
      sortOrder: typeof raw.sortOrder === 'number' ? raw.sortOrder : idx,
      archived: Boolean(raw.archived),
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    }));

    if (strategy === 'replace') {
      await db.lifeAreas.clear();
      if (sanitized.length > 0) {
        await db.lifeAreas.bulkAdd(sanitized);
      }
      return sanitized.length;
    }

    let imported = 0;
    for (const area of sanitized) {
      if (typeof area.id === 'number') {
        const existing = await db.lifeAreas.get(area.id);
        if (existing) {
          await db.lifeAreas.put(area);
        } else {
          await db.lifeAreas.put(area);
        }
      } else {
        await db.lifeAreas.add(area);
      }
      imported++;
    }
    return imported;
  },
};

/**
 * Reactive hooks
 */
export function useActiveAreas(): LifeArea[] {
  const areas = useLiveQuery(() => areasRepo.getActiveAreas());
  return areas ?? [];
}

export function useAllAreas(): LifeArea[] {
  const areas = useLiveQuery(() => areasRepo.getAllAreas());
  return areas ?? [];
}

export function useArea(id: number | null | undefined): LifeArea | null {
  const area = useLiveQuery(async () => {
    if (typeof id !== 'number' || isNaN(id)) return null;
    return (await areasRepo.getAreaById(id)) ?? null;
  }, [id]);
  return area ?? null;
}
