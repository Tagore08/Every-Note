import { useLiveQuery } from 'dexie-react-hooks';
import { areasRepo } from '../../../db/repos/areasRepo';
import { notesRepo } from '../../../db/notesRepo';
import { Sheet } from '../../../design/ui/Sheet';
import type { GraphFilterOptions } from '../lib/graphData';

export interface GraphFiltersSheetProps {
  isOpen: boolean;
  onClose: () => void;
  filters: GraphFilterOptions;
  onChange: (next: GraphFilterOptions) => void;
  totalNodes: number;
  isCapped: boolean;
}

export function GraphFiltersSheet({
  isOpen,
  onClose,
  filters,
  onChange,
  totalNodes,
  isCapped,
}: GraphFiltersSheetProps) {
  const areas = useLiveQuery(() => areasRepo.getActiveAreas()) || [];
  const tagsWithCounts = useLiveQuery(() => notesRepo.getAllTagsWithCounts()) || [];

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Graph Filters">
      <div className="space-y-6 pb-6">
        {/* Dataset Cap Notice */}
        {isCapped && (
          <div className="p-3 rounded-2xl bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs text-[var(--color-ink-muted)]">
            Showing top <span className="font-semibold text-[var(--color-ink)]">500</span> nodes by link degree ({totalNodes} total matching notes).
          </div>
        )}

        {/* Toggles */}
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-2xl bg-[var(--color-surface-2)] cursor-pointer">
            <div>
              <div className="text-sm font-medium text-[var(--color-ink)]">Include Journal Entries</div>
              <div className="text-xs text-[var(--color-ink-muted)]">Show daily journal reflections in graph</div>
            </div>
            <input
              type="checkbox"
              checked={filters.includeJournals}
              onChange={(e) => onChange({ ...filters, includeJournals: e.target.checked })}
              className="w-5 h-5 rounded-md accent-[var(--color-accent)] cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-2xl bg-[var(--color-surface-2)] cursor-pointer">
            <div>
              <div className="text-sm font-medium text-[var(--color-ink)]">Hide Unlinked Notes (Orphans)</div>
              <div className="text-xs text-[var(--color-ink-muted)]">Only display nodes with at least 1 connection</div>
            </div>
            <input
              type="checkbox"
              checked={filters.hideOrphans}
              onChange={(e) => onChange({ ...filters, hideOrphans: e.target.checked })}
              className="w-5 h-5 rounded-md accent-[var(--color-accent)] cursor-pointer"
            />
          </label>
        </div>

        {/* Life Area Filter */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] mb-2">
            Filter by Life Area
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...filters, lifeAreaId: null })}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filters.lifeAreaId === null || filters.lifeAreaId === undefined
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-ink)] hover:opacity-80'
              }`}
            >
              All Areas
            </button>
            {areas.map((area) => (
              <button
                key={area.id}
                type="button"
                onClick={() => onChange({ ...filters, lifeAreaId: area.id })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  filters.lifeAreaId === area.id
                    ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-ink)] hover:opacity-80'
                }`}
              >
                <span>{area.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tags Filter */}
        {tagsWithCounts.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] mb-2">
              Filter by Tag
            </div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              <button
                type="button"
                onClick={() => onChange({ ...filters, tag: null })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  !filters.tag
                    ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-ink)] hover:opacity-80'
                }`}
              >
                All Tags
              </button>
              {tagsWithCounts.map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onChange({ ...filters, tag: filters.tag === tag ? null : tag })}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    filters.tag === tag
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-ink)]'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-ink)] hover:opacity-80'
                  }`}
                >
                  #{tag} ({count})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
