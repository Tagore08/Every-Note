import { describe, it, expect } from 'vitest';
import type { BackupEnvelope, ExportCanvas } from './exportService';
import type { Note } from '../types/note';
import type { Task } from '../types/task';
import type { Routine } from '../types/routine';
import type { TimerPreset } from '../types/focus';

describe('Export/Import Envelope Round-Trip Completeness Audit (Phase 7)', () => {
  it('covers all v2 data types in full backup envelope specification', () => {
    // 1. Journal Note
    const sampleNote: Note = {
      id: 1,
      title: 'Daily Reflection',
      content: 'Reflecting on [[Project Alpha]].',
      tags: ['reflection'],
      pinned: false,
      archived: false,
      trashedAt: null,
      inbox: false,
      kind: 'journal',
      journalDate: '2026-09-25',
      mood: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 2. Task with Subtask Provenance & Tags
    const sampleTask: Task = {
      id: 2,
      title: 'Launch v2.0 Release',
      status: 'todo',
      priority: 'high',
      dueAt: new Date('2026-09-26T12:00:00Z'),
      completedAt: null,
      parentTaskId: null,
      routineRunId: 10,
      importance: false,
      urgency: false,
      tags: ['work'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 3. Canvas Doc
    const sampleCanvas: ExportCanvas = {
      id: 1,
      title: 'System Diagram',
      doc: {
        version: 1,
        width: 3000,
        height: 2000,
        bg: '#ffffff',
        strokes: [],
      },
      linkedNoteId: 1,
      tags: ['arch'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trashedAt: null,
      thumbBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };

    // 4. Routine & Run
    const sampleRoutine: Routine = {
      id: 5,
      name: 'Evening Wind-down',
      emoji: '🌙',
      daysOfWeek: [1, 2, 3, 4, 5],
      timeOfDay: 'evening',
      items: [{ uid: 'r1', kind: 'custom', title: 'Write reflection', durationMin: 15 }],
      active: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 5. Timer Preset
    const samplePreset: TimerPreset = {
      id: 3,
      name: 'Deep Focus',
      focusMin: 50,
      shortBreakMin: 10,
      longBreakMin: 30,
      cycles: 2,
      autoStartBreaks: true,
      autoStartFocus: false,
      sound: true,
      isDefault: false,
    };

    // Construct full BackupEnvelope
    const envelope: BackupEnvelope = {
      version: 15,
      app: 'notes-app',
      exportedAt: new Date().toISOString(),
      notes: [sampleNote],
      tasks: [sampleTask],
      events: [],
      people: [],
      attachments: [],
      habits: [],
      habitLogs: [],
      focusSessions: [],
      templates: [],
      links: [{ id: 1, sourceId: 1, targetId: null, targetTitle: 'project alpha', context: 'Reflecting on [[Project Alpha]].', createdAt: Date.now() }],
      routines: [sampleRoutine],
      routineRuns: [],
      canvases: [sampleCanvas],
      timerPresets: [samplePreset],
      settings: {
        theme: 'system',
        flags: {
          canvas: true,
          journal: true,
          graph: true,
          routines: true,
          calendarPro: true,
          insights: true,
          focusPro: true,
          habitAnalytics: true,
          smartInbox: true,
        },
      },
    };

    // Verify envelope serialization and deserialization
    const serialized = JSON.stringify(envelope);
    const parsed: BackupEnvelope = JSON.parse(serialized);

    expect(parsed.version).toBe(15);
    expect(parsed.app).toBe('notes-app');
    expect(parsed.notes).toHaveLength(1);
    expect(parsed.notes[0].kind).toBe('journal');
    expect(parsed.notes[0].journalDate).toBe('2026-09-25');
    expect(parsed.notes[0].mood).toBe(5);

    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks?.[0].tags).toContain('work');
    expect(parsed.tasks?.[0].routineRunId).toBe(10);

    expect(parsed.canvases).toHaveLength(1);
    expect(parsed.canvases?.[0].doc.width).toBe(3000);
    expect(parsed.canvases?.[0].thumbBase64).toContain('data:image/png;base64');

    expect(parsed.routines).toHaveLength(1);
    expect(parsed.routines?.[0].name).toBe('Evening Wind-down');

    expect(parsed.timerPresets).toHaveLength(1);
    expect(parsed.timerPresets?.[0].name).toBe('Deep Focus');

    expect(parsed.links).toHaveLength(1);
    expect(parsed.links?.[0].targetTitle).toBe('project alpha');

    expect(parsed.settings?.flags?.focusPro).toBe(true);
  });
});
