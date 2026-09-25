export interface TimerPreset {
  id?: number;
  name: string; // "Classic Pomodoro", "Deep Work", "Quick"
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  cycles: number; // long break after N focus sessions
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  sound: boolean;
  isDefault: boolean;
}

export type FocusSessionKind = 'focus' | 'break';

export interface FocusSession {
  id?: number;
  startedAt: Date;
  minutes: number;
  taskId?: number | null;
  presetId?: number | null;
  kind?: FocusSessionKind;
  createdAt: Date;
}
