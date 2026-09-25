export interface Folder {
  id?: number;
  name: string;
  parentId?: number | null;
  sortOrder?: number;
  createdAt: Date;
  updatedAt: Date;
}
