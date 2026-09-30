import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { canvasRepo, createDefaultCanvasDoc } from '../../db/repos/canvasRepo';
import { attachmentsRepo } from '../../db/attachmentsRepo';
import { db } from '../../db/database';
import { useSnackbar } from '../../context/SnackbarContext';
import {
  screenToDoc,
  docToScreen,
  zoomAt,
  panBy,
  fitToScreen,
  clampZoom,
  type ViewportTransform,
} from './engine/transform';
import { hitTestStroke } from './engine/strokeGeometry';
import { hitTestElement, hitTestHandle, type ResizeHandle } from './engine/excalidrawRenderer';
import { CanvasHistory } from './engine/history';
import {
  renderStaticLayer,
  renderActiveLayer,
  exportDocToBlob,
  generateThumbnailBlob,
} from './engine/renderer';
import { LinkNoteModal } from './LinkNoteModal';
import { EmbedNoteModal } from './EmbedNoteModal';
import { ExcalidrawStylePopover } from './ExcalidrawStylePopover';
import type {
  CanvasDoc,
  CanvasEntity,
  CanvasElement,
  ExcalidrawTool,
  Stroke,
  FillStyle,
  StrokeStyle,
} from '../../types/canvas';

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
  const [isEmbedNoteModalOpen, setIsEmbedNoteModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDocInfoOpen, setIsDocInfoOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Active Tool & Style Defaults
  const [tool, setTool] = useState<ExcalidrawTool>('select');
  const [strokeColor, setStrokeColor] = useState('#18181b');
  const [bgColor, setBgColor] = useState('transparent');
  const [fillStyle, setFillStyle] = useState<FillStyle>('none');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeStyle, setStrokeStyle] = useState<StrokeStyle>('solid');
  const [roughness, setRoughness] = useState(1);
  const [roundness, setRoundness] = useState(1);

  // Selection & Properties
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isStylePanelOpen, setIsStylePanelOpen] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Grid Mode (dots, grid, none)
  const [gridMode, setGridMode] = useState<'dots' | 'grid' | 'none'>(() => {
    return (localStorage.getItem('canvas_grid_mode') as 'dots' | 'grid' | 'none') || 'dots';
  });

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

  // References for mutable state without triggering rerenders during drawing/dragging
  const docRef = useRef<CanvasDoc>(doc);
  docRef.current = doc;

  const transformRef = useRef<ViewportTransform>(transform);
  transformRef.current = transform;

  const historyRef = useRef<CanvasHistory<{ strokes: Stroke[]; elements: CanvasElement[] }>>(
    new CanvasHistory(50, { strokes: [], elements: [] })
  );

  const activeStrokeRef = useRef<Stroke | null>(null);
  const activeElementRef = useRef<CanvasElement | null>(null);
  const isPointerDownRef = useRef(false);
  const pointerStartPosRef = useRef<[number, number]>([0, 0]);

  // Resizing / Dragging / Panning interaction state
  const draggingOriginRef = useRef<{ x: number; y: number; elX: number; elY: number } | null>(null);
  const resizeOriginRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    elX: number;
    elY: number;
    handle: ResizeHandle;
  } | null>(null);

  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);

  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const lastTouchDistanceRef = useRef<number | null>(null);
  const lastTouchCenterRef = useRef<{ x: number; y: number } | null>(null);

  // Autosave timers
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load canvas data
  useEffect(() => {
    if (!numericId) {
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

      const initialDoc: CanvasDoc = {
        ...entity.doc,
        elements: entity.doc.elements || [],
        strokes: entity.doc.strokes || [],
      };
      setDoc(initialDoc);
      historyRef.current = new CanvasHistory(50, {
        strokes: initialDoc.strokes,
        elements: initialDoc.elements || [],
      });

      if (entity.linkedNoteId) {
        const note = await db.notes.get(entity.linkedNoteId);
        setLinkedNoteTitle(note?.title || 'Untitled Note');
      } else {
        setLinkedNoteTitle(null);
      }

      // Initial fit to screen once container layout is ready
      setTimeout(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const initialTransform = fitToScreen(
            initialDoc.width,
            initialDoc.height,
            rect.width,
            rect.height,
            32
          );
          setTransform(initialTransform);
        }
      }, 50);
    });
  }, [numericId, navigate, showSnackbar]);

  // Redraw static canvas layer whenever doc, transform, selectedElementId, or gridMode changes
  const redrawStaticLayer = useCallback(() => {
    if (!staticCanvasRef.current) return;
    renderStaticLayer(
      staticCanvasRef.current,
      docRef.current,
      transformRef.current,
      window.devicePixelRatio || 1,
      selectedElementId,
      gridMode
    );
  }, [selectedElementId, gridMode]);

  useEffect(() => {
    redrawStaticLayer();
  }, [doc, transform, selectedElementId, gridMode, redrawStaticLayer]);

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

      saveTimerRef.current = setTimeout(async () => {
        try {
          await canvasRepo.updateCanvasDoc(numericId, newDoc);
          setIsSaving(false);
        } catch (err) {
          console.error('Failed to autosave canvas doc:', err);
        }
      }, 1000);

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

  // Push state to history & save
  const commitCanvasState = useCallback(
    (newStrokes: Stroke[], newElements: CanvasElement[]) => {
      historyRef.current.push({ strokes: newStrokes, elements: newElements });
      const updatedDoc: CanvasDoc = {
        ...docRef.current,
        strokes: newStrokes,
        elements: newElements,
      };
      setDoc(updatedDoc);
      scheduleSave(updatedDoc);
    },
    [scheduleSave]
  );

  // Title edit handler
  const handleTitleChange = async (newTitle: string) => {
    setTitle(newTitle);
    if (numericId) {
      await canvasRepo.updateCanvasMetadata(numericId, { title: newTitle });
    }
  };

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    const prevState = historyRef.current.undo();
    if (prevState) {
      const updatedDoc: CanvasDoc = {
        ...docRef.current,
        strokes: prevState.strokes,
        elements: prevState.elements,
      };
      setDoc(updatedDoc);
      scheduleSave(updatedDoc);
    }
  }, [scheduleSave]);

  const handleRedo = useCallback(() => {
    const nextState = historyRef.current.redo();
    if (nextState) {
      const updatedDoc: CanvasDoc = {
        ...docRef.current,
        strokes: nextState.strokes,
        elements: nextState.elements,
      };
      setDoc(updatedDoc);
      scheduleSave(updatedDoc);
    }
  }, [scheduleSave]);

  // Element actions: Update, Delete, Duplicate
  const handleUpdateElement = useCallback(
    (patch: Partial<CanvasElement>) => {
      if (!selectedElementId) {
        // Update default styles for new elements
        if (patch.strokeColor) setStrokeColor(patch.strokeColor);
        if (patch.backgroundColor) setBgColor(patch.backgroundColor);
        if (patch.fillStyle) setFillStyle(patch.fillStyle);
        if (patch.strokeWidth) setStrokeWidth(patch.strokeWidth);
        if (patch.strokeStyle) setStrokeStyle(patch.strokeStyle);
        if (patch.roughness !== undefined) setRoughness(patch.roughness);
        if (patch.roundness !== undefined) setRoundness(patch.roundness);
        return;
      }

      const elements = (docRef.current.elements || []).map((el) =>
        el.id === selectedElementId ? { ...el, ...patch } : el
      );
      commitCanvasState(docRef.current.strokes, elements);
    },
    [selectedElementId, commitCanvasState]
  );

  const handleDeleteElement = useCallback(() => {
    if (!selectedElementId) return;
    const elements = (docRef.current.elements || []).filter((el) => el.id !== selectedElementId);
    setSelectedElementId(null);
    commitCanvasState(docRef.current.strokes, elements);
    showSnackbar({ message: 'Element deleted.' });
  }, [selectedElementId, commitCanvasState, showSnackbar]);

  const handleDuplicateElement = useCallback(() => {
    if (!selectedElementId) return;
    const el = (docRef.current.elements || []).find((e) => e.id === selectedElementId);
    if (!el) return;
    const duplicated: CanvasElement = {
      ...el,
      id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      x: el.x + 24,
      y: el.y + 24,
    };
    const elements = [...(docRef.current.elements || []), duplicated];
    setSelectedElementId(duplicated.id);
    commitCanvasState(docRef.current.strokes, elements);
    showSnackbar({ message: 'Element duplicated.' });
  }, [selectedElementId, commitCanvasState, showSnackbar]);

  const handleClear = () => {
    if (doc.strokes.length === 0 && (!doc.elements || doc.elements.length === 0)) return;
    commitCanvasState([], []);
    setSelectedElementId(null);
    setIsMenuOpen(false);
    showSnackbar({ message: 'Canvas cleared.' });
  };

  // Grid toggle (dots -> grid -> none)
  const handleToggleGrid = () => {
    const next = gridMode === 'dots' ? 'grid' : gridMode === 'grid' ? 'none' : 'dots';
    setGridMode(next);
    localStorage.setItem('canvas_grid_mode', next);
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

  // Embed Note Card Handler
  const handleSelectNoteToEmbed = (note: { id: number; title: string; content?: string }) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const [centerX, centerY] = screenToDoc(rect.width / 2, rect.height / 2, transformRef.current);

    const newCard: CanvasElement = {
      id: `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'card',
      x: Math.max(20, Math.min(2700, centerX - 110)),
      y: Math.max(20, Math.min(1800, centerY - 60)),
      width: 240,
      height: 120,
      strokeColor: '#3b82f6',
      backgroundColor: '#ffffff',
      fillStyle: 'solid',
      strokeWidth: 2,
      strokeStyle: 'solid',
      roughness: 0,
      roundness: 1,
      noteId: note.id,
      noteTitle: note.title,
      text: note.content ? note.content.replace(/<[^>]+>/g, '').slice(0, 100) : '',
    };

    const elements = [...(docRef.current.elements || []), newCard];
    commitCanvasState(docRef.current.strokes, elements);
    setSelectedElementId(newCard.id);
    setTool('select');
    showSnackbar({ message: `Embedded note "${note.title}".` });
  };

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateElement();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElementId) {
          e.preventDefault();
          handleDeleteElement();
          return;
        }
      }

      if (e.key === 'Escape') {
        setSelectedElementId(null);
        setEditingTextId(null);
        setTool('select');
        return;
      }

      // Tool switching shortcuts
      switch (e.key.toLowerCase()) {
        case 'h':
          setTool('hand');
          break;
        case 'v':
        case '1':
          setTool('select');
          break;
        case 'r':
        case '2':
          setTool('rectangle');
          break;
        case 'd':
        case '3':
          setTool('diamond');
          break;
        case 'e':
        case 'o':
        case '4':
          setTool('ellipse');
          break;
        case 'a':
        case '5':
          setTool('arrow');
          break;
        case 'l':
        case '6':
          setTool('line');
          break;
        case 'p':
        case '7':
          setTool('pen');
          break;
        case 't':
        case '8':
          setTool('text');
          break;
        case 'n':
        case '9':
          setIsEmbedNoteModalOpen(true);
          break;
        case 'x':
        case '0':
          setTool('eraser');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementId, handleUndo, handleRedo, handleDeleteElement, handleDuplicateElement]);

  // Pointer event handlers for drawing, shape creation, selecting, resizing, and panning
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
      activeElementRef.current = null;
      if (activeCanvasRef.current) {
        renderActiveLayer(activeCanvasRef.current, null, transformRef.current);
      }
      const pts = Array.from(activePointersRef.current.values());
      lastTouchDistanceRef.current = Math.hypot(
        pts[0].clientX - pts[1].clientX,
        pts[0].clientY - pts[1].clientY
      );
      lastTouchCenterRef.current = {
        x: (pts[0].clientX + pts[1].clientX) / 2 - rect.left,
        y: (pts[0].clientY + pts[1].clientY) / 2 - rect.top,
      };
      return;
    }

    if (activePointersRef.current.size > 2) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    isPointerDownRef.current = true;
    const [docX, docY] = screenToDoc(screenX, screenY, transformRef.current);
    pointerStartPosRef.current = [docX, docY];

    // Case 1: Hand tool or Middle-click pan
    if (tool === 'hand' || e.button === 1) {
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: transformRef.current.panX,
        panY: transformRef.current.panY,
      };
      return;
    }

    // Case 2: Select Tool
    if (tool === 'select') {
      // 2a. Check if clicking on a resize handle of currently selected element
      if (selectedElementId) {
        const curEl = (docRef.current.elements || []).find((el) => el.id === selectedElementId);
        if (curEl) {
          const handle = hitTestHandle(curEl, docX, docY, transformRef.current.zoom);
          if (handle) {
            resizeOriginRef.current = {
              x: docX,
              y: docY,
              width: curEl.width,
              height: curEl.height,
              elX: curEl.x,
              elY: curEl.y,
              handle,
            };
            return;
          }
        }
      }

      // 2b. Hit test elements from top to bottom
      const hit = (docRef.current.elements || []).slice().reverse().find((el) => hitTestElement(el, docX, docY));
      if (hit) {
        setSelectedElementId(hit.id);
        draggingOriginRef.current = {
          x: docX,
          y: docY,
          elX: hit.x,
          elY: hit.y,
        };
        return;
      }

      // 2c. Clicked empty space: deselect
      setSelectedElementId(null);
      setEditingTextId(null);
      return;
    }

    // Case 3: Eraser Tool
    if (tool === 'eraser') {
      // Check elements first
      const hitIndex = (docRef.current.elements || []).findIndex((el) => hitTestElement(el, docX, docY));
      if (hitIndex !== -1) {
        const remaining = (docRef.current.elements || []).filter((_, idx) => idx !== hitIndex);
        commitCanvasState(docRef.current.strokes, remaining);
        if (selectedElementId === docRef.current.elements?.[hitIndex]?.id) {
          setSelectedElementId(null);
        }
        return;
      }

      // Check strokes
      const hitStrokeIdx = findLastIndex(docRef.current.strokes, (s) =>
        hitTestStroke(s, [docX, docY], 16)
      );
      if (hitStrokeIdx !== -1) {
        const remaining = docRef.current.strokes.filter((_, idx) => idx !== hitStrokeIdx);
        commitCanvasState(remaining, docRef.current.elements || []);
      }
      return;
    }

    // Case 4: Text Tool
    if (tool === 'text') {
      const newTextEl: CanvasElement = {
        id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'text',
        x: docX,
        y: docY,
        width: 140,
        height: 36,
        strokeColor,
        backgroundColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 0,
        roundness: 0,
        text: 'Text here...',
        fontSize: 22,
      };

      const elements = [...(docRef.current.elements || []), newTextEl];
      commitCanvasState(docRef.current.strokes, elements);
      setSelectedElementId(newTextEl.id);
      setEditingTextId(newTextEl.id);
      setTool('select');
      isPointerDownRef.current = false;
      return;
    }

    // Case 5: Shape Tools (rectangle, diamond, ellipse, arrow, line)
    if (['rectangle', 'diamond', 'ellipse', 'arrow', 'line'].includes(tool)) {
      const newShape: CanvasElement = {
        id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: tool as any,
        x: docX,
        y: docY,
        width: 1,
        height: 1,
        strokeColor,
        backgroundColor: bgColor,
        fillStyle,
        strokeWidth,
        strokeStyle,
        roughness,
        roundness,
        points: tool === 'arrow' || tool === 'line' ? [[0, 0], [1, 1]] : undefined,
      };

      activeElementRef.current = newShape;
      if (activeCanvasRef.current) {
        renderActiveLayer(
          activeCanvasRef.current,
          null,
          transformRef.current,
          window.devicePixelRatio || 1,
          newShape
        );
      }
      return;
    }

    // Case 6: Freehand Ink Tools (pen, brush, highlighter)
    const pressure = e.pointerType === 'mouse' ? 0.5 : e.pressure || 0.5;
    const newStroke: Stroke = {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tool: tool as any,
      color: strokeColor,
      size: strokeWidth * 2,
      points: [[docX, docY, pressure]],
    };

    activeStrokeRef.current = newStroke;
    if (activeCanvasRef.current) {
      renderActiveLayer(
        activeCanvasRef.current,
        newStroke,
        transformRef.current,
        window.devicePixelRatio || 1
      );
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

    // Panning canvas
    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform((prev) => ({
        ...prev,
        panX: panStartRef.current!.panX + dx,
        panY: panStartRef.current!.panY + dy,
      }));
      return;
    }

    if (!isPointerDownRef.current) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const [docX, docY] = screenToDoc(screenX, screenY, transformRef.current);

    // Resizing element via handle
    if (resizeOriginRef.current && selectedElementId) {
      const orig = resizeOriginRef.current;
      const dx = docX - orig.x;
      const dy = docY - orig.y;

      const elements = (docRef.current.elements || []).map((el) => {
        if (el.id !== selectedElementId) return el;

        let nextX = orig.elX;
        let nextY = orig.elY;
        let nextW = orig.width;
        let nextH = orig.height;

        switch (orig.handle) {
          case 'se':
            nextW = Math.max(20, orig.width + dx);
            nextH = Math.max(20, orig.height + dy);
            break;
          case 'sw':
            nextX = orig.elX + dx;
            nextW = Math.max(20, orig.width - dx);
            nextH = Math.max(20, orig.height + dy);
            break;
          case 'ne':
            nextY = orig.elY + dy;
            nextW = Math.max(20, orig.width + dx);
            nextH = Math.max(20, orig.height - dy);
            break;
          case 'nw':
            nextX = orig.elX + dx;
            nextY = orig.elY + dy;
            nextW = Math.max(20, orig.width - dx);
            nextH = Math.max(20, orig.height - dy);
            break;
          case 'e':
            nextW = Math.max(20, orig.width + dx);
            break;
          case 'w':
            nextX = orig.elX + dx;
            nextW = Math.max(20, orig.width - dx);
            break;
          case 's':
            nextH = Math.max(20, orig.height + dy);
            break;
          case 'n':
            nextY = orig.elY + dy;
            nextH = Math.max(20, orig.height - dy);
            break;
        }

        return { ...el, x: nextX, y: nextY, width: nextW, height: nextH };
      });

      docRef.current.elements = elements;
      redrawStaticLayer();
      return;
    }

    // Dragging element
    if (draggingOriginRef.current && selectedElementId) {
      const orig = draggingOriginRef.current;
      const dx = docX - orig.x;
      const dy = docY - orig.y;

      const elements = (docRef.current.elements || []).map((el) =>
        el.id === selectedElementId ? { ...el, x: orig.elX + dx, y: orig.elY + dy } : el
      );

      docRef.current.elements = elements;
      redrawStaticLayer();
      return;
    }

    // Creating shape in real time
    if (activeElementRef.current) {
      const startX = pointerStartPosRef.current[0];
      const startY = pointerStartPosRef.current[1];
      const curShape = activeElementRef.current;

      if (curShape.type === 'arrow' || curShape.type === 'line') {
        curShape.width = docX - startX;
        curShape.height = docY - startY;
        curShape.points = [[0, 0], [docX - startX, docY - startY]];
      } else {
        curShape.x = Math.min(startX, docX);
        curShape.y = Math.min(startY, docY);
        curShape.width = Math.max(2, Math.abs(docX - startX));
        curShape.height = Math.max(2, Math.abs(docY - startY));
      }

      if (activeCanvasRef.current) {
        requestAnimationFrame(() => {
          if (activeCanvasRef.current && activeElementRef.current) {
            renderActiveLayer(
              activeCanvasRef.current,
              null,
              transformRef.current,
              window.devicePixelRatio || 1,
              activeElementRef.current
            );
          }
        });
      }
      return;
    }

    // Continuous stroke eraser
    if (tool === 'eraser') {
      const hitIndex = findLastIndex(docRef.current.strokes, (s) =>
        hitTestStroke(s, [docX, docY], 16)
      );
      if (hitIndex !== -1) {
        const remaining = docRef.current.strokes.filter((_, idx) => idx !== hitIndex);
        commitCanvasState(remaining, docRef.current.elements || []);
      }
      return;
    }

    // Freehand ink drawing
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
          renderActiveLayer(
            activeCanvasRef.current,
            activeStrokeRef.current,
            transformRef.current,
            window.devicePixelRatio || 1
          );
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

    if (isPanningRef.current) {
      isPanningRef.current = false;
      panStartRef.current = null;
    }

    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    // Finish resizing
    if (resizeOriginRef.current) {
      resizeOriginRef.current = null;
      commitCanvasState(docRef.current.strokes, docRef.current.elements || []);
      return;
    }

    // Finish dragging
    if (draggingOriginRef.current) {
      draggingOriginRef.current = null;
      commitCanvasState(docRef.current.strokes, docRef.current.elements || []);
      return;
    }

    // Finish creating shape
    if (activeElementRef.current) {
      const shape = activeElementRef.current;
      activeElementRef.current = null;
      if (activeCanvasRef.current) {
        renderActiveLayer(
          activeCanvasRef.current,
          null,
          transformRef.current,
          window.devicePixelRatio || 1
        );
      }

      if (shape.width >= 5 || shape.height >= 5) {
        const elements = [...(docRef.current.elements || []), shape];
        commitCanvasState(docRef.current.strokes, elements);
        setSelectedElementId(shape.id);
        setTool('select');
      }
      return;
    }

    // Finish stroke
    const active = activeStrokeRef.current;
    if (active && active.points.length > 0) {
      const newStrokes = [...docRef.current.strokes, active];
      commitCanvasState(newStrokes, docRef.current.elements || []);
    }

    activeStrokeRef.current = null;
    if (activeCanvasRef.current) {
      renderActiveLayer(
        activeCanvasRef.current,
        null,
        transformRef.current,
        window.devicePixelRatio || 1
      );
    }
  };

  // Double click: open note card or inline edit text
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const [docX, docY] = screenToDoc(screenX, screenY, transformRef.current);

    const hit = (docRef.current.elements || []).slice().reverse().find((el) => hitTestElement(el, docX, docY));
    if (hit) {
      if (hit.type === 'card' && hit.noteId) {
        navigate(`/note/${hit.noteId}`);
      } else if (hit.type === 'text') {
        setEditingTextId(hit.id);
      }
    } else {
      // Double click on empty space: quickly create text
      const newTextEl: CanvasElement = {
        id: `text_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'text',
        x: docX,
        y: docY,
        width: 140,
        height: 36,
        strokeColor,
        backgroundColor: 'transparent',
        fillStyle: 'none',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 0,
        roundness: 0,
        text: 'Text here...',
        fontSize: 22,
      };
      const elements = [...(docRef.current.elements || []), newTextEl];
      commitCanvasState(docRef.current.strokes, elements);
      setSelectedElementId(newTextEl.id);
      setEditingTextId(newTextEl.id);
      setTool('select');
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
      const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
      const newZoom = clampZoom(transform.zoom * zoomFactor);
      setTransform((prev) => zoomAt(prev, focalX, focalY, newZoom));
    } else {
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
    const targetNoteId = canvasEntity?.linkedNoteId;
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

  const selectedElement = selectedElementId
    ? (doc.elements || []).find((e) => e.id === selectedElementId) || null
    : null;

  // Excalidraw Toolstrip Definition
  const TOOLS: { id: ExcalidrawTool; label: string; shortcut: string; icon: React.ReactNode }[] = [
    {
      id: 'hand',
      label: 'Hand (Pan)',
      shortcut: 'H',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v3" />
          <path d="M14 9V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6" />
          <path d="M10 9.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v9" />
          <path d="M6 14.5a4 4 0 0 0 4 4h4a6 6 0 0 0 6-6V9.5a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2" />
        </svg>
      ),
    },
    {
      id: 'select',
      label: 'Selection',
      shortcut: 'V',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
          <path d="M13 13l6 6" />
        </svg>
      ),
    },
    {
      id: 'rectangle',
      label: 'Rectangle',
      shortcut: 'R',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      ),
    },
    {
      id: 'diamond',
      label: 'Diamond',
      shortcut: 'D',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 12l10 10 10-10L12 2z" />
        </svg>
      ),
    },
    {
      id: 'ellipse',
      label: 'Ellipse',
      shortcut: 'E',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
        </svg>
      ),
    },
    {
      id: 'arrow',
      label: 'Arrow',
      shortcut: 'A',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      ),
    },
    {
      id: 'line',
      label: 'Line',
      shortcut: 'L',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="20" x2="20" y2="4" />
        </svg>
      ),
    },
    {
      id: 'pen',
      label: 'Draw (Pen)',
      shortcut: 'P',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        </svg>
      ),
    },
    {
      id: 'text',
      label: 'Text',
      shortcut: 'T',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      ),
    },
    {
      id: 'card',
      label: 'Embed Note Card',
      shortcut: 'N',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      id: 'eraser',
      label: 'Eraser',
      shortcut: 'X',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
          <path d="M22 21H7" />
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen w-full select-none overflow-hidden bg-surface-2 text-ink">
      {/* Top Bar Header */}
      {/* Top Bar Header */}
      <header className="w-full min-h-[3.5rem] py-2 border-b border-border bg-surface px-2 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 z-20 shrink-0">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => navigate('/canvas')}
            className="p-1.5 sm:p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
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
            className="font-semibold text-sm md:text-base text-ink bg-transparent border-b border-transparent hover:border-border focus:border-accent focus:outline-none px-1 py-0.5 rounded transition-colors w-full max-w-sm truncate"
            placeholder="Untitled drawing"
          />

          {isSaving && (
            <span className="text-[10px] sm:text-xs text-ink-muted animate-pulse shrink-0 ml-1">Saving…</span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0 shrink-0 max-w-full">
          {/* Style Properties toggle button */}
          <button
            type="button"
            onClick={() => setIsStylePanelOpen(!isStylePanelOpen)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 ${
              isStylePanelOpen || selectedElementId
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'bg-surface-2 border-border text-ink-muted hover:text-ink'
            }`}
            title="Toggle Style Panel"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z" />
            </svg>
            <span className="hidden sm:inline">Styles</span>
          </button>

          {/* Undo / Redo */}
          <div className="flex items-center border border-border rounded-lg bg-surface-2 shrink-0">
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

          {/* Link to note button */}
          <button
            type="button"
            onClick={() => setIsLinkModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer shrink-0 max-w-[120px] sm:max-w-[160px] truncate ${
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:opacity-90 transition-opacity cursor-pointer shrink-0"
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
          <div className="relative shrink-0">
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

      {/* Secondary Toolbar: Drawing Tools */}
      <div className="w-full bg-surface-2/50 border-b border-border py-1.5 px-2 sm:px-4 flex items-center justify-center gap-1 overflow-x-auto no-scrollbar shrink-0 z-10">
        {TOOLS.map((t) => {
          const isActive = tool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                if (t.id === 'card') {
                  setIsEmbedNoteModalOpen(true);
                } else {
                  setTool(t.id);
                }
              }}
              className={`relative p-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0 ${
                isActive
                  ? 'bg-accent text-white shadow-xs'
                  : 'text-ink-muted hover:text-ink hover:bg-surface'
              }`}
              title={`${t.label} (${t.shortcut})`}
            >
              {t.icon}
              <span className="sr-only">{t.label}</span>
              <span className="absolute -bottom-0.5 right-1 text-[8px] font-mono opacity-50 select-none hidden md:block">
                {t.shortcut}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Viewport Container */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        className={`relative flex-1 w-full h-full overflow-hidden bg-slate-900/5 dark:bg-black/40 touch-none ${
          tool === 'hand' ? 'cursor-grab active:cursor-grabbing' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair'
        }`}
      >
        {/* Left Floating Excalidraw Style Popover (shown if toggled or element selected) */}
        {(isStylePanelOpen || selectedElementId) && (
          <div className="absolute top-4 left-4 z-20 max-h-[calc(100%-2rem)] overflow-y-auto">
            <ExcalidrawStylePopover
              element={selectedElement}
              currentStrokeColor={strokeColor}
              currentBgColor={bgColor}
              currentFillStyle={fillStyle}
              currentStrokeWidth={strokeWidth}
              currentStrokeStyle={strokeStyle}
              currentRoughness={roughness}
              currentRoundness={roundness}
              onUpdateElement={handleUpdateElement}
              onDeleteElement={selectedElementId ? handleDeleteElement : undefined}
              onDuplicateElement={selectedElementId ? handleDuplicateElement : undefined}
              onOpenCardNote={(nId) => navigate(`/note/${nId}`)}
            />
          </div>
        )}

        {/* Static Layer: All committed strokes and Excalidraw elements */}
        <canvas
          ref={staticCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Active Layer: Currently drawn stroke/shape & interactive pointer surface */}
        <canvas
          ref={activeCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ touchAction: 'none' }}
        />

        {/* Inline Text Editor Overlay */}
        {editingTextId && (() => {
          const textEl = (doc.elements || []).find((e) => e.id === editingTextId);
          if (!textEl) return null;
          const [sx, sy] = docToScreen(textEl.x, textEl.y, transform);
          return (
            <textarea
              autoFocus
              value={textEl.text || ''}
              onChange={(e) => handleUpdateElement({ text: e.target.value })}
              onBlur={() => setEditingTextId(null)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
                  setEditingTextId(null);
                }
              }}
              className="absolute z-30 p-2 border-2 border-accent bg-surface/95 text-ink rounded-lg shadow-float font-sans resize focus:outline-hidden"
              style={{
                left: Math.max(10, sx),
                top: Math.max(10, sy),
                width: Math.max(160, (textEl.width || 140) * transform.zoom),
                minHeight: Math.max(48, (textEl.height || 40) * transform.zoom),
                fontSize: Math.max(13, (textEl.fontSize || 20) * transform.zoom),
              }}
            />
          );
        })()}

        {/* Bottom Floating Canvas Controls */}
        <div className="absolute bottom-5 left-4 z-20 flex items-center gap-1.5 p-1 rounded-lg bg-surface/90 dark:bg-surface/95 backdrop-blur-md border border-border shadow-float text-xs font-medium text-ink">
          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => handleZoom('out')}
            className="p-1.5 hover:text-accent rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {/* Reset / Fit zoom */}
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 py-1 hover:text-accent rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
            title="Fit to Screen"
          >
            {Math.round(transform.zoom * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => handleZoom('in')}
            className="p-1.5 hover:text-accent rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
            title="Zoom In"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          <div className="w-px h-4 bg-border my-auto" />

          {/* Grid Toggle: Dots -> Grid -> None */}
          <button
            type="button"
            onClick={handleToggleGrid}
            className="px-2 py-1 text-ink-muted hover:text-ink rounded-md hover:bg-surface-2 transition-colors cursor-pointer capitalize"
            title={`Toggle Grid (Current: ${gridMode})`}
          >
            {gridMode === 'dots' ? ':: Dots' : gridMode === 'grid' ? '# Grid' : '○ Clean'}
          </button>
        </div>
      </div>

      {/* Note Link Modal */}
      <LinkNoteModal
        isOpen={isLinkModalOpen}
        currentNoteId={canvasEntity?.linkedNoteId}
        onClose={() => setIsLinkModalOpen(false)}
        onSelectNote={handleSelectLinkedNote}
      />

      {/* Note Card Embed Picker Modal */}
      <EmbedNoteModal
        isOpen={isEmbedNoteModalOpen}
        onClose={() => setIsEmbedNoteModalOpen(false)}
        onSelectNote={handleSelectNoteToEmbed}
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
              Export a crisp 2× HD PNG image (6000 × 4000 px) of this whiteboard.
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
                <span className="text-ink-muted">Elements Count</span>
                <span className="font-medium text-ink">{doc.elements?.length || 0} shapes / notes</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-ink-muted">Freehand Strokes</span>
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
