import { describe, it, expect } from 'vitest';
import {
  PLANT_LIBRARY,
  PLANT_CATEGORIES,
  getPlantById,
  getPlantsByCategory,
  DEFAULT_STARTER_PLANT_IDS,
} from './plants/plantLibrary';
import { getTimeOfDay } from './plants/DynamicSkyBalcony';

describe('Gamified Plant Library System', () => {
  it('contains the 3 hydration and maintenance categories', () => {
    expect(PLANT_CATEGORIES).toHaveLength(3);
    const catIds = PLANT_CATEGORIES.map((c) => c.id);
    expect(catIds).toContain('low_water');
    expect(catIds).toContain('moderate');
    expect(catIds).toContain('high_water');
  });

  it('contains between 10 and 15 distinct categorized plant varieties', () => {
    expect(PLANT_LIBRARY.length).toBeGreaterThanOrEqual(10);
    expect(PLANT_LIBRARY.length).toBeLessThanOrEqual(15);
    expect(PLANT_LIBRARY.length).toBe(13);
  });

  it('correctly categorizes plants across the 3 maintenance/hydration tiers', () => {
    const lowWater = getPlantsByCategory('low_water');
    const moderate = getPlantsByCategory('moderate');
    const highWater = getPlantsByCategory('high_water');

    expect(lowWater.length).toBeGreaterThanOrEqual(3);
    expect(moderate.length).toBeGreaterThanOrEqual(3);
    expect(highWater.length).toBeGreaterThanOrEqual(3);

    // Verify low water plants
    expect(lowWater.map((p) => p.id)).toContain('cactus');
    expect(lowWater.map((p) => p.id)).toContain('snake_plant');
    expect(lowWater.map((p) => p.id)).toContain('aloe_vera');
    expect(lowWater.map((p) => p.id)).toContain('jade_plant');

    // Verify moderate plants
    expect(moderate.map((p) => p.id)).toContain('bonsai');
    expect(moderate.map((p) => p.id)).toContain('sunflower');
    expect(moderate.map((p) => p.id)).toContain('monstera');
    expect(moderate.map((p) => p.id)).toContain('pothos');
    expect(moderate.map((p) => p.id)).toContain('lavender');

    // Verify high water plants
    expect(highWater.map((p) => p.id)).toContain('peace_lily');
    expect(highWater.map((p) => p.id)).toContain('orchid');
    expect(highWater.map((p) => p.id)).toContain('fern');
    expect(highWater.map((p) => p.id)).toContain('venus_flytrap');
  });

  it('has 3 starter plants covering all three categories at session start', () => {
    expect(DEFAULT_STARTER_PLANT_IDS).toHaveLength(3);
    const starterCategories = DEFAULT_STARTER_PLANT_IDS.map((id) => getPlantById(id).category);
    expect(starterCategories).toContain('low_water');
    expect(starterCategories).toContain('moderate');
    expect(starterCategories).toContain('high_water');
  });

  it('provides all metadata for each plant variety', () => {
    for (const plant of PLANT_LIBRARY) {
      expect(plant.id).toBeTruthy();
      expect(plant.name).toBeTruthy();
      expect(plant.scientificName).toBeTruthy();
      expect(plant.icon).toBeTruthy();
      expect(plant.tagline).toBeTruthy();
      expect(plant.description).toBeTruthy();
      expect(plant.waterNeeds).toBeTruthy();
      expect(plant.sunlight).toBeTruthy();
      expect(plant.potStyle).toBeTruthy();
      expect(plant.primaryColor).toBeTruthy();
      expect(plant.bloomedColor).toBeTruthy();
    }
  });

  it('retrieves fallback plant safely for unknown IDs', () => {
    const fallback = getPlantById('unknown_mystery_plant');
    expect(fallback).toBeDefined();
    expect(fallback.id).toBe(PLANT_LIBRARY[0].id);
  });
});

describe('Dynamic Sky Time of Day Engine', () => {
  it('correctly maps hours to dawn, day, sunset, and night', () => {
    // 06:30 -> dawn
    const dawnDate = new Date(2026, 8, 25, 6, 30);
    expect(getTimeOfDay(dawnDate)).toBe('dawn');

    // 12:00 -> day
    const dayDate = new Date(2026, 8, 25, 12, 0);
    expect(getTimeOfDay(dayDate)).toBe('day');

    // 18:15 -> sunset
    const sunsetDate = new Date(2026, 8, 25, 18, 15);
    expect(getTimeOfDay(sunsetDate)).toBe('sunset');

    // 22:00 -> night
    const nightDate = new Date(2026, 8, 25, 22, 0);
    expect(getTimeOfDay(nightDate)).toBe('night');

    // 02:00 -> night
    const lateNightDate = new Date(2026, 8, 25, 2, 0);
    expect(getTimeOfDay(lateNightDate)).toBe('night');
  });
});

describe('Vault Folder Priority Sorting', () => {
  it('sorts Vault to the very top, followed by other pinned folders, then alphabetical', () => {
    const sampleFolders = [
      { id: 1, name: 'Work', pinned: false, createdAt: new Date(), updatedAt: new Date() },
      { id: 2, name: 'Archive Project', pinned: false, createdAt: new Date(), updatedAt: new Date() },
      { id: 3, name: 'Vault', pinned: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 4, name: 'Important Pinned', pinned: true, createdAt: new Date(), updatedAt: new Date() },
      { id: 5, name: 'Personal', pinned: false, createdAt: new Date(), updatedAt: new Date() },
    ];

    sampleFolders.sort((a, b) => {
      const isVaultA = a.name.toLowerCase() === 'vault';
      const isVaultB = b.name.toLowerCase() === 'vault';
      if (isVaultA && !isVaultB) return -1;
      if (!isVaultA && isVaultB) return 1;

      const pinA = Boolean(a.pinned);
      const pinB = Boolean(b.pinned);
      if (pinA && !pinB) return -1;
      if (!pinA && pinB) return 1;

      return a.name.localeCompare(b.name);
    });

    expect(sampleFolders[0].name).toBe('Vault');
    expect(sampleFolders[1].name).toBe('Important Pinned');
    expect(sampleFolders[2].name).toBe('Archive Project');
    expect(sampleFolders[3].name).toBe('Personal');
    expect(sampleFolders[4].name).toBe('Work');
  });
});

describe('Real-Time Plant Growth Calculation', () => {
  it('calculates smooth linear growth progress from active focus seconds', () => {
    const totalMinutes = 45;
    const totalSeconds = totalMinutes * 60; // 2700s

    // At start
    const remainingStart = 2700;
    const progressStart = Math.min(1, Math.max(0, (totalSeconds - remainingStart) / totalSeconds));
    expect(progressStart).toBe(0);

    // Quarter way (33.75m remaining)
    const remainingQuarter = 2025;
    const progressQuarter = Math.min(1, Math.max(0, (totalSeconds - remainingQuarter) / totalSeconds));
    expect(progressQuarter).toBeCloseTo(0.25, 2);

    // Halfway
    const remainingMid = 1350;
    const progressMid = Math.min(1, Math.max(0, (totalSeconds - remainingMid) / totalSeconds));
    expect(progressMid).toBeCloseTo(0.5, 2);

    // Bloomed / Complete
    const remainingEnd = 0;
    const progressEnd = Math.min(1, Math.max(0, (totalSeconds - remainingEnd) / totalSeconds));
    expect(progressEnd).toBe(1);
  });
});
