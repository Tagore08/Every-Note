import { describe, it, expect } from 'vitest';
import { computeJournalStreak, filterOnThisDay } from './journal';

describe('Journal Streak & On This Day Logic', () => {
  describe('computeJournalStreak', () => {
    it('returns 0 for empty entries', () => {
      expect(computeJournalStreak([], '2026-09-24')).toBe(0);
    });

    it('returns 1 when today has an entry', () => {
      expect(computeJournalStreak(['2026-09-24'], '2026-09-24')).toBe(1);
    });

    it('returns 2 for today and yesterday', () => {
      expect(computeJournalStreak(['2026-09-24', '2026-09-23'], '2026-09-24')).toBe(2);
    });

    it('keeps streak intact when today is not written yet but yesterday has an entry', () => {
      expect(computeJournalStreak(['2026-09-23'], '2026-09-24')).toBe(1);
      expect(computeJournalStreak(['2026-09-23', '2026-09-22'], '2026-09-24')).toBe(2);
    });

    it('resets streak to 0 if both today and yesterday are missing', () => {
      // 2026-09-22 was written, but 2026-09-23 and 2026-09-24 are missing
      expect(computeJournalStreak(['2026-09-22'], '2026-09-24')).toBe(0);
    });

    it('handles skipped day in the past by capping streak', () => {
      // 2026-09-24 written, 2026-09-23 skipped, 2026-09-22 written
      expect(computeJournalStreak(['2026-09-24', '2026-09-22'], '2026-09-24')).toBe(1);
    });

    it('handles month boundaries seamlessly', () => {
      expect(
        computeJournalStreak(
          ['2026-10-02', '2026-10-01', '2026-09-30', '2026-09-29'],
          '2026-10-02'
        )
      ).toBe(4);
    });
  });

  describe('filterOnThisDay', () => {
    it('returns past entries matching month and day', () => {
      const entries = [
        { id: 1, journalDate: '2025-09-24', content: 'Last year entry' },
        { id: 2, journalDate: '2024-09-24', content: 'Two years ago entry' },
        { id: 3, journalDate: '2026-09-24', content: 'Today entry' },
        { id: 4, journalDate: '2025-09-25', content: 'Different day entry' },
      ];

      const matches = filterOnThisDay(entries, '2026-09-24');
      expect(matches).toHaveLength(2);
      expect(matches[0].journalDate).toBe('2025-09-24');
      expect(matches[1].journalDate).toBe('2024-09-24');
    });

    it('returns empty array when no historical match exists', () => {
      const entries = [
        { id: 1, journalDate: '2026-09-23', content: 'Yesterday' },
        { id: 2, journalDate: '2025-08-24', content: 'Different month' },
      ];

      expect(filterOnThisDay(entries, '2026-09-24')).toEqual([]);
    });
  });
});
