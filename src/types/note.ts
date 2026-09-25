export type NoteKind = 'note' | 'journal';
export type JournalMood = 1 | 2 | 3 | 4 | 5;

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
  personId?: number | null;
  kind?: NoteKind;
  journalDate?: string | null; // 'YYYY-MM-DD' in local timezone
  mood?: JournalMood | null;
  createdAt: Date;
  updatedAt: Date;
}

