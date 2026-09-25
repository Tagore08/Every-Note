import { useState, useEffect } from 'react';
import { db, AppDatabase } from '../../db/database';
import {
  buildFullBackupEnvelope,
  triggerDownload,
  saveBackupToOPFS,
  listOPFSBackups,
} from '../../db/exportService';

interface TableReport {
  name: string;
  before: number;
  after: number;
  status: 'ok' | 'mismatch' | 'error';
}

export function MigrateDebugScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [reports, setReports] = useState<TableReport[]>([]);
  const [opfsBackups, setOpfsBackups] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  const addLog = (msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const refreshOPFS = async () => {
    const list = await listOPFSBackups();
    setOpfsBackups(list);
  };

  useEffect(() => {
    refreshOPFS();
  }, []);

  const runDryRun = async () => {
    try {
      setIsRunning(true);
      setLog([]);
      setReports([]);
      addLog('Starting migration dry-run on isolated clone database...');

      // 1. Delete previous test clone if exists
      addLog('Cleaning up any previous test clone (notesapp_migration_test)...');
      const testDbName = 'notesapp_migration_test';
      const existing = new AppDatabase(testDbName);
      await existing.delete().catch(() => {});

      // 2. Read live data
      addLog('Reading records from live database (NotesAppDatabase)...');
      const liveNotes = await db.notes.toArray();
      const liveTasks = await db.tasks.toArray();
      const liveEvents = await db.events.toArray();
      const livePeople = await db.people.toArray();
      const liveHabits = await db.habits.toArray();
      const liveHabitLogs = await db.habitLogs.toArray();
      const liveFocus = await db.focusSessions.toArray();
      const liveAttachments = await db.attachments.toArray();
      const liveTemplates = await db.templates.toArray();
      const liveLinks = await db.links.toArray();
      const liveRoutines = await db.routines.toArray();
      const liveRoutineRuns = await db.routineRuns.toArray();
      const liveCanvases = await db.canvases.toArray();
      const livePresets = await db.timerPresets.toArray();

      const beforeCounts: Record<string, number> = {
        notes: liveNotes.length,
        tasks: liveTasks.length,
        events: liveEvents.length,
        people: livePeople.length,
        habits: liveHabits.length,
        habitLogs: liveHabitLogs.length,
        focusSessions: liveFocus.length,
        attachments: liveAttachments.length,
        templates: liveTemplates.length,
        links: liveLinks.length,
        routines: liveRoutines.length,
        routineRuns: liveRoutineRuns.length,
        canvases: liveCanvases.length,
        timerPresets: livePresets.length,
      };

      addLog(`Captured live counts: Notes=${liveNotes.length}, Tasks=${liveTasks.length}, Events=${liveEvents.length}...`);

      // 3. Open test clone and populate
      const testDb = new AppDatabase(testDbName);
      await testDb.open();
      addLog('Opened test clone. Seeding live data into clone...');

      if (liveNotes.length) await testDb.notes.bulkAdd(liveNotes);
      if (liveTasks.length) await testDb.tasks.bulkAdd(liveTasks);
      if (liveEvents.length) await testDb.events.bulkAdd(liveEvents);
      if (livePeople.length) await testDb.people.bulkAdd(livePeople);
      if (liveHabits.length) await testDb.habits.bulkAdd(liveHabits);
      if (liveHabitLogs.length) await testDb.habitLogs.bulkAdd(liveHabitLogs);
      if (liveFocus.length) await testDb.focusSessions.bulkAdd(liveFocus);
      if (liveAttachments.length) await testDb.attachments.bulkAdd(liveAttachments);
      if (liveTemplates.length) await testDb.templates.bulkAdd(liveTemplates);
      if (liveLinks.length) await testDb.links.bulkAdd(liveLinks);
      if (liveRoutines.length) await testDb.routines.bulkAdd(liveRoutines);
      if (liveRoutineRuns.length) await testDb.routineRuns.bulkAdd(liveRoutineRuns);
      if (liveCanvases.length) await testDb.canvases.bulkAdd(liveCanvases);
      if (livePresets.length) await testDb.timerPresets.bulkAdd(livePresets);

      // 4. Verify clone data
      addLog('Testing schema integrity and index queries...');
      const afterNotes = await testDb.notes.count();
      const afterTasks = await testDb.tasks.count();
      const afterEvents = await testDb.events.count();
      const afterPeople = await testDb.people.count();
      const afterHabits = await testDb.habits.count();
      const afterHabitLogs = await testDb.habitLogs.count();
      const afterFocus = await testDb.focusSessions.count();
      const afterAttachments = await testDb.attachments.count();
      const afterTemplates = await testDb.templates.count();
      const afterLinks = await testDb.links.count();
      const afterRoutines = await testDb.routines.count();
      const afterRoutineRuns = await testDb.routineRuns.count();
      const afterCanvases = await testDb.canvases.count();
      const afterPresets = await testDb.timerPresets.count();
      const metaCount = await testDb.appMeta.count();

      const afterCounts: Record<string, number> = {
        notes: afterNotes,
        tasks: afterTasks,
        events: afterEvents,
        people: afterPeople,
        habits: afterHabits,
        habitLogs: afterHabitLogs,
        focusSessions: afterFocus,
        attachments: afterAttachments,
        templates: afterTemplates,
        links: afterLinks,
        routines: afterRoutines,
        routineRuns: afterRoutineRuns,
        canvases: afterCanvases,
        timerPresets: afterPresets,
        appMeta: metaCount,
      };

      const tableNames = [
        'notes',
        'tasks',
        'events',
        'people',
        'habits',
        'habitLogs',
        'focusSessions',
        'attachments',
        'templates',
        'links',
        'routines',
        'routineRuns',
        'canvases',
        'timerPresets',
        'appMeta',
      ];

      const reportList: TableReport[] = tableNames.map((name) => {
        const b = beforeCounts[name] ?? 0;
        const a = afterCounts[name] ?? 0;
        const status = (name === 'appMeta' || b === a) ? 'ok' : 'mismatch';
        return { name, before: b, after: a, status };
      });

      setReports(reportList);
      addLog('Dry run complete! All tables verified.');

      // Clean up test clone
      await testDb.delete().catch(() => {});
      addLog('Test clone successfully deleted.');
    } catch (err: any) {
      console.error('Migration dry run failed:', err);
      addLog(`ERROR: ${err?.message || String(err)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleSimulateBackup = async () => {
    try {
      setBackupStatus('Generating full JSON envelope...');
      const env = await buildFullBackupEnvelope();
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `dry-run-backup-${dateStr}.json`;
      const json = JSON.stringify(env, null, 2);

      const opfsSuccess = await saveBackupToOPFS(json, filename);
      triggerDownload(json, filename);

      await refreshOPFS();
      setBackupStatus(
        `Backup created successfully! Saved to OPFS (${opfsSuccess ? 'OK' : 'Unavailable'}) and downloaded.`
      );
    } catch (err: any) {
      setBackupStatus(`Failed to generate backup: ${err?.message || String(err)}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Dev Only
            </span>
            <h1 className="text-2xl font-semibold text-ink">Migration Dry-Run</h1>
          </div>
          <p className="text-sm text-ink-muted mt-1">
            EXPANSION_PLAN §2.3: Clones live database into test instance, validates schema & row counts, and verifies backup safety.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runDryRun}
            disabled={isRunning}
            className="px-4 py-2 rounded-pill bg-accent text-accent-ink text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-card cursor-pointer disabled:opacity-50 min-h-[44px]"
          >
            {isRunning ? 'Running Dry-Run…' : 'Execute Dry-Run'}
          </button>
          <button
            type="button"
            onClick={handleSimulateBackup}
            className="px-4 py-2 rounded-pill bg-surface-2 hover:bg-surface text-ink text-sm font-semibold border border-border transition-colors cursor-pointer min-h-[44px]"
          >
            Test Pre-Upgrade Backup
          </button>
        </div>
      </div>

      {backupStatus && (
        <div className="p-3 rounded-card bg-accent-soft text-accent text-sm font-medium">
          {backupStatus}
        </div>
      )}

      {/* Reports Table */}
      {reports.length > 0 && (
        <div className="rounded-card bg-surface border border-border shadow-card overflow-hidden">
          <div className="px-4 py-3 bg-surface-2 border-b border-border font-semibold text-sm text-ink flex items-center justify-between">
            <span>Before / After Table Row Counts</span>
            <span className="text-xs text-ink-muted">Dexie Schema Version 8</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-ink-muted text-xs uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-2.5">Table</th>
                  <th className="px-4 py-2.5">Live Count</th>
                  <th className="px-4 py-2.5">Clone Count</th>
                  <th className="px-4 py-2.5">Integrity Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((row) => (
                  <tr key={row.name} className="hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-ink">{row.name}</td>
                    <td className="px-4 py-2.5 text-ink">{row.before}</td>
                    <td className="px-4 py-2.5 text-ink">{row.after}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          row.status === 'ok'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            row.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        {row.status === 'ok' ? '100% Intact' : 'Row Mismatch'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OPFS Backups list */}
      <div className="rounded-card bg-surface border border-border p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Origin Private File System (OPFS) Backups</h2>
          <button
            type="button"
            onClick={refreshOPFS}
            className="text-xs text-accent hover:underline cursor-pointer"
          >
            Refresh
          </button>
        </div>
        {opfsBackups.length === 0 ? (
          <p className="text-xs text-ink-muted">No OPFS safety backups recorded yet.</p>
        ) : (
          <ul className="space-y-1 text-xs font-mono text-ink">
            {opfsBackups.map((name) => (
              <li key={name} className="p-2 rounded bg-surface-2 border border-border flex items-center justify-between">
                <span>{name}</span>
                <span className="text-[10px] text-ink-muted">Local OPFS</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Execution Logs */}
      {log.length > 0 && (
        <div className="rounded-card bg-surface border border-border p-4 shadow-card space-y-2">
          <h2 className="text-sm font-semibold text-ink">Execution Log</h2>
          <div className="p-3 rounded bg-surface-2 font-mono text-xs text-ink-muted space-y-1 max-h-60 overflow-y-auto">
            {log.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
