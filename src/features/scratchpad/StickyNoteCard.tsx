import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Trash2,
  Inbox,
  FolderPlus,
  Bold,
  Italic,
  Underline,
  Clock,
  PenTool,
  Type,
  Palette,
  Maximize2
} from 'lucide-react';
import type { StickyNote, StickyColor, StickyFontFamily, StickyFontSize } from '../../types/sticky';
import { stickyNotesRepo } from '../../db/repos/stickyNotesRepo';
import { formatRelativeTime } from '../../utils/format';

interface StickyNoteCardProps {
  note: StickyNote;
  onOpenDrawing?: (note: StickyNote) => void;
  onExportInbox: (note: StickyNote) => void;
  onExportNotes: (note: StickyNote) => void;
  onDelete: (id: number) => void;
}

export const STICKY_PALETTE: Record<StickyColor, {
  label: string;
  bg: string;
  border: string;
  dot: string;
  defaultText: string;
}> = {
  yellow: {
    label: 'Post-it Yellow',
    bg: 'bg-amber-100 dark:bg-amber-950/70',
    border: 'border-amber-300 dark:border-amber-700/60',
    dot: 'bg-amber-400',
    defaultText: '#451a03',
  },
  peach: {
    label: 'Melon Peach',
    bg: 'bg-orange-100 dark:bg-orange-950/70',
    border: 'border-orange-300 dark:border-orange-700/60',
    dot: 'bg-orange-400',
    defaultText: '#431407',
  },
  mint: {
    label: 'Fresh Mint',
    bg: 'bg-emerald-100 dark:bg-emerald-950/70',
    border: 'border-emerald-300 dark:border-emerald-700/60',
    dot: 'bg-emerald-400',
    defaultText: '#064e3b',
  },
  blue: {
    label: 'Sky Blue',
    bg: 'bg-sky-100 dark:bg-sky-950/70',
    border: 'border-sky-300 dark:border-sky-700/60',
    dot: 'bg-sky-400',
    defaultText: '#082f49',
  },
  lavender: {
    label: 'Lavender',
    bg: 'bg-purple-100 dark:bg-purple-950/70',
    border: 'border-purple-300 dark:border-purple-700/60',
    dot: 'bg-purple-400',
    defaultText: '#3b0764',
  },
  pink: {
    label: 'Rose Pink',
    bg: 'bg-rose-100 dark:bg-rose-950/70',
    border: 'border-rose-300 dark:border-rose-700/60',
    dot: 'bg-rose-400',
    defaultText: '#4c0519',
  },
  slate: {
    label: 'Cool Slate',
    bg: 'bg-slate-100 dark:bg-slate-900',
    border: 'border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
    defaultText: '#0f172a',
  },
};

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Charcoal', value: '#18181b' },
  { label: 'Deep Blue', value: '#1e3a8a' },
  { label: 'Deep Purple', value: '#581c87' },
  { label: 'Forest Green', value: '#14532d' },
  { label: 'Crimson', value: '#881337' },
  { label: 'White', value: '#fcfcfd' },
];

export function StickyNoteCard({
  note,
  onOpenDrawing,
  onExportInbox,
  onExportNotes,
  onDelete,
}: StickyNoteCardProps) {
  const [content, setContent] = useState(note.content);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFormattingOpen, setIsFormattingOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);

  // Position & size state
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [size, setSize] = useState({ width: note.width, height: note.height });
  const isResizingRef = useRef(false);

  useEffect(() => {
    setContent(note.content);
  }, [note.content]);

  const palette = STICKY_PALETTE[note.color] || STICKY_PALETTE.yellow;

  // Auto-save content debounce
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleContentChange = (val: string) => {
    setContent(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (note.id) {
        stickyNotesRepo.updateStickyNote(note.id, { content: val });
      }
    }, 400);
  };

  // Drag end updates coordinates
  const handleDragEnd = (_: any, info: any) => {
    const nextX = Math.max(0, pos.x + info.offset.x);
    const nextY = Math.max(0, pos.y + info.offset.y);
    setPos({ x: nextX, y: nextY });
    if (note.id) {
      stickyNotesRepo.updateStickyNote(note.id, { x: nextX, y: nextY });
    }
  };

  // Resize handler
  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    isResizingRef.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;

    const onPointerMove = (moveEv: PointerEvent) => {
      if (!isResizingRef.current) return;
      const newW = Math.max(220, startW + (moveEv.clientX - startX));
      const newH = Math.max(180, startH + (moveEv.clientY - startY));
      setSize({ width: newW, height: newH });
    };

    const onPointerUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (note.id) {
        setSize((curr) => {
          stickyNotesRepo.updateStickyNote(note.id!, { width: curr.width, height: curr.height });
          return curr;
        });
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Markdown formatting helpers
  const applyMarkdown = (prefix: string, suffix: string = prefix) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = content.slice(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;
    const next = content.slice(0, start) + replacement + content.slice(end);
    setContent(next);
    if (note.id) {
      stickyNotesRepo.updateStickyNote(note.id, { content: next });
    }
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 10);
  };

  const fontFamilyClasses = {
    sans: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono text-xs',
    handwriting: 'font-serif italic',
  }[note.fontFamily || 'sans'];

  const fontSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base font-semibold',
  }[note.fontSize || 'md'];

  return (
    <motion.div
      ref={noteRef}
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      onPointerDown={() => note.id && stickyNotesRepo.bringToFront(note.id)}
      style={{
        position: 'absolute',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: note.zIndex ?? 10,
        touchAction: 'none',
      }}
      className={`group rounded-2xl border ${palette.border} ${palette.bg} shadow-float flex flex-col transition-shadow select-none hover:shadow-pop`}
    >
      {/* ── Tape Header & Drag Bar ── */}
      <div className="relative pt-2.5 px-3 pb-1 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-black/5 dark:border-white/5">
        {/* Visual Washi-Tape strip */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-4.5 bg-white/50 dark:bg-black/30 backdrop-blur-xs border border-white/60 dark:border-white/10 rounded-xs rotate-[-1.5deg] shadow-xs pointer-events-none" />

        {/* Quick color indicator dot */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${palette.dot} shadow-xs`} />
          <span className="text-[10px] font-bold opacity-60 uppercase tracking-wider">Sticky</span>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-1">
          {/* Quick drawing trigger */}
          {onOpenDrawing && (
            <button
              type="button"
              onClick={() => onOpenDrawing(note)}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-ink-muted hover:text-ink cursor-pointer"
              title="Add / Edit Sketch"
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Text & Style Format Toggle */}
          <button
            type="button"
            onClick={() => setIsFormattingOpen(!isFormattingOpen)}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isFormattingOpen ? 'bg-black/15 dark:bg-white/15 text-ink' : 'hover:bg-black/10 dark:hover:bg-white/10 text-ink-muted'
            }`}
            title="Style & Typography"
          >
            <Type className="w-3.5 h-3.5" />
          </button>

          {/* Color Palette Toggle */}
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              isMenuOpen ? 'bg-black/15 dark:bg-white/15 text-ink' : 'hover:bg-black/10 dark:hover:bg-white/10 text-ink-muted'
            }`}
            title="Sticky Options"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

          {/* Delete sticky */}
          <button
            type="button"
            onClick={() => note.id && onDelete(note.id)}
            className="p-1 rounded-lg hover:bg-rose-500/20 text-ink-muted hover:text-rose-600 transition-colors cursor-pointer"
            title="Delete Sticky Note"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Sub-toolbar 1: Colors & Actions Bar (Collapsible) ── */}
      {isMenuOpen && (
        <div className="p-2 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-2 text-xs">
          {/* Colors */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold opacity-70">Background:</span>
            <div className="flex items-center gap-1.5">
              {(Object.keys(STICKY_PALETTE) as StickyColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => note.id && stickyNotesRepo.updateStickyNote(note.id, { color: c })}
                  className={`w-5 h-5 rounded-full ${STICKY_PALETTE[c].dot} cursor-pointer transition-transform ${
                    note.color === c ? 'scale-125 ring-2 ring-accent' : 'hover:scale-110 opacity-80'
                  }`}
                  title={STICKY_PALETTE[c].label}
                />
              ))}
            </div>
          </div>

          {/* Quick triage actions */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => onExportInbox(note)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/10 dark:bg-white/10 hover:bg-black/20 text-[11px] font-medium cursor-pointer"
            >
              <Inbox className="w-3 h-3" />
              <span>To Inbox</span>
            </button>
            <button
              type="button"
              onClick={() => onExportNotes(note)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/10 dark:bg-white/10 hover:bg-black/20 text-[11px] font-medium cursor-pointer"
            >
              <FolderPlus className="w-3 h-3" />
              <span>To Notes</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (note.id) {
                  stickyNotesRepo.updateStickyNote(note.id, { showTimestamp: !note.showTimestamp });
                }
              }}
              className={`p-1 rounded-md text-[11px] font-medium flex items-center gap-1 cursor-pointer ${
                note.showTimestamp ? 'bg-accent/20 text-accent font-bold' : 'opacity-70 hover:opacity-100'
              }`}
              title="Toggle Timestamp"
            >
              <Clock className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Sub-toolbar 2: Typography & Markdown Bar (Collapsible) ── */}
      {isFormattingOpen && (
        <div className="p-2 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 space-y-2 text-xs">
          {/* Markdown Quick Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyMarkdown('**')}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                title="Bold (**text**)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyMarkdown('*')}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                title="Italic (*text*)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyMarkdown('<u>', '</u>')}
                className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
                title="Underline"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Font Size Pills */}
            <div className="flex items-center gap-1 bg-black/10 dark:bg-white/10 rounded-pill p-0.5">
              {(['sm', 'md', 'lg'] as StickyFontSize[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => note.id && stickyNotesRepo.updateStickyNote(note.id, { fontSize: sz })}
                  className={`px-1.5 py-0.5 rounded-full text-[10px] uppercase font-bold cursor-pointer ${
                    (note.fontSize || 'md') === sz ? 'bg-surface text-ink shadow-xs' : 'opacity-60'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>

            {/* Font Family Selector */}
            <select
              value={note.fontFamily || 'sans'}
              onChange={(e) => note.id && stickyNotesRepo.updateStickyNote(note.id, { fontFamily: e.target.value as StickyFontFamily })}
              className="bg-transparent border border-black/15 dark:border-white/15 rounded-md px-1 py-0.5 text-[10px] font-medium focus:outline-none"
            >
              <option value="sans">Sans</option>
              <option value="serif">Serif</option>
              <option value="mono">Mono</option>
              <option value="handwriting">Script</option>
            </select>
          </div>

          {/* Text Color Swatches */}
          <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5">
            <span className="text-[10px] font-semibold opacity-70">Text Color:</span>
            <div className="flex items-center gap-1.5">
              {TEXT_COLORS.map((tc) => (
                <button
                  key={tc.label}
                  type="button"
                  onClick={() => note.id && stickyNotesRepo.updateStickyNote(note.id, { textColor: tc.value || undefined })}
                  style={{ backgroundColor: tc.value || palette.defaultText }}
                  className={`w-4 h-4 rounded-full border border-black/20 cursor-pointer ${
                    note.textColor === tc.value ? 'ring-2 ring-accent scale-110' : 'hover:scale-105'
                  }`}
                  title={tc.label}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky Body Area ── */}
      <div className="flex-1 flex flex-col p-3 overflow-hidden">
        {/* Optional Embedded Sketch preview */}
        {note.drawingSvg && (
          <div
            onClick={() => onOpenDrawing && onOpenDrawing(note)}
            className="mb-2 max-h-[100px] overflow-hidden rounded-lg border border-black/10 dark:border-white/10 bg-white/40 dark:bg-black/20 cursor-pointer relative group/sketch flex items-center justify-center"
            title="Click to edit drawing"
          >
            <div dangerouslySetInnerHTML={{ __html: note.drawingSvg }} className="w-full h-full flex items-center justify-center p-1 pointer-events-none" />
            <div className="absolute inset-0 bg-accent/10 opacity-0 group-hover/sketch:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-bold text-accent">
              Edit Sketch ✎
            </div>
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Jot down quick thoughts, notes, or tasks…"
          style={{ color: note.textColor || undefined }}
          className={`flex-1 w-full bg-transparent resize-none focus:outline-none placeholder-black/30 dark:placeholder-white/30 leading-relaxed ${fontFamilyClasses} ${fontSizeClasses}`}
        />
      </div>

      {/* ── Sticky Footer (Timestamp & Resize Grip) ── */}
      <div className="px-3 pb-2 pt-1 flex items-center justify-between text-[10px] opacity-60 font-mono">
        <div>
          {note.showTimestamp && (
            <span>{formatRelativeTime(note.updatedAt)}</span>
          )}
        </div>

        {/* Resizer handle */}
        <div
          onPointerDown={handleResizePointerDown}
          className="cursor-nwse-resize p-1 -mr-1.5 -mb-1 text-ink-muted hover:text-ink hover:scale-110 transition-transform flex items-center justify-center"
          title="Drag corner to resize"
        >
          <Maximize2 className="w-3 h-3 rotate-90" />
        </div>
      </div>
    </motion.div>
  );
}
