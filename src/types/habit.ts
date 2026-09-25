export type HabitFrequency = 'daily' | 'weekdays' | 'weekly' | 'custom';
export type HabitTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface Habit {
  id?: number;
  name: string;
  iconOrEmoji?: string; // Emoji or short icon, e.g. "💧", "🏃", "📚"
  frequency: HabitFrequency;
  targetDaysPerWeek?: number; // For 'weekly' frequency (e.g. 1 to 7, default 3)
  customDays?: number[]; // For 'custom' frequency: 0=Sun, 1=Mon, ..., 6=Sat
  timeOfDay?: HabitTimeOfDay; // 'morning' | 'afternoon' | 'evening' | 'anytime'
  reminderAt?: string | null; // "HH:MM" 24-hr format (e.g. "08:00") or null
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface HabitLog {
  id?: number;
  habitId: number;
  date: string; // 'YYYY-MM-DD' formatted in local time
  done: boolean;
  value?: number; // Optional numeric value for future numeric habits
  createdAt: Date;
}

export interface HabitStreakResult {
  currentStreak: number;
  bestStreak: number;
}

export interface HabitWithStats extends Habit {
  isDoneToday: boolean;
  currentStreak: number;
  bestStreak: number;
  // Map or array of last 30 days: date string -> done (boolean)
  last30Days: Array<{ date: string; done: boolean; isToday: boolean; isFuture: boolean }>;
  logsMap?: Record<string, boolean>;
}

