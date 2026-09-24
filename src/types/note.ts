export interface Note {
  id?: number;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  trashedAt: Date | null;
  inbox: boolean;
  createdAt: Date;
  updatedAt: Date;
}
