import { useState } from 'react';
import { Sheet } from '../../design/ui/Sheet';
import { useFocusTimer } from './FocusTimerContext';
import { timerPresetsRepo } from '../../db/repos/timerPresetsRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import type { TimerPreset } from '../../types/focus';

export interface PresetsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PresetsSheet({ isOpen, onClose }: PresetsSheetProps) {
  const { presets, preset: activePreset, selectPreset, refreshPresets } = useFocusTimer();
  const { showSnackbar } = useSnackbar();

  const [editingPreset, setEditingPreset] = useState<TimerPreset | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [focusMin, setFocusMin] = useState(25);
  const [shortBreakMin, setShortBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [cycles, setCycles] = useState(4);
  const [autoStartBreaks, setAutoStartBreaks] = useState(true);
  const [autoStartFocus, setAutoStartFocus] = useState(false);
  const [sound, setSound] = useState(true);

  const openEdit = (p: TimerPreset) => {
    setEditingPreset(p);
    setFormName(p.name);
    setFocusMin(p.focusMin);
    setShortBreakMin(p.shortBreakMin);
    setLongBreakMin(p.longBreakMin);
    setCycles(p.cycles);
    setAutoStartBreaks(p.autoStartBreaks);
    setAutoStartFocus(p.autoStartFocus);
    setSound(p.sound);
    setIsCreating(false);
  };

  const openCreate = () => {
    setEditingPreset(null);
    setFormName('Custom Preset');
    setFocusMin(30);
    setShortBreakMin(5);
    setLongBreakMin(20);
    setCycles(4);
    setAutoStartBreaks(true);
    setAutoStartFocus(false);
    setSound(true);
    setIsCreating(true);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) return;

    if (editingPreset && editingPreset.id) {
      await timerPresetsRepo.update(editingPreset.id, {
        name: cleanName,
        focusMin,
        shortBreakMin,
        longBreakMin,
        cycles,
        autoStartBreaks,
        autoStartFocus,
        sound,
      });
      showSnackbar({ message: `Updated preset "${cleanName}"` });
    } else {
      const created = await timerPresetsRepo.create({
        name: cleanName,
        focusMin,
        shortBreakMin,
        longBreakMin,
        cycles,
        autoStartBreaks,
        autoStartFocus,
        sound,
        isDefault: false,
      });
      showSnackbar({ message: `Created preset "${cleanName}"` });
      selectPreset(created);
    }

    await refreshPresets();
    setEditingPreset(null);
    setIsCreating(false);
  };

  const handleDuplicate = async (p: TimerPreset) => {
    if (!p.id) return;
    const duplicated = await timerPresetsRepo.duplicate(p.id);
    if (duplicated) {
      showSnackbar({ message: `Duplicated "${p.name}"` });
      await refreshPresets();
    }
  };

  const handleSetDefault = async (p: TimerPreset) => {
    if (!p.id) return;
    await timerPresetsRepo.setDefault(p.id);
    showSnackbar({ message: `"${p.name}" is now the default preset` });
    await refreshPresets();
  };

  const handleDelete = async (p: TimerPreset) => {
    if (!p.id) return;
    if (presets.length <= 1) {
      showSnackbar({ message: 'Cannot delete the only preset' });
      return;
    }
    await timerPresetsRepo.delete(p.id);
    showSnackbar({ message: `Deleted "${p.name}"` });
    await refreshPresets();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={() => {
        setEditingPreset(null);
        setIsCreating(false);
        onClose();
      }}
      title={isCreating ? 'New Preset' : editingPreset ? 'Edit Preset' : 'Timer Presets'}
      description={
        isCreating || editingPreset
          ? 'Customize interval lengths and cycle behavior'
          : 'Choose a focus preset or customize intervals'
      }
    >
      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {isCreating || editingPreset ? (
          <form onSubmit={handleSaveForm} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
                Preset Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-card bg-surface-2 border border-border text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Focus (min)</label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={focusMin}
                  onChange={(e) => setFocusMin(Math.max(1, Number(e.target.value)))}
                  className="w-full px-2.5 py-1.5 text-sm rounded-card bg-surface-2 border border-border text-ink"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Short Break</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={shortBreakMin}
                  onChange={(e) => setShortBreakMin(Math.max(1, Number(e.target.value)))}
                  className="w-full px-2.5 py-1.5 text-sm rounded-card bg-surface-2 border border-border text-ink"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1">Long Break</label>
                <input
                  type="number"
                  min="0"
                  max="90"
                  value={longBreakMin}
                  onChange={(e) => setLongBreakMin(Math.max(0, Number(e.target.value)))}
                  className="w-full px-2.5 py-1.5 text-sm rounded-card bg-surface-2 border border-border text-ink"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1">
                Cycles before long break ({cycles})
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={cycles}
                onChange={(e) => setCycles(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            <div className="space-y-2 pt-1 border-t border-border">
              <label className="flex items-center justify-between text-xs text-ink cursor-pointer py-1">
                <span>Auto-start breaks</span>
                <input
                  type="checkbox"
                  checked={autoStartBreaks}
                  onChange={(e) => setAutoStartBreaks(e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-ink cursor-pointer py-1">
                <span>Auto-start focus after break</span>
                <input
                  type="checkbox"
                  checked={autoStartFocus}
                  onChange={(e) => setAutoStartFocus(e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
              </label>
              <label className="flex items-center justify-between text-xs text-ink cursor-pointer py-1">
                <span>Completion chime (WebAudio)</span>
                <input
                  type="checkbox"
                  checked={sound}
                  onChange={(e) => setSound(e.target.checked)}
                  className="rounded text-accent focus:ring-accent"
                />
              </label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingPreset(null);
                  setIsCreating(false);
                }}
                className="flex-1 py-2 rounded-pill font-medium text-xs bg-surface-2 border border-border text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-pill font-semibold text-xs bg-accent text-accent-ink"
              >
                Save Preset
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2.5">
            {presets.map((p) => {
              const isActive = activePreset.id === p.id;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-card border transition-all ${
                    isActive
                      ? 'bg-accent-soft/40 border-accent/40'
                      : 'bg-surface-2/60 border-border hover:bg-surface-2'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        selectPreset(p);
                        onClose();
                      }}
                      className="text-left flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-sm text-ink">{p.name}</span>
                        {p.isDefault && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
                            Default
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-ink text-surface">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {p.focusMin}m focus · {p.shortBreakMin}m break · {p.cycles} cycles
                        {p.longBreakMin > 0 ? ` (${p.longBreakMin}m long break)` : ''}
                      </p>
                    </button>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="px-2 py-1 text-xs font-medium rounded-pill bg-surface text-ink border border-border hover:bg-surface-2"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(p)}
                        className="px-2 py-1 text-xs font-medium rounded-pill bg-surface text-ink border border-border hover:bg-surface-2"
                        title="Duplicate preset"
                      >
                        Copy
                      </button>
                      {!p.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(p)}
                          className="px-2 py-1 text-[11px] font-medium rounded-pill bg-surface text-ink-muted border border-border hover:text-ink"
                          title="Make default"
                        >
                          Default
                        </button>
                      )}
                      {presets.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          className="px-2 py-1 text-xs font-medium rounded-pill text-danger hover:bg-danger/10"
                          title="Delete preset"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={openCreate}
              className="w-full py-2.5 rounded-pill font-semibold text-xs border border-dashed border-border text-ink-muted hover:text-ink hover:border-ink/40 transition-colors"
            >
              + Create Custom Preset
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
