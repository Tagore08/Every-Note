import { describe, it, expect, beforeEach } from 'vitest';
import { CloudStorageService } from './cloudStorageService';

describe('CloudStorageService', () => {
  let service: CloudStorageService;
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    const mockLocalStorage = {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStore[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    };
    (globalThis as any).localStorage = mockLocalStorage;
    if (typeof window !== 'undefined') {
      (window as any).localStorage = mockLocalStorage;
    }
    service = new CloudStorageService();
  });

  it('initializes with default settings', () => {
    const config = service.getConfig();
    expect(config.activeProvider).toBeNull();
    expect(config.autoBackupEnabled).toBe(false);
    expect(config.providers.webdav).toBeDefined();
    expect(config.providers.gdrive).toBeDefined();
    expect(config.providers.dropbox).toBeDefined();
  });

  it('updates provider config and sets active provider', () => {
    service.updateProviderConfig('webdav', {
      serverUrl: 'https://cloud.example.com/remote.php/dav/files/demo/',
      username: 'alice',
      password: 'secretpassword',
      folderPath: '/Notes',
    });

    service.setActiveProvider('webdav');

    const config = service.getConfig();
    expect(config.activeProvider).toBe('webdav');
    expect(config.providers.webdav?.serverUrl).toBe('https://cloud.example.com/remote.php/dav/files/demo/');
    expect(config.providers.webdav?.username).toBe('alice');
    expect(config.providers.webdav?.folderPath).toBe('/Notes');
  });

  it('tests WebDAV connection validation without URL', async () => {
    const res = await service.testConnection('webdav');
    expect(res.success).toBe(false);
    expect(res.message).toContain('WebDAV server URL is required');
  });

  it('tests Google Drive validation without access token', async () => {
    const res = await service.testConnection('gdrive');
    expect(res.success).toBe(false);
    expect(res.message).toContain('OAuth token is required');
  });

  it('tests S3 validation with missing credentials', async () => {
    const res = await service.testConnection('s3');
    expect(res.success).toBe(false);
    expect(res.message).toContain('required');
  });

  it('rejects backupToCloud when no provider is active', async () => {
    const res = await service.backupToCloud();
    expect(res.success).toBe(false);
    expect(res.message).toContain('No cloud storage service selected');
  });

  it('sanitizes and trims provider configuration fields', () => {
    service.updateProviderConfig('webdav', {
      serverUrl: '   https://webdav.example.com   ',
      username: '  user123  ',
      password: '  pass!  ',
      folderPath: '  /Backups/  ',
    });

    const cfg = service.getConfig().providers.webdav;
    expect(cfg?.serverUrl).toBe('https://webdav.example.com');
    expect(cfg?.username).toBe('user123');
    expect(cfg?.password).toBe('pass!');
    expect(cfg?.folderPath).toBe('/Backups/');
  });

  it('clears credentials for a single provider or all providers', () => {
    service.updateProviderConfig('dropbox', {
      accessToken: 'dbx_secret_token_123',
      folderPath: '/MyNotes',
    });
    service.setActiveProvider('dropbox');

    expect(service.getConfig().providers.dropbox?.accessToken).toBe('dbx_secret_token_123');
    expect(service.getConfig().activeProvider).toBe('dropbox');

    service.clearCredentials('dropbox');
    expect(service.getConfig().providers.dropbox?.accessToken).toBeUndefined();

    // Clear all
    service.clearCredentials();
    expect(service.getConfig().activeProvider).toBeNull();
  });

  it('fetches remote backups and falls back to cache safely', async () => {
    service.setActiveProvider('webdav');
    const backups = await service.fetchRemoteBackups('webdav');
    expect(Array.isArray(backups)).toBe(true);
    expect(backups).toEqual([]);
  });
});
