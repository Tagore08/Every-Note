export interface Person {
  id?: number;
  name: string;
  photoBlob?: Blob | null;
  contactInfo?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  trashedAt?: Date | null;
}
