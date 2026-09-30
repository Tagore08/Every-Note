import { useState, useMemo } from 'react';
import { useAllRoutines, routinesRepo } from '../../db/repos/routinesRepo';
import { useTemplates } from '../../db/repos/templatesRepo';
import { RoutineEditorModal } from './RoutineEditorModal';
import { TemplatePickerSheet } from '../templates/TemplatePickerSheet';
import type { Routine, RoutineTimeOfDay } from '../../types/routine';
import type { Template } from '../../types/template';
import { useSnackbar } from '../../context/SnackbarContext';

const TIME_OF_DAY_SECTIONS: { id: RoutineTimeOfDay; label: string; icon: string; anchor: string }[] = [
  { id: 'morning', label: 'Morning Routines', icon: '🌅', anchor: '09:00' },
  { id: 'afternoon', label: 'Afternoon Routines', icon: '☀️', anchor: '14:00' },
  { id: 'evening', label: 'Evening Wind-Down', icon: '🌙', anchor: '19:00' },
  { id: 'any', label: 'Anytime Routines', icon: '⚡', anchor: '12:00' },
];

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function RoutinesScreen() {
  const { showSnackbar } = useSnackbar();
  const routines = useAllRoutines();
  const routineTemplates = useTemplates('routine');

  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);

  const grouped = useMemo(() => {
    const map: Record<RoutineTimeOfDay, Routine[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      any: [],
    };
    for (const r of routines) {
      if (map[r.timeOfDay]) {
        map[r.timeOfDay].push(r);
      } else {
        map.any.push(r);
      }
    }
    return map;
  }, [routines]);

  const handleToggleActive = async (routine: Routine, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!routine.id) return;
    try {
      await routinesRepo.toggleRoutineActive(routine.id, !routine.active);
      showSnackbar({ message: !routine.active ? 'Routine activated' : 'Routine paused' });
    } catch (err) {
      console.error('Failed to toggle routine active:', err);
    }
  };

  const handleCreateNew = () => {
    setSelectedRoutine(null);
    setIsEditorOpen(true);
  };

  const handleSelectTemplate = async (template: Template) => {
    setIsTemplatePickerOpen(false);
    try {
      const created = await routinesRepo.createRoutineFromTemplate(template);
      setSelectedRoutine(created);
      setIsEditorOpen(true);
      showSnackbar({ message: `Created routine from "${template.name}"` });
    } catch (err) {
      console.error('Failed to create from template:', err);
      showSnackbar({ message: 'Failed to create routine from template' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Subheader Toolbar */}
      <div className="flex flex-row items-center justify-between gap-4 pb-3 border-b border-border">
        <p className="text-xs text-ink-muted">
          Daily checklists materialized into tasks and trackable runs
        </p>

        <div className="flex items-center gap-2">
          {routineTemplates.length > 0 && (
            <button
              type="button"
              onClick={() => setIsTemplatePickerOpen(true)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-surface-2 hover:bg-surface border border-border text-ink transition-colors cursor-pointer min-h-[44px]"
            >
              Templates ({routineTemplates.length})
            </button>
          )}

          <button
            type="button"
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-accent text-accent-ink shadow-xs hover:opacity-90 transition-opacity cursor-pointer min-h-[44px]"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>New Routine</span>
          </button>
        </div>
      </div>

      {/* Routines Grouped by Time of Day */}
      {routines.length === 0 ? (
        <div className="bg-surface border border-dashed border-border rounded-card p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto text-2xl">
            ☀️
          </div>
          <h3 className="text-base font-bold text-ink">No routines created yet</h3>
          <p className="text-xs text-ink-muted max-w-sm mx-auto">
            Build morning startup routines, workouts, or evening wind-downs. Steps materialize into tasks and checkable lists each day.
          </p>
          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-accent text-accent-ink text-xs font-semibold cursor-pointer min-h-[44px]"
          >
            Create your first routine →
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {TIME_OF_DAY_SECTIONS.map((sec) => {
            const list = grouped[sec.id] || [];
            if (list.length === 0) return null;

            return (
              <div key={sec.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{sec.icon}</span>
                    <h2 className="text-sm font-bold text-ink">{sec.label}</h2>
                    <span className="text-[11px] text-ink-muted">· anchor {sec.anchor}</span>
                  </div>
                  <span className="text-xs text-ink-muted font-medium">
                    {list.length} {list.length === 1 ? 'routine' : 'routines'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {list.map((routine) => {
                    const totalSteps = routine.items?.length || 0;
                    const totalDuration = (routine.items || []).reduce(
                      (acc, it) => acc + (it.durationMin || 0),
                      0
                    );

                    return (
                      <div
                        key={routine.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedRoutine(routine);
                          setIsEditorOpen(true);
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer text-left space-y-2.5 ${
                          routine.active
                            ? 'bg-surface border-border hover:border-accent/40 shadow-xs'
                            : 'bg-surface-2/40 border-border/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xl shrink-0">{routine.emoji || '☀️'}</span>
                            <h3 className="font-bold text-sm text-ink truncate">
                              {routine.name}
                            </h3>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleToggleActive(routine, e)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors cursor-pointer shrink-0 min-h-[32px] flex items-center ${
                              routine.active
                                ? 'bg-success/15 text-success hover:bg-success/25'
                                : 'bg-surface-2 text-ink-muted hover:text-ink'
                            }`}
                          >
                            {routine.active ? 'Active' : 'Paused'}
                          </button>
                        </div>

                        {/* Days of week */}
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                            const isIncluded = (routine.daysOfWeek || []).includes(day);
                            return (
                              <span
                                key={day}
                                className={`w-5 h-5 rounded-md text-[9px] font-bold flex items-center justify-center ${
                                  isIncluded
                                    ? 'bg-accent-soft text-accent'
                                    : 'text-ink-muted/40'
                                }`}
                              >
                                {WEEKDAY_SHORT[day][0]}
                              </span>
                            );
                          })}
                        </div>

                        {/* Step count & duration */}
                        <div className="flex items-center justify-between text-[11px] text-ink-muted pt-1 border-t border-border/60">
                          <span>
                            {totalSteps} {totalSteps === 1 ? 'step' : 'steps'}
                            {totalDuration > 0 && ` · ${totalDuration}m`}
                          </span>
                          <span className="text-accent font-medium">Edit →</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Routine Editor Modal */}
      <RoutineEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        routine={selectedRoutine}
      />

      {/* Template Picker */}
      <TemplatePickerSheet
        isOpen={isTemplatePickerOpen}
        onClose={() => setIsTemplatePickerOpen(false)}
        kind="routine"
        onSelectTemplate={handleSelectTemplate}
      />
    </div>
  );
}
