export interface Snippet {
  id?: number;
  trigger: string; // e.g. '#addr', '#sig', '#email'
  expansion: string; // Full text to expand into
  description?: string; // Optional label/hint
  tags?: string[]; // Optional tag categories e.g. ['work', 'email']
  createdAt: Date;
  updatedAt: Date;
}
