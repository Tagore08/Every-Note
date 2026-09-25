import { describe, it, expect } from 'vitest';
import { habitsRepo } from '../../db/habitsRepo';
import type { HabitLog } from '../../types/habit';

function makeLogs(dates: string[]): HabitLog[] {
  return dates.map((d, idx) => ({
    id: idx + 1,
    habitId: 1,
    date: d,
    done: true,
    createdAt: new Date(),
  }));
}

describe('Habit Streak Engine (Phase 6)', () => {
  describe('Daily Habits', () => {
    it('calculates current streak with today completed', () => {
      const logs = makeLogs(['2026-09-23', '2026-09-24', '2026-09-25']);
      const res = habitsRepo.calculateHabitStreaks('daily', logs, '2026-09-25');
      expect(res.currentStreak).toBe(3);
      expect(res.bestStreak).toBe(3);
    });

    it('gives grace period if yesterday completed but today not yet', () => {
      const logs = makeLogs(['2026-09-23', '2026-09-24']);
      const res = habitsRepo.calculateHabitStreaks('daily', logs, '2026-09-25');
      expect(res.currentStreak).toBe(2);
      expect(res.bestStreak).toBe(2);
    });

    it('resets streak if yesterday was skipped', () => {
      const logs = makeLogs(['2026-09-22', '2026-09-23']); // 24th skipped, today is 25th
      const res = habitsRepo.calculateHabitStreaks('daily', logs, '2026-09-25');
      expect(res.currentStreak).toBe(0);
      expect(res.bestStreak).toBe(2);
    });

    it('handles month boundaries seamlessly', () => {
      const logs = makeLogs(['2026-08-30', '2026-08-31', '2026-09-01']);
      const res = habitsRepo.calculateHabitStreaks('daily', logs, '2026-09-01');
      expect(res.currentStreak).toBe(3);
      expect(res.bestStreak).toBe(3);
    });

    it('tracks higher historical best streak when current streak resets', () => {
      const logs = makeLogs([
        '2026-09-01',
        '2026-09-02',
        '2026-09-03',
        '2026-09-04',
        '2026-09-05', // 5-day streak
        // 06 to 23 skipped
        '2026-09-24',
        '2026-09-25', // 2-day streak
      ]);
      const res = habitsRepo.calculateHabitStreaks('daily', logs, '2026-09-25');
      expect(res.currentStreak).toBe(2);
      expect(res.bestStreak).toBe(5);
    });

    it('handles empty logs gracefully', () => {
      const res = habitsRepo.calculateHabitStreaks('daily', [], '2026-09-25');
      expect(res.currentStreak).toBe(0);
      expect(res.bestStreak).toBe(0);
    });
  });

  describe('Weekday Habits', () => {
    it('preserves streak across weekends without breaking', () => {
      // 2026-09-25 is Friday, 26 is Sat, 27 is Sun, 28 is Monday
      const logs = makeLogs([
        '2026-09-24', // Thursday
        '2026-09-25', // Friday
        '2026-09-28', // Monday
      ]);
      const res = habitsRepo.calculateHabitStreaks('weekdays', logs, '2026-09-28');
      expect(res.currentStreak).toBe(3);
      expect(res.bestStreak).toBe(3);
    });

    it('does not penalize missing weekends when checking on Monday', () => {
      const logs = makeLogs(['2026-09-24', '2026-09-25']); // Thu, Fri
      const res = habitsRepo.calculateHabitStreaks('weekdays', logs, '2026-09-28'); // Mon (not done yet)
      expect(res.currentStreak).toBe(2);
    });

    it('breaks weekday streak when a weekday is skipped', () => {
      const logs = makeLogs([
        '2026-09-23', // Wed
        // Thursday 24 skipped
        '2026-09-25', // Fri
      ]);
      const res = habitsRepo.calculateHabitStreaks('weekdays', logs, '2026-09-25');
      expect(res.currentStreak).toBe(1);
      expect(res.bestStreak).toBe(1);
    });
  });

  describe('Weekly Target Habits', () => {
    it('computes streak when weekly target is met', () => {
      // Target: 2 days/week
      const logs = makeLogs([
        '2026-09-15', // Week 1
        '2026-09-17', // Week 1 (2/2 met)
        '2026-09-22', // Week 2
        '2026-09-24', // Week 2 (2/2 met)
      ]);
      const res = habitsRepo.calculateHabitStreaks('weekly_target', logs, '2026-09-25', 2);
      expect(res.currentStreak).toBe(2);
      expect(res.bestStreak).toBe(2);
    });

    it('gives grace period to in-progress current week if prior week was met', () => {
      // Prior week met (2 logs), current week has 0 logs so far
      const logs = makeLogs(['2026-09-15', '2026-09-17']);
      const res = habitsRepo.calculateHabitStreaks('weekly_target', logs, '2026-09-25', 2);
      expect(res.currentStreak).toBe(1);
    });

    it('resets streak if previous full week did not meet target', () => {
      // Prior week had only 1 log when 3 required
      const logs = makeLogs([
        '2026-09-08',
        '2026-09-09',
        '2026-09-10', // week 1 met (3)
        '2026-09-16', // week 2 missed (1 of 3)
        '2026-09-22',
        '2026-09-23',
        '2026-09-24', // week 3 met (3)
      ]);
      const res = habitsRepo.calculateHabitStreaks('weekly_target', logs, '2026-09-25', 3);
      expect(res.currentStreak).toBe(1);
      expect(res.bestStreak).toBe(1);
    });
  });

  describe('Custom Days Habits', () => {
    // 2026-09-21: Mon (1)
    // 2026-09-22: Tue (2)
    // 2026-09-23: Wed (3)
    // 2026-09-24: Thu (4)
    // 2026-09-25: Fri (5)
    // 2026-09-26: Sat (6)
    // 2026-09-27: Sun (0)
    // 2026-09-28: Mon (1)
    const mwfHabit = {
      id: 1,
      name: 'Gym',
      frequency: 'custom' as const,
      customDays: [1, 3, 5], // Mon, Wed, Fri
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('calculates current streak when all scheduled days are completed', () => {
      const logs = makeLogs(['2026-09-21', '2026-09-23', '2026-09-25']); // Mon, Wed, Fri
      const res = habitsRepo.calculateHabitStreaks(mwfHabit, logs, '2026-09-25');
      expect(res.currentStreak).toBe(3);
      expect(res.bestStreak).toBe(3);
    });

    it('maintains streak on rest days', () => {
      const logs = makeLogs(['2026-09-21', '2026-09-23', '2026-09-25']); // Mon, Wed, Fri
      // Check on Saturday 2026-09-26 (rest day)
      const resSat = habitsRepo.calculateHabitStreaks(mwfHabit, logs, '2026-09-26');
      expect(resSat.currentStreak).toBe(3);

      // Check on Sunday 2026-09-27 (rest day)
      const resSun = habitsRepo.calculateHabitStreaks(mwfHabit, logs, '2026-09-27');
      expect(resSun.currentStreak).toBe(3);
    });

    it('gives grace period on scheduled day before completing it', () => {
      const logs = makeLogs(['2026-09-21', '2026-09-23']); // Mon, Wed completed
      // On Friday 2026-09-25 (not completed yet today)
      const res = habitsRepo.calculateHabitStreaks(mwfHabit, logs, '2026-09-25');
      expect(res.currentStreak).toBe(2);
    });

    it('breaks streak when a scheduled custom day was missed', () => {
      const logs = makeLogs([
        '2026-09-21', // Mon (done)
        // Wed 2026-09-23 missed!
        '2026-09-25', // Fri (done)
      ]);
      const res = habitsRepo.calculateHabitStreaks(mwfHabit, logs, '2026-09-25');
      expect(res.currentStreak).toBe(1);
      expect(res.bestStreak).toBe(1);
    });
  });
});

