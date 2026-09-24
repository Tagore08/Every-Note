import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './quickAdd';

const mockAreas = [
  { id: 1, name: 'Health' },
  { id: 2, name: 'Work' },
  { id: 3, name: 'Personal' },
  { id: 4, name: 'Finance' },
];

describe('parseQuickAdd', () => {
  const refDate = new Date('2026-09-24T12:00:00.000Z'); // Thursday

  it('parses full phrasing with date, time, tag, and area', () => {
    const res = parseQuickAdd('Call dentist tomorrow 5pm #health @Work', mockAreas, refDate);
    expect(res.title).toBe('Call dentist');
    expect(res.tags).toEqual(['health']);
    expect(res.lifeAreaId).toBe(2);
    expect(res.dueAt).toBeDefined();
    expect(res.rawMatchedDateText).toBe('tomorrow 5pm');
    expect(res.previewLabel).toContain('tomorrow 5pm');
    expect(res.previewLabel).toContain('#health');
    expect(res.previewLabel).toContain('@Work');
  });

  it('does NOT false-positive parse "meeting with 3 people"', () => {
    const res = parseQuickAdd('meeting with 3 people', mockAreas, refDate);
    expect(res.title).toBe('meeting with 3 people');
    expect(res.dueAt).toBeUndefined();
    expect(res.tags).toEqual([]);
    expect(res.lifeAreaId).toBeNull();
  });

  it('does NOT false-positive parse "buy 2 apples"', () => {
    const res = parseQuickAdd('buy 2 apples', mockAreas, refDate);
    expect(res.title).toBe('buy 2 apples');
    expect(res.dueAt).toBeUndefined();
  });

  it('does NOT false-positive parse "read chapter 5"', () => {
    const res = parseQuickAdd('read chapter 5', mockAreas, refDate);
    expect(res.title).toBe('read chapter 5');
    expect(res.dueAt).toBeUndefined();
  });

  it('does NOT false-positive parse "walk 5 miles in park"', () => {
    const res = parseQuickAdd('walk 5 miles in park', mockAreas, refDate);
    expect(res.title).toBe('walk 5 miles in park');
    expect(res.dueAt).toBeUndefined();
  });

  it('parses relative day offsets like "in 3 days"', () => {
    const res = parseQuickAdd('Submit taxes in 3 days', mockAreas, refDate);
    expect(res.title).toBe('Submit taxes');
    expect(res.dueAt).toBeDefined();
    expect(res.rawMatchedDateText).toBe('in 3 days');
  });

  it('parses "tonight 8pm" with life area', () => {
    const res = parseQuickAdd('Gym tonight 8pm @Health', mockAreas, refDate);
    expect(res.title).toBe('Gym');
    expect(res.dueAt).toBeDefined();
    expect(res.lifeAreaId).toBe(1);
    expect(res.rawMatchedDateText).toBe('tonight 8pm');
  });

  it('parses weekday like "friday"', () => {
    const res = parseQuickAdd('Finish report friday', mockAreas, refDate);
    expect(res.title).toBe('Finish report');
    expect(res.dueAt).toBeDefined();
    expect(res.rawMatchedDateText?.toLowerCase()).toBe('friday');
  });

  it('parses complex date string "next monday 10:30am"', () => {
    const res = parseQuickAdd('Doctor appointment next monday 10:30am', mockAreas, refDate);
    expect(res.title).toBe('Doctor appointment');
    expect(res.dueAt).toBeDefined();
    expect(res.rawMatchedDateText).toBe('next monday 10:30am');
  });

  it('handles multiple tags at any position', () => {
    const res = parseQuickAdd('#urgent Buy groceries #family today', mockAreas, refDate);
    expect(res.title).toBe('Buy groceries');
    expect(res.tags).toContain('urgent');
    expect(res.tags).toContain('family');
    expect(res.dueAt).toBeDefined();
  });

  it('preserves non-matching @mentions or emails in title', () => {
    const res = parseQuickAdd('Email john@example.com about @unknownProject', mockAreas, refDate);
    expect(res.title).toContain('john@example.com');
    expect(res.title).toContain('@unknownProject');
    expect(res.lifeAreaId).toBeNull();
  });

  it('matches life areas case-insensitively', () => {
    const res = parseQuickAdd('Review investment @finance', mockAreas, refDate);
    expect(res.title).toBe('Review investment');
    expect(res.lifeAreaId).toBe(4);
  });

  it('handles empty input gracefully', () => {
    const res = parseQuickAdd('');
    expect(res.title).toBe('');
    expect(res.dueAt).toBeUndefined();
    expect(res.tags).toEqual([]);
    expect(res.lifeAreaId).toBeNull();
  });
});
