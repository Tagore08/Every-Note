export interface Note {
  id?: number;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  trashedAt: Date | null;
  inbox: boolean;
  scheduledAt?: Date | null;
  reminderAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

