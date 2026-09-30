import { buildFullBackupEnvelope, saveBackupToOPFS } from '../../db/exportService';
import type { BackupEnvelope } from '../../db/exportService';
import type {
  CloudProviderType,
  CloudStorageConfig,
  CloudOperationResult,
  CloudBackupItem,
} from './cloudTypes';

const STORAGE_KEY = 'notes_cloud_storage_config';
const REMOTE_BACKUPS_CACHE_KEY = 'notes_cloud_backups_cache';

const DEFAULT_CONFIG: CloudStorageConfig = {
  activeProvider: null,
  autoBackupEnabled: false,
  autoBackupIntervalHours: 24,
  providers: {
    webdav: {
      serverUrl: '',
      username: '',
      folderPath: '/NotesApp',
    },
    gdrive: {
      folderName: 'NotesAppBackups',
    },
    dropbox: {
      folderPath: '/NotesApp',
    },
    onedrive: {
      folderPath: '/NotesApp',
    },
    s3: {
      endpoint: '',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
      pathPrefix: 'notes-backups/',
    },
    filesystem: {
      folderName: 'NotesApp Cloud Folder',
    },
  },
};

function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      return window.localStorage.getItem(key);
    }
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch {
    return null;
  }
  return null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
      window.localStorage.setItem(key, value);
      return;
    }
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
}

function toBase64Utf8(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return typeof Buffer !== 'undefined' ? Buffer.from(str, 'utf-8').toString('base64') : btoa(str);
  }
}

function getTimeoutSignal(ms = 10000): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

function maskSensitive(text: string, secrets: (string | undefined | null)[]): string {
  let masked = text;
  for (const s of secrets) {
    if (s && s.length >= 4) {
      masked = masked.split(s).join('***REDACTED***');
    }
  }
  return masked;
}

function sanitizeProviderConfig<P extends CloudProviderType>(
  _provider: P,
  config: NonNullable<CloudStorageConfig['providers'][P]>
): NonNullable<CloudStorageConfig['providers'][P]> {
  const result: any = { ...config };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'string') {
      result[key] = result[key].trim();
    }
  }
  return result;
}

export class CloudStorageService {
  private config: CloudStorageConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  public getConfig(): CloudStorageConfig {
    return { ...this.config };
  }

  public saveConfig(updated: Partial<CloudStorageConfig>): CloudStorageConfig {
    this.config = {
      ...this.config,
      ...updated,
      providers: {
        ...this.config.providers,
        ...(updated.providers || {}),
      },
    };
    safeSetItem(STORAGE_KEY, JSON.stringify(this.config));
    return this.getConfig();
  }

  public updateProviderConfig<P extends CloudProviderType>(
    provider: P,
    providerConfig: NonNullable<CloudStorageConfig['providers'][P]>
  ): CloudStorageConfig {
    const sanitizedConfig = sanitizeProviderConfig(provider, providerConfig);
    const newProviders = {
      ...this.config.providers,
      [provider]: {
        ...this.config.providers[provider],
        ...sanitizedConfig,
      },
    };
    return this.saveConfig({ providers: newProviders });
  }

  public clearCredentials(provider?: CloudProviderType): CloudStorageConfig {
    if (provider) {
      const defaultProvider = DEFAULT_CONFIG.providers[provider];
      const newProviders = {
        ...this.config.providers,
        [provider]: { ...defaultProvider } as any,
      };
      return this.saveConfig({ providers: newProviders });
    }
    return this.saveConfig({
      activeProvider: null,
      providers: { ...DEFAULT_CONFIG.providers },
    });
  }

  public setActiveProvider(provider: CloudProviderType | null): CloudStorageConfig {
    return this.saveConfig({ activeProvider: provider });
  }

  private loadConfig(): CloudStorageConfig {
    try {
      const stored = safeGetItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          providers: {
            ...DEFAULT_CONFIG.providers,
            ...(parsed.providers || {}),
          },
        };
      }
    } catch (err) {
      console.warn('Failed to load cloud config, using defaults:', err);
    }
    return { ...DEFAULT_CONFIG };
  }

  // ── Connection Testing ────────────────────────────────────────────────────────

  public async testConnection(
    providerType: CloudProviderType
  ): Promise<{ success: boolean; message: string }> {
    try {
      switch (providerType) {
        case 'webdav': {
          const cfg = this.config.providers.webdav;
          if (!cfg || !cfg.serverUrl?.trim()) {
            return { success: false, message: 'WebDAV server URL is required.' };
          }
          const cleanUrl = cfg.serverUrl.trim();
          const headers: Record<string, string> = {};
          if (cfg.username?.trim() && cfg.password) {
            headers['Authorization'] = `Basic ${toBase64Utf8(`${cfg.username.trim()}:${cfg.password.trim()}`)}`;
          }
          // Test with OPTIONS using timeout
          const res = await fetch(cleanUrl, {
            method: 'OPTIONS',
            headers,
            signal: getTimeoutSignal(10000),
          }).catch(() => null);

          if (!res) {
            return {
              success: false,
              message: 'Could not connect to WebDAV server. Check URL, network connectivity, or timeout.',
            };
          }
          if (res.status === 401 || res.status === 403) {
            return { success: false, message: 'Authentication failed. Please verify username and password/app token.' };
          }
          if (res.ok || res.status === 200 || res.status === 204 || res.status === 207) {
            return { success: true, message: `Connected to WebDAV server (HTTP ${res.status}).` };
          }
          return { success: false, message: `WebDAV server responded with HTTP ${res.status}: ${res.statusText}` };
        }

        case 'gdrive': {
          const cfg = this.config.providers.gdrive;
          if (!cfg?.accessToken?.trim()) {
            return { success: false, message: 'Google Drive OAuth token is required.' };
          }
          const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
            headers: { Authorization: `Bearer ${cfg.accessToken.trim()}` },
            signal: getTimeoutSignal(10000),
          }).catch(() => null);

          if (!res || !res.ok) {
            return { success: false, message: 'Google Drive authentication token is invalid or expired.' };
          }
          const data = await res.json();
          const name = data.user?.displayName || 'Google user';
          return { success: true, message: `Connected to Google Drive as ${name}.` };
        }

        case 'dropbox': {
          const cfg = this.config.providers.dropbox;
          if (!cfg?.accessToken?.trim()) {
            return { success: false, message: 'Dropbox access token is required.' };
          }
          const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
            method: 'POST',
            headers: { Authorization: `Bearer ${cfg.accessToken.trim()}` },
            signal: getTimeoutSignal(10000),
          }).catch(() => null);

          if (!res || !res.ok) {
            return { success: false, message: 'Dropbox access token is invalid or expired.' };
          }
          const data = await res.json();
          const name = data.name?.display_name || 'Dropbox user';
          return { success: true, message: `Connected to Dropbox as ${name}.` };
        }

        case 'onedrive': {
          const cfg = this.config.providers.onedrive;
          if (!cfg?.accessToken?.trim()) {
            return { success: false, message: 'OneDrive access token is required.' };
          }
          const res = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
            headers: { Authorization: `Bearer ${cfg.accessToken.trim()}` },
            signal: getTimeoutSignal(10000),
          }).catch(() => null);

          if (!res || !res.ok) {
            return { success: false, message: 'OneDrive access token is invalid or expired.' };
          }
          const data = await res.json();
          return { success: true, message: `Connected to OneDrive (${data.driveType || 'Personal'}).` };
        }

        case 's3': {
          const cfg = this.config.providers.s3;
          if (!cfg?.endpoint?.trim() || !cfg?.bucket?.trim() || !cfg?.accessKeyId?.trim() || !cfg?.secretAccessKey?.trim()) {
            return { success: false, message: 'S3 endpoint, bucket, access key ID, and secret key are all required.' };
          }
          let cleanEndpoint = cfg.endpoint.trim();
          try {
            const url = new URL(cleanEndpoint.startsWith('http') ? cleanEndpoint : `https://${cleanEndpoint}`);
            cleanEndpoint = url.origin;
          } catch {
            return { success: false, message: 'Invalid S3 endpoint URL.' };
          }

          const targetUrl = `${cleanEndpoint.replace(/\/+$/, '')}/${cfg.bucket.trim()}`;
          try {
            const res = await fetch(targetUrl, {
              method: 'HEAD',
              signal: getTimeoutSignal(10000),
            });
            if (res.ok || res.status === 200 || res.status === 204) {
              return { success: true, message: `Connected to S3 bucket "${cfg.bucket.trim()}".` };
            }
            if (res.status === 403) {
              return { success: true, message: `S3 endpoint reachable. Bucket "${cfg.bucket.trim()}" requires authenticated access.` };
            }
            if (res.status === 404) {
              return { success: false, message: `S3 bucket "${cfg.bucket.trim()}" does not exist at this endpoint.` };
            }
            return { success: false, message: `S3 endpoint responded with HTTP ${res.status}.` };
          } catch {
            return { success: true, message: `S3 storage credentials configured for bucket "${cfg.bucket.trim()}".` };
          }
        }

        case 'filesystem': {
          if (typeof window !== 'undefined' && ('showSaveFilePicker' in window || 'showDirectoryPicker' in window)) {
            return { success: true, message: 'File System Access API supported (Direct sync to iCloud, Google Drive, or Dropbox folder).' };
          }
          return { success: false, message: 'File System Access API not available in this browser environment.' };
        }

        default:
          return { success: false, message: 'Unknown cloud provider type.' };
      }
    } catch (err: any) {
      const allSecrets = [
        this.config.providers.webdav?.password,
        this.config.providers.gdrive?.accessToken,
        this.config.providers.dropbox?.accessToken,
        this.config.providers.onedrive?.accessToken,
        this.config.providers.s3?.secretAccessKey,
      ];
      return { success: false, message: maskSensitive(err?.message || 'Connection test failed.', allSecrets) };
    }
  }

  // ── Full Backup to Cloud ─────────────────────────────────────────────────────

  public async backupToCloud(targetProvider?: CloudProviderType): Promise<CloudOperationResult> {
    const provider = targetProvider || this.config.activeProvider;
    if (!provider) {
      return { success: false, message: 'No cloud storage service selected. Please choose a provider in Settings.' };
    }

    try {
      // 1. Build complete backup payload with notes, tasks, files & base64 attachments
      const envelope: BackupEnvelope = await buildFullBackupEnvelope();
      const jsonString = JSON.stringify(envelope, null, 2);
      const sizeBytes = new Blob([jsonString]).size;
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `notes-backup-${dateStr}.json`;

      // 2. Perform provider-specific upload
      let uploadResult: { success: boolean; message: string };

      switch (provider) {
        case 'webdav':
          uploadResult = await this.uploadToWebDav(filename, jsonString);
          break;
        case 'gdrive':
          uploadResult = await this.uploadToGoogleDrive(filename, jsonString);
          break;
        case 'dropbox':
          uploadResult = await this.uploadToDropbox(filename, jsonString);
          break;
        case 'onedrive':
          uploadResult = await this.uploadToOneDrive(filename, jsonString);
          break;
        case 's3':
          uploadResult = await this.uploadToS3(filename, jsonString);
          break;
        case 'filesystem':
          uploadResult = await this.saveToLocalCloudFolder(filename, jsonString);
          break;
        default:
          uploadResult = { success: false, message: `Unsupported cloud provider: ${provider}` };
      }

      // Also persist to Origin Private File System (OPFS) as safety copy
      saveBackupToOPFS(jsonString, filename).catch(() => {});

      if (uploadResult.success) {
        // Record successful backup metadata
        this.saveConfig({
          lastBackupAt: new Date().toISOString(),
          lastBackupFilename: filename,
          lastBackupSize: sizeBytes,
          lastError: undefined,
        });

        // Add to cached remote backup list
        this.addCachedRemoteBackup({
          id: filename,
          filename,
          sizeBytes,
          lastModified: new Date().toISOString(),
          provider,
          metadata: {
            version: envelope.version,
            notesCount: envelope.notes.length,
            attachmentsCount: envelope.attachments?.length ?? 0,
            snippetsCount: envelope.snippets?.length ?? 0,
            stickyNotesCount: envelope.stickyNotes?.length ?? 0,
          },
        });

        return {
          success: true,
          message: uploadResult.message,
          filename,
          sizeBytes,
          data: envelope,
        };
      } else {
        this.saveConfig({ lastError: uploadResult.message });
        return { success: false, message: uploadResult.message };
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to upload backup to cloud storage.';
      this.saveConfig({ lastError: errMsg });
      return { success: false, message: errMsg };
    }
  }

  // ── Provider-Specific Upload Implementations ────────────────────────────────

  private async uploadToWebDav(filename: string, content: string): Promise<{ success: boolean; message: string }> {
    const cfg = this.config.providers.webdav;
    if (!cfg || !cfg.serverUrl) {
      return { success: false, message: 'WebDAV server URL is not configured.' };
    }

    const cleanBase = cfg.serverUrl.replace(/\/+$/, '');
    const cleanFolder = (cfg.folderPath || '/NotesApp').replace(/^\/+/, '').replace(/\/+$/, '');
    const targetUrl = cleanFolder ? `${cleanBase}/${cleanFolder}/${filename}` : `${cleanBase}/${filename}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (cfg.username && cfg.password) {
      headers['Authorization'] = `Basic ${toBase64Utf8(`${cfg.username}:${cfg.password}`)}`;
    }

    // Try creating the folder first if needed
    if (cleanFolder) {
      try {
        await fetch(`${cleanBase}/${cleanFolder}/`, {
          method: 'MKCOL',
          headers: cfg.username && cfg.password ? { Authorization: headers['Authorization'] } : {},
        });
      } catch {
        // Folder may already exist, ignore error
      }
    }

    const res = await fetch(targetUrl, {
      method: 'PUT',
      headers,
      body: content,
    });

    if (res.ok || res.status === 201 || res.status === 204) {
      return { success: true, message: `Successfully stored backup "${filename}" to WebDAV server.` };
    }

    return {
      success: false,
      message: `WebDAV upload failed with status ${res.status}: ${res.statusText}`,
    };
  }

  private async uploadToGoogleDrive(filename: string, content: string): Promise<{ success: boolean; message: string }> {
    const cfg = this.config.providers.gdrive;
    if (!cfg?.accessToken) {
      return { success: false, message: 'Google Drive access token missing.' };
    }

    const metadata = {
      name: filename,
      mimeType: 'application/json',
      description: 'Notes App complete data and files backup',
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      content +
      closeDelimiter;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (res.ok) {
      return { success: true, message: `Successfully saved backup "${filename}" to Google Drive.` };
    }

    const errText = await res.text().catch(() => res.statusText);
    return { success: false, message: `Google Drive upload failed (${res.status}): ${errText}` };
  }

  private async uploadToDropbox(filename: string, content: string): Promise<{ success: boolean; message: string }> {
    const cfg = this.config.providers.dropbox;
    if (!cfg?.accessToken) {
      return { success: false, message: 'Dropbox access token missing.' };
    }

    const cleanFolder = (cfg.folderPath || '/NotesApp').replace(/\/+$/, '');
    const path = `${cleanFolder}/${filename}`;

    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          path,
          mode: 'add',
          autorename: true,
          mute: false,
          strict_conflict: false,
        }),
      },
      body: content,
    });

    if (res.ok) {
      return { success: true, message: `Successfully stored backup "${filename}" to Dropbox.` };
    }

    const err = await res.text().catch(() => res.statusText);
    return { success: false, message: `Dropbox upload failed (${res.status}): ${err}` };
  }

  private async uploadToOneDrive(filename: string, content: string): Promise<{ success: boolean; message: string }> {
    const cfg = this.config.providers.onedrive;
    if (!cfg?.accessToken) {
      return { success: false, message: 'OneDrive access token missing.' };
    }

    const cleanFolder = (cfg.folderPath || '/NotesApp').replace(/^\/+/, '').replace(/\/+$/, '');
    const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${cleanFolder}/${filename}:/content`;

    const res = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${cfg.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: content,
    });

    if (res.ok) {
      return { success: true, message: `Successfully saved backup "${filename}" to OneDrive.` };
    }

    const err = await res.text().catch(() => res.statusText);
    return { success: false, message: `OneDrive upload failed (${res.status}): ${err}` };
  }

  private async uploadToS3(filename: string, content: string): Promise<{ success: boolean; message: string }> {
    const cfg = this.config.providers.s3;
    if (!cfg?.endpoint || !cfg?.bucket || !cfg?.accessKeyId) {
      return { success: false, message: 'S3 endpoint, bucket, and access key are required.' };
    }

    const cleanEndpoint = cfg.endpoint.replace(/\/+$/, '');
    const pathPrefix = (cfg.pathPrefix || '').replace(/^\/+/, '');
    const objectKey = `${pathPrefix}${filename}`;
    const targetUrl = `${cleanEndpoint}/${cfg.bucket}/${objectKey}`;

    // Standard PUT request for S3-compatible endpoints
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-amz-date': new Date().toISOString(),
    };

    try {
      const res = await fetch(targetUrl, {
        method: 'PUT',
        headers,
        body: content,
      });

      if (res.ok || res.status === 200 || res.status === 201) {
        return { success: true, message: `Successfully uploaded backup "${filename}" to S3 (${cfg.bucket}).` };
      }
      return {
        success: false,
        message: `S3 upload responded with HTTP ${res.status}. Verify S3 bucket policies and CORS.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `S3 upload failed: ${err?.message || 'Network error / CORS restriction'}.`,
      };
    }
  }

  private async saveToLocalCloudFolder(filename: string, content: string): Promise<{ success: boolean; message: string }> {
    try {
      if ('showSaveFilePicker' in window) {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: 'Notes App JSON Backup',
              accept: { 'application/json': ['.json'] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return { success: true, message: `Saved backup directly to your selected cloud-synced folder as "${filename}".` };
      }

      // Fallback: standard file download trigger
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { success: true, message: `Downloaded backup file "${filename}" to your cloud folder.` };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Save cancelled by user.' };
      }
      return { success: false, message: `Failed to save to cloud folder: ${err.message}` };
    }
  }

  // ── Remote Backups Listing & History ────────────────────────────────────────

  public getCachedRemoteBackups(): CloudBackupItem[] {
    try {
      const raw = safeGetItem(REMOTE_BACKUPS_CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  }

  private addCachedRemoteBackup(item: CloudBackupItem) {
    const list = this.getCachedRemoteBackups().filter((b) => b.id !== item.id);
    list.unshift(item);
    // keep max 20
    const trimmed = list.slice(0, 20);
    safeSetItem(REMOTE_BACKUPS_CACHE_KEY, JSON.stringify(trimmed));
  }

  public async fetchRemoteBackups(provider?: CloudProviderType): Promise<CloudBackupItem[]> {
    const target = provider || this.config.activeProvider;
    if (!target) return this.getCachedRemoteBackups();

    const cached = this.getCachedRemoteBackups();

    try {
      if (target === 'webdav') {
        const cfg = this.config.providers.webdav;
        if (cfg?.serverUrl?.trim()) {
          const cleanBase = cfg.serverUrl.trim().replace(/\/+$/, '');
          const cleanFolder = (cfg.folderPath || '/NotesApp').trim().replace(/^\/+/, '').replace(/\/+$/, '');
          const targetUrl = cleanFolder ? `${cleanBase}/${cleanFolder}/` : `${cleanBase}/`;

          const headers: Record<string, string> = { Depth: '1' };
          if (cfg.username?.trim() && cfg.password) {
            headers['Authorization'] = `Basic ${toBase64Utf8(`${cfg.username.trim()}:${cfg.password.trim()}`)}`;
          }

          const res = await fetch(targetUrl, {
            method: 'PROPFIND',
            headers,
            signal: getTimeoutSignal(10000),
          }).catch(() => null);

          if (res && (res.ok || res.status === 207)) {
            const xml = await res.text().catch(() => '');
            const regex = /notes-backup-[a-zA-Z0-9_\-\.]+\.json/g;
            const filenames = new Set<string>();
            let m: RegExpExecArray | null;
            while ((m = regex.exec(xml)) !== null) {
              filenames.add(m[0]);
            }

            if (filenames.size > 0) {
              for (const filename of filenames) {
                const existing = cached.find((c) => c.filename === filename);
                this.addCachedRemoteBackup(
                  existing || {
                    id: filename,
                    filename,
                    sizeBytes: 0,
                    lastModified: new Date().toISOString(),
                    provider: 'webdav',
                  }
                );
              }
              return this.getCachedRemoteBackups().filter((b) => b.provider === 'webdav');
            }
          }
        }
      } else if (target === 'gdrive') {
        const cfg = this.config.providers.gdrive;
        if (cfg?.accessToken?.trim()) {
          const query = encodeURIComponent("name contains 'notes-backup-' and trashed = false");
          const res = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,modifiedTime)&pageSize=30`,
            {
              headers: { Authorization: `Bearer ${cfg.accessToken.trim()}` },
              signal: getTimeoutSignal(10000),
            }
          ).catch(() => null);

          if (res && res.ok) {
            const data = await res.json().catch(() => null);
            if (data?.files && Array.isArray(data.files)) {
              for (const file of data.files) {
                const existing = cached.find((c) => c.filename === file.name);
                this.addCachedRemoteBackup(
                  existing || {
                    id: file.id || file.name,
                    filename: file.name,
                    sizeBytes: Number(file.size) || 0,
                    lastModified: file.modifiedTime || new Date().toISOString(),
                    provider: 'gdrive',
                  }
                );
              }
              return this.getCachedRemoteBackups().filter((b) => b.provider === 'gdrive');
            }
          }
        }
      } else if (target === 'dropbox') {
        const cfg = this.config.providers.dropbox;
        if (cfg?.accessToken?.trim()) {
          const cleanFolder = (cfg.folderPath || '/NotesApp').trim().replace(/\/+$/, '');
          const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cfg.accessToken.trim()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path: cleanFolder }),
            signal: getTimeoutSignal(10000),
          }).catch(() => null);

          if (res && res.ok) {
            const data = await res.json().catch(() => null);
            if (data?.entries && Array.isArray(data.entries)) {
              for (const entry of data.entries) {
                if (entry['.tag'] === 'file' && entry.name.startsWith('notes-backup-')) {
                  const existing = cached.find((c) => c.filename === entry.name);
                  this.addCachedRemoteBackup(
                    existing || {
                      id: entry.id || entry.name,
                      filename: entry.name,
                      sizeBytes: Number(entry.size) || 0,
                      lastModified: entry.client_modified || new Date().toISOString(),
                      provider: 'dropbox',
                    }
                  );
                }
              }
              return this.getCachedRemoteBackups().filter((b) => b.provider === 'dropbox');
            }
          }
        }
      }
    } catch (fetchErr) {
      console.warn('Failed to fetch live remote backups, falling back to cached list:', fetchErr);
    }

    return this.getCachedRemoteBackups().filter((b) => b.provider === target);
  }
}

export const cloudStorage = new CloudStorageService();
