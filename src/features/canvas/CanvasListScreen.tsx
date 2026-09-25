import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { canvasRepo } from '../../db/repos/canvasRepo';
import { areasRepo } from '../../db/repos/areasRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import { FAB } from '../../design/ui/FAB';
import { EmptyState } from '../../design/ui/EmptyState';
import type { CanvasEntity } from '../../types/canvas';
import type { LifeArea } from '../../types/area';

export function CanvasListScreen() {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const [canvases, setCanvases] = useState<CanvasEntity[]>([]);
  const [trashedCanvases, setTrashedCanvases] = useState<CanvasEntity[]>([]);
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([]);
  const [activeAreaId, setActiveAreaId] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Object URLs map to revoke on unmount or updates
  const objectUrlsRef = useRef<Map<number, string>>(new Map());

  // Load data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [active, trashed, areas] = await Promise.all([
        canvasRepo.getAllCanvases(false),
        canvasRepo.getTrashedCanvases(),
        areasRepo.getAllAreas(),
      ]);
      setCanvases(active);
      setTrashedCanvases(trashed);
      setLifeAreas(areas);
    } catch (err) {
      console.error('Failed to load canvases:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Manage thumbnail object URLs with explicit revocation
  const thumbUrlMap = useMemo(() => {
    // Revoke previous URLs not present or updated
    const newMap = new Map<number, string>();
    const currentList = showTrash ? trashedCanvases : canvases;

    for (const c of currentList) {
      if (c.id && c.thumbBlob) {
        const existing = objectUrlsRef.current.get(c.id);
        if (existing) {
          newMap.set(c.id, existing);
        } else {
          const url = URL.createObjectURL(c.thumbBlob);
          newMap.set(c.id, url);
        }
      }
    }

    // Revoke any orphaned URLs
    for (const [id, url] of objectUrlsRef.current.entries()) {
      if (!newMap.has(id)) {
        URL.revokeObjectURL(url);
      }
    }

    objectUrlsRef.current = newMap;
    return newMap;
  }, [canvases, trashedCanvases, showTrash]);

  // Clean up all object URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current.clear();
    };
  }, []);

  const handleCreateNew = async () => {
    try {
      const created = await canvasRepo.createCanvas({
        title: 'Untitled drawing',
        lifeAreaId: typeof activeAreaId === 'number' ? activeAreaId : null,
      });
      navigate(`/canvas/${created.id}`);
    } catch (err) {
      console.error('Failed to create canvas:', err);
      showSnackbar({ message: 'Failed to create canvas.' });
    }
  };

  const handleTrash = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await canvasRepo.trashCanvas(id);
      await loadData();
      showSnackbar({ message: 'Canvas moved to Trash.' });
    } catch (err) {
      console.error('Failed to trash canvas:', err);
    }
  };

  const handleRestore = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    try {
      await canvasRepo.restoreCanvas(id);
      await loadData();
      showSnackbar({ message: 'Canvas restored.' });
    } catch (err) {
      console.error('Failed to restore canvas:', err);
    }
  };

  const handleDeletePermanently = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('Delete this canvas permanently? This cannot be undone.')) {
      return;
    }
    try {
      await canvasRepo.deleteCanvasPermanently(id);
      await loadData();
      showSnackbar({ message: 'Canvas deleted permanently.' });
    } catch (err) {
      console.error('Failed to delete canvas:', err);
    }
  };

  // Filtered list
  const displayedCanvases = useMemo(() => {
    const list = showTrash ? trashedCanvases : canvases;
    return list.filter((c) => {
      // Area filter
      if (activeAreaId !== 'all' && c.lifeAreaId !== activeAreaId) {
        return false;
      }
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesTags = c.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesTags) return false;
      }
      return true;
    });
  }, [canvases, trashedCanvases, showTrash, activeAreaId, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink flex items-center gap-2">
            <svg className="w-7 h-7 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
            </svg>
            Canvas &amp; Ink
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            Freeform pressure-sensitive sketches, diagrams, and notes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Trash Toggle */}
          <button
            type="button"
            onClick={() => setShowTrash(!showTrash)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5 ${
              showTrash
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                : 'bg-surface border-border text-ink-muted hover:text-ink'
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            {showTrash ? 'Active Drawings' : `Trash (${trashedCanvases.length})`}
          </button>

          {!showTrash && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>New Drawing</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Row: Search & Life Area Chips */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search drawings by title or tags…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-card bg-surface border border-border text-ink text-sm placeholder:text-ink-muted focus:outline-hidden focus:border-accent transition-colors"
          />
        </div>

        {/* Life Area Chips */}
        {lifeAreas.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveAreaId('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                activeAreaId === 'all'
                  ? 'bg-ink text-surface'
                  : 'bg-surface-2 text-ink-muted hover:text-ink border border-border'
              }`}
            >
              All Areas
            </button>
            {lifeAreas.map((area) => {
              const isSelected = activeAreaId === area.id;
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setActiveAreaId(isSelected ? 'all' : area.id!)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-accent/15 border-accent text-accent'
                      : 'bg-surface-2 text-ink-muted hover:text-ink border-border'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: area.color }}
                  />
                  <span>{area.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid of Canvases */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 rounded-card bg-surface-2 animate-pulse border border-border" />
          ))}
        </div>
      ) : displayedCanvases.length === 0 ? (
        <EmptyState
          title={showTrash ? 'Trash is empty' : 'No drawings yet'}
          description={
            showTrash
              ? 'Deleted drawings appear here and can be restored anytime.'
              : 'Drawings, sketches, and visual ideas will show up here.'
          }
          action={
            showTrash
              ? undefined
              : {
                  label: 'Start Drawing',
                  onClick: handleCreateNew,
                }
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedCanvases.map((c) => {
            const thumbUrl = c.id ? thumbUrlMap.get(c.id) : undefined;
            const area = lifeAreas.find((a) => a.id === c.lifeAreaId);

            return (
              <div
                key={c.id}
                onClick={() => {
                  if (!showTrash) navigate(`/canvas/${c.id}`);
                }}
                className={`group rounded-card border border-border bg-surface hover:border-accent/40 shadow-card transition-all duration-fast overflow-hidden flex flex-col ${
                  !showTrash ? 'cursor-pointer hover:-translate-y-0.5' : ''
                }`}
              >
                {/* Thumbnail Header */}
                <div className="relative aspect-16/10 bg-slate-900/5 dark:bg-black/40 overflow-hidden flex items-center justify-center border-b border-border/60">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={c.title}
                      className="w-full h-full object-cover transition-transform duration-normal group-hover:scale-102"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-ink-muted">
                      <svg className="w-10 h-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                        <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                        <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                      </svg>
                      <span className="text-xs opacity-60">Canvas (3000 × 2000)</span>
                    </div>
                  )}

                  {/* Stroke count chip */}
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-xs text-white text-[10px] font-medium">
                    {c.doc.strokes.length} {c.doc.strokes.length === 1 ? 'stroke' : 'strokes'}
                  </span>
                </div>

                {/* Card Details */}
                <div className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {area && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: area.color }}
                          title={area.name}
                        />
                      )}
                      <h3 className="font-semibold text-sm text-ink truncate group-hover:text-accent transition-colors">
                        {c.title || 'Untitled drawing'}
                      </h3>
                    </div>
                    <p className="text-xs text-ink-muted mt-1">
                      {new Date(c.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    {showTrash ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => handleRestore(e, c.id!)}
                          className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                          title="Restore drawing"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeletePermanently(e, c.id!)}
                          className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                          title="Delete permanently"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleTrash(e, c.id!)}
                        className="p-1.5 rounded-lg text-ink-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                        title="Move to Trash"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button on mobile */}
      {!showTrash && (
        <div className="fixed bottom-20 right-4 z-30 md:hidden">
          <FAB
            onClick={handleCreateNew}
            icon={
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            }
            ariaLabel="New Drawing"
          />
        </div>
      )}
    </div>
  );
}
