import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import type { Note } from '../../../types/note';
import type { NoteLink } from '../../../types/link';
import { localDateStr } from '../../../lib/date';

export interface GraphNode extends SimulationNodeDatum {
  id: number;
  title: string;
  kind: 'note' | 'journal';
  journalDate?: string | null;
  tags: string[];
  degree: number;
  radius: number;
  color: string;
  isTodayJournal?: boolean;
  isFocused?: boolean;
}

export interface GraphEdge extends SimulationLinkDatum<GraphNode> {
  id: string;
  source: number | GraphNode;
  target: number | GraphNode;
}

export interface GraphFilterOptions {
  tag?: string | null;
  includeJournals: boolean;
  hideOrphans: boolean;
}

export const DEFAULT_NODE_COLOR = 'oklch(0.65 0.02 262)';
export const JOURNAL_NODE_COLOR = 'oklch(0.68 0.12 300)';
export const ACCENT_COLOR = 'oklch(0.55 0.17 265)';

export function getNodeColor(kind?: string): string {
  if (kind === 'journal') {
    return JOURNAL_NODE_COLOR;
  }
  return DEFAULT_NODE_COLOR;
}

/**
 * Builds the dataset for the global graph.
 * Caps at 500 highest-degree nodes per EXPANSION_PLAN §5.3.
 */
export function buildGlobalGraph(
  notes: Note[],
  links: NoteLink[],
  filters: GraphFilterOptions
): { nodes: GraphNode[]; edges: GraphEdge[]; isCapped: boolean; totalNodes: number } {
  const todayStr = localDateStr();

  // 1. Initial filter based on options
  let eligibleNotes = notes.filter((n) => {
    if (n.trashedAt !== null) return false;
    if (!filters.includeJournals && n.kind === 'journal') return false;
    if (filters.tag) {
      const cleanTag = filters.tag.toLowerCase();
      if (!n.tags?.some((t) => t.toLowerCase() === cleanTag)) return false;
    }
    return true;
  });

  const eligibleIds = new Set(eligibleNotes.map((n) => n.id!));

  // 2. Count degrees for eligible notes
  const degreeMap = new Map<number, number>();
  for (const n of eligibleNotes) {
    degreeMap.set(n.id!, 0);
  }

  const validLinks: NoteLink[] = [];
  for (const link of links) {
    if (
      typeof link.sourceId === 'number' &&
      typeof link.targetId === 'number' &&
      eligibleIds.has(link.sourceId) &&
      eligibleIds.has(link.targetId)
    ) {
      degreeMap.set(link.sourceId, (degreeMap.get(link.sourceId) || 0) + 1);
      degreeMap.set(link.targetId, (degreeMap.get(link.targetId) || 0) + 1);
      validLinks.push(link);
    }
  }

  // 3. Filter orphans if requested
  if (filters.hideOrphans) {
    eligibleNotes = eligibleNotes.filter((n) => (degreeMap.get(n.id!) || 0) > 0);
  }

  const totalNodes = eligibleNotes.length;
  let isCapped = false;

  // 4. Cap at 500 nodes (highest degree first)
  if (eligibleNotes.length > 500) {
    eligibleNotes.sort((a, b) => {
      const degA = degreeMap.get(a.id!) || 0;
      const degB = degreeMap.get(b.id!) || 0;
      return degB - degA;
    });
    eligibleNotes = eligibleNotes.slice(0, 500);
    isCapped = true;
  }

  const finalNodeIds = new Set(eligibleNotes.map((n) => n.id!));

  // 5. Construct node objects
  const nodes: GraphNode[] = eligibleNotes.map((n) => {
    const degree = degreeMap.get(n.id!) || 0;
    const isJournal = n.kind === 'journal';
    const isTodayJournal = isJournal && n.journalDate === todayStr;

    // Node radius calculation: 3 + degree, journals slightly smaller
    const radius = isJournal
      ? Math.max(3, 2.5 + degree * 0.6)
      : Math.min(18, 4 + degree * 1.1);

    return {
      id: n.id!,
      title: n.title || (n.journalDate ? `Journal — ${n.journalDate}` : 'Untitled'),
      kind: n.kind === 'journal' ? 'journal' : 'note',
      journalDate: n.journalDate,
      tags: n.tags || [],
      degree,
      radius,
      color: getNodeColor(n.kind),
      isTodayJournal,
    };
  });

  // 6. Construct edge objects
  const edges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const link of validLinks) {
    if (finalNodeIds.has(link.sourceId) && finalNodeIds.has(link.targetId!)) {
      const edgeKey = `${link.sourceId}->${link.targetId}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        edges.push({
          id: edgeKey,
          source: link.sourceId,
          target: link.targetId!,
        });
      }
    }
  }

  return { nodes, edges, isCapped, totalNodes };
}

/**
 * Builds the dataset for a local graph focused on a specific note (depth 1 or 2).
 */
export function buildLocalGraph(
  notes: Note[],
  links: NoteLink[],
  centerNoteId: number,
  depth: 1 | 2 = 1
): { nodes: GraphNode[]; edges: GraphEdge[]; centerNode?: GraphNode } {
  const notesMap = new Map<number, Note>();
  for (const n of notes) {
    if (n.trashedAt === null && n.id) {
      notesMap.set(n.id, n);
    }
  }

  if (!notesMap.has(centerNoteId)) {
    return { nodes: [], edges: [] };
  }

  // BFS traversal up to depth
  const visited = new Set<number>([centerNoteId]);
  let currentLayer = new Set<number>([centerNoteId]);

  // Build adjacency
  const adj = new Map<number, Set<number>>();
  for (const l of links) {
    if (typeof l.sourceId === 'number' && typeof l.targetId === 'number') {
      if (!adj.has(l.sourceId)) adj.set(l.sourceId, new Set());
      if (!adj.has(l.targetId)) adj.set(l.targetId, new Set());
      adj.get(l.sourceId)!.add(l.targetId);
      adj.get(l.targetId)!.add(l.sourceId);
    }
  }

  for (let d = 0; d < depth; d++) {
    const nextLayer = new Set<number>();
    for (const nodeId of currentLayer) {
      const neighbors = adj.get(nodeId);
      if (neighbors) {
        for (const neighborId of neighbors) {
          if (!visited.has(neighborId) && notesMap.has(neighborId)) {
            visited.add(neighborId);
            nextLayer.add(neighborId);
          }
        }
      }
    }
    currentLayer = nextLayer;
  }

  // Degree calculation within visited nodes
  const degreeMap = new Map<number, number>();
  for (const id of visited) degreeMap.set(id, 0);

  const edges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const l of links) {
    if (
      typeof l.sourceId === 'number' &&
      typeof l.targetId === 'number' &&
      visited.has(l.sourceId) &&
      visited.has(l.targetId)
    ) {
      degreeMap.set(l.sourceId, (degreeMap.get(l.sourceId) || 0) + 1);
      degreeMap.set(l.targetId, (degreeMap.get(l.targetId) || 0) + 1);

      const edgeKey = `${l.sourceId}->${l.targetId}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        edges.push({
          id: edgeKey,
          source: l.sourceId,
          target: l.targetId,
        });
      }
    }
  }

  let centerNodeObj: GraphNode | undefined = undefined;
  const nodes: GraphNode[] = [];

  for (const id of visited) {
    const n = notesMap.get(id)!;
    const isCenter = id === centerNoteId;
    const degree = degreeMap.get(id) || 0;
    const radius = isCenter
      ? 12
      : Math.min(14, 4 + degree * 1.2);

    const node: GraphNode = {
      id,
      title: n.title || (n.journalDate ? `Journal — ${n.journalDate}` : 'Untitled'),
      kind: n.kind === 'journal' ? 'journal' : 'note',
      journalDate: n.journalDate,
      tags: n.tags || [],
      degree,
      radius,
      color: isCenter ? ACCENT_COLOR : getNodeColor(n.kind),
      isFocused: isCenter,
    };

    if (isCenter) centerNodeObj = node;
    nodes.push(node);
  }

  return { nodes, edges, centerNode: centerNodeObj };
}
