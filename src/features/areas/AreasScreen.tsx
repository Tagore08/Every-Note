import { useState } from 'react';
import { useAllAreas, areasRepo } from '../../db/repos/areasRepo';
import { useTagsWithCounts } from '../../db/notesRepo';
import { SectionHeader } from '../../design/ui/SectionHeader';
import { EmptyState } from '../../design/ui/EmptyState';
import { ColorDots } from '../../design/ui/ColorDots';
import { useSnackbar } from '../../context/SnackbarContext';
import type { LifeArea } from '../../types/area';

export function AreasScreen() {
  const allAreas = useAllAreas();
  const allTags = useTagsWithCounts() ?? [];
  const { showSnackbar } = useSnackbar();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<LifeArea | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('var(--area-1, oklch(0.62 0.16 25))');
  const [formIcon, setFormIcon] = useState('Folder');

  const activeAreas = allAreas.filter((a) => !a.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const archivedAreas = allAreas.filter((a) => a.archived).sort((a, b) => a.sortOrder - b.sortOrder);

  const openCreateModal = () => {
    setFormName('');
    setFormColor('var(--area-1, oklch(0.62 0.16 25))');
    setFormIcon('Folder');
    setIsCreateOpen(true);
  };

  const openEditModal = (area: LifeArea) => {
    setEditingArea(area);
    setFormName(area.name);
    setFormColor(area.color);
    setFormIcon(area.icon);
  };

  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (!cleanName) return;

    if (editingArea && editingArea.id) {
      await areasRepo.updateArea(editingArea.id, {
        name: cleanName,
        color: formColor,
        icon: formIcon,
      });
      showSnackbar({ message: `Updated area "${cleanName}"` });
      setEditingArea(null);
    } else {
      await areasRepo.createArea({
        name: cleanName,
        color: formColor,
        icon: formIcon,
        sortOrder: activeAreas.length,
        archived: false,
      });
      showSnackbar({ message: `Created area "${cleanName}"` });
      setIsCreateOpen(false);
    }
  };

  const handleArchive = async (id: number) => {
    await areasRepo.archiveArea(id);
    showSnackbar({ message: 'Area archived' });
  };

  const handleUnarchive = async (id: number) => {
    await areasRepo.unarchiveArea(id);
    showSnackbar({ message: 'Area restored' });
  };

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`Permanently delete "${name}"? Notes and tasks with this area will remain intact.`)) {
      await areasRepo.deleteArea(id);
      showSnackbar({ message: `Deleted area "${name}"` });
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeAreas.length) return;

    const newOrder = [...activeAreas];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const ids = newOrder.map((a) => a.id).filter((id): id is number => typeof id === 'number');
    await areasRepo.reorderAreas(ids);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Life Areas & Tags</h1>
          <p className="text-sm text-ink-muted mt-1">
            Organize tasks, notes, and events by the domains that matter to you.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-accent text-accent-ink text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-card cursor-pointer min-h-[44px]"
        >
          <span>+ Add Area</span>
        </button>
      </div>

      {/* Active Areas List */}
      <div className="space-y-3">
        <SectionHeader
          title="Active Life Areas"
          count={activeAreas.length}
          description="Default & custom domains for tasks, notes, and events."
        />

        {activeAreas.length === 0 ? (
          <EmptyState
            title="No life areas found"
            description="Create your first area to begin organizing your work and personal life."
            action={{
              label: 'Seed defaults',
              onClick: () => areasRepo.seedDefaults(),
            }}
          />
        ) : (
          <div className="rounded-card border border-border bg-surface shadow-card divide-y divide-border overflow-hidden">
            {activeAreas.map((area, index) => (
              <div
                key={area.id}
                className="flex items-center justify-between p-3.5 sm:px-5 hover:bg-surface-2 transition-colors min-h-[52px]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: area.color }}
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{area.name}</h3>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Reorder Up/Down */}
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                    className="p-2 text-ink-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none rounded cursor-pointer transition-colors"
                    title="Move up"
                    aria-label="Move up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    disabled={index === activeAreas.length - 1}
                    onClick={() => handleMove(index, 'down')}
                    className="p-2 text-ink-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none rounded cursor-pointer transition-colors"
                    title="Move down"
                    aria-label="Move down"
                  >
                    ▼
                  </button>

                  {/* Edit */}
                  <button
                    type="button"
                    onClick={() => openEditModal(area)}
                    className="px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-soft rounded transition-colors cursor-pointer"
                  >
                    Edit
                  </button>

                  {/* Archive */}
                  <button
                    type="button"
                    onClick={() => area.id && handleArchive(area.id)}
                    className="px-2.5 py-1 text-xs font-semibold text-ink-muted hover:text-ink rounded transition-colors cursor-pointer"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Archived Areas (Collapsible) */}
      {archivedAreas.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border">
          <SectionHeader
            title="Archived Areas"
            count={archivedAreas.length}
            description="Hidden from pickers, but past records retain their tags."
          />
          <div className="rounded-card border border-border bg-surface shadow-card divide-y divide-border overflow-hidden opacity-80">
            {archivedAreas.map((area) => (
              <div
                key={area.id}
                className="flex items-center justify-between p-3.5 sm:px-5 hover:bg-surface-2 transition-colors min-h-[52px]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 opacity-50"
                    style={{ backgroundColor: area.color }}
                  />
                  <span className="text-sm font-medium text-ink-muted line-through">{area.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => area.id && handleUnarchive(area.id)}
                    className="px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-soft rounded transition-colors cursor-pointer"
                  >
                    Unarchive
                  </button>
                  <button
                    type="button"
                    onClick={() => area.id && handleDelete(area.id, area.name)}
                    className="px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/10 rounded transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags Section */}
      <div className="space-y-3 pt-4 border-t border-border">
        <SectionHeader
          title="Tags"
          count={allTags?.length ?? 0}
          description="Tags used across your notes and tasks."
        />
        <div className="flex flex-wrap gap-2">
          {(!allTags || allTags.length === 0) ? (
            <p className="text-xs text-ink-muted">No tags created yet. Type #tag in any note or task.</p>
          ) : (
            allTags.map(({ tag, count }) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-surface border border-border text-ink shadow-xs"
              >
                <span className="text-ink-muted">#</span>
                <span>{tag}</span>
                <span className="text-[10px] text-ink-muted/70 font-mono">({count})</span>
              </span>
            ))
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {(isCreateOpen || editingArea) && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
          onClick={() => {
            setIsCreateOpen(false);
            setEditingArea(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-surface border border-border p-6 shadow-float space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">
                {editingArea ? 'Edit Life Area' : 'New Life Area'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditingArea(null);
                }}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveArea} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Health, Finance, Projects"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Color Palette
                </label>
                <ColorDots
                  selectedColor={formColor}
                  onChange={(col) => setFormColor(col)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingArea(null);
                  }}
                  className="px-4 py-2 rounded-pill text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-pill bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-all shadow-card cursor-pointer min-h-[44px]"
                >
                  {editingArea ? 'Save Changes' : 'Create Area'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default AreasScreen;
