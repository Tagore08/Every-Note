import { useState, useEffect, type DragEvent } from 'react';
import {
  FolderArchive,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  X,
  FolderOpen,
  Info,
  FileArchive,
  Files,
  UploadCloud,
  Layers,
  Plus,
  Trash2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { localVaultService, type LocalVaultMetadata } from '../../services/vault/localVaultService';
import { useSnackbar } from '../../context/SnackbarContext';

interface VaultManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVaultLinked?: (vault: LocalVaultMetadata) => void;
}

export function VaultManagerModal({ isOpen, onClose, onVaultLinked }: VaultManagerModalProps) {
  const { showSnackbar } = useSnackbar();
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import'>('list');
  const [vault, setVault] = useState<LocalVaultMetadata>(() => localVaultService.getActiveVault());
  const [vaultList, setVaultList] = useState<LocalVaultMetadata[]>(() => localVaultService.getVaultList());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing vault…');
  const [customVaultName, setCustomVaultName] = useState('');
  const [newVaultName, setNewVaultName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const isNativeOrMobile = localVaultService.isNativeOrMobile();

  const refreshVaultData = () => {
    setVault(localVaultService.getActiveVault());
    setVaultList(localVaultService.getVaultList());
  };

  useEffect(() => {
    if (isOpen) {
      refreshVaultData();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleVaultChange = () => {
      refreshVaultData();
    };
    window.addEventListener('vault-changed', handleVaultChange);
    window.addEventListener('vault-list-changed', handleVaultChange);
    return () => {
      window.removeEventListener('vault-changed', handleVaultChange);
      window.removeEventListener('vault-list-changed', handleVaultChange);
    };
  }, []);

  if (!isOpen) return null;

  const handleSwitchVault = async (targetName: string) => {
    if (targetName.toLowerCase() === vault.name.toLowerCase()) return;
    setIsLoading(true);
    setLoadingText(`Switching to ${targetName}…`);
    try {
      const res = await localVaultService.switchVault(targetName);
      if (res.success && res.vault) {
        setVault(res.vault);
        setVaultList(localVaultService.getVaultList());
        showSnackbar({ message: res.message });
        onVaultLinked?.(res.vault);
      } else {
        showSnackbar({ message: res.message });
      }
    } catch (err: any) {
      showSnackbar({ message: `Error switching vault: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewVault = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = newVaultName.trim();
    if (!name) {
      showSnackbar({ message: 'Please enter a vault name.' });
      return;
    }

    setIsLoading(true);
    setLoadingText(`Creating "${name}"…`);
    try {
      const res = await localVaultService.createAppManagedVault(name);
      if (res.success && res.vault) {
        setVault(res.vault);
        setVaultList(localVaultService.getVaultList());
        setNewVaultName('');
        setActiveTab('list');
        showSnackbar({ message: res.message });
        onVaultLinked?.(res.vault);
      } else {
        showSnackbar({ message: res.message });
      }
    } catch (err: any) {
      showSnackbar({ message: `Error creating vault: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveVault = (e: React.MouseEvent, vaultName: string) => {
    e.stopPropagation();
    if (vaultName.toLowerCase() === 'default vault') {
      showSnackbar({ message: 'Default Vault cannot be removed.' });
      return;
    }
    localVaultService.removeVaultFromList(vaultName);
    refreshVaultData();
    showSnackbar({ message: `Removed "${vaultName}" from vault list.` });
  };

  const handleOpenFolderPicker = async () => {
    setIsLoading(true);
    setLoadingText('Scanning & importing folder…');
    try {
      const res = await localVaultService.openLocalFolderPicker(customVaultName);
      if (res.success && res.vault) {
        setVault(res.vault);
        setVaultList(localVaultService.getVaultList());
        setActiveTab('list');
        showSnackbar({ message: res.message });
        onVaultLinked?.(res.vault);
      } else {
        showSnackbar({ message: res.message });
      }
    } catch (err: any) {
      showSnackbar({ message: `Error opening folder: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenZipPicker = async () => {
    setIsLoading(true);
    setLoadingText('Extracting & importing ZIP vault…');
    try {
      const res = await localVaultService.openZipPicker(customVaultName);
      if (res.success && res.vault) {
        setVault(res.vault);
        setVaultList(localVaultService.getVaultList());
        setActiveTab('list');
        showSnackbar({ message: res.message });
        onVaultLinked?.(res.vault);
      } else {
        showSnackbar({ message: res.message });
      }
    } catch (err: any) {
      showSnackbar({ message: `Error importing ZIP vault: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenFilesPicker = async () => {
    setIsLoading(true);
    setLoadingText('Importing markdown notes…');
    try {
      const res = await localVaultService.openFilesPicker(customVaultName);
      if (res.success && res.vault) {
        setVault(res.vault);
        setVaultList(localVaultService.getVaultList());
        setActiveTab('list');
        showSnackbar({ message: res.message });
        onVaultLinked?.(res.vault);
      } else {
        showSnackbar({ message: res.message });
      }
    } catch (err: any) {
      showSnackbar({ message: `Error importing files: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!e.dataTransfer) return;

    setIsLoading(true);
    setLoadingText('Reading and syncing dropped items…');
    try {
      const res = await localVaultService.importFromDataTransfer(e.dataTransfer, customVaultName);
      if (res.success && res.vault) {
        setVault(res.vault);
        setVaultList(localVaultService.getVaultList());
        setActiveTab('list');
        showSnackbar({ message: res.message });
        onVaultLinked?.(res.vault);
      } else {
        showSnackbar({ message: res.message });
      }
    } catch (err: any) {
      showSnackbar({ message: `Error importing dropped item: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResync = async () => {
    setIsLoading(true);
    setLoadingText('Resyncing notes in vault…');
    try {
      const res = await localVaultService.resyncActiveVault();
      if (res.success) {
        refreshVaultData();
        showSnackbar({ message: res.message });
      } else {
        showSnackbar({ message: res.message });
      }
    } catch (err: any) {
      showSnackbar({ message: `Resync failed: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="w-full max-w-lg rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Obsidian-Style Vault Switcher Header */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-border/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent text-accent-ink flex items-center justify-center shadow-xs">
              <FolderArchive className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-bold text-ink leading-tight flex items-center gap-2">
                <span>Vaults & Workspaces</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-accent-soft text-accent">
                  Obsidian Compatible
                </span>
              </h3>
              <p className="text-xs text-ink-muted">Switch workspaces or link local folders</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (Obsidian Switcher style) */}
        <div className="flex border-b border-border/60 px-5 bg-surface-2/40 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>Vaults ({vaultList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create New Vault</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'border-accent text-accent'
                : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Open Folder / ZIP</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: VAULTS LIST */}
          {activeTab === 'list' && (
            <div className="space-y-3">
              <div className="text-xs text-ink-muted flex items-center justify-between">
                <span>Select a vault to switch workspace</span>
                <span className="text-[11px] text-ink-faint">
                  Active: <strong className="text-ink">{vault.name}</strong>
                </span>
              </div>

              <div className="space-y-2">
                {vaultList.map((v) => {
                  const isActive = v.name.toLowerCase() === vault.name.toLowerCase();
                  return (
                    <div
                      key={v.name}
                      onClick={() => handleSwitchVault(v.name)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                        isActive
                          ? 'border-accent bg-accent-soft/30 shadow-xs'
                          : 'border-border/80 bg-surface-2/40 hover:bg-surface-2 hover:border-accent/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-accent text-accent-ink shadow-xs'
                              : 'bg-surface border border-border text-ink-muted group-hover:text-accent'
                          }`}
                        >
                          <FolderArchive className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-ink truncate">{v.name}</span>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0">
                                <CheckCircle2 className="w-3 h-3" />
                                Active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-ink-faint flex items-center gap-2 mt-0.5">
                            <span>{v.fileCount} notes</span>
                            <span>•</span>
                            <span className="capitalize">{v.storageType || 'app-managed'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isActive ? (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResync();
                            }}
                            className="p-2 rounded-xl text-ink-muted hover:text-accent hover:bg-surface-3 transition-colors cursor-pointer"
                            title="Resync notes in this vault"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleRemoveVault(e, v.name)}
                              className="p-2 rounded-xl text-ink-faint hover:text-red-600 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Remove vault from list"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface border border-border text-ink group-hover:border-accent group-hover:text-accent transition-colors">
                              <span>Open</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick actions row */}
              <div className="pt-2 flex items-center justify-between border-t border-border/50">
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create another vault</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('import')}
                  className="text-xs font-medium text-ink-muted hover:text-ink flex items-center gap-1 cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Import from disk</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: CREATE NEW VAULT */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateNewVault} className="space-y-4">
              <div className="p-4 rounded-2xl bg-surface-2/40 border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <h4 className="text-sm font-bold text-ink">Create a New Isolated Vault</h4>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Create a fresh vault with its own workspace folder and notes. Perfect for separating Work, Personal, or Project wikis.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-ink">Vault Name</label>
                <input
                  type="text"
                  placeholder="e.g. Work Notes, Knowledge Base, Research"
                  value={newVaultName}
                  onChange={(e) => setNewVaultName(e.target.value)}
                  autoFocus
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-surface-2 border border-border text-ink placeholder:text-ink-faint focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !newVaultName.trim()}
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-accent hover:opacity-95 text-accent-ink transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isLoading ? loadingText : 'Create & Switch to Vault'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="py-2.5 px-4 rounded-xl text-xs font-medium border border-border bg-surface text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: IMPORT / OPEN FOLDER / ZIP */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              {/* Vault Name customization (optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-muted flex items-center justify-between">
                  <span>Custom Vault Label (Optional)</span>
                  <span className="text-[11px] text-ink-faint">Defaults to folder/archive name</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Obsidian Sync, External Notes"
                  value={customVaultName}
                  onChange={(e) => setCustomVaultName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-surface-2 border border-border text-ink placeholder:text-ink-faint focus:outline-hidden focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
              </div>

              {/* Action: Upload / Select Local Vault */}
              <div className="p-4 rounded-2xl border border-accent/30 bg-accent-soft/20 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-accent text-accent-ink shadow-xs">
                    <FolderOpen className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-ink">Upload or Link Local Vault</h4>
                    <p className="text-xs text-ink-muted">
                      Choose a folder, a .zip vault archive, or markdown files to import.
                    </p>
                  </div>
                </div>

                {/* Desktop Drag and Drop Dropzone */}
                {!isNativeOrMobile && (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer ${
                      isDragging
                        ? 'border-accent bg-accent-soft/50 scale-[1.01]'
                        : 'border-border/80 hover:border-accent/60 bg-surface/60'
                    }`}
                    onClick={handleOpenFolderPicker}
                  >
                    <UploadCloud
                      className={`w-6 h-6 transition-colors ${
                        isDragging ? 'text-accent scale-110' : 'text-ink-faint'
                      }`}
                    />
                    <div className="text-xs font-semibold text-ink">
                      {isDragging ? 'Drop folder or ZIP archive here' : 'Drag & drop a folder or .zip vault here'}
                    </div>
                    <div className="text-[11px] text-ink-faint">
                      or click to browse your local disk
                    </div>
                  </div>
                )}

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleOpenFolderPicker}
                    className="py-2.5 px-3.5 rounded-xl text-xs font-semibold bg-accent hover:opacity-95 text-accent-ink transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <HardDrive className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {isLoading ? loadingText : 'Select Local Vault Folder'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleOpenZipPicker}
                    className="py-2.5 px-3.5 rounded-xl text-xs font-semibold border border-border bg-surface hover:bg-surface-2 text-ink transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    title="Ideal for mobile: unpacks folders and markdown files automatically"
                  >
                    <FileArchive className="w-4 h-4 text-accent shrink-0" />
                    <span className="truncate">Upload Vault Archive (.zip)</span>
                  </button>
                </div>

                {/* Secondary actions: Select Multiple Markdown Files */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={handleOpenFilesPicker}
                    className="py-2 px-3 rounded-xl text-xs font-medium border border-border/80 bg-surface hover:bg-surface-2 text-ink transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Files className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="truncate">Select Markdown Files</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="py-2 px-3 rounded-xl text-xs font-medium border border-border/80 bg-surface hover:bg-surface-2 text-ink transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="truncate">New Empty Vault</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Help box */}
          <div className="p-3.5 rounded-2xl bg-surface-2/60 border border-border/60 text-xs text-ink-muted space-y-1.5">
            <div className="font-semibold text-ink flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-accent" />
              <span>Obsidian Vault Compatibility</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
              <li>Switch between multiple vaults seamlessly just like in Obsidian.</li>
              <li>Each vault maintains its own folders, tags, and <code>[[wikilinks]]</code>.</li>
              <li>100% offline & local-first: data is stored securely on your device.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-border/60 bg-surface-2/30 flex justify-between items-center shrink-0">
          <div className="text-[11px] text-ink-faint">
            {vaultList.length} vault{vaultList.length === 1 ? '' : 's'} available
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface hover:bg-surface-2 border border-border text-ink transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
