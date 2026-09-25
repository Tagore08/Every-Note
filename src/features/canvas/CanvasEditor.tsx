import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { canvasRepo, createDefaultCanvasDoc } from '../../db/repos/canvasRepo';
import { attachmentsRepo } from '../../db/attachmentsRepo';
import { db } from '../../db/database';
import { useSnackbar } from '../../context/SnackbarContext';
import {
  screenToDoc,
  zoomAt,
  panBy,
  fitToScreen,
  clampZoom,
  type ViewportTransform,
} from './engine/transform';
import { hitTestStroke } from './engine/strokeGeometry';
import { CanvasHistory } from './engine/history';
import {
  renderStaticLayer,
  renderActiveLayer,
  exportDocToBlob,
  generateThumbnailBlob,
} from './engine/renderer';
import { LinkNoteModal } from './LinkNoteModal';
import type { CanvasDoc, CanvasEntity, InkTool, Stroke } from '../../types/canvas';

const PALETTE_COLORS = [
  '#18181b', // Ink Black
  '#ffffff', // White
  'oklch(0.62 0.16 25)',  // Coral / Health
  'oklch(0.58 0.13 250)', // Indigo / Work
  'oklch(0.66 0.14 145)', // Green / Personal
  'oklch(0.64 0.13 60)',  // Amber / Finance
  'oklch(0.60 0.14 310)', // Violet / Learning
  'oklch(0.63 0.10 200)', // Teal / Home
  'oklch(0.61 0.17 0)',   // Rose / Relationships
  'oklch(0.60 0.03 262)', // Slate / Other
];

const STROKE_SIZES = [
  { label: 'Fine', value: 4 },
  { label: 'Medium', value: 8 },
  { label: 'Broad', value: 16 },
];

function findLastIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

export function CanvasEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const numericId = id ? parseInt(id, 10) : undefined;

  const [canvasEntity, setCanvasEntity] = useState<CanvasEntity | null>(null);
  const [doc, setDoc] = useState<CanvasDoc>(createDefaultCanvasDoc());
  const [title, setTitle] = useState('Untitled drawing');
  const [linkedNoteTitle, setLinkedNoteTitle] = useState<string | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDocInfoOpen, setIsDocInfoOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Active drawing state
  const [tool, setTool] = useState<InkTool>('pen');
  const [color, setColor] = useState(PALETTE_COLORS[0]);
  const [size, setSize] = useState(8);

  // Viewport transform
  const [transform, setTransform] = useState<ViewportTransform>({
    panX: 40,
    panY: 40,
    zoom: 0.35,
  });

  // Canvas elements
  const containerRef = useRef<HTMLDivElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const activeCanvasRef = useRef<HTMLCanvasElement>(null);

  // References for mutable state without triggering rerenders during drawing
  const docRef = useRef<CanvasDoc>(doc);
  docRef.current = doc;

  const transformRef = useRef<ViewportTransform>(transform);
  transformRef.current = transform;

  const historyRef = useRef<CanvasHistory>(new CanvasHistory(50, []));
  const activeStrokeRef = useRef<Stroke | null>(null);
  const isPointerDownRef = useRef(false);
  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Autosave timers
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load canvas data
  useEffect(() => {
    if (!numericId) {
      // Create new canvas if no id
      canvasRepo.createCanvas().then((created) => {
        navigate(`/canvas/${created.id}`, { replace: true });
      });
      return;
    }

    canvasRepo.getCanvasById(numericId).then(async (entity) => {
      if (!entity) {
        showSnackbar({ message: 'Canvas not found.' });
        navigate('/canvas');
        return;
      }
      setCanvasEntity(entity);
      setTitle(entity.title || 'Untitled drawing');
      setDoc(entity.doc);
      historyRef.current = new CanvasHistory(50, entity.doc.strokes || []);

      if (entity.linkedNoteId) {
        const note = await db.notes.get(entity.linkedNoteId);
        setLinkedNoteTitle(note?.title || 'Untitled Note');
      } else {
        setLinkedNoteTitle(null);
      }

      // Initial fit to screen once container layout is available
      setTimeout(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const initialTransform = fitToScreen(
            entity.doc.width,
            entity.doc.height,
            rect.width,
            rect.height,
            32
          );
          setTransform(initialTransform);
        }
      }, 50);
    });
  }, [numericId, navigate, showSnackbar]);

  // Redraw static canvas layer whenever doc or transform changes
  const redrawStaticLayer = useCallback(() => {
    if (!staticCanvasRef.current) return;
    renderStaticLayer(staticCanvasRef.current, docRef.current, transformRef.current);
  }, []);

  useEffect(() => {
    redrawStaticLayer();
  }, [doc, transform, redrawStaticLayer]);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      redrawStaticLayer();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawStaticLayer]);

  // Debounced autosave
  const scheduleSave = useCallback(
    (newDoc: CanvasDoc) => {
      if (!numericId) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (thumbTimerRef.current) clearTimeout(thumbTimerRef.current);

      setIsSaving(true);

      // Debounce 1s doc save
      saveTimerRef.current = setTimeout(async () => {
        try {
          await canvasRepo.updateCanvasDoc(numericId, newDoc);
          setIsSaving(false);
        } catch (err) {
          console.error('Failed to autosave canvas doc:', err);
        }
      }, 1000);

      // Debounce 3s thumbnail generation
      thumbTimerRef.current = setTimeout(async () => {
        try {
          const thumbBlob = await generateThumbnailBlob(newDoc, 512);
          await canvasRepo.updateCanvasDoc(numericId, newDoc, thumbBlob);
        } catch (err) {
          console.error('Failed to generate canvas thumbnail:', err);
        }
      }, 3000);
    },
    [numericId]
  );

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (thumbTimerRef.current) clearTimeout(thumbTimerRef.current);
      if (numericId && docRef.current) {
        canvasRepo.updateCanvasDoc(numericId, docRef.current).catch(() => {});
      }
    };
  }, [numericId]);

  // Title edit handler
  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    if (numericId) {
      await canvasRepo.updateCanvasMetadata(numericId, { title: newTitle });
    }
  };

  // Undo / Redo handlers
  const handleUndo = () => {
    const prevStrokes = historyRef.current.undo();
    if (prevStrokes !== null) {
      const updatedDoc = { ...docRef.current, strokes: prevStrokes };
      setDoc(updatedDoc);
      scheduleSave(updatedDoc);
    }
  };

  const handleRedo = () => {
    const nextStrokes = historyRef.current.redo();
    if (nextStrokes !== null) {
      const updatedDoc = { ...docRef.current, strokes: nextStrokes };
      setDoc(updatedDoc);
      scheduleSave(updatedDoc);
    }
  };

  const handleClear = () => {
    if (doc.strokes.length === 0) return;
    historyRef.current.push([]);
    const updatedDoc = { ...docRef.current, strokes: [] };
    setDoc(updatedDoc);
    scheduleSave(updatedDoc);
    setIsMenuOpen(false);
    showSnackbar({ message: 'Canvas cleared.' });
  };

  // Zoom handlers
  const handleZoom = (direction: 'in' | 'out') => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const focalX = rect.width / 2;
    const focalY = rect.height / 2;
    const factor = direction === 'in' ? 1.25 : 0.8;
    const newZoom = clampZoom(transform.zoom * factor);
    setTransform((prev) => zoomAt(prev, focalX, focalY, newZoom));
  };

  const handleResetZoom = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const initialTransform = fitToScreen(doc.width, doc.height, rect.width, rect.height, 32);
    setTransform(initialTransform);
  };

  // Pointer event handlers for drawing and navigation
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // Multi-touch pinch start
    if (activePointersRef.current.size === 2) {
      isPointerDownRef.current = false;
      activeStrokeRef.current = null;
      if (activeCanvasRef.current) {
        renderActiveLayer(activeCanvasRef.current, null, transformRef.current);
      }
      const pts = Array.from(activePointersRef.current.values());
      lastTouchDistanceRef.current = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      lastTouchCenterRef.current = {
        x: (pts[0].clientX + pts[1].clientX) / 2 - rect.left,
        y: (pts[0].clientY + pts[1].clientY) / 2 - rect.top,
      };
      return;
    }

    if (activePointersRef.current.size > 2) return;

    // Capture pointer
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    isPointerDownRef.current = true;
    const [docX, docY] = screenToDoc(screenX, screenY, transformRef.current);

    if (tool === 'eraser') {
      // Stroke-level eraser hit testing
      const hitIndex = findLastIndex(docRef.current.strokes, (s) =>
        hitTestStroke(s, [docX, docY], size * 1.5)
      );
      if (hitIndex !== -1) {
        const remaining = docRef.current.strokes.filter((_, idx) => idx !== hitIndex);
        historyRef.current.push(remaining);
        const updated = { ...docRef.current, strokes: remaining };
        setDoc(updated);
        scheduleSave(updated);
      }
      return;
    }

    // Pen, brush, or highlighter
    const pressure = e.pointerType === 'mouse' ? 0.5 : e.pressure || 0.5;
    const newStroke: Stroke = {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tool,
      color,
      size,
      points: [[docX, docY, pressure]],
    };

    activeStrokeRef.current = newStroke;
    if (activeCanvasRef.current) {
      renderActiveLayer(activeCanvasRef.current, newStroke, transformRef.current);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    // 2-pointer pinch & pan
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].clientX - pts[1].clientX, pts[0].clientY - pts[1].clientY);
      const center = {
        x: (pts[0].clientX + pts[1].clientX) / 2 - rect.left,
        y: (pts[0].clientY + pts[1].clientY) / 2 - rect.top,
      };

      if (lastTouchDistanceRef.current && lastTouchCenterRef.current) {
        const scaleDelta = dist / lastTouchDistanceRef.current;
        const newZoom = clampZoom(transformRef.current.zoom * scaleDelta);
        let nextTransform = zoomAt(transformRef.current, center.x, center.y, newZoom);
        const panDeltaX = center.x - lastTouchCenterRef.current.x;
        const panDeltaY = center.y - lastTouchCenterRef.current.y;
        nextTransform = panBy(nextTransform, panDeltaX, panDeltaY);
        setTransform(nextTransform);
      }

      lastTouchDistanceRef.current = dist;
      lastTouchCenterRef.current = center;
      return;
    }

    if (!isPointerDownRef.current) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const [docX, docY] = screenToDoc(screenX, screenY, transformRef.current);

    if (tool === 'eraser') {
      const hitIndex = findLastIndex(docRef.current.strokes, (s) =>
        hitTestStroke(s, [docX, docY], size * 1.5)
      );
      if (hitIndex !== -1) {
        const remaining = docRef.current.strokes.filter((_, idx) => idx !== hitIndex);
        historyRef.current.push(remaining);
        const updated = { ...docRef.current, strokes: remaining };
        setDoc(updated);
        scheduleSave(updated);
      }
      return;
    }

    // Process coalesced events for smooth stroke paths
    const active = activeStrokeRef.current;
    if (!active) return;

    const events = (e.nativeEvent as any).getCoalescedEvents
      ? (e.nativeEvent as any).getCoalescedEvents()
      : [e.nativeEvent];

    for (const ev of events) {
      const sx = ev.clientX - rect.left;
      const sy = ev.clientY - rect.top;
      const [dx, dy] = screenToDoc(sx, sy, transformRef.current);
      const p = ev.pointerType === 'mouse' ? 0.5 : ev.pressure || 0.5;
      active.points.push([dx, dy, p]);
    }

    if (activeCanvasRef.current) {
      requestAnimationFrame(() => {
        if (activeCanvasRef.current && activeStrokeRef.current) {
          renderActiveLayer(activeCanvasRef.current, activeStrokeRef.current, transformRef.current);
        }
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      lastTouchDistanceRef.current = null;
      lastTouchCenterRef.current = null;
    }

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    const active = activeStrokeRef.current;
    if (active && active.points.length > 0) {
      const newStrokes = [...docRef.current.strokes, active];
      historyRef.current.push(newStrokes);
      const updated = { ...docRef.current, strokes: newStrokes };
      setDoc(updated);
      scheduleSave(updated);
    }

    activeStrokeRef.current = null;
    if (activeCanvasRef.current) {
      renderActiveLayer(activeCanvasRef.current, null, transformRef.current);
    }
  };

  // Wheel zoom / pan
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const focalX = e.clientX - rect.left;
    const focalY = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      // Trackpad pinch or mouse wheel zoom
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      const newZoom = clampZoom(transform.zoom * zoomFactor);
      setTransform((prev) => zoomAt(prev, focalX, focalY, newZoom));
    } else {
      // 2-finger scroll or wheel pan
      setTransform((prev) => panBy(prev, -e.deltaX, -e.deltaY));
    }
  };

  // Note link selection
  const handleSelectLinkedNote = async (noteId: number | null) => {
    if (!numericId) return;
    await canvasRepo.updateCanvasMetadata(numericId, { linkedNoteId: noteId });
    if (noteId) {
      const note = await db.notes.get(noteId);
      setLinkedNoteTitle(note?.title || 'Untitled Note');
      showSnackbar({ message: 'Linked canvas to note.' });
    } else {
      setLinkedNoteTitle(null);
      showSnackbar({ message: 'Unlinked canvas from note.' });
    }
  };

  // Export handlers
  const handleDownloadPNG = async () => {
    try {
      const blob = await exportDocToBlob(docRef.current, 2.0);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'canvas'}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setIsExportModalOpen(false);
      showSnackbar({ message: 'Downloaded 2× HD PNG image.' });
    } catch (err) {
      console.error('Failed to export PNG:', err);
      showSnackbar({ message: 'Failed to export image.' });
    }
  };

  const handleAttachToLinkedNote = async () => {
    if (!numericId) return;
    let targetNoteId = canvasEntity?.linkedNoteId;
    if (!targetNoteId) {
      setIsExportModalOpen(false);
      setIsLinkModalOpen(true);
      showSnackbar({ message: 'Please link this canvas to a note first.' });
      return;
    }

    try {
      const blob = await exportDocToBlob(docRef.current, 2.0);
      const fileName = `${title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'canvas'}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });
      await attachmentsRepo.addFileAttachment(targetNoteId, file);
      setIsExportModalOpen(false);
      showSnackbar({ message: `Attached drawing image to "${linkedNoteTitle || 'note'}"!` });
    } catch (err) {
      console.error('Failed to attach PNG to note:', err);
      showSnackbar({ message: 'Failed to attach image to note.' });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen w-full select-none overflow-hidden bg-surface-2 text-ink">
      {/* Top Bar */}
      <header className="h-14 border-b border-border bg-surface px-3 flex items-center justify-between gap-2 z-20 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/canvas')}
            className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
            title="Back to Canvases"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Inline editable title */}
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="font-semibold text-sm md:text-base text-ink bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-hidden px-1 py-0.5 rounded-xs transition-colors max-w-[140px] sm:max-w-[240px] truncate"
            placeholder="Untitled drawing"
          />

          {isSaving && (
            <span className="text-xs text-ink-muted hidden sm:inline animate-pulse">
              Saving…
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center border border-border rounded-lg bg-surface-2 overflow-hidden">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!historyRef.current.canUndo()}
              className="p-1.5 text-ink-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Undo (Ctrl+Z)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
            </button>
            <div className="w-px h-4 bg-border" />
            <button
              type="button"
              onClick={handleRedo}
              disabled={!historyRef.current.canRedo()}
              className="p-1.5 text-ink-muted hover:text-ink disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Redo (Ctrl+Y)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
              </svg>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="hidden sm:flex items-center border border-border rounded-lg bg-surface-2 text-xs font-medium text-ink px-1">
            <button
              type="button"
              onClick={() => handleZoom('out')}
              className="p-1 hover:text-accent cursor-pointer"
              title="Zoom Out"
            >
              -
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1.5 hover:text-accent cursor-pointer"
              title="Fit to Screen"
            >
              {Math.round(transform.zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => handleZoom('in')}
              className="p-1 hover:text-accent cursor-pointer"
              title="Zoom In"
            >
              +
            </button>
          </div>

          {/* Link to note button */}
          <button
            type="button"
            onClick={() => setIsLinkModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer max-w-[130px] truncate ${
              linkedNoteTitle
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'bg-surface-2 border-border text-ink-muted hover:text-ink'
            }`}
            title={linkedNoteTitle ? `Linked to: ${linkedNoteTitle}` : 'Link to a note'}
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span className="truncate">{linkedNoteTitle || 'Link note'}</span>
          </button>

          {/* Export PNG */}
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:opacity-90 transition-opacity cursor-pointer"
            title="Export PNG (2× HD)"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* ⋯ Overflow menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
              title="More options"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>

            {isMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 bg-surface rounded-card border border-border shadow-float py-1.5 z-30"
                onClick={() => setIsMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={handleClear}
                  className="w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-surface-2 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                  Clear Canvas
                </button>
                <button
                  type="button"
                  onClick={() => setIsDocInfoOpen(true)}
                  className="w-full text-left px-3 py-2 text-xs text-ink hover:bg-surface-2 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  Document Info
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Viewport Container */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className="relative flex-1 w-full h-full overflow-hidden bg-slate-900/5 dark:bg-black/40 touch-none cursor-crosshair"
      >
        {/* Static Layer: All committed strokes */}
        <canvas
          ref={staticCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Active Layer: Current drawing stroke and interactive pointer surface */}
        <canvas
          ref={activeCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ touchAction: 'none' }}
        />

        {/* Bottom Pill Toolbar */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 rounded-pill bg-surface/90 dark:bg-surface/95 backdrop-blur-md border border-border shadow-float">
          {/* Tools: Pen, Brush, Highlighter, Eraser */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTool('pen')}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                tool === 'pen'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-2'
              }`}
              title="Pen (Vector tapered stroke)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19l7-7 3 3-7 7-3-3z" />
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                <path d="M2 2l7.586 7.586" />
                <circle cx="11" cy="11" r="2" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setTool('brush')}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                tool === 'brush'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-2'
              }`}
              title="Brush (Softer textured stroke)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
                <path d="M7.07 14.94c-1.66 0-3 1.34-3 3 0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2 2.21 0 4-1.79 4-4 0-1.66-1.34-3-3-3z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setTool('highlighter')}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                tool === 'highlighter'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-2'
              }`}
              title="Highlighter (Translucent multiply)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 11-6 6v3h3l6-6" />
                <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`p-2 rounded-full transition-colors cursor-pointer ${
                tool === 'eraser'
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-2'
              }`}
              title="Eraser (Whole stroke removal)"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                <path d="M22 21H7" />
                <path d="m5 11 9 9" />
              </svg>
            </button>
          </div>

          <div className="w-px h-5 bg-border my-auto" />

          {/* Color palette */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[180px] sm:max-w-none px-0.5 py-0.5">
            {PALETTE_COLORS.map((c) => {
              const isSelected = tool !== 'eraser' && color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    if (tool === 'eraser') setTool('pen');
                  }}
                  className={`w-6 h-6 rounded-full border border-black/10 dark:border-white/20 transition-transform cursor-pointer shrink-0 ${
                    isSelected ? 'ring-2 ring-accent ring-offset-1 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              );
            })}
          </div>

          <div className="w-px h-5 bg-border my-auto" />

          {/* Size dots: 3 sizes */}
          <div className="flex items-center gap-1">
            {STROKE_SIZES.map((s) => {
              const isSelected = size === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSize(s.value)}
                  className={`p-1.5 rounded-full transition-colors cursor-pointer flex items-center justify-center ${
                    isSelected ? 'bg-surface-2 text-accent' : 'text-ink-muted hover:text-ink'
                  }`}
                  title={`${s.label} (${s.value}px)`}
                >
                  <div
                    className="rounded-full bg-current"
                    style={{
                      width: s.value === 4 ? 6 : s.value === 8 ? 10 : 14,
                      height: s.value === 4 ? 6 : s.value === 8 ? 10 : 14,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Note Link Modal */}
      <LinkNoteModal
        isOpen={isLinkModalOpen}
        currentNoteId={canvasEntity?.linkedNoteId}
        onClose={() => setIsLinkModalOpen(false)}
        onSelectNote={handleSelectLinkedNote}
      />

      {/* Export Modal */}
      {isExportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setIsExportModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-surface rounded-card border border-border shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink text-base">Export Canvas</h3>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-ink-muted leading-relaxed">
              Export a crisp 2× HD PNG image (6000 × 4000 px) of this drawing.
            </p>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadPNG}
                className="w-full py-2.5 px-4 rounded-lg bg-accent text-white font-medium text-sm hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PNG (2× HD)
              </button>

              <button
                type="button"
                onClick={handleAttachToLinkedNote}
                className="w-full py-2.5 px-4 rounded-lg bg-surface-2 border border-border text-ink font-medium text-sm hover:bg-surface transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                {linkedNoteTitle ? `Attach to "${linkedNoteTitle}"` : 'Link & Attach to Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Doc Info Modal */}
      {isDocInfoOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setIsDocInfoOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-surface rounded-card border border-border shadow-xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink text-base">Document Info</h3>
              <button
                type="button"
                onClick={() => setIsDocInfoOpen(false)}
                className="text-ink-muted hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs divide-y divide-border/60">
              <div className="flex justify-between py-1.5">
                <span className="text-ink-muted">Page Dimensions</span>
                <span className="font-medium text-ink">3000 × 2000 px</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-ink-muted">Strokes Count</span>
                <span className="font-medium text-ink">{doc.strokes.length} strokes</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-ink-muted">Linked Note</span>
                <span className="font-medium text-ink">{linkedNoteTitle || 'None'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-ink-muted">Last Modified</span>
                <span className="font-medium text-ink">
                  {canvasEntity?.updatedAt ? new Date(canvasEntity.updatedAt).toLocaleTimeString() : 'Just now'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
