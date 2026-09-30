import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
} from 'd3-force';
import type { GraphNode, GraphEdge } from '../lib/graphData';

export interface GraphPhysicsSettings {
  centerStrength: number;     // 0.01 to 0.5 (default 0.12)
  repelStrength: number;      // -400 to -40 (default -140)
  linkDistance: number;       // 30 to 220 (default 75)
  linkStrength: number;       // 0.1 to 1.0 (default 0.45)
  nodeSizeMultiplier: number; // 0.6 to 2.5 (default 1.0)
  linkThickness: number;      // 0.5 to 4.0 (default 1.2)
  showArrows: boolean;        // default true
  showLabels: boolean;        // default true
  isPaused: boolean;          // default false
  searchQuery?: string;
  colorGroups?: { query: string; color: string }[];
}

export const DEFAULT_GRAPH_SETTINGS: GraphPhysicsSettings = {
  centerStrength: 0.12,
  repelStrength: -140,
  linkDistance: 75,
  linkStrength: 0.45,
  nodeSizeMultiplier: 1.0,
  linkThickness: 1.2,
  showArrows: true,
  showLabels: true,
  isPaused: false,
  searchQuery: '',
  colorGroups: [],
};

export interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  settings?: GraphPhysicsSettings;
  onOpenNote?: (node: GraphNode) => void;
  onFocusNode?: (node: GraphNode) => void;
  isLocalView?: boolean;
}

interface Transform {
  x: number;
  y: number;
  k: number;
}

export function GraphCanvas({
  nodes,
  edges,
  settings = DEFAULT_GRAPH_SETTINGS,
  onOpenNote,
  onFocusNode,
  isLocalView = false,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const simulationRef = useRef<Simulation<GraphNode, GraphEdge> | null>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  // Dragging state
  const isDraggingCanvasRef = useRef(false);
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartCenterRef = useRef<{ x: number; y: number } | null>(null);

  // References for live rendering without restart
  const nodesRef = useRef<GraphNode[]>(nodes);
  const edgesRef = useRef<GraphEdge[]>(edges);
  const settingsRef = useRef<GraphPhysicsSettings>(settings);
  nodesRef.current = nodes;
  edgesRef.current = edges;
  settingsRef.current = settings;

  // Build connection map for hover neighbor highlighting
  const neighborMap = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const node of nodes) {
      map.set(node.id, new Set<number>());
    }
    for (const edge of edges) {
      const s = typeof edge.source === 'object' ? (edge.source as GraphNode).id : edge.source;
      const t = typeof edge.target === 'object' ? (edge.target as GraphNode).id : edge.target;
      if (typeof s === 'number' && typeof t === 'number') {
        map.get(s)?.add(t);
        map.get(t)?.add(s);
      }
    }
    return map;
  }, [nodes, edges]);

  // Screen to world coordinates helper
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const { x, y, k } = transformRef.current;
    return {
      x: (screenX - x) / k,
      y: (screenY - y) / k,
    };
  }, []);

  // Find node under cursor
  const getNodeAt = useCallback(
    (screenX: number, screenY: number): GraphNode | null => {
      const { x, y } = screenToWorld(screenX, screenY);
      const mult = settingsRef.current.nodeSizeMultiplier || 1.0;
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        const node = nodesRef.current[i];
        if (node.x != null && node.y != null) {
          const dx = x - node.x;
          const dy = y - node.y;
          const r = node.radius * mult + 8;
          if (dx * dx + dy * dy <= r * r) {
            return node;
          }
        }
      }
      return null;
    },
    [screenToWorld]
  );

  // Helper to resolve node color with color groups or search query
  const getNodeColor = useCallback((node: GraphNode): string => {
    const s = settingsRef.current;
    if (s.colorGroups && s.colorGroups.length > 0) {
      for (const group of s.colorGroups) {
        if (!group.query) continue;
        const q = group.query.toLowerCase();
        if (
          node.title.toLowerCase().includes(q) ||
          node.tags.some((t) => t.toLowerCase().includes(q.replace(/^#/, '')))
        ) {
          return group.color;
        }
      }
    }

    if (s.searchQuery && s.searchQuery.trim()) {
      const q = s.searchQuery.toLowerCase().trim();
      const match =
        node.title.toLowerCase().includes(q) ||
        node.tags.some((t) => t.toLowerCase().includes(q.replace(/^#/, '')));
      if (match) return '#ec4899'; // Highlight matching notes in bright magenta
    }

    return node.color;
  }, []);

  // Main Draw Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    const { x, y, k } = transformRef.current;
    ctx.translate(x, y);
    ctx.scale(k, k);

    const s = settingsRef.current;
    const activeHover = hoveredNode;
    const activeNeighbors = activeHover ? neighborMap.get(activeHover.id) : null;
    const isHoverActive = activeHover != null;

    // 1. Draw Edges
    const baseThickness = (s.linkThickness || 1.2) / k;
    for (const edge of edgesRef.current) {
      const source = edge.source as GraphNode;
      const target = edge.target as GraphNode;
      if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

      const isConnectedToHover =
        isHoverActive &&
        (source.id === activeHover.id || target.id === activeHover.id);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (isHoverActive) {
        if (isConnectedToHover) {
          ctx.lineWidth = baseThickness * 2.2;
          ctx.strokeStyle = 'rgba(147, 197, 253, 0.95)'; // Bright cyan/blue
        } else {
          ctx.lineWidth = baseThickness * 0.7;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'; // Dimmed
        }
      } else {
        ctx.lineWidth = baseThickness;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      }
      ctx.stroke();

      // Directional arrowheads like Obsidian
      if (s.showArrows) {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const len = Math.hypot(dx, dy);
        if (len > 20) {
          const angle = Math.atan2(dy, dx);
          const targetRadius = target.radius * (s.nodeSizeMultiplier || 1.0);
          const arrowDist = targetRadius + 3;
          const arrowX = target.x - Math.cos(angle) * arrowDist;
          const arrowY = target.y - Math.sin(angle) * arrowDist;
          const headLen = Math.max(4, 7 / k);

          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - headLen * Math.cos(angle - Math.PI / 6),
            arrowY - headLen * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            arrowX - headLen * Math.cos(angle + Math.PI / 6),
            arrowY - headLen * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
        }
      }
    }

    // 2. Draw Nodes
    const nodeMult = s.nodeSizeMultiplier || 1.0;
    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue;

      const isCurrentHover = activeHover && activeHover.id === node.id;
      const isNeighbor = activeNeighbors?.has(node.id);
      const isSelected = selectedNode && selectedNode.id === node.id;
      const isHighlighted = isCurrentHover || isNeighbor || isSelected || node.isFocused;

      const alpha = isHoverActive ? (isHighlighted ? 1.0 : 0.18) : 1.0;
      const radius = node.radius * nodeMult;

      // Halo ring for hovered, selected, or focused node
      if (isCurrentHover || isSelected || node.isFocused || node.isTodayJournal) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 5 / k, 0, 2 * Math.PI);
        ctx.fillStyle = isCurrentHover
          ? 'rgba(99, 102, 241, 0.35)'
          : 'rgba(255, 255, 255, 0.18)';
        ctx.fill();
        ctx.lineWidth = 1.5 / k;
        ctx.strokeStyle = isCurrentHover ? '#818cf8' : '#ffffff';
        ctx.stroke();
      }

      // Main Node Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      const nodeColor = getNodeColor(node);

      if (alpha < 1.0) {
        ctx.fillStyle = 'rgba(120, 130, 150, 0.2)';
        ctx.fill();
        ctx.lineWidth = 0.5 / k;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.stroke();
      } else {
        ctx.fillStyle = nodeColor;
        ctx.fill();
        ctx.lineWidth = (isHighlighted ? 2.0 : 1.0) / k;
        ctx.strokeStyle = isHighlighted ? '#ffffff' : 'rgba(255, 255, 255, 0.35)';
        ctx.stroke();
      }

      // 3. Node Labels (Obsidian style)
      if (s.showLabels && (!isHoverActive || isHighlighted)) {
        const fontSize = Math.max(9, Math.round(11 / Math.pow(k, 0.72)));
        ctx.font = `${isHighlighted ? '600' : '500'} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const maxChars = isHighlighted ? 45 : Math.max(12, Math.round(20 * Math.sqrt(k)));
        const display =
          node.title.length > maxChars ? node.title.slice(0, maxChars - 1) + '…' : node.title;
        const labelY = node.y + radius + Math.max(3, 4 / k);

        // Contrast halo stroke
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2, 4 / k);
        ctx.strokeStyle = 'rgba(12, 14, 20, 0.95)';
        ctx.strokeText(display, node.x, labelY);

        // Foreground text
        ctx.fillStyle = isHighlighted ? '#ffffff' : 'rgba(235, 240, 255, 0.88)';
        ctx.fillText(display, node.x, labelY);
      }
    }

    ctx.restore();
  }, [hoveredNode, neighborMap, selectedNode, getNodeColor]);

  // Setup D3 Simulation with High Velocity Decay (Obsidian Calm Dynamics)
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let animId: number;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      if (transformRef.current.x === 0 && transformRef.current.y === 0) {
        transformRef.current.x = rect.width / 2;
        transformRef.current.y = rect.height / 2;
      }
    };

    resize();

    // Deep copy nodes & edges for D3
    const simNodes: GraphNode[] = nodes.map((d) => ({ ...d }));
    const simEdges: GraphEdge[] = edges.map((e) => ({
      ...e,
      source: typeof e.source === 'object' ? (e.source as GraphNode).id : e.source,
      target: typeof e.target === 'object' ? (e.target as GraphNode).id : e.target,
    }));

    nodesRef.current = simNodes;
    edgesRef.current = simEdges;

    const s = settingsRef.current;

    // HIGH VELOCITY DECAY (0.75): This completely fixes the fast/shaking motion!
    const sim = forceSimulation<GraphNode>(simNodes)
      .velocityDecay(0.75)
      .alphaDecay(0.022)
      .alphaMin(0.001)
      .force(
        'link',
        forceLink<GraphNode, GraphEdge>(simEdges)
          .id((d) => d.id)
          .distance(isLocalView ? s.linkDistance * 1.1 : s.linkDistance)
          .strength(s.linkStrength)
      )
      .force('charge', forceManyBody().strength(s.repelStrength).distanceMax(500))
      .force('collide', forceCollide<GraphNode>().radius((d) => d.radius * (s.nodeSizeMultiplier || 1) + 8))
      .force('center', forceCenter(0, 0).strength(s.centerStrength));

    if (s.isPaused) {
      sim.stop();
    }

    simulationRef.current = sim;

    const tick = () => {
      draw();
      if (sim.alpha() > 0.002 && !settingsRef.current.isPaused) {
        animId = requestAnimationFrame(tick);
      }
    };

    sim.on('tick', () => {
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(draw);
    });

    animId = requestAnimationFrame(tick);

    const observer = new ResizeObserver(() => {
      resize();
      draw();
    });
    observer.observe(container);

    return () => {
      sim.stop();
      cancelAnimationFrame(animId);
      observer.disconnect();
    };
  }, [nodes, edges, isLocalView, draw]);

  // React to dynamic physics settings changes
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;

    if (settings.isPaused) {
      sim.stop();
    } else {
      const linkForce = sim.force('link') as any;
      if (linkForce) {
        linkForce
          .distance(isLocalView ? settings.linkDistance * 1.1 : settings.linkDistance)
          .strength(settings.linkStrength);
      }
      const chargeForce = sim.force('charge') as any;
      if (chargeForce) {
        chargeForce.strength(settings.repelStrength);
      }
      const centerForce = sim.force('center') as any;
      if (centerForce) {
        centerForce.strength(settings.centerStrength);
      }
      const collideForce = sim.force('collide') as any;
      if (collideForce) {
        collideForce.radius((d: GraphNode) => d.radius * settings.nodeSizeMultiplier + 8);
      }

      sim.alpha(0.12).restart();
    }
    draw();
  }, [settings, isLocalView, draw]);

  // Mouse Interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const hit = getNodeAt(clientX, clientY);
    if (hit) {
      draggedNodeRef.current = hit;
      hit.fx = hit.x;
      hit.fy = hit.y;
      // Gentle alpha target: allows moving node without exploding the entire graph
      simulationRef.current?.alphaTarget(0.15).restart();
    } else {
      isDraggingCanvasRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (draggedNodeRef.current) {
      const world = screenToWorld(clientX, clientY);
      draggedNodeRef.current.fx = world.x;
      draggedNodeRef.current.fy = world.y;
      draw();
    } else if (isDraggingCanvasRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      transformRef.current.x += dx;
      transformRef.current.y += dy;
      draw();
    } else {
      // Hover detection
      const hit = getNodeAt(clientX, clientY);
      if (hit?.id !== hoveredNode?.id) {
        setHoveredNode(hit);
      }
    }
  };

  const handleMouseUp = () => {
    if (draggedNodeRef.current) {
      simulationRef.current?.alphaTarget(0);
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
      draggedNodeRef.current = null;
    }
    if (isDraggingCanvasRef.current) {
      isDraggingCanvasRef.current = false;
    }
  };

  const handleMouseLeave = () => {
    handleMouseUp();
    setHoveredNode(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const hit = getNodeAt(clientX, clientY);
    setSelectedNode(hit);
    if (hit) {
      onFocusNode?.(hit);
      onOpenNote?.(hit);
    }
  };

  // Wheel zoom centered at cursor
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
    const newK = Math.max(0.12, Math.min(5, transformRef.current.k * zoomFactor));

    transformRef.current.x = mouseX - (mouseX - transformRef.current.x) * (newK / transformRef.current.k);
    transformRef.current.y = mouseY - (mouseY - transformRef.current.y) * (newK / transformRef.current.k);
    transformRef.current.k = newK;

    draw();
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1) {
      const clientX = e.touches[0].clientX - rect.left;
      const clientY = e.touches[0].clientY - rect.top;
      const hit = getNodeAt(clientX, clientY);
      if (hit) {
        draggedNodeRef.current = hit;
        hit.fx = hit.x;
        hit.fy = hit.y;
        simulationRef.current?.alphaTarget(0.15).restart();
      } else {
        isDraggingCanvasRef.current = true;
        lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    } else if (e.touches.length === 2) {
      isDraggingCanvasRef.current = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      touchStartDistRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartCenterRef.current = {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1) {
      const clientX = e.touches[0].clientX - rect.left;
      const clientY = e.touches[0].clientY - rect.top;

      if (draggedNodeRef.current) {
        const world = screenToWorld(clientX, clientY);
        draggedNodeRef.current.fx = world.x;
        draggedNodeRef.current.fy = world.y;
        draw();
      } else if (isDraggingCanvasRef.current) {
        const dx = e.touches[0].clientX - lastMousePosRef.current.x;
        const dy = e.touches[0].clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        transformRef.current.x += dx;
        transformRef.current.y += dy;
        draw();
      }
    } else if (e.touches.length === 2 && touchStartDistRef.current != null) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = dist / touchStartDistRef.current;
      touchStartDistRef.current = dist;

      const center = {
        x: (t1.clientX + t2.clientX) / 2 - rect.left,
        y: (t1.clientY + t2.clientY) / 2 - rect.top,
      };

      const newK = Math.max(0.12, Math.min(5, transformRef.current.k * ratio));
      transformRef.current.x = center.x - (center.x - transformRef.current.x) * (newK / transformRef.current.k);
      transformRef.current.y = center.y - (center.y - transformRef.current.y) * (newK / transformRef.current.k);
      transformRef.current.k = newK;

      draw();
    }
  };

  const handleTouchEnd = () => {
    handleMouseUp();
    touchStartDistRef.current = null;
    touchStartCenterRef.current = null;
  };

  // Zoom controls helper
  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const newK = Math.min(5, transformRef.current.k * 1.3);
    transformRef.current.x = cx - (cx - transformRef.current.x) * (newK / transformRef.current.k);
    transformRef.current.y = cy - (cy - transformRef.current.y) * (newK / transformRef.current.k);
    transformRef.current.k = newK;
    draw();
  };

  const handleZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const newK = Math.max(0.12, transformRef.current.k / 1.3);
    transformRef.current.x = cx - (cx - transformRef.current.x) * (newK / transformRef.current.k);
    transformRef.current.y = cy - (cy - transformRef.current.y) * (newK / transformRef.current.k);
    transformRef.current.k = newK;
    draw();
  };

  const handleResetZoom = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    transformRef.current = {
      x: canvas.clientWidth / 2,
      y: canvas.clientHeight / 2,
      k: 1.0,
    };
    draw();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none bg-[#101216]">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Obsidian-Style Hover Tooltip */}
      {hoveredNode && (
        <div
          className="absolute pointer-events-none z-20 px-3 py-2 rounded-xl bg-black/85 backdrop-blur-md border border-white/15 text-white shadow-xl animate-in fade-in duration-100 max-w-xs"
          style={{
            left: Math.min(
              (containerRef.current?.clientWidth || 300) - 220,
              Math.max(10, (hoveredNode.x || 0) * transformRef.current.k + transformRef.current.x + 15)
            ),
            top: Math.min(
              (containerRef.current?.clientHeight || 300) - 80,
              Math.max(10, (hoveredNode.y || 0) * transformRef.current.k + transformRef.current.y + 15)
            ),
          }}
        >
          <div className="font-bold text-xs truncate text-white">{hoveredNode.title}</div>
          <div className="text-[10px] text-white/70 flex items-center gap-2 mt-0.5">
            <span>{neighborMap.get(hoveredNode.id)?.size || 0} links</span>
            {hoveredNode.tags.length > 0 && (
              <span>• #{hoveredNode.tags.slice(0, 2).join(', #')}</span>
            )}
          </div>
        </div>
      )}

      {/* Floating Canvas Controls (Bottom-Right Zoom / Reset) */}
      <div className="absolute bottom-5 right-5 z-20 flex items-center gap-1.5 p-1 bg-black/60 backdrop-blur-md rounded-2xl border border-white/15 text-white/80 shadow-lg">
        <button
          type="button"
          onClick={handleZoomIn}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all text-sm font-bold cursor-pointer"
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all text-sm font-bold cursor-pointer"
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          className="px-2.5 h-8 rounded-xl flex items-center justify-center hover:bg-white/15 active:scale-95 transition-all text-[11px] font-semibold cursor-pointer"
          title="Reset to 100%"
          aria-label="Reset zoom"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
