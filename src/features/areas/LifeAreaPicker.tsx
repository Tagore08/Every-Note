import { useState, useRef, useEffect } from 'react';
import { useActiveAreas, useArea } from '../../db/repos/areasRepo';

interface LifeAreaPickerProps {
  selectedAreaId?: number | null;
  value?: number | null;
  onSelect?: (areaId: number | null) => void;
  onChange?: (areaId: number | null) => void;
  className?: string;
  allowClear?: boolean;
  compact?: boolean;
}

export function LifeAreaPicker({
  selectedAreaId,
  value,
  onSelect,
  onChange,
  className = '',
  allowClear = true,
  compact = false,
}: LifeAreaPickerProps) {
  const currentAreaId = value !== undefined ? value : selectedAreaId;
  const handleSelectArea = (areaId: number | null) => {
    onSelect?.(areaId);
    onChange?.(areaId);
  };
  const [isOpen, setIsOpen] = useState(false);
  const areas = useActiveAreas();
  const selectedArea = useArea(currentAreaId);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      {selectedArea ? (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-border bg-surface text-ink transition-colors shadow-xs">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: selectedArea.color }}
          />
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="hover:underline cursor-pointer truncate max-w-[120px]"
            title={`Life Area: ${selectedArea.name}`}
          >
            {selectedArea.name}
          </button>
          {allowClear && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelectArea(null);
                setIsOpen(false);
              }}
              className="text-ink-muted hover:text-ink p-0.5 rounded cursor-pointer transition-colors"
              title="Remove Life Area"
              aria-label="Remove Life Area"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border hover:border-accent text-xs font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer min-h-[36px] ${
            compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
          }`}
          title="Assign Life Area"
        >
          <span className="w-2 h-2 rounded-full bg-ink-muted/40 shrink-0" />
          <span>+ Area</span>
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-48 rounded-xl bg-surface border border-border shadow-float z-50 py-1.5 animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto">
          <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Life Areas
          </div>

          {allowClear && selectedArea && (
            <button
              type="button"
              onClick={() => {
                handleSelectArea(null);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-ink-muted hover:bg-surface-2 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <span className="w-2 h-2 rounded-full border border-border shrink-0" />
              <span>None (Clear)</span>
            </button>
          )}

          {areas.map((area) => {
            const isSelected = currentAreaId === area.id;
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => {
                  if (typeof area.id === 'number') {
                    handleSelectArea(area.id);
                  }
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  isSelected ? 'bg-accent/10 font-semibold text-accent' : 'text-ink hover:bg-surface-2'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: area.color }}
                  />
                  <span className="truncate">{area.name}</span>
                </div>
                {isSelected && (
                  <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
