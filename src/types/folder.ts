export interface Folder {
  id?: number;
  name: string;
  parentId?: number | null;
  sortOrder?: number;
  pinned?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
