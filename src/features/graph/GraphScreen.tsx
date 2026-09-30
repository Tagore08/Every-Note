import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sliders, Filter, Sparkles } from 'lucide-react';
import { useAllGraphData } from '../../db/repos/linksRepo';
import { buildGlobalGraph, buildLocalGraph, type GraphFilterOptions, type GraphNode } from './lib/graphData';
import { GraphCanvas, DEFAULT_GRAPH_SETTINGS, type GraphPhysicsSettings } from './components/GraphCanvas';
import { ObsidianGraphSettings } from './components/ObsidianGraphSettings';
import { GraphFiltersSheet } from './components/GraphFiltersSheet';
import { EmptyState } from '../../design/ui/EmptyState';
import { Segmented } from '../../design/ui/Segmented';

export function GraphScreen() {
  const { noteId } = useParams<{ noteId?: string }>();
  const navigate = useNavigate();

  const focusedNoteId = noteId ? parseInt(noteId, 10) : null;
  const isLocalMode = typeof focusedNoteId === 'number' && !isNaN(focusedNoteId);

  const [localDepth, setLocalDepth] = useState<'1' | '2'>('1');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [physicsSettings, setPhysicsSettings] = useState<GraphPhysicsSettings>(() => {
    try {
      const stored = localStorage.getItem('notes_graph_physics_settings');
      if (stored) return { ...DEFAULT_GRAPH_SETTINGS, ...JSON.parse(stored) };
    } catch {
      // fallback
    }
    return DEFAULT_GRAPH_SETTINGS;
  });

  const handlePhysicsSettingsChange = (next: GraphPhysicsSettings) => {
    setPhysicsSettings(next);
    try {
      localStorage.setItem('notes_graph_physics_settings', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const [filters, setFilters] = useState<GraphFilterOptions>({
    tag: null,
    includeJournals: true,
    hideOrphans: false,
  });

  const graphData = useAllGraphData();
  const notes = graphData?.notes || [];
  const links = graphData?.links || [];

  // Construct graph elements based on mode
  const { nodes, edges, isCapped, totalNodes, centerNodeTitle } = useMemo(() => {
    if (isLocalMode && focusedNoteId) {
      const depthNum = localDepth === '2' ? 2 : 1;
      const { nodes, edges, centerNode } = buildLocalGraph(notes, links, focusedNoteId, depthNum);
      return {
        nodes,
        edges,
        isCapped: false,
        totalNodes: nodes.length,
        centerNodeTitle: centerNode?.title || 'Note',
      };
    }

    const { nodes, edges, isCapped, totalNodes } = buildGlobalGraph(notes, links, filters);
    return { nodes, edges, isCapped, totalNodes, centerNodeTitle: '' };
  }, [isLocalMode, focusedNoteId, localDepth, notes, links, filters]);

  const handleOpenNote = (node: GraphNode) => {
    if (node.kind === 'journal' && node.journalDate) {
      navigate(`/journal/${node.journalDate}`);
    } else {
      navigate(`/notes/${node.id}`);
    }
  };

  const handleFocusNode = (node: GraphNode) => {
    navigate(`/graph/${node.id}`);
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] md:h-screen flex flex-col bg-[#101216] text-white">
      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          {isLocalMode ? (
            <button
              type="button"
              onClick={() => navigate('/graph')}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-md transition-colors"
            >
              ← Global Graph
            </button>
          ) : null}

          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <span>{isLocalMode ? `Connections: ${centerNodeTitle}` : 'Knowledge Graph'}</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10 hidden sm:inline-flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-accent" />
                Obsidian Physics
              </span>
            </h1>
            <div className="text-xs text-white/60">
              {nodes.length} node{nodes.length === 1 ? '' : 's'} · {edges.length} connection{edges.length === 1 ? '' : 's'}
              {isCapped && ' (top 500)'}
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {isLocalMode ? (
            <div className="bg-black/40 backdrop-blur-md rounded-xl p-0.5 border border-white/10">
              <Segmented
                options={[
                  { label: 'Depth 1', value: '1' },
                  { label: 'Depth 2', value: '2' },
                ]}
                value={localDepth}
                onChange={(val) => setLocalDepth(val as '1' | '2')}
                size="sm"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsFiltersOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 text-xs font-semibold text-white/90 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-white/70" />
              <span>Filters</span>
              {(filters.tag != null || !filters.includeJournals || filters.hideOrphans) && (
                <span className="w-2 h-2 rounded-full bg-accent" />
              )}
            </button>
          )}

          {/* Obsidian Graph Settings Toggle */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl backdrop-blur-md border text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              isSettingsOpen
                ? 'bg-accent text-accent-ink border-accent shadow-xs'
                : 'bg-white/10 hover:bg-white/20 border-white/10 text-white/90'
            }`}
            title="Obsidian Graph Settings (Display, Forces, Groups)"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Floating Obsidian Graph Controls */}
      <ObsidianGraphSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={physicsSettings}
        onChange={handlePhysicsSettingsChange}
        includeJournals={filters.includeJournals}
        onIncludeJournalsChange={(val) => setFilters((prev) => ({ ...prev, includeJournals: val }))}
        hideOrphans={filters.hideOrphans}
        onHideOrphansChange={(val) => setFilters((prev) => ({ ...prev, hideOrphans: val }))}
      />

      {/* Main Canvas or Empty State */}
      {nodes.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md bg-[var(--color-surface)] text-[var(--color-ink)] rounded-2xl p-6 shadow-[var(--shadow-float)] border border-[var(--color-border)]">
            <EmptyState
              title={isLocalMode ? 'No connected notes' : 'No graph connections yet'}
              description={
                isLocalMode
                  ? 'This note has no outgoing or incoming links. Connect it to other thoughts by typing [[Note Title]].'
                  : 'Start linking notes together using [[wikilinks]] to visualize your ideas.'
              }
              action={{
                label: 'Go to Notes',
                onClick: () => navigate('/notes'),
              }}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 w-full h-full">
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            settings={physicsSettings}
            onOpenNote={handleOpenNote}
            onFocusNode={handleFocusNode}
            isLocalView={isLocalMode}
          />
        </div>
      )}

      {/* Filters Bottom Sheet */}
      <GraphFiltersSheet
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
        totalNodes={totalNodes}
        isCapped={isCapped}
      />
    </div>
  );
}
