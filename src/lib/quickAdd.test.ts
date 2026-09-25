import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from './quickAdd';

describe('parseQuickAdd', () => {
  const refDate = new Date('2026-09-24T12:00:00.000Z'); // Thursday

  it('parses phrasing with date, time, and tags', () => {
    const res = parseQuickAdd('Call dentist tomorrow 5pm #health', refDate);
    expect(res.title).toBe('Call dentist');
    expect(res.tags).toEqual(['health']);
    expect(res.dueAt).toBeDefined();
    expect(res.rawMatchedDateText).toBe('tomorrow 5pm');
    expect(res.previewLabel).toContain('tomorrow 5pm');
    expect(res.previewLabel).toContain('#health');
  });

  it('does NOT false-positive parse "meeting with 3 people"', () => {
    const res = parseQuickAdd('meeting with 3 people', refDate);
    expect(res.title).toBe('meeting with 3 people');
    expect(res.dueAt).toBeUndefined();
    expect(res.tags).toEqual([]);
  });

  it('does NOT false-positive parse "buy 2 apples"', () => {
    const res = parseQuickAdd('buy 2 apples', refDate);
    expect(res.title).toBe('buy 2 apples');
    expect(res.dueAt).toBeUndefined();
  });

  it('does NOT false-positive parse "read chapter 5"', () => {
    const res = parseQuickAdd('read chapter 5', refDate);
    expect(res.title).toBe('read chapter 5');
    expect(res.dueAt).toBeUndefined();
  });

  it('does NOT false-positive parse "walk 5 miles in park"', () => {
    const res = parseQuickAdd('walk 5 miles in park', refDate);
    expect(res.title).toBe('walk 5 miles in park');
    expect(res.dueAt).toBeUndefined();
  });

  it('parses relative day offsets like "in 3 days"', () => {
    const res = parseQuickAdd('Submit taxes in 3 days', refDate);
    expect(res.title).toBe('Submit taxes');
    expect(res.dueAt).toBeDefined();
    expect(res.rawMatchedDateText).toBe('in 3 days');
  });

  it('parses "tonight 8pm"', () => {
    const res = parseQuickAdd('Gym tonight 8pm', refDate);
    expect(res.title).toBe('Gym');
    expect(res.dueAt).toBeDefined();
    expect(res.rawMatchedDateText).toBe('tonight 8pm');
  });

  it('parses weekday like "friday"', () => {
    const res = parseQuickAdd('Finish report friday', refDate);
    expect(res.title).toBe('Finish report');
    expect(res.dueAt).toBeDefined();
    expect(res.rawMatchedDateText?.toLowerCase()).toBe('friday');
  });

  it('parses complex date string "next monday 10:30am"', () => {
    const res = parseQuickAdd('Doctor appointment next monday 10:30am', refDate);
    expect(res.title).toBe('Doctor appointment');
    expect(res.dueAt).toBeDefined();
    expect(res.rawMatchedDateText).toBe('next monday 10:30am');
  });

  it('handles multiple tags at any position', () => {
    const res = parseQuickAdd('#urgent Buy groceries #family today', refDate);
    expect(res.title).toBe('Buy groceries');
    expect(res.tags).toContain('urgent');
    expect(res.tags).toContain('family');
    expect(res.dueAt).toBeDefined();
  });

  it('preserves email or @mentions in title', () => {
    const res = parseQuickAdd('Email john@example.com about @someProject', refDate);
    expect(res.title).toContain('john@example.com');
    expect(res.title).toContain('@someProject');
  });

  it('handles empty input gracefully', () => {
    const res = parseQuickAdd('');
    expect(res.title).toBe('');
    expect(res.dueAt).toBeUndefined();
    expect(res.tags).toEqual([]);
  });

  it('parses "Buy milk tomorrow 5pm #shopping" setting date, time, and tag', () => {
    const res = parseQuickAdd('Buy milk tomorrow 5pm #shopping', refDate);
    expect(res.title).toBe('Buy milk');
    expect(res.tags).toEqual(['shopping']);
    expect(res.dueAt).toBeDefined();
    expect(res.rawMatchedDateText).toBe('tomorrow 5pm');
    expect(res.previewLabel).toContain('tomorrow 5pm');
    expect(res.previewLabel).toContain('#shopping');
  });

  it('parses priority tokens p1, p2, p3, p4 and !1', () => {
    const res1 = parseQuickAdd('Finish slides tomorrow p1 #work', refDate);
    expect(res1.title).toBe('Finish slides');
    expect(res1.priority).toBe('p1');
    expect(res1.tags).toEqual(['work']);
    expect(res1.dueAt).toBeDefined();
    expect(res1.previewLabel).toContain('P1');

    const res2 = parseQuickAdd('Check mail !2', refDate);
    expect(res2.title).toBe('Check mail');
    expect(res2.priority).toBe('p2');

    const res3 = parseQuickAdd('Call bank priority:3', refDate);
    expect(res3.title).toBe('Call bank');
    expect(res3.priority).toBe('p3');
  });
});
