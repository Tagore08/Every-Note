import { useState, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { FolderArchive } from 'lucide-react';
import type { Folder } from '../../types/folder';
import type { Note } from '../../types/note';
import { foldersRepo } from '../../db/repos/foldersRepo';
import { useSnackbar } from '../../context/SnackbarContext';

export interface FolderTreeProps {
  folders: Folder[];
  notes: Note[];
  selectedFolderId: number | null | 'all';
  onSelectFolder: (folderId: number | null | 'all') => void;
  onSelectNote: (noteId: number) => void;
  onCreateNoteInFolder?: (folderId: number) => void;
  activeNoteId?: number | null;
}

// ─── Single Tree Node ─────────────────────────────────────────────────────────
interface FolderNodeProps {
  folder: Folder;
  depth: number;
  allFolders: Folder[];
  noteChildrenMap: Map<number | null, Note[]>;
  folderChildrenMap: Map<number | null, Folder[]>;
  selectedFolderId: number | null | 'all';
  onSelectFolder: (id: number | null | 'all') => void;
  onSelectNote: (id: number) => void;
  onCreateNoteInFolder?: (folderId: number) => void;
  activeNoteId?: number | null;
}

const FolderNode = memo(function FolderNode({
  folder,
  depth,
  noteChildrenMap,
  folderChildrenMap,
  selectedFolderId,
  onSelectFolder,
  onSelectNote,
  onCreateNoteInFolder,
  activeNoteId,
}: FolderNodeProps) {
  const { showSnackbar } = useSnackbar();
  const shouldReduceMotion = useReducedMotion();
  const folderId = folder.id as number;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingName, setEditingName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const childFolders = folderChildrenMap.get(folderId) || [];
  const childNotes = noteChildrenMap.get(folderId) || [];
  const isSelected = selectedFolderId === folderId;
  const hasChildren = childFolders.length > 0 || childNotes.length > 0;

  const handleCreateSubmit = async (parentId: number | null) => {
    if (!newFolderName.trim()) { setIsCreatingFolder(false); setNewFolderName(''); return; }
    try {
      await foldersRepo.createFolder(newFolderName.trim(), parentId);
      setIsCreatingFolder(false);
      setNewFolderName('');
    } catch (err) {
      console.error('Failed to create folder:', err);
      showSnackbar({ message: 'Failed to create folder' });
    }
  };

  const handleRenameSubmit = async () => {
    if (!editingName.trim()) { setIsEditing(false); return; }
    try {
      await foldersRepo.renameFolder(folderId, editingName.trim());
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to rename folder:', err);
      showSnackbar({ message: 'Failed to rename folder' });
    }
  };

  const handleDeleteFolder = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete folder? Notes inside will be moved to the parent directory.')) {
      try {
        await foldersRepo.deleteFolder(folderId);
        if (selectedFolderId === folderId) onSelectFolder('all');
        showSnackbar({ message: 'Folder deleted' });
      } catch (err) {
        console.error('Failed to delete folder:', err);
        showSnackbar({ message: 'Failed to delete folder' });
      }
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/folder-id', String(folderId));
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const noteId = e.dataTransfer.getData('text/note-id');
    if (noteId) {
      await foldersRepo.setNoteFolder(Number(noteId), folderId);
      return;
    }

    const draggedFolderId = e.dataTransfer.getData('text/folder-id');
    if (draggedFolderId && Number(draggedFolderId) !== folderId) {
      try {
        await foldersRepo.moveFolder(Number(draggedFolderId), folderId);
      } catch (err) {
        console.error('Failed to move folder:', err);
        showSnackbar({ message: 'Failed to move folder' });
      }
    }
  };

  const indentPx = depth * 20;

  return (
    <div className="select-none">
      {/* ── Node Row ── */}
      <div
        draggable={!isEditing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => onSelectFolder(folderId)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectFolder(folderId); }}
        style={{ paddingLeft: `${indentPx + 8}px` }}
        className={`group relative flex items-center justify-between gap-2 min-h-[44px] px-2 rounded-xl cursor-pointer transition-all ${
          isDragOver
            ? 'ring-2 ring-accent bg-accent/20'
            : isSelected
              ? 'bg-accent-soft text-accent font-semibold'
              : 'text-ink hover:bg-surface-2'
        }`}
      >
        {/* Branch line from parent (visible at depth > 0) */}
        {depth > 0 && (
          <svg
            aria-hidden="true"
            className="absolute left-0 top-0 h-full pointer-events-none overflow-visible"
            width={indentPx + 8}
            style={{ left: 0, top: 0 }}
          >
            {/* Vertical stem */}
            <line
              x1={indentPx - 10}
              y1="0"
              x2={indentPx - 10}
              y2="50%"
              stroke="var(--color-border)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Horizontal elbow */}
            <line
              x1={indentPx - 10}
              y1="50%"
              x2={indentPx + 4}
              y2="50%"
              stroke="var(--color-border)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Expand/Collapse chevron */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setIsCollapsed((c) => !c); }}
          className="p-1 rounded text-ink-muted hover:text-ink shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center"
          aria-label={isCollapsed ? 'Expand folder' : 'Collapse folder'}
        >
          {hasChildren ? (
            <motion.svg
              animate={{ rotate: isCollapsed ? -90 : 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="6 9 12 15 18 9" />
            </motion.svg>
          ) : (
            <span className="w-3.5 h-3.5 block" />
          )}
        </button>

        {/* Folder icon */}
        <svg
          className={`w-4.5 h-4.5 shrink-0 ${isSelected ? 'text-accent' : 'text-amber-500/80 dark:text-amber-400/80'}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>

        {/* Folder name / edit input */}
        {isEditing ? (
          <input
            type="text"
            autoFocus
            value={editingName}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="bg-transparent border-b border-accent text-xs text-ink focus:outline-none px-1 w-full min-h-[28px]"
          />
        ) : (
          <span className="truncate text-xs flex-1">{folder.name}</span>
        )}

        {/* Note count badge */}
        <span className="text-[10px] text-ink-muted font-mono shrink-0">{childNotes.length || ''}</span>

        {/* Context actions — visible on mobile, hover/focus on desktop */}
        <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity shrink-0">
          {onCreateNoteInFolder && (
            <button
              type="button"
              title="New note in folder"
              onClick={(e) => {
                e.stopPropagation();
                onCreateNoteInFolder(folderId);
              }}
              className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent-soft min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </button>
          )}
          <button
            type="button"
            title="Add subfolder"
            onClick={(e) => { e.stopPropagation(); setIsCreatingFolder(true); setNewFolderName(''); setIsCollapsed(false); }}
            className="p-1.5 rounded-lg text-ink-muted hover:text-accent hover:bg-accent-soft min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            type="button"
            title="Rename folder"
            onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditingName(folder.name); }}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
          <button
            type="button"
            title="Delete folder"
            onClick={handleDeleteFolder}
            className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger/10 min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Children (animated) ── */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (hasChildren || isCreatingFolder) && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="relative space-y-1.5 pt-1.5 pb-1">
              {/* Vertical stem line for children */}
              {(childFolders.length > 0 || childNotes.length > 0) && (
                <div
                  aria-hidden="true"
                  className="absolute top-1 bottom-3 w-px bg-border/60 pointer-events-none"
                  style={{ left: `${indentPx + 10}px` }}
                />
              )}

              {/* Inline new subfolder input */}
              {isCreatingFolder && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-xl bg-surface-2 border border-accent/30"
                  style={{ marginLeft: `${indentPx + 24}px` }}
                >
                  <svg className="w-4 h-4 text-amber-500/80 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                  </svg>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Subfolder name…"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onBlur={() => handleCreateSubmit(folderId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateSubmit(folderId);
                      if (e.key === 'Escape') setIsCreatingFolder(false);
                    }}
                    className="bg-transparent border-b border-accent text-xs text-ink focus:outline-none px-1 w-full min-h-[28px]"
                  />
                </motion.div>
              )}

              {/* Child folders */}
              {childFolders.map((sub) => (
                <div key={`folder-${sub.id}`}>
                  <FolderNode
                    folder={sub}
                    depth={depth + 1}
                    allFolders={[]}
                    noteChildrenMap={noteChildrenMap}
                    folderChildrenMap={folderChildrenMap}
                    selectedFolderId={selectedFolderId}
                    onSelectFolder={onSelectFolder}
                    onSelectNote={onSelectNote}
                    onCreateNoteInFolder={onCreateNoteInFolder}
                    activeNoteId={activeNoteId}
                  />
                </div>
              ))}

              {/* Notes inside this folder */}
              {childNotes.map((note) => {
                const isActive = activeNoteId === note.id;
                const branchX = indentPx + 10;
                const noteIndent = indentPx + 32;
                return (
                  <div key={`note-${note.id}`}>
                    <div
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/note-id', String(note.id));
                        e.stopPropagation();
                      }}
                      onClick={() => onSelectNote(note.id as number)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectNote(note.id as number); }}
                      style={{ paddingLeft: `${noteIndent}px` }}
                      className={`group relative flex items-center gap-2 min-h-[36px] py-1.5 pr-2 rounded-xl cursor-grab active:cursor-grabbing transition-colors text-xs ${
                        isActive
                          ? 'bg-accent/15 text-accent font-medium'
                          : 'text-ink-muted hover:text-ink hover:bg-surface-2/60'
                      }`}
                    >
                      {/* Elbow line to note */}
                      <svg
                        aria-hidden="true"
                        className="absolute left-0 top-0 h-full pointer-events-none overflow-visible"
                        width={noteIndent}
                        style={{ left: 0, top: 0 }}
                      >
                        <line
                          x1={branchX}
                          y1="0"
                          x2={branchX}
                          y2="50%"
                          stroke="var(--color-border)"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                        <line
                          x1={branchX}
                          y1="50%"
                          x2={indentPx + 24}
                          y2="50%"
                          stroke="var(--color-border)"
                          strokeWidth="1.2"
                          strokeLinecap="round"
                        />
                      </svg>
                      <svg className="w-3.5 h-3.5 shrink-0 opacity-50 group-hover:opacity-80 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <span className="truncate flex-1">{note.title || 'Untitled Note'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── FolderTree Root ─────────────────────────────────────────────────────────
export const FolderTree = memo(function FolderTree({
  folders,
  notes,
  selectedFolderId,
  onSelectFolder,
  onSelectNote,
  onCreateNoteInFolder,
  activeNoteId,
}: FolderTreeProps) {
  const { showSnackbar } = useSnackbar();
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');

  // Group folders by parentId
  const folderChildrenMap = useMemo(() => {
    const map = new Map<number | null, Folder[]>();
    for (const f of folders) {
      const pid = f.parentId ?? null;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(f);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const isVaultA = a.name.toLowerCase() === 'vault';
        const isVaultB = b.name.toLowerCase() === 'vault';
        if (isVaultA && !isVaultB) return -1;
        if (!isVaultA && isVaultB) return 1;
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return a.name.localeCompare(b.name);
      });
    }
    return map;
  }, [folders]);

  // Group notes by folderId (exclude trash/scratchpad)
  const noteChildrenMap = useMemo(() => {
    const map = new Map<number | null, Note[]>();
    for (const n of notes) {
      if (n.trashedAt !== null || n.isScratchpad) continue;
      const fid = n.folderId ?? null;
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid)!.push(n);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return map;
  }, [notes]);

  const rootFolders = folderChildrenMap.get(null) || [];
  const rootNotes = noteChildrenMap.get(null) || [];
  const totalNotes = notes.filter((n) => !n.isScratchpad && n.trashedAt === null).length;

  const handleCreateRoot = async () => {
    if (!newRootName.trim()) { setIsCreatingRoot(false); setNewRootName(''); return; }
    try {
      await foldersRepo.createFolder(newRootName.trim(), null);
      setIsCreatingRoot(false);
      setNewRootName('');
    } catch (err) {
      console.error('Failed to create folder:', err);
      showSnackbar({ message: 'Failed to create folder' });
    }
  };

  return (
    <div className="space-y-1 select-none">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Vault Folders
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('open-vault-modal'));
              }
            }}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-ink-muted hover:text-accent flex items-center gap-1 text-[11px] font-medium cursor-pointer min-h-[32px]"
            title="Manage Local Folder Vault"
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Vault</span>
          </button>
          <button
            type="button"
            onClick={() => { setIsCreatingRoot(true); setNewRootName(''); }}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-accent flex items-center gap-1 text-[11px] font-medium cursor-pointer min-h-[32px]"
            title="New root folder"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Folder</span>
          </button>
        </div>
      </div>

      {/* ── All Notes entry ── */}
      <div
        onClick={() => onSelectFolder('all')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectFolder('all'); }}
        className={`flex items-center justify-between min-h-[44px] px-3 rounded-xl cursor-pointer transition-colors text-sm ${
          selectedFolderId === 'all'
            ? 'bg-accent-soft text-accent font-semibold'
            : 'text-ink hover:bg-surface-2'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
          <span className="text-xs font-medium">All Notes</span>
        </div>
        <span className="text-[10px] text-ink-muted font-mono px-1.5 py-0.5 rounded-md bg-surface-2 border border-border">
          {totalNotes}
        </span>
      </div>

      {/* ── Quick Scratchpad entry ── */}
      <Link
        to="/scratchpad"
        className="flex items-center justify-between min-h-[44px] px-3 rounded-xl cursor-pointer transition-colors text-sm text-ink hover:bg-surface-2"
      >
        <div className="flex items-center gap-2.5 text-violet-500">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span className="text-xs font-medium text-ink">Scratchpad</span>
        </div>
        <span className="text-[10px] text-violet-500 font-mono px-1.5 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20">
          Quick
        </span>
      </Link>

      {/* ── New root folder inline input ── */}
      <AnimatePresence>
        {isCreatingRoot && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 mx-1 py-1.5 px-3 bg-surface-2 rounded-xl border border-accent/30">
              <svg className="w-4 h-4 text-amber-500/80 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
              </svg>
              <input
                type="text"
                autoFocus
                placeholder="Folder name…"
                value={newRootName}
                onChange={(e) => setNewRootName(e.target.value)}
                onBlur={handleCreateRoot}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateRoot();
                  if (e.key === 'Escape') setIsCreatingRoot(false);
                }}
                className="bg-transparent border-b border-accent text-xs text-ink focus:outline-none px-1 w-full min-h-[28px]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Root folder tree ── */}
      <div className="space-y-0.5">
        {rootFolders.map((folder) => (
          <FolderNode
            key={`folder-${folder.id}`}
            folder={folder}
            depth={0}
            allFolders={folders}
            noteChildrenMap={noteChildrenMap}
            folderChildrenMap={folderChildrenMap}
            selectedFolderId={selectedFolderId}
            onSelectFolder={onSelectFolder}
            onSelectNote={onSelectNote}
            onCreateNoteInFolder={onCreateNoteInFolder}
            activeNoteId={activeNoteId}
          />
        ))}
      </div>

      {/* ── Root / Unfiled notes (Drop target) ── */}
      {rootNotes.length > 0 && (
        <div className="pt-2 border-t border-border">
          <div
            onClick={() => onSelectFolder(null)}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              const noteId = e.dataTransfer.getData('text/note-id');
              if (noteId) {
                await foldersRepo.setNoteFolder(Number(noteId), null);
                return;
              }
              const draggedFolderId = e.dataTransfer.getData('text/folder-id');
              if (draggedFolderId) {
                try {
                  await foldersRepo.moveFolder(Number(draggedFolderId), null);
                } catch (err) {
                  console.error('Failed to move folder to root:', err);
                  showSnackbar({ message: 'Failed to move folder to root' });
                }
              }
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectFolder(null); }}
            className={`flex items-center justify-between min-h-[44px] px-3 rounded-xl cursor-pointer transition-colors text-sm ${
              selectedFolderId === null
                ? 'bg-accent-soft text-accent font-semibold'
                : 'text-ink hover:bg-surface-2'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-xs font-medium">Root / Unfiled</span>
            </div>
            <span className="text-[10px] text-ink-muted font-mono px-1.5 py-0.5 rounded-md bg-surface-2 border border-border">
              {rootNotes.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
