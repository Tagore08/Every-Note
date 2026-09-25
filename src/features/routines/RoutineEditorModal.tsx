import { useState, useEffect } from 'react';
import type { Routine, RoutineItem, RoutineItemKind, RoutineTimeOfDay } from '../../types/routine';
import { routinesRepo } from '../../db/repos/routinesRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { useHabitsWithStats } from '../../db/habitsRepo';
import { useTodoTasks } from '../../db/tasksRepo';

interface RoutineEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  routine?: Routine | null;
  onSaved?: () => void;
}

const WEEKDAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

const TIME_OF_DAY_OPTIONS: { value: RoutineTimeOfDay; label: string; icon: string; time: string }[] = [
  { value: 'morning', label: 'Morning', icon: '🌅', time: '09:00' },
  { value: 'afternoon', label: 'Afternoon', icon: '☀️', time: '14:00' },
  { value: 'evening', label: 'Evening', icon: '🌙', time: '19:00' },
  { value: 'any', label: 'Anytime', icon: '⚡', time: '12:00' },
];

const EMOJI_OPTIONS = ['☀️', '🌅', '🌙', '⚡', '🏃', '🧘', '☕', '📚', '💪', '🎯'];

export function RoutineEditorModal({
  isOpen,
  onClose,
  routine,
  onSaved,
}: RoutineEditorModalProps) {
  const { showSnackbar } = useSnackbar();
  const { activeHabits } = useHabitsWithStats();
  const allTasks = useTodoTasks() ?? [];

  const isEditing = Boolean(routine && routine.id);

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('☀️');
  const [timeOfDay, setTimeOfDay] = useState<RoutineTimeOfDay>('morning');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [items, setItems] = useState<RoutineItem[]>([]);

  // Step builder drawer state
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [newStepKind, setNewStepKind] = useState<RoutineItemKind>('custom');
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDuration, setNewStepDuration] = useState<number | undefined>(undefined);
  const [newStepRefId, setNewStepRefId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) return;

    if (routine) {
      setName(routine.name);
      setEmoji(routine.emoji || '☀️');
      setTimeOfDay(routine.timeOfDay);
      setDaysOfWeek(routine.daysOfWeek || [1, 2, 3, 4, 5]);
      setItems([...(routine.items || [])]);
    } else {
      setName('');
      setEmoji('☀️');
      setTimeOfDay('morning');
      setDaysOfWeek([1, 2, 3, 4, 5]);
      setItems([]);
    }
    setIsAddingStep(false);
    setNewStepTitle('');
    setNewStepDuration(undefined);
    setNewStepRefId(undefined);
  }, [isOpen, routine]);

  if (!isOpen) return null;

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev; // Keep at least one day
        return prev.filter((d) => d !== day);
      } else {
        return [...prev, day].sort((a, b) => a - b);
      }
    });
  };

  const handleAddItem = () => {
    let finalTitle = newStepTitle.trim();
    let refId = newStepRefId;

    if (newStepKind === 'habit') {
      const habit = activeHabits.find((h) => h.id === refId);
      finalTitle = habit ? `Habit: ${habit.name}` : finalTitle || 'Habit';
    } else if (newStepKind === 'task') {
      const task = allTasks.find((t) => t.id === refId);
      finalTitle = task ? `Task: ${task.title}` : finalTitle || 'Task';
    } else if (newStepKind === 'journal') {
      finalTitle = "Write today's journal entry";
      refId = undefined;
    }

    if (!finalTitle) return;

    const newItem: RoutineItem = {
      uid: crypto.randomUUID(),
      kind: newStepKind,
      refId,
      title: finalTitle,
      durationMin: newStepDuration && newStepDuration > 0 ? Number(newStepDuration) : undefined,
    };

    setItems([...items, newItem]);
    setNewStepTitle('');
    setNewStepDuration(undefined);
    setNewStepRefId(undefined);
    setIsAddingStep(false);
  };

  const handleRemoveItem = (uid: string) => {
    setItems(items.filter((it) => it.uid !== uid));
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const newItems = [...items];
    const [moved] = newItems.splice(index, 1);
    newItems.splice(targetIndex, 0, moved);
    setItems(newItems);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showSnackbar({ message: 'Please enter a routine name' });
      return;
    }

    try {
      if (isEditing && routine?.id) {
        await routinesRepo.updateRoutine(routine.id, {
          name: name.trim(),
          emoji,
          timeOfDay,
          daysOfWeek,
          items,
        });
        showSnackbar({ message: 'Routine updated' });
      } else {
        await routinesRepo.createRoutine({
          name: name.trim(),
          emoji,
          timeOfDay,
          daysOfWeek,
          items,
          active: true,
        });
        showSnackbar({ message: 'Routine created' });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('Failed to save routine:', err);
      showSnackbar({ message: 'Failed to save routine' });
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!name.trim()) return;
    try {
      const routineObj: Routine = {
        name: name.trim(),
        emoji,
        timeOfDay,
        daysOfWeek,
        items,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await routinesRepo.saveRoutineAsTemplate(routineObj);
      showSnackbar({ message: 'Saved as routine template' });
    } catch (err) {
      console.error('Failed to save as template:', err);
      showSnackbar({ message: 'Failed to save template' });
    }
  };

  const handleDelete = async () => {
    if (!routine?.id) return;
    if (window.confirm('Delete this routine? Past runs will remain in your history.')) {
      await routinesRepo.deleteRoutine(routine.id);
      showSnackbar({ message: 'Routine deleted' });
      onSaved?.();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface border border-border w-full max-w-xl rounded-card shadow-float max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base sm:text-lg font-bold text-ink">
            {isEditing ? 'Edit Routine' : 'New Routine'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs sm:text-sm">
          {/* Name & Emoji */}
          <div className="space-y-1.5">
            <label className="font-semibold text-ink block">Routine Name</label>
            <div className="flex items-center gap-2">
              {/* Emoji selector */}
              <div className="relative group">
                <button
                  type="button"
                  className="w-11 h-11 rounded-xl border border-border bg-surface-2 flex items-center justify-center text-xl cursor-pointer hover:bg-surface-2/80"
                >
                  {emoji}
                </button>
                <div className="absolute top-12 left-0 z-30 p-2 bg-surface border border-border rounded-xl shadow-card hidden group-hover:flex group-focus-within:flex flex-wrap gap-1 w-44">
                  {EMOJI_OPTIONS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setEmoji(em)}
                      className="w-8 h-8 rounded-lg hover:bg-surface-2 flex items-center justify-center text-lg cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Morning Launch, Evening Wind-Down"
                className="flex-1 px-3 py-2.5 rounded-xl border border-border bg-surface-2 text-ink placeholder:text-ink-muted focus:outline-hidden focus:border-accent"
              />
            </div>
          </div>

          {/* Time of Day */}
          <div className="space-y-1.5">
            <label className="font-semibold text-ink block">Time of Day</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIME_OF_DAY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTimeOfDay(opt.value)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer min-h-[44px] ${
                    timeOfDay === opt.value
                      ? 'border-accent bg-accent-soft text-accent font-bold ring-1 ring-accent'
                      : 'border-border bg-surface-2 hover:bg-surface text-ink'
                  }`}
                >
                  <span className="text-base">{opt.icon}</span>
                  <span className="text-xs font-semibold mt-0.5">{opt.label}</span>
                  <span className="text-[10px] text-ink-muted">{opt.time}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Days of Week */}
          <div className="space-y-1.5">
            <label className="font-semibold text-ink block">Repeat Days</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map(({ day, label }) => {
                const isSelected = daysOfWeek.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`flex-1 min-w-[40px] py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                      isSelected
                        ? 'bg-accent text-accent-ink border-accent shadow-2xs'
                        : 'bg-surface-2 border-border text-ink-muted hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Routine Steps / Items */}
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-ink block">
                Routine Steps ({items.length})
              </label>
              <button
                type="button"
                onClick={() => setIsAddingStep(true)}
                className="text-xs font-semibold text-accent hover:underline cursor-pointer min-h-[44px] flex items-center"
              >
                + Add Step
              </button>
            </div>

            {/* Steps list */}
            {items.length === 0 ? (
              <div className="py-6 text-center text-xs text-ink-muted border border-dashed border-border rounded-xl">
                No steps added yet. Add custom steps or pointers to existing habits, tasks, and journals.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div
                    key={item.uid}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface-2 gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider bg-surface text-ink-muted border border-border">
                        {item.kind}
                      </span>
                      <span className="font-medium text-ink truncate text-xs sm:text-sm">
                        {item.title}
                      </span>
                      {item.durationMin && (
                        <span className="text-[10px] text-ink-muted shrink-0">
                          ({item.durationMin}m)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveItem(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-ink-muted hover:text-ink disabled:opacity-30 cursor-pointer"
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveItem(index, 'down')}
                        disabled={index === items.length - 1}
                        className="p-1 text-ink-muted hover:text-ink disabled:opacity-30 cursor-pointer"
                        title="Move down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.uid)}
                        className="p-1 text-danger hover:opacity-80 cursor-pointer"
                        title="Remove step"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Step creation box */}
            {isAddingStep && (
              <div className="p-3.5 rounded-xl border border-accent/40 bg-accent-soft/20 space-y-3 mt-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Add Routine Step</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingStep(false)}
                    className="text-xs text-ink-muted hover:text-ink cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {/* Step Kind Selector */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-xs">
                  {(['custom', 'habit', 'journal', 'task', 'note'] as RoutineItemKind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => {
                        setNewStepKind(k);
                        if (k === 'journal') setNewStepTitle("Write today's journal entry");
                      }}
                      className={`py-1.5 px-2 rounded-lg border font-semibold capitalize transition-all cursor-pointer min-h-[44px] flex items-center justify-center ${
                        newStepKind === k
                          ? 'bg-accent text-accent-ink border-accent'
                          : 'bg-surface border-border text-ink-muted hover:text-ink'
                      }`}
                    >
                      {k}
                    </button>
                  ))}
                </div>

                {/* Step Configuration Details */}
                {newStepKind === 'custom' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={newStepTitle}
                      onChange={(e) => setNewStepTitle(e.target.value)}
                      placeholder="Step name (e.g. Stretch 10m)"
                      className="sm:col-span-2 px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:outline-hidden focus:border-accent"
                    />
                    <input
                      type="number"
                      value={newStepDuration || ''}
                      onChange={(e) => setNewStepDuration(Number(e.target.value))}
                      placeholder="Minutes (opt)"
                      className="px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:outline-hidden focus:border-accent"
                    />
                  </div>
                )}

                {newStepKind === 'habit' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-ink-muted">Select Habit Pointer</label>
                    <select
                      value={newStepRefId || ''}
                      onChange={(e) => setNewStepRefId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:outline-hidden"
                    >
                      <option value="">-- Choose habit --</option>
                      {activeHabits.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {newStepKind === 'task' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-ink-muted">Select Active Task Pointer</label>
                    <select
                      value={newStepRefId || ''}
                      onChange={(e) => setNewStepRefId(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:outline-hidden"
                    >
                      <option value="">-- Choose task --</option>
                      {allTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {newStepKind === 'journal' && (
                  <div className="text-xs text-ink-muted italic">
                    Points to today's daily journal entry.
                  </div>
                )}

                {newStepKind === 'note' && (
                  <input
                    type="text"
                    value={newStepTitle}
                    onChange={(e) => setNewStepTitle(e.target.value)}
                    placeholder="Note reference title"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface text-ink text-xs focus:outline-hidden focus:border-accent"
                  />
                )}

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 rounded-lg bg-accent text-accent-ink font-semibold text-xs cursor-pointer min-h-[44px]"
                >
                  Confirm Step
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border bg-surface-2/40">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                className="text-xs text-danger hover:underline cursor-pointer min-h-[44px] flex items-center"
              >
                Delete Routine
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveAsTemplate}
              className="px-3 py-2 rounded-xl border border-border bg-surface hover:bg-surface-2 text-ink text-xs font-semibold transition-colors cursor-pointer min-h-[44px]"
            >
              Save as Template
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-accent text-accent-ink text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity cursor-pointer min-h-[44px]"
            >
              Save Routine
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
