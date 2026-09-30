import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Pen,
  Highlighter,
  Eraser,
  Undo2,
  Redo2,
  Trash2,
  Sparkles,
  Check,
  X
} from 'lucide-react';
import { getStrokeOutline, getSvgPathFromStroke } from '../canvas/engine/strokeGeometry';
import { recognizeAndSnapShape } from './shapeRecognizer';
import type { Stroke } from '../../types/canvas';

export interface DrawingLayer {
  id: number;
  name: string;
  strokes: Stroke[];
  visible: boolean;
}

export interface DrawingPadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStrokesJson?: string;
  onSave: (svgContent: string, strokesJson: string) => void;
  title?: string;
}

const PALETTE = [
  '#18181b', // Slate/black
  '#8b5cf6', // Soft purple (accent)
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#ffffff', // White
];

export function DrawingPadModal({
  isOpen,
  onClose,
  initialStrokesJson,
  onSave,
  title = 'Sketch & Draw',
}: DrawingPadModalProps) {
  const [tool, setTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [color, setColor] = useState('#8b5cf6');
  const [size, setSize] = useState(4);
  const [smartShapes, setSmartShapes] = useState(true);
  const [activeLayerIndex, setActiveLayerIndex] = useState(0);

  // 2 Layers
  const [layers, setLayers] = useState<DrawingLayer[]>([
    { id: 1, name: 'Layer 1', strokes: [], visible: true },
    { id: 2, name: 'Layer 2', strokes: [], visible: true },
  ]);

  // History stack for undo/redo
  const [history, setHistory] = useState<DrawingLayer[][]>([]);
  const [redoStack, setRedoStack] = useState<DrawingLayer[][]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentPointsRef = useRef<[number, number, number][]>([]);

  // Parse initial strokes if editing existing drawing
  useEffect(() => {
    if (!isOpen) return;
    if (initialStrokesJson) {
      try {
        const parsed = JSON.parse(initialStrokesJson);
        if (Array.isArray(parsed)) {
          if (parsed.length > 0 && 'strokes' in parsed[0]) {
            setLayers(parsed);
          } else {
            setLayers([
              { id: 1, name: 'Layer 1', strokes: parsed, visible: true },
              { id: 2, name: 'Layer 2', strokes: [], visible: true },
            ]);
          }
        }
      } catch (err) {
        console.error('Failed to parse drawing data:', err);
      }
    } else {
      setLayers([
        { id: 1, name: 'Layer 1', strokes: [], visible: true },
        { id: 2, name: 'Layer 2', strokes: [], visible: true },
      ]);
    }
    setHistory([]);
    setRedoStack([]);
  }, [isOpen, initialStrokesJson]);

  // Render canvas layers
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const layer of layers) {
      if (!layer.visible) continue;
      for (const stroke of layer.strokes) {
        ctx.save();
        if (stroke.tool === 'highlighter') {
          ctx.globalAlpha = 0.35;
          ctx.globalCompositeOperation = 'multiply';
        } else {
          ctx.globalAlpha = 1.0;
          ctx.globalCompositeOperation = 'source-over';
        }

        ctx.fillStyle = stroke.color;
        const outline = getStrokeOutline(stroke);
        const pathData = getSvgPathFromStroke(outline);
        if (pathData) {
          ctx.fill(new Path2D(pathData));
        }
        ctx.restore();
      }
    }
  }, [layers]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Handle Pointer Drawing
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    isDrawingRef.current = true;
    currentPointsRef.current = [[x, y, pressure]];

    if (tool === 'eraser') {
      eraseAt([x, y]);
    }
  };

  const eraseAt = (point: [number, number]) => {
    const eraseRadius = size * 3;
    setLayers((prevLayers) => {
      const activeLayer = prevLayers[activeLayerIndex];
      const remainingStrokes = activeLayer.strokes.filter((s) => {
        // Simple hit test against stroke points
        return !s.points.some((p) => Math.hypot(p[0] - point[0], p[1] - point[1]) < eraseRadius);
      });
      if (remainingStrokes.length !== activeLayer.strokes.length) {
        const next = [...prevLayers];
        next[activeLayerIndex] = { ...activeLayer, strokes: remainingStrokes };
        return next;
      }
      return prevLayers;
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;

    if (tool === 'eraser') {
      eraseAt([x, y]);
      return;
    }

    currentPointsRef.current.push([x, y, pressure]);

    // Live preview stroke
    const ctx = canvas.getContext('2d');
    if (ctx && currentPointsRef.current.length > 1) {
      const tempStroke: Stroke = {
        id: 'preview',
        tool,
        color,
        size,
        points: currentPointsRef.current,
      };
      redraw();
      ctx.save();
      if (tool === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.globalCompositeOperation = 'multiply';
      } else {
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = color;
      const outline = getStrokeOutline(tempStroke);
      const pathData = getSvgPathFromStroke(outline);
      if (pathData) ctx.fill(new Path2D(pathData));
      ctx.restore();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (tool === 'eraser') {
      return;
    }

    if (currentPointsRef.current.length < 2) {
      currentPointsRef.current = [];
      return;
    }

    // Save previous state to history
    setHistory((prev) => [...prev.slice(-20), layers]);
    setRedoStack([]);

    let finalPoints = currentPointsRef.current;

    // Apply real-time shape recognition if enabled
    if (smartShapes && tool !== 'highlighter') {
      const result = recognizeAndSnapShape(finalPoints);
      if (result.shape) {
        finalPoints = result.points;
      }
    }

    const newStroke: Stroke = {
      id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tool,
      color,
      size,
      points: finalPoints,
    };

    setLayers((prev) => {
      const next = [...prev];
      next[activeLayerIndex] = {
        ...next[activeLayerIndex],
        strokes: [...next[activeLayerIndex].strokes, newStroke],
      };
      return next;
    });

    currentPointsRef.current = [];
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setRedoStack((prev) => [...prev, layers]);
    setLayers(last);
    setHistory((prev) => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, layers]);
    setLayers(next);
    setRedoStack((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (confirm('Clear current drawing?')) {
      setHistory((prev) => [...prev, layers]);
      setLayers((prev) => {
        const next = [...prev];
        next[activeLayerIndex] = { ...next[activeLayerIndex], strokes: [] };
        return next;
      });
    }
  };

  // Generate crisp standalone SVG
  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    let svgPaths = '';
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (const stroke of layer.strokes) {
        const outline = getStrokeOutline(stroke);
        const d = getSvgPathFromStroke(outline);
        if (d) {
          const opacity = stroke.tool === 'highlighter' ? '0.35' : '1.0';
          svgPaths += `<path d="${d}" fill="${stroke.color}" opacity="${opacity}" />`;
        }
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">${svgPaths}</svg>`;
    const serialized = JSON.stringify(layers);

    onSave(svg, serialized);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-surface border border-border rounded-card shadow-pop w-full max-w-2xl flex flex-col overflow-hidden max-h-[95vh]">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-accent-soft text-accent">
              <Pen className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-sm text-ink">{title}</h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-accent text-accent-ink font-semibold text-xs shadow-xs hover:opacity-90 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Done</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-surface-2 text-ink-muted hover:text-ink cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-2 sm:px-4 border-b border-border bg-surface-2/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Tool selector */}
          <div className="flex items-center gap-1 bg-surface rounded-xl p-1 border border-border">
            <button
              type="button"
              onClick={() => setTool('pen')}
              className={`p-1.5 rounded-lg flex items-center gap-1 cursor-pointer font-medium ${
                tool === 'pen' ? 'bg-accent text-accent-ink font-bold shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
              title="Pen (fine freehand)"
            >
              <Pen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pen</span>
            </button>

            <button
              type="button"
              onClick={() => setTool('highlighter')}
              className={`p-1.5 rounded-lg flex items-center gap-1 cursor-pointer font-medium ${
                tool === 'highlighter' ? 'bg-accent text-accent-ink font-bold shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
              title="Highlighter (semi-transparent)"
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Highlighter</span>
            </button>

            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`p-1.5 rounded-lg flex items-center gap-1 cursor-pointer font-medium ${
                tool === 'eraser' ? 'bg-accent text-accent-ink font-bold shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
              title="Eraser"
            >
              <Eraser className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Eraser</span>
            </button>
          </div>

          {/* Color swatches */}
          {tool !== 'eraser' && (
            <div className="flex items-center gap-1.5">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full border border-border/80 cursor-pointer transition-transform ${
                    color === c ? 'scale-125 ring-2 ring-accent' : 'hover:scale-110'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Controls: Thickness, Smart Shapes, Layer, Undo/Redo */}
          <div className="flex items-center gap-2">
            {/* Stroke size selector */}
            <div className="flex items-center gap-1.5">
              <input
                type="range"
                min="2"
                max="24"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-16 accent-accent h-1.5 cursor-pointer"
                title={`Thickness: ${size}px`}
              />
            </div>

            {/* Smart shape recognition toggle */}
            <button
              type="button"
              onClick={() => setSmartShapes(!smartShapes)}
              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                smartShapes
                  ? 'bg-accent-soft border-accent/40 text-accent'
                  : 'bg-surface border-border text-ink-muted hover:text-ink'
              }`}
              title="Auto-snap rough circles, rectangles & lines"
            >
              <Sparkles className="w-3 h-3" />
              <span className="hidden sm:inline">Shapes</span>
            </button>

            {/* Layer selector */}
            <div className="flex items-center bg-surface border border-border rounded-lg p-0.5">
              {layers.map((l, idx) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setActiveLayerIndex(idx)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    activeLayerIndex === idx ? 'bg-accent text-accent-ink' : 'text-ink-muted'
                  }`}
                >
                  L{l.id}
                </button>
              ))}
            </div>

            {/* Undo / Redo / Clear */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="p-1.5 rounded-lg hover:bg-surface text-ink-muted disabled:opacity-30 cursor-pointer"
              title="Undo"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="p-1.5 rounded-lg hover:bg-surface text-ink-muted disabled:opacity-30 cursor-pointer"
              title="Redo"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-ink-muted hover:text-rose-500 cursor-pointer"
              title="Clear layer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="p-3 bg-surface-2 flex items-center justify-center overflow-hidden">
          <canvas
            ref={canvasRef}
            width={600}
            height={360}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full max-w-[600px] h-[360px] bg-surface rounded-xl border border-border shadow-xs touch-none cursor-crosshair"
          />
        </div>
      </div>
    </div>
  );
}
