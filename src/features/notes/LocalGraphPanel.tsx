import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllGraphData } from '../../db/repos/linksRepo';
import { buildLocalGraph, type GraphNode } from '../graph/lib/graphData';
import { GraphCanvas } from '../graph/components/GraphCanvas';
import { Segmented } from '../../design/ui/Segmented';

export interface LocalGraphPanelProps {
  noteId: number;
  noteTitle: string;
}

export function LocalGraphPanel({ noteId }: LocalGraphPanelProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [depth, setDepth] = useState<'1' | '2'>('1');

  const graphData = useAllGraphData();
  const notes = graphData?.notes || [];
  const links = graphData?.links || [];

  const { nodes, edges } = useMemo(() => {
    const depthNum = depth === '2' ? 2 : 1;
    return buildLocalGraph(notes, links, noteId, depthNum);
  }, [notes, links, noteId, depth]);

  const hasConnections = nodes.length > 1;

  const handleOpenNode = (node: GraphNode) => {
    if (node.id === noteId) return;
    if (node.kind === 'journal' && node.journalDate) {
      navigate(`/journal/${node.journalDate}`);
    } else {
      navigate(`/notes/${node.id}`);
    }
  };

  return (
    <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)] hover:opacity-80 transition-opacity"
        >
          <span>Local Graph</span>
          {hasConnections && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-ink-muted)]">
              {nodes.length} nodes
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {isExpanded && hasConnections && (
            <>
              <Segmented
                options={[
                  { label: 'Depth 1', value: '1' },
                  { label: 'Depth 2', value: '2' },
                ]}
                value={depth}
                onChange={(val) => setDepth(val as '1' | '2')}
                size="sm"
              />
              <button
                type="button"
                onClick={() => navigate(`/graph/${noteId}`)}
                className="px-2 py-1 text-xs rounded-lg bg-[var(--color-surface-2)] text-[var(--color-ink)] hover:bg-[var(--color-border)] transition-colors"
                title="Open full screen"
              >
                Expand ↗
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            {isExpanded ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[#111318]">
          {!hasConnections ? (
            <div className="p-8 text-center text-xs text-white/50">
              No connections yet. Type <code className="text-white/80 bg-white/10 px-1 py-0.5 rounded">[[Title]]</code> in this note to link it to other notes.
            </div>
          ) : (
            <div className="w-full h-56 relative">
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                onOpenNote={handleOpenNode}
                isLocalView={true}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
