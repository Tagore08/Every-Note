import { useState, useEffect, type KeyboardEvent } from 'react';
import type { EventRecurrence, EventOccurrence } from '../../types/event';
import { eventsRepo } from '../../db/eventsRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatDateKey, parseDateKey } from '../../utils/format';
import { PersonBadge } from '../people/PersonBadge';
import { PersonPickerModal } from '../people/PersonPickerModal';
import { LifeAreaPicker } from '../../features/areas/LifeAreaPicker';

interface EventEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  // If editing an occurrence, this is provided
  occurrence?: EventOccurrence | null;
  // If creating new, defaultDate is provided
  defaultDate?: Date;
}

type ReminderPreset = 'none' | '0' | '5' | '15' | '30' | '60' | '1440';

export function EventEditorModal({
  isOpen,
  onClose,
  occurrence,
  defaultDate,
}: EventEditorModalProps) {
  const { showSnackbar, showUndo } = useSnackbar();

  const isEditing = !!occurrence;
  const isRecurring = isEditing && occurrence.originalEvent.recurrence !== 'none';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [startTimeStr, setStartTimeStr] = useState('09:00');
  const [endTimeStr, setEndTimeStr] = useState('10:00');
  const [recurrence, setRecurrence] = useState<EventRecurrence>('none');
  const [reminderPreset, setReminderPreset] = useState<ReminderPreset>('none');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [personId, setPersonId] = useState<number | null>(null);
  const [lifeAreaId, setLifeAreaId] = useState<number | null>(null);
  const [isPersonPickerOpen, setIsPersonPickerOpen] = useState(false);

  // Mode for recurring updates: 'occurrence' | 'series'
  const [editScope, setEditScope] = useState<'occurrence' | 'series'>('occurrence');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    if (occurrence) {
      setTitle(occurrence.title || '');
      setDescription(occurrence.description || '');
      setDateStr(occurrence.occurrenceDate);
      setAllDay(occurrence.allDay);

      const s = new Date(occurrence.startAt);
      setStartTimeStr(
        `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`
      );

      if (occurrence.endAt) {
        const e = new Date(occurrence.endAt);
        setEndTimeStr(
          `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`
        );
      } else {
        const defaultEnd = new Date(s.getTime() + 60 * 60 * 1000);
        setEndTimeStr(
          `${String(defaultEnd.getHours()).padStart(2, '0')}:${String(defaultEnd.getMinutes()).padStart(2, '0')}`
        );
      }

      setRecurrence(occurrence.originalEvent.recurrence);
      setTags([...occurrence.tags]);
      setPersonId(occurrence.originalEvent.personId ?? null);
      setLifeAreaId(occurrence.originalEvent.lifeAreaId ?? null);
      setEditScope('occurrence');

      // Compute preset if reminderAt matches
      if (occurrence.reminderAt) {
        const remTime = new Date(occurrence.reminderAt).getTime();
        const diffMin = Math.round((s.getTime() - remTime) / (60 * 1000));
        if (diffMin === 0) setReminderPreset('0');
        else if (diffMin === 5) setReminderPreset('5');
        else if (diffMin === 15) setReminderPreset('15');
        else if (diffMin === 30) setReminderPreset('30');
        else if (diffMin === 60) setReminderPreset('60');
        else if (diffMin === 1440) setReminderPreset('1440');
        else setReminderPreset('none');
      } else {
        setReminderPreset('none');
      }
    } else {
      const baseDate = defaultDate || new Date();
      setTitle('');
      setDescription('');
      setDateStr(formatDateKey(baseDate));
      setAllDay(false);

      const now = new Date();
      const nextHour = (now.getHours() + 1) % 24;
      const endHour = (nextHour + 1) % 24;
      setStartTimeStr(`${String(nextHour).padStart(2, '0')}:00`);
      setEndTimeStr(`${String(endHour).padStart(2, '0')}:00`);
      setRecurrence('none');
      setReminderPreset('none');
      setTags([]);
      setPersonId(null);
      setLifeAreaId(null);
      setEditScope('series');
    }

    setTagInput('');
    setShowDeleteConfirm(false);
  }, [isOpen, occurrence, defaultDate]);

  if (!isOpen) return null;

  const handleAddTag = (rawTag: string) => {
    const clean = rawTag.trim().replace(/^#/, '');
    if (!clean || tags.includes(clean)) {
      setTagInput('');
      return;
    }
    setTags([...tags, clean]);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      e.preventDefault();
      setTags(tags.slice(0, -1));
    }
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showSnackbar({ message: 'Please enter a title for the event' });
      return;
    }

    const baseDay = parseDateKey(dateStr);
    let startAt: Date;
    let endAt: Date | null = null;

    if (allDay) {
      startAt = new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate(), 0, 0, 0, 0);
      endAt = new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate(), 23, 59, 59, 999);
    } else {
      const [sH, sM] = startTimeStr.split(':').map(Number);
      const [eH, eM] = endTimeStr.split(':').map(Number);
      startAt = new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate(), sH, sM, 0, 0);
      endAt = new Date(baseDay.getFullYear(), baseDay.getMonth(), baseDay.getDate(), eH, eM, 0, 0);

      // If endAt <= startAt, push endAt to next day or clamp
      if (endAt.getTime() <= startAt.getTime()) {
        endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
      }
    }

    // Compute reminderAt
    let reminderAt: Date | null = null;
    if (reminderPreset !== 'none') {
      const offsetMin = parseInt(reminderPreset, 10);
      reminderAt = new Date(startAt.getTime() - offsetMin * 60 * 1000);
    }

    try {
      if (isEditing && occurrence) {
        const origEvent = occurrence.originalEvent;
        const eventId = origEvent.id!;

        if (isRecurring && editScope === 'occurrence') {
          // Save exception for this specific occurrence date
          await eventsRepo.addEventException(eventId, {
            date: occurrence.occurrenceDate,
            title: trimmedTitle,
            description: description.trim() || undefined,
            startAt,
            endAt,
            allDay,
            cancelled: false,
          });
          showSnackbar({ message: 'Updated this occurrence' });
        } else {
          // Save for the entire series or single non-recurring event
          await eventsRepo.updateEvent(eventId, {
            title: trimmedTitle,
            description: description.trim() || undefined,
            startAt,
            endAt,
            allDay,
            recurrence,
            reminderAt,
            tags,
            personId,
            lifeAreaId,
          });
          showSnackbar({ message: isRecurring ? 'Updated event series' : 'Updated event' });
        }
      } else {
        // Create new event
        await eventsRepo.createEvent({
          title: trimmedTitle,
          description: description.trim() || undefined,
          startAt,
          endAt,
          allDay,
          recurrence,
          reminderAt,
          tags,
          personId,
          lifeAreaId,
          relatedTaskId: null,
        });
        showSnackbar({ message: 'Event scheduled' });
      }

      onClose();
    } catch (err) {
      console.error('Failed to save event:', err);
      showSnackbar({ message: 'Failed to save event' });
    }
  };

  const handleDeleteOccurrenceOnly = async () => {
    if (!occurrence?.originalEvent.id) return;
    const eventId = occurrence.originalEvent.id;
    const dateKey = occurrence.occurrenceDate;

    try {
      await eventsRepo.addEventException(eventId, {
        date: dateKey,
        cancelled: true,
      });

      showUndo('Deleted this occurrence', async () => {
        // Remove cancellation exception to restore
        const ev = await eventsRepo.getEventById(eventId);
        if (ev && ev.exceptions) {
          const filtered = ev.exceptions.filter((ex) => ex.date !== dateKey);
          await eventsRepo.updateEvent(eventId, { exceptions: filtered });
        }
      });

      onClose();
    } catch (err) {
      console.error('Failed to cancel occurrence:', err);
    }
  };

  const handleDeleteEntireSeries = async () => {
    if (!occurrence?.originalEvent.id) return;
    const eventId = occurrence.originalEvent.id;

    try {

      await eventsRepo.trashEvent(eventId);
      showUndo('Moved event to trash', async () => {
        await eventsRepo.restoreEvent(eventId);
      });
      onClose();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg my-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            {isEditing ? 'Edit Event' : 'New Event'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4">
          {/* Scope selector for recurring events */}
          {isRecurring && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 space-y-1.5">
              <span className="text-xs font-semibold text-blue-900 dark:text-blue-300 block">
                Recurring event series ({occurrence.originalEvent.recurrence})
              </span>
              <div className="flex items-center gap-4 text-xs text-slate-700 dark:text-slate-300">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="editScope"
                    value="occurrence"
                    checked={editScope === 'occurrence'}
                    onChange={() => setEditScope('occurrence')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>This occurrence only</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="editScope"
                    value="series"
                    checked={editScope === 'series'}
                    onChange={() => setEditScope('series')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span>All occurrences (entire series)</span>
                </label>
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Title
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Strategy Sync"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date & All-Day Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Date
              </label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="sm:pt-5">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                />
                <span>All-day event</span>
              </label>
            </div>
          </div>

          {/* Time pickers (if not all day) */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTimeStr}
                  onChange={(e) => setStartTimeStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTimeStr}
                  onChange={(e) => setEndTimeStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Recurrence & Reminder Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Repeat
              </label>
              <select
                value={recurrence}
                disabled={isEditing && editScope === 'occurrence'}
                onChange={(e) => setRecurrence(e.target.value as EventRecurrence)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Reminder
              </label>
              <select
                value={reminderPreset}
                onChange={(e) => setReminderPreset(e.target.value as ReminderPreset)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">No reminder</option>
                <option value="0">At start time</option>
                <option value="5">5 minutes before</option>
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
                <option value="1440">1 day before</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Description (optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, agenda, or location..."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 min-h-[40px]">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300"
                >
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-blue-900 dark:hover:text-white p-0.5 cursor-pointer"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => {
                  if (tagInput.trim()) handleAddTag(tagInput);
                }}
                placeholder={tags.length === 0 ? '+ Add tag (Enter)...' : '+ tag...'}
                className="text-xs bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none flex-1 min-w-[80px]"
              />
            </div>
          </div>

          {/* With Person */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              With Person (optional)
            </label>
            <div className="flex items-center gap-2">
              {personId ? (
                <PersonBadge
                  personId={personId}
                  onClick={() => setIsPersonPickerOpen(true)}
                  onClear={() => setPersonId(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsPersonPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  <span>+ With person</span>
                </button>
              )}
            </div>
          </div>

          {/* Life Area */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Life Area (optional)
            </label>
            <div>
              <LifeAreaPicker
                selectedAreaId={lifeAreaId}
                onSelect={(id) => setLifeAreaId(id)}
              />
            </div>
          </div>
        </div>

        {/* Delete Confirm Drawer / Options */}
        {showDeleteConfirm && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-2 text-xs">
            <span className="font-semibold text-rose-800 dark:text-rose-200 block">
              Confirm Deletion:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {isRecurring ? (
                <>
                  <button
                    type="button"
                    onClick={handleDeleteOccurrenceOnly}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium cursor-pointer"
                  >
                    Delete This Occurrence
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteEntireSeries}
                    className="px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-900 text-white font-medium cursor-pointer"
                  >
                    Delete Entire Series
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteEntireSeries}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium cursor-pointer"
                >
                  Delete Event
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            {isEditing && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              >
                Delete...
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              {isEditing ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </div>
      </div>

      {/* Person Picker Modal */}
      <PersonPickerModal
        isOpen={isPersonPickerOpen}
        onClose={() => setIsPersonPickerOpen(false)}
        selectedPersonId={personId}
        onSelectPerson={(id) => setPersonId(id)}
      />
    </div>
  );
}
