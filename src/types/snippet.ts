export interface Snippet {
  id?: number;
  trigger: string; // e.g. '#addr', '#sig', '#email'
  expansion: string; // Full text to expand into
  description?: string; // Optional label/hint
  createdAt: Date;
  updatedAt: Date;
}
