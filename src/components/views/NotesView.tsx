import { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useActiveNotes, notesRepo } from '../../db/notesRepo';
import { useFolders, foldersRepo } from '../../db/repos/foldersRepo';
import { FolderTree } from '../../features/notes/FolderTree';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatRelativeTime, getDisplayTitle, getContentSnippet } from '../../utils/format';
import {
  FolderOpen,
  FolderArchive,
  Plus,
  Palette,
  ChevronRight,
  X,
  Search,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import type { Note } from '../../types/note';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import { canvasRepo } from '../../db/repos/canvasRepo';
import { localVaultService } from '../../services/vault/localVaultService';
import { cleanDrawingTitle } from '../../services/vault/drawingConverter';
import type { CanvasEntity } from '../../types/canvas';

export function NotesView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tagFilter = searchParams.get('tag') || undefined;
  const searchQuery = searchParams.get('q') || '';
  const navigate = useNavigate();
  const { showUndo, showSnackbar } = useSnackbar();

  const allNotes = useActiveNotes(tagFilter);
  const folders = useFolders();
  const allCanvases = useLiveQuery(() => db.canvases.toArray(), []);

  // Map noteId to CanvasEntity
  const canvasByNoteId = useMemo(() => {
    const map = new Map<number, CanvasEntity>();
    if (allCanvases) {
      for (const c of allCanvases) {
        if (c.linkedNoteId && !c.trashedAt) {
          map.set(c.linkedNoteId, c);
        }
      }
    }
    return map;
  }, [allCanvases]);

  // Sidebar toggle state (defaults to open on laptop/desktop screens)
  const [isFolderSidebarOpen, setIsFolderSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('notes_sidebar_open');
      if (stored !== null) return stored === 'true';
      return window.innerWidth >= 640;
    }
    return true;
  });

  const toggleSidebar = () => {
    setIsFolderSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('notes_sidebar_open', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Selected folder state
  const [selectedFolderId, setSelectedFolderId] = useState<number | null | 'all'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notes_selected_folder_id');
      if (saved === 'all') return 'all';
      if (saved === 'null') return null;
      if (saved) {
        const num = parseInt(saved, 10);
        if (!isNaN(num)) return num;
      }
    }
    return 'all';
  });

  // Automatically select active vault folder if on 'all' initially and a vault folder exists
  useEffect(() => {
    if (folders && folders.length > 0 && selectedFolderId === 'all') {
      const saved = localStorage.getItem('notes_selected_folder_id');
      if (!saved) {
        const activeVault = localVaultService.getActiveVault();
        const vaultFolder = folders.find(
          (f) => f.name.toLowerCase() === activeVault.name.toLowerCase() && !f.parentId
        );
        if (vaultFolder && vaultFolder.id) {
          setSelectedFolderId(vaultFolder.id);
        } else if (folders[0]?.id) {
          setSelectedFolderId(folders[0].id);
        }
      }
    }
  }, [folders]);

  const handleSelectFolder = (id: number | null | 'all') => {
    setSelectedFolderId(id);
    try {
      localStorage.setItem('notes_selected_folder_id', String(id));
    } catch {
      // ignore
    }
  };

  // Descendant folder IDs for recursive inclusion when a parent folder is selected
  const subtreeFolderIds = useMemo(() => {
    if (typeof selectedFolderId === 'number') {
      return foldersRepo.getSubtreeFolderIds(selectedFolderId, folders);
    }
    return new Set<number>();
  }, [selectedFolderId, folders]);

  // Folder paths map for quick lookup and search
  const folderPathMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of folders) {
      if (f.id) {
        map.set(f.id, foldersRepo.getFolderPathString(f.id, folders));
      }
    }
    return map;
  }, [folders]);

  // Sort state
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'created'>('updated');

  // Filter notes based on selected folder and search query
  const notes = useMemo(() => {
    if (!allNotes) return [];

    let filtered = allNotes.filter((n) => {
      // 1. Strict Folder filter: ONLY show notes belonging to selected folder (and subfolders)
      if (selectedFolderId !== 'all') {
        if (selectedFolderId === null) {
          if (n.folderId) return false;
        } else {
          const inSelected = n.folderId === selectedFolderId;
          const inSubtree = n.folderId ? subtreeFolderIds.has(n.folderId) : false;
          if (!inSelected && !inSubtree) return false;
        }
      }

      // 2. Search & folder path query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const contentMatch = (n.content || '').toLowerCase().includes(q);
        const tagMatch = n.tags.some((t) => t.toLowerCase().includes(q));
        const fPath = n.folderId ? folderPathMap.get(n.folderId) || '' : 'root';
        const pathMatch = fPath.toLowerCase().includes(q);

        if (q.startsWith('folder:') || q.startsWith('path:')) {
          const target = q.replace(/^(folder|path):/, '').trim();
          return fPath.toLowerCase().includes(target);
        }

        return titleMatch || contentMatch || tagMatch || pathMatch;
      }

      return true;
    });

    // Sort notes
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      if (sortBy === 'created') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [allNotes, selectedFolderId, subtreeFolderIds, searchQuery, folderPathMap, sortBy]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track long-press to distinguish between tap and hold on mobile
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressActive = useRef(false);

  const handleTogglePin = useCallback(
    async (id?: number, currentPinned?: boolean) => {
      if (typeof id !== 'number') return;
      try {
        const next = !currentPinned;
        await notesRepo.togglePin(id, next);
        showUndo(next ? 'Note pinned to top' : 'Note unpinned', async () => {
          await notesRepo.togglePin(id, currentPinned ?? false);
        });
      } catch (err) {
        console.error('Failed to toggle pin:', err);
        showSnackbar({ message: 'Failed to update pin' });
      }
    },
    [showUndo, showSnackbar]
  );

  const handleArchive = useCallback(
    async (e: React.MouseEvent, id?: number) => {
      e.stopPropagation();
      if (typeof id !== 'number') return;
      try {
        await notesRepo.archiveNote(id);
        showUndo('Note archived', async () => {
          await notesRepo.unarchiveNote(id);
        });
      } catch (err) {
        console.error('Failed to archive note:', err);
        showSnackbar({ message: 'Failed to archive note' });
      }
    },
    [showUndo, showSnackbar]
  );

  const handleTrash = useCallback(
    async (e: React.MouseEvent, id?: number) => {
      e.stopPropagation();
      if (typeof id !== 'number') return;
      try {
        await notesRepo.trashNote(id);
        showUndo('Note moved to trash', async () => {
          await notesRepo.restoreNote(id);
        });
      } catch (err) {
        console.error('Failed to trash note:', err);
        showSnackbar({ message: 'Failed to move note to trash' });
      }
    },
    [showUndo, showSnackbar]
  );

  const handleTouchStart = (note: Note) => {
    isLongPressActive.current = false;
    touchTimer.current = setTimeout(() => {
      isLongPressActive.current = true;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(40);
        } catch {
          // Ignore
        }
      }
      handleTogglePin(note.id, note.pinned);
    }, 500);
  };

  const handleTouchEndOrMove = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
  };

  // When clicking a note card: if it's a Drawing/Canvas note, navigate straight to /canvas/:id!
  const handleCardClick = (note: Note) => {
    if (isLongPressActive.current) {
      isLongPressActive.current = false;
      return;
    }

    const linkedCanvas = note.id ? canvasByNoteId.get(note.id) : undefined;
    if (linkedCanvas && linkedCanvas.id) {
      navigate(`/canvas/${linkedCanvas.id}`);
      return;
    }

    // Check if title or content indicates a drawing note
    const lowerTitle = (note.title || '').toLowerCase();
    const isDrawing =
      note.tags.includes('drawing') ||
      note.tags.includes('canvas') ||
      lowerTitle.endsWith('.canvas') ||
      lowerTitle.endsWith('.excalidraw') ||
      lowerTitle.endsWith('.drawing');

    if (isDrawing && allCanvases && allCanvases.length > 0) {
      const cleanT = cleanDrawingTitle(note.title);
      const match = allCanvases.find(
        (c) => cleanDrawingTitle(c.title).toLowerCase() === cleanT.toLowerCase()
      );
      if (match && match.id) {
        navigate(`/canvas/${match.id}`);
        return;
      }
    }

    navigate(`/notes/${note.id}`);
  };

  const handleCreateNewDrawingInFolder = async () => {
    try {
      const targetFolderId = typeof selectedFolderId === 'number' ? selectedFolderId : null;
      const targetFolderName =
        typeof selectedFolderId === 'number'
          ? folders.find((f) => f.id === selectedFolderId)?.name
          : undefined;

      const title = `Drawing in ${targetFolderName || 'Vault'}`;
      const note = await notesRepo.createNote({
        title,
        content: `# ${title}\n\n> [!NOTE] 🎨 Drawing Canvas\n> Interactive vector drawing.`,
        folderId: targetFolderId,
        tags: ['drawing', 'canvas'],
      });

      const canvas = await canvasRepo.createCanvas({
        title,
        linkedNoteId: note.id,
        tags: ['drawing', 'canvas'],
      });

      navigate(`/canvas/${canvas.id}`);
    } catch (err) {
      console.error('Failed to create canvas in folder:', err);
      showSnackbar({ message: 'Failed to create canvas in folder' });
    }
  };

  const handleClearTagFilter = () => {
    searchParams.delete('tag');
    setSearchParams(searchParams);
  };

  const noteList = notes ?? [];

  // TanStack Virtualizer — tighter row height for Notion-style flat rows
  const rowVirtualizer = useVirtualizer({
    count: noteList.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 52,
    overscan: 6,
  });

  const selectedFolderName =
    selectedFolderId === 'all'
      ? 'All Vault Notes'
      : selectedFolderId === null
      ? 'Root / Unfiled'
      : folders.find((f) => f.id === selectedFolderId)?.name || 'Folder';

  const activeVault = localVaultService.getActiveVault();

  // Breadcrumbs generator
  const breadcrumbParts = useMemo(() => {
    if (selectedFolderId === 'all') return ['All Vault Notes'];
    if (selectedFolderId === null) return ['Root', 'Unfiled'];
    const parts: string[] = [];
    let curId: number | null | undefined = selectedFolderId;
    while (curId) {
      const f = folders.find((item) => item.id === curId);
      if (!f) break;
      parts.unshift(f.name);
      curId = f.parentId;
    }
    return parts.length > 0 ? parts : [selectedFolderName];
  }, [selectedFolderId, folders, selectedFolderName]);

  return (
    <div className="max-w-7xl mx-auto space-y-2 pb-8">
      {/* ── Top Bar: Sidebar toggle + breadcrumb + action buttons ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 py-1 px-0.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Sidebar Toggle */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-surface text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-2 transition-all cursor-pointer"
            title={isFolderSidebarOpen ? 'Hide Vault Explorer' : 'Show Vault Explorer'}
            aria-label="Toggle Vault Explorer"
          >
            {isFolderSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeft className="w-4 h-4" />
            )}
            <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wide">
              {isFolderSidebarOpen ? 'Explorer' : 'Folders'}
            </span>
          </button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-xs text-ink-muted overflow-hidden max-w-[280px] sm:max-w-md">
            <span className="font-medium text-ink-muted flex items-center gap-1 shrink-0">
              <FolderOpen className="w-3.5 h-3.5 text-amber-500/80" />
              <span>{activeVault.isLinked ? activeVault.name : 'Vault'}</span>
            </span>
            {breadcrumbParts.map((part, idx) => (
              <span key={idx} className="flex items-center gap-1 shrink-0">
                <ChevronRight className="w-3 h-3 text-ink-faint" />
                <span className={idx === breadcrumbParts.length - 1 ? 'font-semibold text-ink truncate' : 'text-ink-muted'}>
                  {part}
                </span>
              </span>
            ))}
          </div>

          {tagFilter && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-accent-soft text-accent border border-accent/20">
              <span>#{tagFilter}</span>
              <button
                type="button"
                onClick={handleClearTagFilter}
                className="hover:opacity-80 p-0.5 cursor-pointer"
                aria-label="Clear tag filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>

        {/* Action buttons — right side */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCreateNewDrawingInFolder}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-surface hover:bg-surface-2 text-ink-muted hover:text-ink text-xs font-medium transition-all cursor-pointer"
            title="New drawing canvas"
          >
            <Palette className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Canvas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const fParam = typeof selectedFolderId === 'number' ? `?folderId=${selectedFolderId}` : '';
              navigate(`/notes/new${fParam}`);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-all cursor-pointer"
            title="Create note in selected folder"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New page</span>
          </button>
        </div>
      </div>

      {/* ── Main layout: Notion-style sidebar + page list ── */}
      <div className="flex flex-col sm:flex-row items-start w-full border border-border/40 rounded-lg overflow-hidden bg-surface">
        {/* ── Left sidebar: Notion file tree ── */}
        {isFolderSidebarOpen && (
          <aside
            className="w-full sm:w-52 md:w-60 shrink-0 border-b sm:border-b-0 sm:border-r border-border/40 bg-surface-2/20 flex flex-col animate-in fade-in duration-150"
            style={{ maxHeight: 'calc(100vh - 11rem)' }}
          >
            {/* Sidebar vault header */}
            <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('open-vault-modal'));
                  }
                }}
                className="flex items-center gap-1.5 cursor-pointer group min-w-0 text-left"
                title="Change or Manage Vault Location"
              >
                <FolderArchive className="w-3.5 h-3.5 text-ink-faint shrink-0 group-hover:text-accent transition-colors" />
                <span className="text-[11px] font-semibold text-ink-faint truncate max-w-[90px] group-hover:text-accent uppercase tracking-wider">
                  {activeVault.name}
                </span>
              </button>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleCreateNewDrawingInFolder}
                  className="p-1 rounded-md text-ink-faint hover:text-indigo-400 hover:bg-surface-2 transition-colors cursor-pointer"
                  title="New Drawing Canvas"
                >
                  <Palette className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fParam = typeof selectedFolderId === 'number' ? `?folderId=${selectedFolderId}` : '';
                    navigate(`/notes/new${fParam}`);
                  }}
                  className="p-1 rounded-md text-ink-faint hover:text-accent hover:bg-surface-2 transition-colors cursor-pointer"
                  title="New Note"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Folder tree body */}
            <div className="px-1 py-1.5 overflow-y-auto flex-1">
              <FolderTree
                folders={folders}
                notes={allNotes || []}
                selectedFolderId={selectedFolderId}
                onSelectFolder={(fId) => handleSelectFolder(fId)}
                onSelectNote={(noteId) => navigate(`/notes/${noteId}`)}
                onCreateNoteInFolder={(folderId) => navigate(`/notes/new?folderId=${folderId}`)}
              />
            </div>
          </aside>
        )}

        {/* ── Right pane: Notion page-directory ── */}
        <div className="flex-1 min-w-0 w-full flex flex-col" style={{ minHeight: '400px' }}>

          {/* Page title row — Notion workspace header */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border/30">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg">📁</span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-ink truncate">{selectedFolderName}</h2>
                <p className="text-[10px] text-ink-faint leading-none">
                  {noteList.length} {noteList.length === 1 ? 'page' : 'pages'}
                </p>
              </div>
            </div>

            {/* Filter & sort — right of header */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <Search className="w-3 h-3 text-ink-faint absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter…"
                  value={searchQuery}
                  onChange={(e) => {
                    const q = e.target.value;
                    if (q) searchParams.set('q', q);
                    else searchParams.delete('q');
                    setSearchParams(searchParams);
                  }}
                  className="pl-7 pr-2 py-1 text-[11px] rounded-md bg-surface-2/50 border border-border/40 text-ink placeholder:text-ink-faint focus:outline-hidden focus:border-accent/60 w-20 sm:w-32 transition-all"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-[11px] bg-transparent border-0 text-ink-faint cursor-pointer focus:outline-hidden hover:text-ink transition-colors"
                aria-label="Sort notes"
              >
                <option value="updated">Updated</option>
                <option value="title">Name A–Z</option>
                <option value="created">Created</option>
              </select>
            </div>
          </div>

          {/* Column headers — Notion database-style */}
          <div className="flex items-center gap-3 px-5 py-1.5 border-b border-border/20 bg-surface-2/10">
            <div className="w-5 shrink-0" />
            <span className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider flex-1">Name</span>
            <span className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider w-20 text-right hidden sm:block">Modified</span>
            <span className="text-[10px] font-semibold text-ink-faint uppercase tracking-wider w-16 text-right hidden md:block">Tags</span>
            <span className="w-[88px] shrink-0" />
          </div>

          {/* Empty state */}
          {noteList.length === 0 ? (
            <div className="py-20 text-center space-y-3 px-6">
              <div className="text-5xl select-none">📄</div>
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  {tagFilter
                    ? `No pages tagged #${tagFilter}`
                    : `No pages in "${selectedFolderName}"`}
                </h3>
                <p className="text-xs text-ink-muted mt-1 max-w-xs mx-auto leading-relaxed">
                  {tagFilter
                    ? 'Remove the tag filter to see all pages in this space.'
                    : 'This space is empty. Create a new page to get started.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const fParam = typeof selectedFolderId === 'number' ? `?folderId=${selectedFolderId}` : '';
                    navigate(`/notes/new${fParam}`);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-accent-ink hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New page</span>
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewDrawingInFolder}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border border-border/60 bg-surface hover:bg-surface-2 text-ink transition-colors cursor-pointer"
                >
                  <Palette className="w-3.5 h-3.5 text-indigo-400" />
                  <span>New canvas</span>
                </button>
              </div>
            </div>
          ) : (
            /* Virtualized Notion page-row list */
            <div
              ref={scrollContainerRef}
              className="overflow-y-auto flex-1"
              style={{ maxHeight: 'calc(100vh - 15rem)' }}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const note = noteList[virtualRow.index];
                  const linkedCanvas = note.id ? canvasByNoteId.get(note.id) : undefined;
                  const lowerTitle = (note.title || '').toLowerCase();
                  const isDrawingNote =
                    !!linkedCanvas ||
                    note.tags.includes('drawing') ||
                    note.tags.includes('canvas') ||
                    lowerTitle.endsWith('.canvas') ||
                    lowerTitle.endsWith('.excalidraw') ||
                    lowerTitle.endsWith('.drawing');

                  return (
                    <div
                      key={note.id ?? virtualRow.index}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {/* ── Notion page-row ── */}
                      <div
                        onClick={() => handleCardClick(note)}
                        onTouchStart={() => handleTouchStart(note)}
                        onTouchEnd={handleTouchEndOrMove}
                        onTouchMove={handleTouchEndOrMove}
                        className={`group relative flex items-center gap-3 px-5 py-2 border-b border-border/20 cursor-pointer transition-colors min-h-[48px] select-none ${
                          note.pinned
                            ? 'bg-amber-500/5 hover:bg-amber-500/8'
                            : 'hover:bg-surface-2/40'
                        }`}
                      >
                        {/* Page icon */}
                        <div className="shrink-0 w-5 flex items-center justify-center text-ink-faint">
                          {isDrawingNote ? (
                            <Palette className="w-3.5 h-3.5 text-indigo-400" />
                          ) : note.pinned ? (
                            <span className="text-[13px]">📌</span>
                          ) : (
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          )}
                        </div>

                        {/* Title + preview */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-ink truncate group-hover:text-accent transition-colors leading-snug">
                              {getDisplayTitle(note)}
                            </span>
                            {isDrawingNote && (
                              <span className="text-[10px] text-indigo-400 font-medium shrink-0 hidden sm:inline">Canvas</span>
                            )}
                          </div>
                          <p className="text-[11px] text-ink-faint truncate leading-none mt-0.5">
                            {getContentSnippet(note.content, 1) || ''}
                          </p>
                        </div>

                        {/* Last modified */}
                        <span className="text-[11px] text-ink-faint w-20 text-right shrink-0 hidden sm:block tabular-nums">
                          {formatRelativeTime(note.updatedAt)}
                        </span>

                        {/* Tags column */}
                        <div className="w-16 text-right shrink-0 hidden md:block">
                          {note.tags && note.tags.length > 0 && (
                            <span className="text-[10px] text-accent/60 truncate">
                              #{note.tags[0]}
                              {note.tags.length > 1 && ` +${note.tags.length - 1}`}
                            </span>
                          )}
                        </div>

                        {/* Row hover / mobile actions */}
                        <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity w-[88px] justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePin(note.id, note.pinned);
                            }}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                              note.pinned
                                ? 'text-amber-400'
                                : 'text-ink-faint hover:text-ink hover:bg-surface-2'
                            }`}
                            title={note.pinned ? 'Unpin' : 'Pin to top'}
                            aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              viewBox="0 0 24 24"
                              fill={note.pinned ? 'currentColor' : 'none'}
                              stroke="currentColor"
                              strokeWidth="1.8"
                            >
                              <line x1="12" y1="17" x2="12" y2="22" />
                              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleArchive(e, note.id)}
                            className="p-1.5 rounded-md text-ink-faint hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                            title="Archive"
                            aria-label="Archive note"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                              <rect x="2" y="3" width="20" height="5" rx="1" />
                              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                              <path d="M10 12h4" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleTrash(e, note.id)}
                            className="p-1.5 rounded-md text-ink-faint hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer"
                            title="Delete"
                            aria-label="Delete note"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
