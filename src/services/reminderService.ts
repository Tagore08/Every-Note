import { eventsRepo } from '../db/eventsRepo';
import { notesRepo } from '../db/notesRepo';
import { habitsRepo, toLocalDateStr } from '../db/habitsRepo';
import { db } from '../db/database';
import { formatEventTime } from '../utils/format';

const NOTIFIED_STORAGE_KEY = 'notes_app_notified_reminders_v1';

let navigateHandler: ((path: string) => void) | null = null;
let timerId: ReturnType<typeof setInterval> | null = null;

export function registerReminderNavigator(fn: (path: string) => void) {
  navigateHandler = fn;
}

export function getNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!getNotificationSupport()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!getNotificationSupport()) return 'unsupported';
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch (err) {
    console.warn('Failed to request notification permission:', err);
    return Notification.permission;
  }
}

function getNotifiedKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveNotifiedKeys(keys: Set<string>) {
  try {
    // Keep set bounded to last 500 keys to avoid unlimited growth
    const arr = Array.from(keys).slice(-500);
    localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // Ignore storage quota issues
  }
}

/**
 * Checks for due reminders across events and scheduled notes.
 */
export async function checkDueReminders() {
  if (!getNotificationSupport() || Notification.permission !== 'granted') {
    return;
  }

  const now = Date.now();
  const maxPastWindowMs = 24 * 60 * 60 * 1000; // Reminders due in the last 24h
  const notifiedKeys = getNotifiedKeys();
  let updated = false;

  try {
    // 1. Check Events
    const activeEvents = await eventsRepo.getActiveReminders();
    for (const event of activeEvents) {
      if (!event.id || !event.reminderAt) continue;
      const remTime = new Date(event.reminderAt).getTime();
      const key = `event-${event.id}-${remTime}`;

      if (remTime <= now && remTime >= now - maxPastWindowMs && !notifiedKeys.has(key)) {
        notifiedKeys.add(key);
        updated = true;

        const body = event.allDay
          ? 'All-day event reminder'
          : `Event starting ${formatEventTime(event.startAt, event.endAt, event.allDay)}`;

        try {
          const notification = new Notification(event.title || 'Event Reminder', {
            body,
            icon: '/favicon.svg',
            tag: key,
          });

          notification.onclick = () => {
            window.focus();
            if (navigateHandler) {
              navigateHandler('/calendar');
            } else {
              window.location.href = '/calendar';
            }
            notification.close();
          };
        } catch (e) {
          console.warn('Could not display event notification:', e);
        }
      }
    }

    // 2. Check Scheduled Notes
    const activeNotes = await notesRepo.getActiveScheduledReminders();
    for (const note of activeNotes) {
      if (!note.id || !note.reminderAt) continue;
      const remTime = new Date(note.reminderAt).getTime();
      const key = `note-${note.id}-${remTime}`;

      if (remTime <= now && remTime >= now - maxPastWindowMs && !notifiedKeys.has(key)) {
        notifiedKeys.add(key);
        updated = true;

        const body = note.content ? note.content.slice(0, 100) : 'Scheduled note reminder';

        try {
          const notification = new Notification(note.title || 'Scheduled Note Reminder', {
            body,
            icon: '/favicon.svg',
            tag: key,
          });

          const noteId = note.id;
          notification.onclick = () => {
            window.focus();
            if (navigateHandler) {
              navigateHandler(`/notes/${noteId}`);
            } else {
              window.location.href = `/notes/${noteId}`;
            }
            notification.close();
          };
        } catch (e) {
          console.warn('Could not display note notification:', e);
        }
      }
    }

    // 3. Check Habits
    const activeHabits = await habitsRepo.getActiveHabitsWithReminders();
    const todayStr = toLocalDateStr();
    for (const habit of activeHabits) {
      if (!habit.id || !habit.reminderAt) continue;
      const [hStr, mStr] = habit.reminderAt.split(':');
      const habitRemDate = new Date();
      habitRemDate.setHours(Number(hStr), Number(mStr), 0, 0);
      const remTime = habitRemDate.getTime();
      const key = `habit-${habit.id}-${todayStr}-${habit.reminderAt}`;

      if (now >= remTime && now - remTime < maxPastWindowMs && !notifiedKeys.has(key)) {
        // Check if habit is already completed today
        const existingLog = await db.habitLogs.where({ habitId: habit.id, date: todayStr }).first();
        if (existingLog && existingLog.done) {
          continue;
        }

        notifiedKeys.add(key);
        updated = true;

        try {
          const notification = new Notification(`Habit Reminder: ${habit.name}`, {
            body: `Don't break your streak! Time to complete ${habit.name}.`,
            icon: '/favicon.svg',
            tag: key,
          });

          notification.onclick = () => {
            window.focus();
            if (navigateHandler) {
              navigateHandler('/habits');
            } else {
              window.location.href = '/habits';
            }
            notification.close();
          };
        } catch (e) {
          console.warn('Could not display habit notification:', e);
        }
      }
    }

    if (updated) {
      saveNotifiedKeys(notifiedKeys);
    }
  } catch (err) {
    console.warn('Error while checking due reminders:', err);
  }
}

/**
 * Initializes the reminder scheduler loop.
 */
export function startReminderScheduler(navigate?: (path: string) => void): () => void {
  if (navigate) {
    registerReminderNavigator(navigate);
  }

  // Run check immediately
  checkDueReminders();

  // Run periodic check every 30 seconds
  if (timerId) {
    clearInterval(timerId);
  }
  timerId = setInterval(() => {
    checkDueReminders();
  }, 30000);

  // Check on tab visibility restoration
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      checkDueReminders();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  return () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
