import { useEffect, useRef, useState, useCallback } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
} from 'd3-force';
import type { GraphNode, GraphEdge } from '../lib/graphData';

export interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
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
  onOpenNote,
  onFocusNode,
  isLocalView = false,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const simulationRef = useRef<Simulation<GraphNode, GraphEdge> | null>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, k: 1 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Dragging state
  const isDraggingCanvasRef = useRef(false);
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartDistRef = useRef<number | null>(null);

  // Node lookup for fast rendering
  const nodesRef = useRef<GraphNode[]>(nodes);
  const edgesRef = useRef<GraphEdge[]>(edges);
  nodesRef.current = nodes;
  edgesRef.current = edges;

  // Render loop
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

    // Apply pan & zoom
    const { x, y, k } = transformRef.current;
    ctx.translate(x, y);
    ctx.scale(k, k);

    // 1. Draw Edges
    ctx.lineWidth = 1 / k;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.beginPath();
    for (const edge of edgesRef.current) {
      const source = edge.source as GraphNode;
      const target = edge.target as GraphNode;
      if (source.x != null && source.y != null && target.x != null && target.y != null) {
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
      }
    }
    ctx.stroke();

    // 2. Draw Nodes
    for (const node of nodesRef.current) {
      if (node.x == null || node.y == null) continue;

      // Draw focus / today halo if applicable
      if (node.isFocused || node.isTodayJournal) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 4 / k, 0, 2 * Math.PI);
        ctx.fillStyle = 'oklch(0.55 0.17 265 / 0.25)';
        ctx.fill();
        ctx.lineWidth = 1.5 / k;
        ctx.strokeStyle = 'oklch(0.55 0.17 265)';
        ctx.stroke();
      }

      // Selected ring
      if (selectedNode && selectedNode.id === node.id) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 3 / k, 0, 2 * Math.PI);
        ctx.lineWidth = 2 / k;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      // Draw Node Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();
      ctx.lineWidth = 1 / k;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.stroke();

      // Node label (show for focused, selected, high degree, or when zoomed in)
      const shouldShowLabel =
        node.isFocused ||
        (selectedNode && selectedNode.id === node.id) ||
        node.degree >= 3 ||
        k > 1.3 ||
        isLocalView;

      if (shouldShowLabel) {
        ctx.font = `${Math.max(10, Math.round(11 / k))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        // Truncate long titles
        const display = node.title.length > 20 ? node.title.slice(0, 18) + '…' : node.title;
        ctx.fillText(display, node.x, node.y + node.radius + 3 / k);
      }
    }

    ctx.restore();
  }, [selectedNode, isLocalView]);

  // Setup simulation and resize handling
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

      // Center initial transform
      if (transformRef.current.x === 0 && transformRef.current.y === 0) {
        transformRef.current.x = rect.width / 2;
        transformRef.current.y = rect.height / 2;
      }
    };

    resize();

    // Deep copy nodes & edges for D3 simulation
    const simNodes: GraphNode[] = nodes.map((d) => ({ ...d }));
    const simEdges: GraphEdge[] = edges.map((e) => ({
      ...e,
      source: typeof e.source === 'object' ? (e.source as GraphNode).id : e.source,
      target: typeof e.target === 'object' ? (e.target as GraphNode).id : e.target,
    }));

    nodesRef.current = simNodes;
    edgesRef.current = simEdges;

    // Build d3-force simulation exactly per spec
    const sim = forceSimulation<GraphNode>(simNodes)
      .force(
        'link',
        forceLink<GraphNode, GraphEdge>(simEdges)
          .id((d) => d.id)
          .distance(isLocalView ? 80 : 60)
      )
      .force('charge', forceManyBody().strength(isLocalView ? -180 : -120))
      .force('collide', forceCollide<GraphNode>().radius((d) => d.radius + 5))
      .force('center', forceCenter(0, 0))
      .alphaDecay(0.025);

    simulationRef.current = sim;

    const tick = () => {
      draw();
      if (sim.alpha() > 0.005) {
        animId = requestAnimationFrame(tick);
      }
    };

    sim.on('tick', () => {
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(draw);
    });

    // Start tick loop
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

  // Screen to world coordinates helper
  const screenToWorld = (screenX: number, screenY: number) => {
    const { x, y, k } = transformRef.current;
    return {
      x: (screenX - x) / k,
      y: (screenY - y) / k,
    };
  };

  // Find node under mouse
  const getNodeAt = (screenX: number, screenY: number): GraphNode | null => {
    const { x, y } = screenToWorld(screenX, screenY);
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const node = nodesRef.current[i];
      if (node.x != null && node.y != null) {
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy <= (node.radius + 6) * (node.radius + 6)) {
          return node;
        }
      }
    }
    return null;
  };

  // Mouse event handlers
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
      simulationRef.current?.alpha(0.3).restart();
    } else {
      isDraggingCanvasRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      draggedNodeRef.current.fx = world.x;
      draggedNodeRef.current.fy = world.y;
      simulationRef.current?.alpha(0.3).restart();
      draw();
    } else if (isDraggingCanvasRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      transformRef.current.x += dx;
      transformRef.current.y += dy;
      draw();
    }
  };

  const handleMouseUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
      draggedNodeRef.current = null;
    }
    if (isDraggingCanvasRef.current) {
      isDraggingCanvasRef.current = false;
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const hit = getNodeAt(clientX, clientY);
    setSelectedNode(hit);
    if (hit && onOpenNote) {
      onOpenNote(hit);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const hit = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (hit && onOpenNote) {
      onOpenNote(hit);
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newK = Math.max(0.15, Math.min(6, transformRef.current.k * zoomFactor));

    // Zoom centered around cursor
    transformRef.current.x = mouseX - (mouseX - transformRef.current.x) * (newK / transformRef.current.k);
    transformRef.current.y = mouseY - (mouseY - transformRef.current.y) * (newK / transformRef.current.k);
    transformRef.current.k = newK;

    draw();
  };

  // Touch event handlers for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const clientX = touch.clientX - rect.left;
      const clientY = touch.clientY - rect.top;

      const hit = getNodeAt(clientX, clientY);
      if (hit) {
        draggedNodeRef.current = hit;
        hit.fx = hit.x;
        hit.fy = hit.y;
        simulationRef.current?.alpha(0.3).restart();
      } else {
        isDraggingCanvasRef.current = true;
        lastMousePosRef.current = { x: touch.clientX, y: touch.clientY };
      }
    } else if (e.touches.length === 2) {
      // 2-finger pinch
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (draggedNodeRef.current) {
        const world = screenToWorld(touch.clientX - rect.left, touch.clientY - rect.top);
        draggedNodeRef.current.fx = world.x;
        draggedNodeRef.current.fy = world.y;
        simulationRef.current?.alpha(0.3).restart();
        draw();
      } else if (isDraggingCanvasRef.current) {
        const dx = touch.clientX - lastMousePosRef.current.x;
        const dy = touch.clientY - lastMousePosRef.current.y;
        lastMousePosRef.current = { x: touch.clientX, y: touch.clientY };
        transformRef.current.x += dx;
        transformRef.current.y += dy;
        draw();
      }
    } else if (e.touches.length === 2 && touchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.sqrt(dx * dx + dy * dy);
      const ratio = newDist / touchStartDistRef.current;
      touchStartDistRef.current = newDist;

      const newK = Math.max(0.15, Math.min(6, transformRef.current.k * ratio));
      transformRef.current.k = newK;
      draw();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
      draggedNodeRef.current = null;
    }
    isDraggingCanvasRef.current = false;
    touchStartDistRef.current = null;

    if (e.changedTouches.length === 1) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const touch = e.changedTouches[0];
      const hit = getNodeAt(touch.clientX - rect.left, touch.clientY - rect.top);
      setSelectedNode(hit);
    }
  };

  // Zoom control helpers
  const handleZoomIn = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const newK = Math.min(6, transformRef.current.k * 1.3);
    transformRef.current.x = centerX - (centerX - transformRef.current.x) * (newK / transformRef.current.k);
    transformRef.current.y = centerY - (centerY - transformRef.current.y) * (newK / transformRef.current.k);
    transformRef.current.k = newK;
    draw();
  };

  const handleZoomOut = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const newK = Math.max(0.15, transformRef.current.k * 0.7);
    transformRef.current.x = centerX - (centerX - transformRef.current.x) * (newK / transformRef.current.k);
    transformRef.current.y = centerY - (centerY - transformRef.current.y) * (newK / transformRef.current.k);
    transformRef.current.k = newK;
    draw();
  };

  const handleResetZoom = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    transformRef.current = {
      x: rect.width / 2,
      y: rect.height / 2,
      k: 1,
    };
    simulationRef.current?.alpha(0.3).restart();
    draw();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none bg-[#111318]"
      style={{ touchAction: 'none' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Zoom / View controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 p-1 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 shadow-[var(--shadow-float)]">
        <button
          type="button"
          onClick={handleZoomIn}
          title="Zoom in"
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm font-semibold"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          title="Zoom out"
          className="w-8 h-8 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm font-semibold"
        >
          −
        </button>
        <button
          type="button"
          onClick={handleResetZoom}
          title="Reset view"
          className="px-2.5 h-8 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors text-xs font-medium"
        >
          Fit
        </button>
      </div>

      {/* Selected Node Tooltip / Chip */}
      {selectedNode && (
        <div className="absolute top-4 left-4 right-4 sm:right-auto sm:w-80 p-3.5 rounded-2xl bg-[#1c1f26]/95 backdrop-blur-md border border-white/10 shadow-[var(--shadow-float)] text-white animate-in fade-in duration-150">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h4 className="font-semibold text-sm truncate flex-1">{selectedNode.title}</h4>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="text-white/40 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/60 mb-3">
            <span>{selectedNode.degree} link{selectedNode.degree === 1 ? '' : 's'}</span>
            {selectedNode.kind === 'journal' && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-medium">
                Journal
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenNote && (
              <button
                type="button"
                onClick={() => onOpenNote(selectedNode)}
                className="flex-1 py-1.5 px-3 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-ink)] text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Open Note
              </button>
            )}
            {onFocusNode && !selectedNode.isFocused && (
              <button
                type="button"
                onClick={() => onFocusNode(selectedNode)}
                className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 text-xs font-medium transition-colors"
              >
                Focus
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
