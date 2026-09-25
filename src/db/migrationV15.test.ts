import { describe, it, expect } from 'vitest';

describe('Dexie Schema Version 15: Life Areas Migration', () => {
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

  const migrateRecord = (record: any) => {
    if (record && record.lifeAreaId != null) {
      const tagName = areaNameMap.get(record.lifeAreaId) || `area-${record.lifeAreaId}`;
      const tags: string[] = Array.isArray(record.tags) ? [...record.tags] : [];
      if (!tags.includes(tagName)) {
        tags.push(tagName);
      }
      record.tags = tags;
      delete record.lifeAreaId;
    }
    return record;
  };

  const migrateTemplate = (tpl: any) => {
    if (tpl?.body && tpl.body.lifeAreaId != null) {
      const tagName = areaNameMap.get(tpl.body.lifeAreaId) || `area-${tpl.body.lifeAreaId}`;
      const tags: string[] = Array.isArray(tpl.body.tags) ? [...tpl.body.tags] : [];
      if (!tags.includes(tagName)) {
        tags.push(tagName);
      }
      tpl.body.tags = tags;
      delete tpl.body.lifeAreaId;
    }
    return tpl;
  };

  it('maps lifeAreaId to known tag name and deletes lifeAreaId from record', () => {
    const note = {
      id: 1,
      title: 'Meeting Notes',
      tags: ['team', 'sync'],
      lifeAreaId: 2, // work
    };

    const migrated = migrateRecord(note);

    expect(migrated.tags).toEqual(['team', 'sync', 'work']);
    expect(migrated.lifeAreaId).toBeUndefined();
    expect('lifeAreaId' in migrated).toBe(false);
  });

  it('does not duplicate tag if tag name already exists', () => {
    const task = {
      id: 2,
      title: 'Workout session',
      tags: ['health', 'morning'],
      lifeAreaId: 1, // health
    };

    const migrated = migrateRecord(task);

    expect(migrated.tags).toEqual(['health', 'morning']);
    expect(migrated.lifeAreaId).toBeUndefined();
  });

  it('handles unknown lifeAreaId by creating area-ID tag', () => {
    const event = {
      id: 3,
      title: 'Special Conference',
      tags: [],
      lifeAreaId: 99,
    };

    const migrated = migrateRecord(event);

    expect(migrated.tags).toEqual(['area-99']);
    expect(migrated.lifeAreaId).toBeUndefined();
  });

  it('leaves records without lifeAreaId untouched', () => {
    const canvas = {
      id: 4,
      title: 'Drawing',
      tags: ['art'],
      lifeAreaId: null,
    };

    const migrated = migrateRecord(canvas);

    expect(migrated.tags).toEqual(['art']);
    expect(migrated.lifeAreaId).toBeNull();
  });

  it('correctly migrates template body lifeAreaId to template body tags', () => {
    const template = {
      id: 5,
      name: 'Project Kickoff',
      kind: 'task',
      body: {
        title: 'Kickoff Task',
        lifeAreaId: 2,
        tags: ['planning'],
      },
    };

    const migrated = migrateTemplate(template);

    expect(migrated.body.tags).toEqual(['planning', 'work']);
    expect(migrated.body.lifeAreaId).toBeUndefined();
    expect('lifeAreaId' in migrated.body).toBe(false);
  });
});
