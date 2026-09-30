import { useState } from 'react';
import type { Task } from '../../types/task';
import { tasksRepo } from '../../db/tasksRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { Dialog } from '../../design/ui/Dialog';

interface QuickRescheduleModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export function QuickRescheduleModal({ task, isOpen, onClose }: QuickRescheduleModalProps) {
  const { showUndo } = useSnackbar();
  const [customDate, setCustomDate] = useState('');

  if (!isOpen || !task || !task.id) return null;

  const originalDueAt = task.dueAt;

  const handleReschedule = async (newDate: Date | null) => {
    if (!task.id) return;
    try {
      await tasksRepo.updateTask(task.id, { dueAt: newDate });
      showUndo(`Rescheduled "${task.title}"`, async () => {
        if (task.id) await tasksRepo.updateTask(task.id, { dueAt: originalDueAt });
      });
      onClose();
    } catch (err) {
      console.error('Failed to reschedule task:', err);
    }
  };

  const getPresetDate = (type: 'today' | 'tomorrow' | 'weekend' | 'nextWeek'): Date => {
    const now = new Date();
    const target = new Date(now);
    target.setSeconds(0, 0);

    if (type === 'today') {
      target.setHours(18, 0, 0, 0);
    } else if (type === 'tomorrow') {
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
    } else if (type === 'weekend') {
      const day = target.getDay();
      const diff = (6 - day + 7) % 7 || 7;
      target.setDate(target.getDate() + diff);
      target.setHours(10, 0, 0, 0);
    } else if (type === 'nextWeek') {
      const day = target.getDay();
      const diff = (8 - day + 7) % 7 || 7;
      target.setDate(target.getDate() + diff);
      target.setHours(9, 0, 0, 0);
    }
    return target;
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="📅 Reschedule Task"
      size="sm"
    >
      <div className="space-y-4">
        <p className="text-xs text-ink-muted truncate font-medium">
          {task.title}
        </p>

        {/* Quick Date Presets */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleReschedule(getPresetDate('today'))}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-surface-2/40 hover:bg-surface-2 text-left cursor-pointer transition-colors"
          >
            <span className="text-base">☀️</span>
            <div>
              <div className="text-xs font-semibold text-ink">Today</div>
              <div className="text-[10px] text-ink-muted">Tonight 6:00 PM</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleReschedule(getPresetDate('tomorrow'))}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-surface-2/40 hover:bg-surface-2 text-left cursor-pointer transition-colors"
          >
            <span className="text-base">🌅</span>
            <div>
              <div className="text-xs font-semibold text-ink">Tomorrow</div>
              <div className="text-[10px] text-ink-muted">Morning 9:00 AM</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleReschedule(getPresetDate('weekend'))}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-surface-2/40 hover:bg-surface-2 text-left cursor-pointer transition-colors"
          >
            <span className="text-base">🛋️</span>
            <div>
              <div className="text-xs font-semibold text-ink">This Weekend</div>
              <div className="text-[10px] text-ink-muted">Saturday 10:00 AM</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleReschedule(getPresetDate('nextWeek'))}
            className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-surface-2/40 hover:bg-surface-2 text-left cursor-pointer transition-colors"
          >
            <span className="text-base">🗓️</span>
            <div>
              <div className="text-xs font-semibold text-ink">Next Week</div>
              <div className="text-[10px] text-ink-muted">Monday 9:00 AM</div>
            </div>
          </button>
        </div>

        {/* Custom date input */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            Custom Date & Time
          </label>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink text-xs focus:outline-none focus:border-accent"
            />
            {customDate && (
              <button
                type="button"
                onClick={() => handleReschedule(new Date(customDate))}
                className="px-3 py-2 rounded-xl bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shrink-0"
              >
                Set
              </button>
            )}
          </div>
        </div>

        {/* Clear Date */}
        {task.dueAt && (
          <button
            type="button"
            onClick={() => handleReschedule(null)}
            className="w-full py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer text-center"
          >
            Clear Due Date (Someday)
          </button>
        )}
      </div>
    </Dialog>
  );
}
