import type { BackupEnvelope } from '../../db/exportService';

export type CloudProviderType =
  | 'webdav'
  | 'gdrive'
  | 'dropbox'
  | 'onedrive'
  | 's3'
  | 'filesystem';

export interface WebDavConfig {
  serverUrl: string; // e.g. https://cloud.example.com/remote.php/dav/files/user/
  username: string;
  password?: string;
  folderPath?: string; // e.g. /NotesApp/
}

export interface GoogleDriveConfig {
  accessToken?: string;
  folderName?: string; // default "NotesAppBackups"
}

export interface DropboxConfig {
  accessToken?: string;
  folderPath?: string; // default "/NotesApp"
}

export interface OneDriveConfig {
  accessToken?: string;
  folderPath?: string; // default "/NotesApp"
}

export interface S3Config {
  endpoint: string; // e.g. https://<accountid>.r2.cloudflarestorage.com or s3.amazonaws.com
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathPrefix?: string;
}

export interface FileSystemConfig {
  folderName?: string;
}

export interface CloudStorageConfig {
  activeProvider: CloudProviderType | null;
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number; // e.g. 24
  lastBackupAt?: string;
  lastBackupFilename?: string;
  lastBackupSize?: number;
  lastError?: string;
  providers: {
    webdav?: WebDavConfig;
    gdrive?: GoogleDriveConfig;
    dropbox?: DropboxConfig;
    onedrive?: OneDriveConfig;
    s3?: S3Config;
    filesystem?: FileSystemConfig;
  };
}

export interface CloudBackupItem {
  id: string;
  filename: string;
  sizeBytes?: number;
  lastModified?: string;
  provider: CloudProviderType;
  metadata?: {
    version?: number;
    notesCount?: number;
    attachmentsCount?: number;
    snippetsCount?: number;
    stickyNotesCount?: number;
  };
}

export interface CloudOperationResult {
  success: boolean;
  message: string;
  filename?: string;
  sizeBytes?: number;
  data?: BackupEnvelope;
}
