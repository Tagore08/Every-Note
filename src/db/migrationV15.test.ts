import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';

describe('Dexie Schema Version 15: Life Areas Migration Engine', () => {
  const DB_NAME = 'test-migration-v15-db';

  beforeEach(async () => {
    await Dexie.delete(DB_NAME);
  });

  it('runs real Dexie upgrade from v14 to v15, transforming lifeAreaId into tags and deleting old table', async () => {
    // 1. Setup Version 14 database
    const dbV14 = new Dexie(DB_NAME);
    dbV14.version(14).stores({
      notes: '++id, title, *tags, lifeAreaId, createdAt, updatedAt',
      tasks: '++id, title, *tags, lifeAreaId, createdAt, updatedAt',
      lifeAreas: '++id, name, color',
      appMeta: 'key',
    });

    await dbV14.open();

    // Populate version 14 records
    await dbV14.table('lifeAreas').bulkAdd([
      { id: 1, name: 'Health', color: '#10b981' },
      { id: 2, name: 'Work', color: '#3b82f6' },
      { id: 9, name: 'Creative Studio', color: '#a855f7' },
    ]);

    await dbV14.table('notes').bulkAdd([
      { id: 1, title: 'Meeting Notes', tags: ['team'], lifeAreaId: 2 },
      { id: 2, title: 'Art Project', tags: ['canvas'], lifeAreaId: 9 },
      { id: 3, title: 'Unlisted Area', tags: [], lifeAreaId: 99 },
    ]);

    await dbV14.table('tasks').bulkAdd([
      { id: 1, title: 'Morning Gym', tags: ['health', 'routine'], lifeAreaId: 1 },
      { id: 2, title: 'General Task', tags: ['todo'] }, // No lifeAreaId
    ]);

    await dbV14.close();

    // 2. Define Version 15 upgrade matching database.ts specification
    const dbV15 = new Dexie(DB_NAME);
    dbV15.version(14).stores({
      notes: '++id, title, *tags, lifeAreaId, createdAt, updatedAt',
      tasks: '++id, title, *tags, lifeAreaId, createdAt, updatedAt',
      lifeAreas: '++id, name, color',
      appMeta: 'key',
    });

    dbV15.version(15).stores({
      notes: '++id, title, *tags, createdAt, updatedAt',
      tasks: '++id, title, *tags, createdAt, updatedAt',
      lifeAreas: null, // Drops lifeAreas store
      appMeta: 'key',
    }).upgrade(async (tx) => {
      const areaNameMap = new Map<number, string>([
        [1, 'health'],
        [2, 'work'],
        [3, 'personal'],
        [4, 'finance'],
        [5, 'learning'],
        [6, 'home'],
        [7, 'relationships'],
        [8, 'other'],
      ]);

      try {
        const areaTable = tx.table('lifeAreas');
        if (areaTable) {
          const areas = await areaTable.toArray();
          for (const area of areas) {
            if (area?.id && area?.name) {
              const sanitized = area.name.trim().toLowerCase().replace(/\s+/g, '-');
              if (sanitized) areaNameMap.set(area.id, sanitized);
            }
          }
        }
      } catch (err) {
        console.debug('lifeAreas table not directly queryable in upgrade:', err);
      }

      const appendAreaTag = (record: any) => {
        if (record && record.lifeAreaId != null) {
          const tagName = areaNameMap.get(record.lifeAreaId) || `area-${record.lifeAreaId}`;
          const tags: string[] = Array.isArray(record.tags) ? [...record.tags] : [];
          if (!tags.includes(tagName)) {
            tags.push(tagName);
          }
          record.tags = tags;
          delete record.lifeAreaId;
        }
      };

      await tx.table('notes').toCollection().modify((note: any) => {
        appendAreaTag(note);
      });

      await tx.table('tasks').toCollection().modify((task: any) => {
        appendAreaTag(task);
      });

      const meta = tx.table('appMeta');
      await meta.put({
        key: 'schemaVersion',
        value: 15,
        updatedAt: Date.now(),
      });
    });

    // 3. Open v15 database to trigger the upgrade
    await dbV15.open();

    // 4. Assert post-upgrade state in real database tables
    const note1 = await dbV15.table('notes').get(1);
    expect(note1.tags).toEqual(['team', 'work']);
    expect(note1.lifeAreaId).toBeUndefined();
    expect('lifeAreaId' in note1).toBe(false);

    const note2 = await dbV15.table('notes').get(2);
    expect(note2.tags).toEqual(['canvas', 'creative-studio']);
    expect('lifeAreaId' in note2).toBe(false);

    const note3 = await dbV15.table('notes').get(3);
    expect(note3.tags).toEqual(['area-99']);
    expect('lifeAreaId' in note3).toBe(false);

    const task1 = await dbV15.table('tasks').get(1);
    // Did not duplicate 'health'
    expect(task1.tags).toEqual(['health', 'routine']);
    expect('lifeAreaId' in task1).toBe(false);

    const task2 = await dbV15.table('tasks').get(2);
    expect(task2.tags).toEqual(['todo']);

    const metaRecord = await dbV15.table('appMeta').get('schemaVersion');
    expect(metaRecord.value).toBe(15);

    await dbV15.close();
  });
});
