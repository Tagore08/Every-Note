import { useState, useEffect } from 'react';
import type { Habit, HabitFrequency, HabitTimeOfDay } from '../../types/habit';

interface HabitEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit?: Habit | null;
  onSave: (draft: {
    name: string;
    iconOrEmoji: string;
    frequency: HabitFrequency;
    targetDaysPerWeek?: number;
    customDays?: number[];
    timeOfDay?: HabitTimeOfDay;
    reminderAt?: string | null;
  }) => Promise<void>;
  onArchiveToggle?: (id: number, archived: boolean) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

const COMMON_EMOJIS = [
  '🎯', '💧', '🏃', '📚', '🧘', '🏋️',
  '🚴', '🥗', '💊', '😴', '✍️', '💻',
  '🚶', '🎨', '🎸', '🍳', '🧹', '🌿',
  '☀️', '🧠', '🍵', '🍎', '📝', '🏊',
  '🧗', '🚭', '💡', '✨', '💪', '🌱',
];

const DAYS_OF_WEEK = [
  { day: 1, label: 'M', name: 'Mon' },
  { day: 2, label: 'T', name: 'Tue' },
  { day: 3, label: 'W', name: 'Wed' },
  { day: 4, label: 'T', name: 'Thu' },
  { day: 5, label: 'F', name: 'Fri' },
  { day: 6, label: 'S', name: 'Sat' },
  { day: 0, label: 'S', name: 'Sun' },
];

const TIME_BUCKETS: { value: HabitTimeOfDay; label: string; icon: string }[] = [
  { value: 'anytime', label: 'Anytime', icon: '✨' },
  { value: 'morning', label: 'Morning', icon: '🌅' },
  { value: 'afternoon', label: 'Afternoon', icon: '☀️' },
  { value: 'evening', label: 'Evening', icon: '🌙' },
];

export function HabitEditorModal({
  isOpen,
  onClose,
  habit,
  onSave,
  onArchiveToggle,
  onDelete,
}: HabitEditorModalProps) {
  const isEditing = Boolean(habit && habit.id);

  const [name, setName] = useState('');
  const [iconOrEmoji, setIconOrEmoji] = useState('🎯');
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState(3);
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [timeOfDay, setTimeOfDay] = useState<HabitTimeOfDay>('anytime');
  const [reminderAt, setReminderAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (habit) {
        setName(habit.name);
        setIconOrEmoji(habit.iconOrEmoji || '🎯');
        setFrequency(habit.frequency);
        setTargetDaysPerWeek(habit.targetDaysPerWeek || 3);
        setCustomDays(habit.customDays && habit.customDays.length > 0 ? habit.customDays : [1, 2, 3, 4, 5]);
        setTimeOfDay(habit.timeOfDay || 'anytime');
        setReminderAt(habit.reminderAt || '');
      } else {
        setName('');
        setIconOrEmoji('🎯');
        setFrequency('daily');
        setTargetDaysPerWeek(3);
        setCustomDays([1, 2, 3, 4, 5]);
        setTimeOfDay('anytime');
        setReminderAt('');
      }
      setShowDeleteConfirm(false);
      setIsSubmitting(false);
    }
  }, [isOpen, habit]);

  if (!isOpen) return null;

  const toggleCustomDay = (day: number) => {
    if (customDays.includes(day)) {
      if (customDays.length > 1) {
        setCustomDays(customDays.filter((d) => d !== day));
      }
    } else {
      setCustomDays([...customDays, day].sort());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSave({
        name: name.trim(),
        iconOrEmoji: iconOrEmoji || '🎯',
        frequency,
        targetDaysPerWeek: frequency === 'weekly' ? targetDaysPerWeek : undefined,
        customDays: frequency === 'custom' ? customDays : undefined,
        timeOfDay,
        reminderAt: reminderAt.trim() || null,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save habit:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!habit?.id || !onArchiveToggle) return;
    try {
      await onArchiveToggle(habit.id, !habit.archived);
      onClose();
    } catch (err) {
      console.error('Failed to toggle archive:', err);
    }
  };

  const handleDelete = async () => {
    if (!habit?.id || !onDelete) return;
    try {
      await onDelete(habit.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete habit:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              {iconOrEmoji}
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {isEditing ? 'Edit Habit' : 'New Habit'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto pr-1 flex-1">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Habit Name
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Drink 2L water, Read 20 mins, Workout"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {/* Emoji Picker Grid */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Choose an Icon
            </label>
            <div className="grid grid-cols-6 gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 max-h-36 overflow-y-auto">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIconOrEmoji(emoji)}
                  className={`h-10 text-xl rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    iconOrEmoji === emoji
                      ? 'bg-blue-600 text-white scale-110 shadow-sm ring-2 ring-blue-400'
                      : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency Choice */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Frequency
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setFrequency('daily')}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                  frequency === 'daily'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Every day
              </button>
              <button
                type="button"
                onClick={() => setFrequency('weekdays')}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                  frequency === 'weekdays'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Weekdays
              </button>
              <button
                type="button"
                onClick={() => setFrequency('weekly')}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                  frequency === 'weekly'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Weekly
              </button>
              <button
                type="button"
                onClick={() => setFrequency('custom')}
                className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
                  frequency === 'custom'
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Custom Days
              </button>
            </div>

            {/* Target days per week picker (when weekly selected) */}
            {frequency === 'weekly' && (
              <div className="pt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Target days per week: <strong>{targetDaysPerWeek} days</strong>
                </span>
                <div className="flex items-center gap-1.5 justify-between">
                  {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setTargetDaysPerWeek(num)}
                      className={`w-9 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        targetDaysPerWeek === num
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-blue-400'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Custom days of week picker (when custom selected) */}
            {frequency === 'custom' && (
              <div className="pt-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Active days: <strong>{customDays.length} days / week</strong>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Rest days won't break streaks
                  </span>
                </div>
                <div className="flex items-center gap-1.5 justify-between">
                  {DAYS_OF_WEEK.map(({ day, label, name: dayName }) => {
                    const isSelected = customDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleCustomDay(day)}
                        title={dayName}
                        className={`w-9 h-9 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400'
                            : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-blue-400'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Time Bucket (Morning / Afternoon / Evening / Anytime) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Time of Day
            </label>
            <div className="grid grid-cols-4 gap-2">
              {TIME_BUCKETS.map((tb) => (
                <button
                  key={tb.value}
                  type="button"
                  onClick={() => setTimeOfDay(tb.value)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    timeOfDay === tb.value
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">{tb.icon}</span>
                  <span>{tb.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Reminder Time */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Reminder Time (Optional)
              </label>
              {reminderAt && (
                <button
                  type="button"
                  onClick={() => setReminderAt('')}
                  className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 font-medium cursor-pointer"
                >
                  Clear time
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="time"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Notifies you at this time if you have not checked off today's habit.
            </p>
          </div>

          {/* Bottom Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleArchive}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  {habit?.archived ? 'Unarchive' : 'Archive'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white transition-all shadow-sm cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Habit'}
              </button>
            </div>
          </div>

          {/* Delete Danger Row for Editing */}
          {isEditing && !showDeleteConfirm && (
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 font-medium cursor-pointer"
              >
                Delete Habit & History...
              </button>
            </div>
          )}

          {isEditing && showDeleteConfirm && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/50 space-y-2">
              <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                Are you sure? This will delete this habit and all logged streak history permanently.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
