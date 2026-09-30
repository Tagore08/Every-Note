import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Sparkles,
  Search
} from 'lucide-react';
import { stickyNotesRepo, useStickyNotes } from '../../db/repos/stickyNotesRepo';
import { StickyNoteCard } from './StickyNoteCard';
import { DrawingPadModal } from '../drawing/DrawingPadModal';
import { useSnackbar } from '../../context/SnackbarContext';
import type { StickyNote } from '../../types/sticky';

export function ScratchpadScreen() {
  const navigate = useNavigate();
  const stickyNotes = useStickyNotes();
  const { showSnackbar } = useSnackbar();

  const [searchQuery, setSearchQuery] = useState('');
  const [drawingNote, setDrawingNote] = useState<StickyNote | null>(null);
  const [isDrawingOpen, setIsDrawingOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-seed one initial sticky note if totally empty
  const seededRef = useRef(false);
  useEffect(() => {
    if (!seededRef.current && stickyNotes.length === 0) {
      seededRef.current = true;
      stickyNotesRepo.getAllStickyNotes().then((all) => {
        if (all.length === 0) {
          stickyNotesRepo.createStickyNote({
            content: 'Welcome to your digital Scratchpad! ✨\n\n- Freely drag & resize sticky notes\n- Customize colors and fonts\n- Draw sketches with smart shape recognition\n- Save quick thoughts into Inbox or Notes',
            color: 'yellow',
            x: 40,
            y: 30,
            width: 300,
            height: 250,
          });
        }
      });
    }
  }, [stickyNotes.length]);

  const handleAddSticky = async () => {
    try {
      const scrollY = containerRef.current?.scrollTop || 0;
      const scrollX = containerRef.current?.scrollLeft || 0;
      await stickyNotesRepo.createStickyNote({
        x: scrollX + 60 + Math.random() * 40,
        y: scrollY + 40 + Math.random() * 40,
      });
      showSnackbar({ message: 'Added new sticky note' });
    } catch (err) {
      console.error('Failed to create sticky note:', err);
    }
  };

  const handleDeleteSticky = async (id: number) => {
    try {
      await stickyNotesRepo.deleteStickyNote(id);
      showSnackbar({ message: 'Deleted sticky note' });
    } catch (err) {
      console.error('Failed to delete sticky note:', err);
    }
  };

  const handleExportInbox = async (note: StickyNote) => {
    try {
      await stickyNotesRepo.exportToNote(note, true);
      showSnackbar({ message: 'Saved to Inbox' });
      navigate('/inbox');
    } catch (err) {
      console.error('Failed to export to inbox:', err);
    }
  };

  const handleExportNotes = async (note: StickyNote) => {
    try {
      const newNote = await stickyNotesRepo.exportToNote(note, false);
      showSnackbar({ message: 'Saved to Vault Notes' });
      navigate(`/notes/${newNote.id}`);
    } catch (err) {
      console.error('Failed to export to notes:', err);
    }
  };

  const handleOpenDrawing = (note: StickyNote) => {
    setDrawingNote(note);
    setIsDrawingOpen(true);
  };

  const handleSaveDrawing = (svg: string, strokesJson: string) => {
    if (!drawingNote || !drawingNote.id) return;
    stickyNotesRepo.updateStickyNote(drawingNote.id, {
      drawingSvg: svg,
      drawingStrokes: strokesJson,
    });
    showSnackbar({ message: 'Attached drawing to sticky note' });
    setDrawingNote(null);
  };

  const handleClearAll = async () => {
    if (confirm('Clear all sticky notes from the scratchpad canvas?')) {
      await stickyNotesRepo.clearAllStickyNotes();
      showSnackbar({ message: 'Cleared all sticky notes' });
    }
  };

  const filteredStickies = stickyNotes.filter((n) => {
    if (!searchQuery.trim()) return true;
    return n.content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] max-w-7xl mx-auto pb-4 overflow-hidden">
      {/* ── Top Header & Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5" strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink flex items-center gap-2">
              <span>Scratchpad</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-2 border border-border text-ink-muted">
                {stickyNotes.length}
              </span>
            </h1>
            <p className="text-xs text-ink-muted">
              Freeform tactile sticky notes. Drag, resize, sketch, and capture quick thoughts.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              type="text"
              placeholder="Search notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-pill bg-surface-2 border border-border text-xs text-ink placeholder-ink-faint focus:outline-none focus:border-accent w-36 sm:w-44 transition-all"
            />
          </div>

          {/* Add Sticky Note button */}
          <button
            type="button"
            onClick={handleAddSticky}
            className="flex items-center gap-1.5 px-4 py-2 rounded-pill bg-accent text-accent-ink font-semibold text-xs shadow-card hover:opacity-90 active:scale-95 transition-all cursor-pointer min-h-[38px]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Sticky</span>
          </button>

          {/* Clear all */}
          {stickyNotes.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="p-2 rounded-xl text-ink-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
              title="Clear all stickies"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Freeform Sticky Notes Canvas ── */}
      <div
        ref={containerRef}
        className="flex-1 relative mt-3 rounded-card border border-border/80 bg-surface/60 overflow-auto shadow-inner"
        style={{
          minHeight: '480px',
          backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Canvas area (2400x1800 virtual workspace) */}
        <div className="relative w-[2400px] h-[1800px]">
          {filteredStickies.map((note) => (
            <StickyNoteCard
              key={note.id}
              note={note}
              onOpenDrawing={handleOpenDrawing}
              onExportInbox={handleExportInbox}
              onExportNotes={handleExportNotes}
              onDelete={handleDeleteSticky}
            />
          ))}
        </div>
      </div>

      {/* ── Drawing Modal ── */}
      <DrawingPadModal
        isOpen={isDrawingOpen}
        onClose={() => setIsDrawingOpen(false)}
        initialStrokesJson={drawingNote?.drawingStrokes}
        onSave={handleSaveDrawing}
        title="Sketch on Sticky Note"
      />
    </div>
  );
}
