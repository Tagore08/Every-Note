import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  startReminderScheduler,
  getNotificationSupport,
  getNotificationPermission,
  FOREGROUND_REMINDER_INTERVAL_MS,
  BACKGROUND_REMINDER_INTERVAL_MS,
} from './reminderService';

describe('reminderService scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('defines correct foreground and background reminder intervals', () => {
    expect(FOREGROUND_REMINDER_INTERVAL_MS).toBe(60000);
    expect(BACKGROUND_REMINDER_INTERVAL_MS).toBe(300000);
  });

  it('reports unsupported when Notification is absent from window and globalThis', () => {
    const originalNotification = (globalThis as any).Notification;
    delete (globalThis as any).Notification;
    if (typeof window !== 'undefined') {
      delete (window as any).Notification;
    }

    expect(getNotificationSupport()).toBe(false);
    expect(getNotificationPermission()).toBe('unsupported');

    (globalThis as any).Notification = originalNotification;
    if (typeof window !== 'undefined') {
      (window as any).Notification = originalNotification;
    }
  });

  it('does not spin interval timers when notification permission is not granted', () => {
    const mockNotif = {
      permission: 'denied',
      requestPermission: vi.fn(),
    };
    (globalThis as any).Notification = mockNotif;
    if (typeof window !== 'undefined') {
      (window as any).Notification = mockNotif;
    }

    const cleanup = startReminderScheduler();
    expect(vi.getTimerCount()).toBe(0);
    cleanup();
  });

  it('starts foreground timer when permission is granted and visibility is visible', () => {
    const mockNotif = {
      permission: 'granted',
      requestPermission: vi.fn(),
    };
    (globalThis as any).Notification = mockNotif;
    if (typeof window !== 'undefined') {
      (window as any).Notification = mockNotif;
    }

    // Mock document
    const listeners: Record<string, () => void> = {};
    (globalThis as any).document = {
      visibilityState: 'visible',
      addEventListener: (type: string, fn: () => void) => {
        listeners[type] = fn;
      },
      removeEventListener: (type: string, fn: () => void) => {
        if (listeners[type] === fn) delete listeners[type];
      },
    };

    const cleanup = startReminderScheduler();
    expect(vi.getTimerCount()).toBe(1);

    // Switch to hidden
    (globalThis as any).document.visibilityState = 'hidden';
    listeners['visibilitychange']?.();
    expect(vi.getTimerCount()).toBe(1);

    cleanup();
    expect(vi.getTimerCount()).toBe(0);
  });
});
