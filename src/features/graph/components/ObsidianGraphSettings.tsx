import { useState } from 'react';
import {
  Sliders,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Play,
  Pause,
  Plus,
  Trash2,
  Filter,
  Eye,
  Zap,
  Tag,
  Search,
  X,
} from 'lucide-react';
import { DEFAULT_GRAPH_SETTINGS, type GraphPhysicsSettings } from './GraphCanvas';

interface ObsidianGraphSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GraphPhysicsSettings;
  onChange: (settings: GraphPhysicsSettings) => void;
  includeJournals: boolean;
  onIncludeJournalsChange: (val: boolean) => void;
  hideOrphans: boolean;
  onHideOrphansChange: (val: boolean) => void;
}

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
];

export function ObsidianGraphSettings({
  isOpen,
  onClose,
  settings,
  onChange,
  includeJournals,
  onIncludeJournalsChange,
  hideOrphans,
  onHideOrphansChange,
}: ObsidianGraphSettingsProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    filters: true,
    groups: false,
    display: true,
    forces: false,
  });

  const [newGroupQuery, setNewGroupQuery] = useState('');
  const [newGroupColor, setNewGroupColor] = useState(PRESET_COLORS[0]);

  if (!isOpen) return null;

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const updateSetting = <K extends keyof GraphPhysicsSettings>(key: K, val: GraphPhysicsSettings[K]) => {
    onChange({ ...settings, [key]: val });
  };

  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    const query = newGroupQuery.trim();
    if (!query) return;

    const currentGroups = settings.colorGroups || [];
    onChange({
      ...settings,
      colorGroups: [...currentGroups, { query, color: newGroupColor }],
    });
    setNewGroupQuery('');
  };

  const handleRemoveGroup = (index: number) => {
    const currentGroups = settings.colorGroups || [];
    onChange({
      ...settings,
      colorGroups: currentGroups.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="absolute top-16 right-4 z-30 w-80 max-h-[calc(100vh-6rem)] rounded-2xl bg-black/85 backdrop-blur-xl border border-white/15 text-white/90 shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-150 text-xs">
      {/* Settings Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/5">
        <div className="flex items-center gap-2 font-bold text-white text-sm">
          <Sliders className="w-4 h-4 text-accent" />
          <span>Graph Settings</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_GRAPH_SETTINGS)}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Reset forces & display to default"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Sections */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* ── SECTION 1: FILTERS ────────────────────────────────────────── */}
        <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
          <button
            type="button"
            onClick={() => toggleSection('filters')}
            className="w-full px-3 py-2.5 flex items-center justify-between font-bold text-white/80 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-accent" />
              <span>Filters</span>
            </div>
            {openSections.filters ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {openSections.filters && (
            <div className="p-3 pt-1 space-y-3 border-t border-white/10">
              {/* Search filter */}
              <div className="space-y-1">
                <label className="text-[11px] text-white/60 flex items-center gap-1">
                  <Search className="w-3 h-3" />
                  <span>Search file name / tag</span>
                </label>
                <input
                  type="text"
                  placeholder="Filter nodes in graph…"
                  value={settings.searchQuery || ''}
                  onChange={(e) => updateSetting('searchQuery', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white placeholder:text-white/40 focus:outline-hidden focus:border-accent text-xs"
                />
              </div>

              {/* Toggles */}
              <label className="flex items-center justify-between py-1 cursor-pointer">
                <span className="text-white/80">Include daily journals</span>
                <input
                  type="checkbox"
                  checked={includeJournals}
                  onChange={(e) => onIncludeJournalsChange(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between py-1 cursor-pointer">
                <span className="text-white/80">Hide unlinked (orphans)</span>
                <input
                  type="checkbox"
                  checked={hideOrphans}
                  onChange={(e) => onHideOrphansChange(e.target.checked)}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </label>
            </div>
          )}
        </div>

        {/* ── SECTION 2: GROUPS ─────────────────────────────────────────── */}
        <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
          <button
            type="button"
            onClick={() => toggleSection('groups')}
            className="w-full px-3 py-2.5 flex items-center justify-between font-bold text-white/80 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-accent" />
              <span>Groups ({settings.colorGroups?.length || 0})</span>
            </div>
            {openSections.groups ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {openSections.groups && (
            <div className="p-3 pt-1 space-y-3 border-t border-white/10">
              <p className="text-[11px] text-white/60 leading-relaxed">
                Color-code nodes matching tags or title keywords like Obsidian.
              </p>

              {/* Existing Groups */}
              {settings.colorGroups && settings.colorGroups.length > 0 && (
                <div className="space-y-1.5">
                  {settings.colorGroups.map((g, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="font-mono text-[11px]">{g.query}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveGroup(idx)}
                        className="p-1 rounded text-white/40 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Group Form */}
              <form onSubmit={handleAddGroup} className="space-y-2 pt-1">
                <input
                  type="text"
                  placeholder="tag (e.g. #project) or title..."
                  value={newGroupQuery}
                  onChange={(e) => setNewGroupQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white placeholder:text-white/40 focus:outline-hidden text-xs"
                />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewGroupColor(c)}
                        className={`w-4 h-4 rounded-full transition-transform ${
                          newGroupColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={!newGroupQuery.trim()}
                    className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-semibold transition-colors disabled:opacity-40 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* ── SECTION 3: DISPLAY ────────────────────────────────────────── */}
        <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
          <button
            type="button"
            onClick={() => toggleSection('display')}
            className="w-full px-3 py-2.5 flex items-center justify-between font-bold text-white/80 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-accent" />
              <span>Display</span>
            </div>
            {openSections.display ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {openSections.display && (
            <div className="p-3 pt-1 space-y-3 border-t border-white/10">
              <label className="flex items-center justify-between py-1 cursor-pointer">
                <span className="text-white/80">Directional Arrows</span>
                <input
                  type="checkbox"
                  checked={settings.showArrows}
                  onChange={(e) => updateSetting('showArrows', e.target.checked)}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between py-1 cursor-pointer">
                <span className="text-white/80">Show Labels</span>
                <input
                  type="checkbox"
                  checked={settings.showLabels}
                  onChange={(e) => updateSetting('showLabels', e.target.checked)}
                  className="w-4 h-4 rounded accent-accent cursor-pointer"
                />
              </label>

              {/* Node Size slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-white/70 text-[11px]">
                  <span>Node Size</span>
                  <span className="font-mono">{settings.nodeSizeMultiplier.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="2.5"
                  step="0.1"
                  value={settings.nodeSizeMultiplier}
                  onChange={(e) => updateSetting('nodeSizeMultiplier', parseFloat(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>

              {/* Link Thickness slider */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-white/70 text-[11px]">
                  <span>Link Thickness</span>
                  <span className="font-mono">{settings.linkThickness.toFixed(1)}px</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3.5"
                  step="0.1"
                  value={settings.linkThickness}
                  onChange={(e) => updateSetting('linkThickness', parseFloat(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 4: FORCES (Calibrated Physics Controls) ───────────── */}
        <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
          <button
            type="button"
            onClick={() => toggleSection('forces')}
            className="w-full px-3 py-2.5 flex items-center justify-between font-bold text-white/80 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-accent" />
              <span>Forces (Physics)</span>
            </div>
            {openSections.forces ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {openSections.forces && (
            <div className="p-3 pt-1 space-y-3.5 border-t border-white/10">
              {/* Play / Pause Toggle */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-white/80 font-medium">Physics Simulation</span>
                <button
                  type="button"
                  onClick={() => updateSetting('isPaused', !settings.isPaused)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    settings.isPaused
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {settings.isPaused ? (
                    <>
                      <Play className="w-3 h-3" />
                      <span>Paused</span>
                    </>
                  ) : (
                    <>
                      <Pause className="w-3 h-3" />
                      <span>Active</span>
                    </>
                  )}
                </button>
              </div>

              {/* Center Force */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-white/70 text-[11px]">
                  <span>Center Force</span>
                  <span className="font-mono">{Math.round(settings.centerStrength * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="0.4"
                  step="0.02"
                  value={settings.centerStrength}
                  onChange={(e) => updateSetting('centerStrength', parseFloat(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>

              {/* Repel Force */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-white/70 text-[11px]">
                  <span>Repel Force</span>
                  <span className="font-mono">{Math.abs(settings.repelStrength)}</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="400"
                  step="10"
                  value={Math.abs(settings.repelStrength)}
                  onChange={(e) => updateSetting('repelStrength', -parseFloat(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>

              {/* Link Distance */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-white/70 text-[11px]">
                  <span>Link Distance</span>
                  <span className="font-mono">{settings.linkDistance}px</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="220"
                  step="5"
                  value={settings.linkDistance}
                  onChange={(e) => updateSetting('linkDistance', parseInt(e.target.value, 10))}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>

              {/* Link Strength */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-white/70 text-[11px]">
                  <span>Link Force</span>
                  <span className="font-mono">{Math.round(settings.linkStrength * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={settings.linkStrength}
                  onChange={(e) => updateSetting('linkStrength', parseFloat(e.target.value))}
                  className="w-full accent-accent cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
