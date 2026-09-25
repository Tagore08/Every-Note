import { describe, it, expect } from 'vitest';
import { computeDelta, type AreaTaskCount } from '../../db/repos/insightsRepo';

describe('Insights Selectors & Deltas (Phase 6)', () => {
  it('computes positive delta with up direction', () => {
    const res = computeDelta(15, 10);
    expect(res.current).toBe(15);
    expect(res.previous).toBe(10);
    expect(res.change).toBe(5);
    expect(res.direction).toBe('up');
  });

  it('computes negative delta with down direction', () => {
    const res = computeDelta(8, 12);
    expect(res.current).toBe(8);
    expect(res.previous).toBe(12);
    expect(res.change).toBe(-4);
    expect(res.direction).toBe('down');
  });

  it('computes equal delta with flat direction', () => {
    const res = computeDelta(20, 20);
    expect(res.change).toBe(0);
    expect(res.direction).toBe('flat');
  });

  it('sorts area task counts descending by count', () => {
    const areas: AreaTaskCount[] = [
      { areaId: 1, areaName: 'Health', color: '#coral', count: 3 },
      { areaId: 2, areaName: 'Work', color: '#indigo', count: 12 },
      { areaId: 3, areaName: 'Finance', color: '#amber', count: 7 },
    ];
    areas.sort((a, b) => b.count - a.count);
    expect(areas.map((a) => a.areaName)).toEqual(['Work', 'Finance', 'Health']);
  });
});
