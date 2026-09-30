import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runPreUpgradeBackupGate,
  TARGET_VERSION,
  getGateState,
  resetGateStateForTesting,
} from './backupGate';
import * as exportService from './exportService';
import { db } from './database';

describe('backupGate - Safety checks and upgrade gate', () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const mockLocalStorage = {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStore[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    };
    (globalThis as any).localStorage = mockLocalStorage;
    if (typeof window !== 'undefined') {
      (window as any).localStorage = mockLocalStorage;
    }
    resetGateStateForTesting();
    vi.restoreAllMocks();
  });

  it('exports TARGET_VERSION as 18 matching database schema', () => {
    expect(TARGET_VERSION).toBe(18);
  });

  it('aborts upgrade and surfaces blocking error UI if saveBackupToOPFS returns false', async () => {
    // Simulate an existing database on an older version
    mockStore['notes_app_schema_version'] = '14';

    // Mock indexedDB.open to pretend DB exists with storeNames
    const fakeRawDb = {
      version: 14,
      objectStoreNames: ['notes'],
      close: vi.fn(),
    };
    const req: any = { onsuccess: null, onerror: null };
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess({ target: { result: fakeRawDb } });
      }, 0);
      return req;
    });

    // Mock buildFullBackupEnvelope to succeed
    vi.spyOn(exportService, 'buildFullBackupEnvelope').mockResolvedValue({
      version: 14,
      app: 'notes-app',
      exportedAt: new Date().toISOString(),
      notes: [],
    } as any);

    // Mock saveBackupToOPFS to fail (return false)
    vi.spyOn(exportService, 'saveBackupToOPFS').mockResolvedValue(false);
    const dbOpenSpy = vi.spyOn(db, 'open');

    await runPreUpgradeBackupGate();

    const state = getGateState();
    expect(state.isUpgrading).toBe(true);
    expect(state.error).toContain('Could not write safety backup to device storage (OPFS)');
    // CRITICAL: db.open() MUST NOT be called!
    expect(dbOpenSpy).not.toHaveBeenCalled();
    // Version must not be updated to 18
    expect(mockStore['notes_app_schema_version']).toBe('14');
  });

  it('aborts upgrade and surfaces blocking error UI if buildFullBackupEnvelope throws', async () => {
    mockStore['notes_app_schema_version'] = '12';

    const fakeRawDb = {
      version: 12,
      objectStoreNames: ['notes'],
      close: vi.fn(),
    };
    const req: any = { onsuccess: null, onerror: null };
    vi.spyOn(indexedDB, 'open').mockImplementation(() => {
      setTimeout(() => {
        if (req.onsuccess) req.onsuccess({ target: { result: fakeRawDb } });
      }, 0);
      return req;
    });

    vi.spyOn(exportService, 'buildFullBackupEnvelope').mockRejectedValue(
      new Error('Storage corruption detected')
    );
    const dbOpenSpy = vi.spyOn(db, 'open');

    await runPreUpgradeBackupGate();

    const state = getGateState();
    expect(state.isUpgrading).toBe(true);
    expect(state.error).toContain('Storage corruption detected');
    // CRITICAL: db.open() MUST NOT be called!
    expect(dbOpenSpy).not.toHaveBeenCalled();
    expect(mockStore['notes_app_schema_version']).toBe('12');
  });
});
