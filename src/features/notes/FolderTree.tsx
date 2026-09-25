import React, { useState } from 'react';
import type { Folder } from '../../types/folder';
import type { Note } from '../../types/note';
import { foldersRepo } from '../../db/repos/foldersRepo';

export interface FolderTreeProps {
  folders: Folder[];
  notes: Note[];
  selectedFolderId: number | null | 'all';
  onSelectFolder: (folderId: number | null | 'all') => void;
  onSelectNote: (noteId: number) => void;
  activeNoteId?: number | null;
}

export function FolderTree({
  folders,
  notes,
  selectedFolderId,
  onSelectFolder,
  onSelectNote,
  activeNoteId,
}: FolderTreeProps) {
  const [collapsedFolders, setCollapsedFolders] = useState<Record<number, boolean>>({});
  const [isCreatingFolder, setIsCreatingFolder] = useState<number | null | 'root'>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  // Group folders by parentId
  const folderChildrenMap = React.useMemo(() => {
    const map = new Map<number | null, Folder[]>();
    for (const f of folders) {
      const pid = f.parentId ?? null;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(f);
    }
    // Sort alphabetically
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return map;
  }, [folders]);

  // Group notes by folderId
  const noteChildrenMap = React.useMemo(() => {
    const map = new Map<number | null, Note[]>();
    for (const n of notes) {
      if (n.trashedAt !== null || n.isScratchpad) continue;
      const fid = n.folderId ?? null;
      if (!map.has(fid)) map.set(fid, []);
      map.get(fid)!.push(n);
    }
    // Sort by updated time
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }
    return map;
  }, [notes]);

  const toggleCollapse = (folderId: number) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleCreateSubmit = async (parentId: number | null) => {
    if (!newFolderName.trim()) {
      setIsCreatingFolder(null);
      setNewFolderName('');
      return;
    }
    try {
      await foldersRepo.createFolder(newFolderName.trim(), parentId);
      setIsCreatingFolder(null);
      setNewFolderName('');
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  const handleRenameSubmit = async (folderId: number) => {
    if (!editingName.trim()) {
      setEditingFolderId(null);
      setEditingName('');
      return;
    }
    try {
      await foldersRepo.renameFolder(folderId, editingName.trim());
      setEditingFolderId(null);
      setEditingName('');
    } catch (err) {
      console.error('Failed to rename folder:', err);
    }
  };

  const handleDeleteFolder = async (folderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete folder? Notes inside will be moved to the parent directory.')) {
      await foldersRepo.deleteFolder(folderId);
      if (selectedFolderId === folderId) {
        onSelectFolder('all');
      }
    }
  };

  const renderFolderItem = (folder: Folder, depth = 0) => {
    const folderId = folder.id as number;
    const isCollapsed = Boolean(collapsedFolders[folderId]);
    const childFolders = folderChildrenMap.get(folderId) || [];
    const childNotes = noteChildrenMap.get(folderId) || [];
    const isSelected = selectedFolderId === folderId;

    return (
      <div key={`folder-${folderId}`} className="select-none text-sm">
        <div
          onClick={() => onSelectFolder(folderId)}
          className={`group flex items-center justify-between py-1.5 px-2 rounded-xl cursor-pointer transition-colors ${
            isSelected
              ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold'
              : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
          }`}
          style={{ paddingLeft: `${Math.max(8, depth * 16 + 8)}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {/* Collapse toggle */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(folderId);
              }}
              className="p-0.5 rounded text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-150 ${isCollapsed ? '' : 'rotate-90'}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {/* Folder Icon */}
            <svg
              className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[var(--color-accent)]' : 'text-amber-500/80 dark:text-amber-400/80'}`}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
            </svg>

            {/* Folder Name / Edit input */}
            {editingFolderId === folderId ? (
              <input
                type="text"
                autoFocus
                value={editingName}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleRenameSubmit(folderId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit(folderId);
                  if (e.key === 'Escape') setEditingFolderId(null);
                }}
                className="bg-transparent border-b border-[var(--color-accent)] text-xs text-[var(--color-ink)] focus:outline-none px-1 w-full"
              />
            ) : (
              <span className="truncate flex-1 text-xs">{folder.name}</span>
            )}
          </div>

          {/* Counts & Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Add subfolder */}
            <button
              type="button"
              title="Add subfolder"
              onClick={(e) => {
                e.stopPropagation();
                setIsCreatingFolder(folderId);
                setNewFolderName('');
                setCollapsedFolders((prev) => ({ ...prev, [folderId]: false }));
              }}
              className="p-1 rounded text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>

            {/* Rename */}
            <button
              type="button"
              title="Rename folder"
              onClick={(e) => {
                e.stopPropagation();
                setEditingFolderId(folderId);
                setEditingName(folder.name);
              }}
              className="p-1 rounded text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>

            {/* Delete */}
            <button
              type="button"
              title="Delete folder"
              onClick={(e) => handleDeleteFolder(folderId, e)}
              className="p-1 rounded text-[var(--color-ink-muted)] hover:text-red-500"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>

          <span className="text-[10px] text-[var(--color-ink-muted)] font-mono ml-1">
            {childNotes.length}
          </span>
        </div>

        {/* Children when expanded */}
        {!isCollapsed && (
          <div className="space-y-0.5 mt-0.5">
            {/* New subfolder inline input */}
            {isCreatingFolder === folderId && (
              <div
                className="flex items-center gap-1.5 py-1 px-2"
                style={{ paddingLeft: `${(depth + 1) * 16 + 12}px` }}
              >
                <svg className="w-3.5 h-3.5 text-amber-500/80" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
                <input
                  type="text"
                  autoFocus
                  placeholder="Subfolder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={() => handleCreateSubmit(folderId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSubmit(folderId);
                    if (e.key === 'Escape') setIsCreatingFolder(null);
                  }}
                  className="bg-transparent border-b border-[var(--color-accent)] text-xs text-[var(--color-ink)] focus:outline-none px-1 w-full"
                />
              </div>
            )}

            {/* Subfolders */}
            {childFolders.map((sub) => renderFolderItem(sub, depth + 1))}

            {/* Notes inside this folder */}
            {childNotes.map((note) => {
              const isActive = activeNoteId === note.id;
              return (
                <div
                  key={`note-${note.id}`}
                  onClick={() => onSelectNote(note.id as number)}
                  className={`flex items-center gap-2 py-1 px-2 rounded-lg cursor-pointer transition-colors text-xs ${
                    isActive
                      ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-medium'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
                  }`}
                  style={{ paddingLeft: `${(depth + 1) * 16 + 12}px` }}
                >
                  <svg className="w-3.5 h-3.5 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span className="truncate">{note.title || 'Untitled Note'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const rootFolders = folderChildrenMap.get(null) || [];
  const rootNotes = noteChildrenMap.get(null) || [];

  return (
    <div className="space-y-2 select-none">
      {/* Top Header & Root controls */}
      <div className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
        <span>Vault Folders</span>
        <button
          type="button"
          onClick={() => {
            setIsCreatingFolder('root');
            setNewFolderName('');
          }}
          className="p-1 rounded hover:bg-[var(--color-surface-2)] text-[var(--color-accent)] flex items-center gap-1 text-xs font-medium cursor-pointer"
          title="New root folder"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Folder</span>
        </button>
      </div>

      {/* 'All Notes' overview item */}
      <div
        onClick={() => onSelectFolder('all')}
        className={`flex items-center justify-between py-1.5 px-2 rounded-xl cursor-pointer transition-colors text-sm ${
          selectedFolderId === 'all'
            ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold'
            : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
        }`}
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
          <span className="text-xs">All Notes</span>
        </div>
        <span className="text-[10px] text-[var(--color-ink-muted)] font-mono">
          {notes.filter((n) => !n.isScratchpad && n.trashedAt === null).length}
        </span>
      </div>

      {/* Inline Input for New Root Folder */}
      {isCreatingFolder === 'root' && (
        <div className="flex items-center gap-1.5 py-1 px-3 bg-[var(--color-surface-2)] rounded-xl">
          <svg className="w-4 h-4 text-amber-500/80" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          <input
            type="text"
            autoFocus
            placeholder="Folder name..."
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onBlur={() => handleCreateSubmit(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateSubmit(null);
              if (e.key === 'Escape') setIsCreatingFolder(null);
            }}
            className="bg-transparent border-b border-[var(--color-accent)] text-xs text-[var(--color-ink)] focus:outline-none px-1 w-full"
          />
        </div>
      )}

      {/* Render Folder Tree */}
      <div className="space-y-0.5">
        {rootFolders.map((folder) => renderFolderItem(folder, 0))}
      </div>

      {/* Root unfiled notes */}
      {rootNotes.length > 0 && (
        <div className="pt-2 border-t border-[var(--color-border)]">
          <div
            onClick={() => onSelectFolder(null)}
            className={`flex items-center justify-between py-1.5 px-2 rounded-xl cursor-pointer transition-colors text-sm ${
              selectedFolderId === null
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold'
                : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-xs">Root / Unfiled</span>
            </div>
            <span className="text-[10px] text-[var(--color-ink-muted)] font-mono">
              {rootNotes.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
