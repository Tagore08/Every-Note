import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  usePerson,
  usePersonEvents,
  usePersonTasks,
  usePersonNotes,
  peopleRepo,
} from '../../db/peopleRepo';
import { tasksRepo } from '../../db/tasksRepo';
import { PersonAvatar } from '../people/PersonAvatar';
import { EventEditorModal } from '../calendar/EventEditorModal';
import { TaskEditorModal } from '../tasks/TaskEditorModal';
import { useSnackbar } from '../../context/SnackbarContext';
import {
  formatRelativeTime,
  formatEventTime,
  formatDueDate,
  formatDateKey,
  getContentSnippet,
  isOverdue,
} from '../../utils/format';
import type { CalendarEvent, EventOccurrence } from '../../types/event';
import type { Task } from '../../types/task';

export function PersonProfileView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSnackbar, showUndo } = useSnackbar();
  const numericId = id ? parseInt(id, 10) : null;

  const person = usePerson(numericId);
  const events = usePersonEvents(numericId);
  const tasks = usePersonTasks(numericId);
  const notes = usePersonNotes(numericId);

  // Form states
  const [name, setName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [notesText, setNotesText] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');

  // Modal / editor states for auto-lists
  const [selectedOccurrence, setSelectedOccurrence] = useState<EventOccurrence | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Delete dialog state
  const [showDeleteForeverModal, setShowDeleteForeverModal] = useState(false);

  // File input ref for photo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialLoadDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state from DB on load
  useEffect(() => {
    if (person && !initialLoadDone.current) {
      setName(person.name || '');
      setContactInfo(person.contactInfo || '');
      setNotesText(person.notes || '');
      initialLoadDone.current = true;
    }
  }, [person]);

  // Debounced autosave
  const triggerAutoSave = useCallback(
    (newName: string, newContact: string, newNotes: string) => {
      if (!numericId) return;
      setSaveStatus('saving');

      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(async () => {
        try {
          await peopleRepo.updatePerson(numericId, {
            name: newName.trim() || 'Untitled Person',
            contactInfo: newContact,
            notes: newNotes,
          });
          setSaveStatus('saved');
        } catch (err) {
          console.error('Failed to autosave person:', err);
          setSaveStatus('idle');
        }
      }, 500);
    },
    [numericId]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    triggerAutoSave(val, contactInfo, notesText);
  };

  const handleContactChange = (val: string) => {
    setContactInfo(val);
    triggerAutoSave(name, val, notesText);
  };

  const handleNotesChange = (val: string) => {
    setNotesText(val);
    triggerAutoSave(name, contactInfo, val);
  };

  // Photo upload
  const handlePhotoSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !numericId) return;

    try {
      await peopleRepo.updatePerson(numericId, { photoBlob: file });
      showSnackbar({ message: 'Photo updated' });
    } catch (err) {
      console.error('Failed to update photo:', err);
      showSnackbar({ message: 'Failed to update photo' });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async () => {
    if (!numericId) return;
    try {
      await peopleRepo.updatePerson(numericId, { photoBlob: null });
      showSnackbar({ message: 'Photo removed' });
    } catch (err) {
      console.error('Failed to remove photo:', err);
    }
  };

  // Delete person permanently
  const handleConfirmDeleteForever = async () => {
    if (!numericId || !person) return;
    try {
      await peopleRepo.deletePermanently(numericId);
      setShowDeleteForeverModal(false);
      showSnackbar({ message: `Deleted ${person.name} forever` });
      navigate('/people', { replace: true });
    } catch (err) {
      console.error('Failed to delete person forever:', err);
      showSnackbar({ message: 'Failed to delete person' });
    }
  };

  // Soft delete person
  const handleTrashPerson = async () => {
    if (!numericId || !person) return;
    try {
      await peopleRepo.trashPerson(numericId);
      showUndo(`Moved ${person.name} to trash`, async () => {
        await peopleRepo.restorePerson(numericId);
      });
      navigate('/people', { replace: true });
    } catch (err) {
      console.error('Failed to trash person:', err);
    }
  };

  // Helper to open event editor
  const handleOpenEvent = (event: CalendarEvent) => {
    const s = new Date(event.startAt);
    const occ: EventOccurrence = {
      eventId: event.id!,
      originalEvent: event,
      occurrenceDate: formatDateKey(s),
      title: event.title,
      description: event.description,
      startAt: s,
      endAt: event.endAt ? new Date(event.endAt) : null,
      allDay: event.allDay,
      recurrence: event.recurrence,
      reminderAt: event.reminderAt ? new Date(event.reminderAt) : null,
      personId: event.personId,
      isException: false,
      tags: event.tags || [],
    };
    setSelectedOccurrence(occ);
  };

  // Toggle task completion
  const handleToggleTask = async (task: Task) => {
    if (!task.id) return;
    try {
      const nextStatus = await tasksRepo.toggleTaskStatus(task.id, task.status);
      showUndo(
        nextStatus === 'done' ? 'Task marked complete' : 'Task marked todo',
        async () => {
          if (task.id) await tasksRepo.toggleTaskStatus(task.id, nextStatus);
        }
      );
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  if (person === undefined) {
    return (
      <div className="max-w-4xl mx-auto py-12 flex justify-center">
        <div className="text-sm text-slate-400 animate-pulse">Loading profile...</div>
      </div>
    );
  }

  if (person === null) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-4">
        <p className="text-sm text-slate-500">Person not found or has been deleted.</p>
        <button
          type="button"
          onClick={() => navigate('/people')}
          className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Return to people
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/people')}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Back to People"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 select-none">
            {saveStatus === 'saving' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Saving...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Saved</span>
              </>
            ) : (
              <span>Unsaved changes</span>
            )}
            {person.updatedAt && (
              <span className="hidden sm:inline text-slate-400 dark:text-slate-600">
                · {formatRelativeTime(person.updatedAt)}
              </span>
            )}
          </div>
        </div>

        {/* Delete actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTrashPerson}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            title="Move to trash"
            aria-label="Move to trash"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Profile Header: Avatar + Name + Photo upload */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          className="hidden"
        />

        {/* Big Avatar with change overlay */}
        <div className="flex flex-col items-center gap-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative cursor-pointer group"
            title="Click to change photo"
          >
            <PersonAvatar
              name={name || person.name}
              photoBlob={person.photoBlob}
              size="xl"
              className="shadow-sm transition-transform group-hover:scale-102"
            />
            <div className="absolute inset-0 rounded-full bg-slate-900/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity text-xs font-medium">
              <svg className="w-6 h-6 mb-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>Change</span>
            </div>
          </div>

          {person.photoBlob && (
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Remove photo
            </button>
          )}
        </div>

        {/* Name Input */}
        <div className="flex-1 w-full space-y-1 text-center sm:text-left">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Person Name..."
            className="w-full text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white placeholder-slate-300 dark:placeholder-slate-700 bg-transparent focus:outline-none tracking-tight border-b border-transparent focus:border-blue-500 pb-1"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 pt-1">
            Tap photo to upload image from device (stored locally as Blob).
          </p>
        </div>
      </div>

      {/* Editable Contact Info & Freeform Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact Info Lines */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span>Contact Lines</span>
            </label>
            <span className="text-[10px] text-slate-400">Freeform lines</span>
          </div>

          <textarea
            rows={4}
            value={contactInfo}
            onChange={(e) => handleContactChange(e.target.value)}
            placeholder="email: alice@example.com&#10;phone: +1 (555) 0192&#10;location: San Francisco"
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
          />
        </div>

        {/* Freeform Notes */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Notes</span>
            </label>
            <span className="text-[10px] text-slate-400">Freeform text</span>
          </div>

          <textarea
            rows={4}
            value={notesText}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Context, mutual interests, project roles, or conversation logs..."
            className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed"
          />
        </div>
      </div>

      {/* Auto-lists Section: Events, Tasks, Notes */}
      <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Activity & Linked Items
        </h3>

        {/* 1. Events Auto-List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Events with {name || 'this person'}</span>
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {events.length}
              </span>
            </h4>
          </div>

          {events.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-center text-xs text-slate-400 dark:text-slate-500">
              No events scheduled with {name || 'this person'}. Link them inside any event.
            </div>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => handleOpenEvent(ev)}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white block truncate">
                      {ev.title}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span>{new Date(ev.startAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      <span>·</span>
                      <span>{formatEventTime(new Date(ev.startAt), ev.endAt ? new Date(ev.endAt) : null, ev.allDay)}</span>
                      {ev.recurrence !== 'none' && (
                        <>
                          <span>·</span>
                          <span className="capitalize">{ev.recurrence}</span>
                        </>
                      )}
                    </span>
                  </div>

                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Edit →
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. Tasks Auto-List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              <span>Tasks with {name || 'this person'}</span>
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {tasks.length}
              </span>
            </h4>
          </div>

          {tasks.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-center text-xs text-slate-400 dark:text-slate-500">
              No tasks assigned to or with {name || 'this person'}. Link them in any task editor.
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => {
                const isTaskOverdue = t.status === 'todo' && t.dueAt && isOverdue(t.dueAt);
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* 1-tap checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleTask(t)}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                          t.status === 'done'
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                        }`}
                        title={t.status === 'done' ? 'Mark todo' : 'Mark done'}
                      >
                        {t.status === 'done' && (
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>

                      <div
                        onClick={() => setSelectedTask(t)}
                        className="min-w-0 flex-1 cursor-pointer"
                      >
                        <span
                          className={`font-semibold text-xs truncate block ${
                            t.status === 'done'
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {t.title}
                        </span>
                        {t.dueAt && (
                          <span
                            className={`text-[11px] block mt-0.5 ${
                              isTaskOverdue
                                ? 'text-red-600 dark:text-red-400 font-semibold'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            Due {formatDueDate(t.dueAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedTask(t)}
                      className="text-xs text-blue-600 dark:text-blue-400 font-medium pl-2 cursor-pointer"
                    >
                      Edit →
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. Notes Auto-List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <svg className="w-4 h-4 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span>Notes mentioning or with {name || 'this person'}</span>
              <span className="text-[11px] px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {notes.length}
              </span>
            </h4>
          </div>

          {notes.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/40 text-center text-xs text-slate-400 dark:text-slate-500">
              No notes linked to {name || 'this person'}. Link them via the Person button in the note editor.
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <Link
                  key={n.id}
                  to={`/notes/${n.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs cursor-pointer transition-colors"
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <span className="font-semibold text-xs text-slate-900 dark:text-white block truncate">
                      {n.title || 'Untitled Note'}
                    </span>
                    {n.content && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                        {getContentSnippet(n.content, 1, 90)}
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium pl-2">
                    Open →
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Danger Zone: Delete forever (Requirement 5) */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
        <div className="p-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-0.5">
            <h4 className="font-semibold text-xs text-red-900 dark:text-red-200 uppercase tracking-wider">
              Danger Zone
            </h4>
            <p className="text-xs text-red-700 dark:text-red-400">
              Permanently delete this person from local database and unlink all associated items.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteForeverModal(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs self-start sm:self-auto shrink-0 transition-colors cursor-pointer"
          >
            Delete forever...
          </button>
        </div>
      </div>

      {/* Underlying Event Editor Modal */}
      {selectedOccurrence && (
        <EventEditorModal
          isOpen={true}
          occurrence={selectedOccurrence}
          onClose={() => setSelectedOccurrence(null)}
        />
      )}

      {/* Underlying Task Editor Modal */}
      {selectedTask && (
        <TaskEditorModal
          isOpen={true}
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onDelete={async (tid) => {
            await tasksRepo.deleteTask(tid);
            setSelectedTask(null);
          }}
        />
      )}

      {/* Delete Forever Confirm Dialog */}
      {showDeleteForeverModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Delete {name || 'person'} forever?
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will permanently delete <strong>{name || person.name}</strong> from your local storage and unlink them from any linked events, tasks, and notes. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowDeleteForeverModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteForever}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors cursor-pointer"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
