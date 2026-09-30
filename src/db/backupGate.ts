import { useState, useEffect } from 'react';
import { db, TARGET_VERSION } from './database';
import {
  buildFullBackupEnvelope,
  triggerDownload,
  saveBackupToOPFS,
} from './exportService';

export { TARGET_VERSION };

const SCHEMA_VERSION_KEY = 'notes_app_schema_version';

export interface BackupGateStatus {
  isUpgrading: boolean;
  message: string;
  error?: string | null;
}

let gateState: BackupGateStatus = {
  isUpgrading: false,
  message: '',
  error: null,
};

const listeners = new Set<(state: BackupGateStatus) => void>();

function setGateState(newState: Partial<BackupGateStatus>) {
  gateState = { ...gateState, ...newState };
  for (const listener of listeners) {
    listener(gateState);
  }
}

export function getGateState(): BackupGateStatus {
  return gateState;
}

export function resetGateStateForTesting(): void {
  gateState = {
    isUpgrading: false,
    message: '',
    error: null,
  };
}

async function checkRawDb(): Promise<{ exists: boolean; version: number; storeNames: string[] }> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('NotesAppDatabase');
      req.onsuccess = (e: any) => {
        const rawDb = e.target.result as IDBDatabase;
        const version = rawDb.version;
        const storeNames = Array.from(rawDb.objectStoreNames);
        rawDb.close();
        resolve({ exists: storeNames.length > 0, version, storeNames });
      };
      req.onerror = () => {
        resolve({ exists: false, version: 0, storeNames: [] });
      };
    } catch {
      resolve({ exists: false, version: 0, storeNames: [] });
    }
  });
}

export async function runPreUpgradeBackupGate(): Promise<void> {
  const lastSeenStr = localStorage.getItem(SCHEMA_VERSION_KEY);
  const lastSeen = lastSeenStr ? parseInt(lastSeenStr, 10) : 0;

  const rawInfo = await checkRawDb();

  // If DB exists and last-seen or raw DB version is older than target version, back up first
  const isUpgradeNeeded = rawInfo.exists && (lastSeen < TARGET_VERSION || rawInfo.version < TARGET_VERSION);

  if (isUpgradeNeeded) {
    setGateState({
      isUpgrading: true,
      message: 'Upgrading your data — saving a backup first…',
      error: null,
    });

    try {
      // 1. Build backup before running Dexie migration
      let envelope: any;
      try {
        envelope = await buildFullBackupEnvelope();
      } catch (err: any) {
        console.error('Failed to build pre-upgrade backup envelope:', err);
        setGateState({
          isUpgrading: true,
          message: 'Pre-upgrade safety backup failed.',
          error: `Could not build backup envelope: ${err?.message || 'Unknown error'}. Database upgrade aborted to protect your data.`,
        });
        return; // Abort upgrade! Prevent db.open() from running.
      }

      if (!envelope) {
        console.error('Pre-upgrade envelope is empty or undefined');
        setGateState({
          isUpgrading: true,
          message: 'Pre-upgrade safety backup failed.',
          error: 'Backup envelope could not be created. Database upgrade aborted to protect your data.',
        });
        return; // Abort upgrade! Prevent db.open() from running.
      }

      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `pre-upgrade-v${rawInfo.version || lastSeen || 7}-backup-${dateStr}.json`;
      const json = JSON.stringify(envelope, null, 2);

      // 2. Write to OPFS (primary reliable local file store)
      const opfsSaved = await saveBackupToOPFS(json, filename);
      if (!opfsSaved) {
        console.error('Failed to save backup to OPFS');
        setGateState({
          isUpgrading: true,
          message: 'Safety backup could not be stored.',
          error: 'Could not write safety backup to device storage (OPFS). Database upgrade aborted to prevent data loss.',
        });
        return; // Abort upgrade! Prevent db.open() from running.
      }

      // 3. Trigger browser download
      triggerDownload(json, filename);

      // 4. Complete Dexie open and upgrade
      await db.open();

      // 5. Update last-seen schema version
      localStorage.setItem(SCHEMA_VERSION_KEY, String(TARGET_VERSION));
      try {
        await db.appMeta.put({
          key: 'schemaVersion',
          value: TARGET_VERSION,
          updatedAt: Date.now(),
        });
      } catch (e) {
        console.warn('Could not record appMeta schemaVersion:', e);
      }

      setGateState({
        isUpgrading: false,
        message: 'Upgrade complete!',
        error: null,
      });
    } catch (err: any) {
      console.error('Backup gate or upgrade failed:', err);
      setGateState({
        isUpgrading: true,
        message: 'Upgrade encountered an issue.',
        error: err?.message || 'Unknown migration error',
      });
      // Safety: Never attempt fallback db.open() if upgrade/gate threw an error
    }
  } else {
    // Fresh install or already on current version
    localStorage.setItem(SCHEMA_VERSION_KEY, String(TARGET_VERSION));
    await db.open().catch(() => {});
    try {
      await db.appMeta.put({
        key: 'schemaVersion',
        value: TARGET_VERSION,
        updatedAt: Date.now(),
      });
    } catch {
      // db might still be initializing
    }
  }
}

export function useBackupGate() {
  const [state, setState] = useState<BackupGateStatus>(gateState);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
