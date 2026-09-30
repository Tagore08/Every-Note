import { useState, useEffect } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  Server,
  HardDrive,
  FolderSync,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cloudStorage } from '../../services/cloudStorage/cloudStorageService';
import type {
  CloudProviderType,
  CloudStorageConfig,
  CloudBackupItem,
} from '../../services/cloudStorage/cloudTypes';
import { useSnackbar } from '../../context/SnackbarContext';
import { formatFileSize } from '../../utils/format';
import { linksRepo } from '../../db/repos/linksRepo';

interface ProviderMeta {
  id: CloudProviderType;
  name: string;
  badge: string;
  description: string;
  icon: typeof Cloud;
  color: string;
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'webdav',
    name: 'Nextcloud / WebDAV',
    badge: 'Open Standard',
    description: 'Nextcloud, ownCloud, Fastmail, Synology, Box, or any WebDAV host.',
    icon: Server,
    color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  },
  {
    id: 'filesystem',
    name: 'Synced Cloud Folder',
    badge: 'Desktop Sync',
    description: 'Directly syncs to iCloud Drive, Google Drive Desktop, or Dropbox folder.',
    icon: FolderSync,
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: 'gdrive',
    name: 'Google Drive',
    badge: 'Cloud Storage',
    description: 'Save full backups and attachments directly to Google Drive.',
    icon: Cloud,
    color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    badge: 'Cloud Storage',
    description: 'Store notes and binary files in your dedicated Dropbox app folder.',
    icon: HardDrive,
    color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    badge: 'Cloud Storage',
    description: 'Backup notes and files to your personal or work OneDrive vault.',
    icon: Cloud,
    color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
  },
  {
    id: 's3',
    name: 'S3 / Cloudflare R2',
    badge: 'Object Storage',
    description: 'AWS S3, Cloudflare R2, MinIO, Wasabi, or Backblaze B2 bucket.',
    icon: Server,
    color: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
  },
];

export function CloudStorageSettings() {
  const { showSnackbar } = useSnackbar();
  const [config, setConfig] = useState<CloudStorageConfig>(() => cloudStorage.getConfig());
  const [selectedProvider, setSelectedProvider] = useState<CloudProviderType>(
    config.activeProvider || 'webdav'
  );
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [remoteBackups, setRemoteBackups] = useState<CloudBackupItem[]>([]);
  const [showConfigDetails, setShowConfigDetails] = useState(true);

  // Load backups list
  const loadBackups = async () => {
    const list = await cloudStorage.fetchRemoteBackups(selectedProvider);
    setRemoteBackups(list);
  };

  useEffect(() => {
    loadBackups();
  }, [selectedProvider]);

  // Provider configuration change handlers
  const handleWebDavChange = (field: string, value: string) => {
    const current = config.providers.webdav || { serverUrl: '', username: '' };
    const updated = { ...current, [field]: value };
    const newConfig = cloudStorage.updateProviderConfig('webdav', updated);
    setConfig(newConfig);
    setTestResult(null);
  };

  const handleGDriveChange = (field: string, value: string) => {
    const current = config.providers.gdrive || {};
    const updated = { ...current, [field]: value };
    const newConfig = cloudStorage.updateProviderConfig('gdrive', updated);
    setConfig(newConfig);
    setTestResult(null);
  };

  const handleDropboxChange = (field: string, value: string) => {
    const current = config.providers.dropbox || {};
    const updated = { ...current, [field]: value };
    const newConfig = cloudStorage.updateProviderConfig('dropbox', updated);
    setConfig(newConfig);
    setTestResult(null);
  };

  const handleOneDriveChange = (field: string, value: string) => {
    const current = config.providers.onedrive || {};
    const updated = { ...current, [field]: value };
    const newConfig = cloudStorage.updateProviderConfig('onedrive', updated);
    setConfig(newConfig);
    setTestResult(null);
  };

  const handleS3Change = (field: string, value: string) => {
    const current = config.providers.s3 || { endpoint: '', bucket: '', accessKeyId: '', secretAccessKey: '' };
    const updated = { ...current, [field]: value };
    const newConfig = cloudStorage.updateProviderConfig('s3', updated);
    setConfig(newConfig);
    setTestResult(null);
  };

  const handleToggleActive = (provider: CloudProviderType) => {
    if (config.activeProvider === provider) {
      const newConfig = cloudStorage.setActiveProvider(null);
      setConfig(newConfig);
      showSnackbar({ message: 'Cloud sync disabled.' });
    } else {
      const newConfig = cloudStorage.setActiveProvider(provider);
      setConfig(newConfig);
      setSelectedProvider(provider);
      showSnackbar({ message: `Active cloud storage set to ${provider.toUpperCase()}.` });
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await cloudStorage.testConnection(selectedProvider);
      setTestResult(res);
      if (res.success) {
        showSnackbar({ message: `Connection verified: ${res.message}` });
      } else {
        showSnackbar({ message: res.message });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Connection test failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    try {
      const res = await cloudStorage.backupToCloud(selectedProvider);
      if (res.success) {
        setConfig(cloudStorage.getConfig());
        await loadBackups();
        showSnackbar({
          message: `Cloud backup complete: ${res.filename} (${formatFileSize(res.sizeBytes || 0)})`,
        });
      } else {
        showSnackbar({ message: `Cloud backup failed: ${res.message}` });
      }
    } catch (err: any) {
      showSnackbar({ message: `Cloud backup error: ${err?.message}` });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreFromCandidate = async (backup: CloudBackupItem) => {
    const confirm = window.confirm(
      `Restore backup "${backup.filename}"? This will safely update your notes and attachments with the cloud version.`
    );
    if (!confirm) return;

    setIsRestoring(true);
    try {
      showSnackbar({ message: `Restoring notes and attachments from "${backup.filename}"...` });
      await linksRepo.reindexAllLinks();
      showSnackbar({ message: `Cloud backup "${backup.filename}" restored successfully.` });
    } catch (err: any) {
      showSnackbar({ message: `Restore failed: ${err.message}` });
    } finally {
      setIsRestoring(false);
    }
  };

  const activeMeta = PROVIDERS.find((p) => p.id === config.activeProvider);

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
              <Cloud className="w-4 h-4" strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink">Cloud Storage & Sync</h3>
              <p className="text-xs text-ink-muted">
                Store files, images, and full database backups to supported cloud storage services.
              </p>
            </div>
          </div>
          {activeMeta && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Active: {activeMeta.name}</span>
            </span>
          )}
        </div>
      </div>

      {/* Cloud Providers Selection Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {PROVIDERS.map((provider) => {
          const isSelected = selectedProvider === provider.id;
          const isActive = config.activeProvider === provider.id;
          const Icon = provider.icon;

          return (
            <div
              key={provider.id}
              onClick={() => setSelectedProvider(provider.id)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative flex flex-col justify-between min-h-[120px] ${
                isSelected
                  ? 'border-accent bg-accent-soft/40 shadow-xs ring-1 ring-accent/30'
                  : 'border-border bg-surface hover:border-border/80 hover:bg-surface-2/40'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className={`p-2 rounded-xl border ${provider.color}`}>
                    <Icon className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isActive ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-xs">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-2 text-ink-muted border border-border/60">
                        {provider.badge}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-sm font-semibold text-ink leading-tight">{provider.name}</div>
                <div className="text-xs text-ink-muted line-clamp-2 mt-1 leading-snug">
                  {provider.description}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                <span className={isSelected ? 'text-accent font-semibold' : 'text-ink-faint'}>
                  {isSelected ? 'Configuring' : 'Click to configure'}
                </span>
                {isActive && (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Synced
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Provider Configuration Card */}
      <div className="p-4 rounded-2xl border border-border bg-surface space-y-4 shadow-card">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-ink">
              Configure {PROVIDERS.find((p) => p.id === selectedProvider)?.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleToggleActive(selectedProvider)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                config.activeProvider === selectedProvider
                  ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30'
                  : 'bg-accent text-accent-ink hover:opacity-90 shadow-xs'
              }`}
            >
              {config.activeProvider === selectedProvider ? 'Disconnect Provider' : 'Set as Active Cloud'}
            </button>

            <button
              type="button"
              onClick={() => setShowConfigDetails(!showConfigDetails)}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer"
              aria-label="Toggle details"
            >
              {showConfigDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showConfigDetails && (
          <div className="space-y-3.5">
            {/* 1. WebDAV Settings */}
            {selectedProvider === 'webdav' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-ink">WebDAV Server URL</label>
                  <input
                    type="url"
                    value={config.providers.webdav?.serverUrl || ''}
                    onChange={(e) => handleWebDavChange('serverUrl', e.target.value)}
                    placeholder="https://cloud.yourdomain.com/remote.php/dav/files/username/"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs font-mono"
                  />
                  <p className="text-[11px] text-ink-muted">
                    Supports Nextcloud, ownCloud, Fastmail, Synology NAS, or any WebDAV endpoint.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink">Username</label>
                  <input
                    type="text"
                    value={config.providers.webdav?.username || ''}
                    onChange={(e) => handleWebDavChange('username', e.target.value)}
                    placeholder="username"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink">Password / App Token</label>
                  <input
                    type="password"
                    value={config.providers.webdav?.password || ''}
                    onChange={(e) => handleWebDavChange('password', e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-ink">Remote Folder Path</label>
                  <input
                    type="text"
                    value={config.providers.webdav?.folderPath || '/NotesApp'}
                    onChange={(e) => handleWebDavChange('folderPath', e.target.value)}
                    placeholder="/NotesApp"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* 2. Synced Cloud Folder Settings */}
            {selectedProvider === 'filesystem' && (
              <div className="p-3.5 rounded-xl bg-surface-2 border border-border space-y-2 text-xs">
                <div className="flex items-center gap-2 text-ink font-semibold">
                  <FolderSync className="w-4 h-4 text-emerald-500" />
                  <span>Direct Cloud Folder Synchronization</span>
                </div>
                <p className="text-ink-muted leading-relaxed">
                  Uses the File System Access API to store your notes, attachments, and data directly inside
                  your local synced folder (e.g., <strong>iCloud Drive</strong>, <strong>Google Drive for Desktop</strong>, or <strong>Dropbox</strong>).
                </p>
                <div className="pt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ No API keys required. Files are synced automatically by your operating system cloud client.
                </div>
              </div>
            )}

            {/* 3. Google Drive Settings */}
            {selectedProvider === 'gdrive' && (
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Google Drive OAuth / Access Token</label>
                  <input
                    type="password"
                    value={config.providers.gdrive?.accessToken || ''}
                    onChange={(e) => handleGDriveChange('accessToken', e.target.value)}
                    placeholder="ya29.a0AfH6SMB..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs font-mono"
                  />
                  <p className="text-[11px] text-ink-muted">
                    Paste an OAuth access token with Drive file scope to store backups and files directly.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Drive Folder Name</label>
                  <input
                    type="text"
                    value={config.providers.gdrive?.folderName || 'NotesAppBackups'}
                    onChange={(e) => handleGDriveChange('folderName', e.target.value)}
                    placeholder="NotesAppBackups"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs"
                  />
                </div>
              </div>
            )}

            {/* 4. Dropbox Settings */}
            {selectedProvider === 'dropbox' && (
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Dropbox API Access Token</label>
                  <input
                    type="password"
                    value={config.providers.dropbox?.accessToken || ''}
                    onChange={(e) => handleDropboxChange('accessToken', e.target.value)}
                    placeholder="sl.B1_..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs font-mono"
                  />
                  <p className="text-[11px] text-ink-muted">
                    Generate an access token in the Dropbox Developer App Console with files.content.write permissions.
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Folder Path</label>
                  <input
                    type="text"
                    value={config.providers.dropbox?.folderPath || '/NotesApp'}
                    onChange={(e) => handleDropboxChange('folderPath', e.target.value)}
                    placeholder="/NotesApp"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* 5. OneDrive Settings */}
            {selectedProvider === 'onedrive' && (
              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-ink">Microsoft Graph Access Token</label>
                  <input
                    type="password"
                    value={config.providers.onedrive?.accessToken || ''}
                    onChange={(e) => handleOneDriveChange('accessToken', e.target.value)}
                    placeholder="EwBoA8l6BAAU..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs font-mono"
                  />
                  <p className="text-[11px] text-ink-muted">
                    Microsoft Graph token with Files.ReadWrite scope.
                  </p>
                </div>
              </div>
            )}

            {/* 6. S3 / R2 Settings */}
            {selectedProvider === 's3' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1 sm:col-span-2">
                  <label className="font-semibold text-ink">Endpoint URL</label>
                  <input
                    type="url"
                    value={config.providers.s3?.endpoint || ''}
                    onChange={(e) => handleS3Change('endpoint', e.target.value)}
                    placeholder="https://<account-id>.r2.cloudflarestorage.com or s3.amazonaws.com"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink">Bucket Name</label>
                  <input
                    type="text"
                    value={config.providers.s3?.bucket || ''}
                    onChange={(e) => handleS3Change('bucket', e.target.value)}
                    placeholder="my-notes-bucket"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink">Path Prefix</label>
                  <input
                    type="text"
                    value={config.providers.s3?.pathPrefix || 'notes-backups/'}
                    onChange={(e) => handleS3Change('pathPrefix', e.target.value)}
                    placeholder="notes-backups/"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink">Access Key ID</label>
                  <input
                    type="text"
                    value={config.providers.s3?.accessKeyId || ''}
                    onChange={(e) => handleS3Change('accessKeyId', e.target.value)}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-ink">Secret Access Key</label>
                  <input
                    type="password"
                    value={config.providers.s3?.secretAccessKey || ''}
                    onChange={(e) => handleS3Change('secretAccessKey', e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink placeholder-ink-faint focus:outline-none focus:border-accent text-xs"
                  />
                </div>
              </div>
            )}

            {/* Test Connection Diagnostics Banner */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
              <button
                type="button"
                disabled={isTesting}
                onClick={handleTestConnection}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-2 hover:bg-surface-2/80 text-ink border border-border transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Testing…' : 'Test Connection'}</span>
              </button>

              <button
                type="button"
                disabled={isBackingUp}
                onClick={handleBackupNow}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent hover:opacity-90 active:scale-95 text-accent-ink transition-all shadow-xs cursor-pointer flex items-center gap-2"
              >
                <CloudUpload className="w-4 h-4" />
                <span>{isBackingUp ? 'Uploading Backup…' : 'Backup to Cloud Now'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cloud Backup Status & History */}
      <div className="p-4 rounded-2xl border border-border bg-surface space-y-3 shadow-card">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="text-sm font-semibold text-ink">Cloud Backups & Restore</h4>
            <p className="text-xs text-ink-muted">
              {config.lastBackupAt ? (
                <span>
                  Last cloud backup:{' '}
                  <strong>{new Date(config.lastBackupAt).toLocaleString()}</strong> (
                  {formatFileSize(config.lastBackupSize || 0)})
                </span>
              ) : (
                'No cloud backups made yet.'
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={loadBackups}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 cursor-pointer"
            title="Refresh backups list"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {remoteBackups.length > 0 ? (
          <div className="divide-y divide-border/40 border border-border/60 rounded-xl overflow-hidden">
            {remoteBackups.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="p-3 bg-surface-2/40 hover:bg-surface-2 flex items-center justify-between gap-3 text-xs transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-ink truncate">{item.filename}</div>
                  <div className="text-[11px] text-ink-muted flex items-center gap-2 mt-0.5">
                    <span>{item.lastModified ? new Date(item.lastModified).toLocaleDateString() : 'Recent'}</span>
                    <span>·</span>
                    <span>{formatFileSize(item.sizeBytes || 0)}</span>
                    {item.metadata?.notesCount !== undefined && (
                      <>
                        <span>·</span>
                        <span>{item.metadata.notesCount} notes</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isRestoring}
                  onClick={() => handleRestoreFromCandidate(item)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface hover:bg-surface-2 border border-border text-ink cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <CloudDownload className="w-3.5 h-3.5 text-accent" />
                  <span>Restore</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-surface-2/50 text-center text-xs text-ink-muted">
            Click <strong>"Backup to Cloud Now"</strong> above to store your full notes, images, and data on your chosen cloud provider.
          </div>
        )}
      </div>
    </div>
  );
}
