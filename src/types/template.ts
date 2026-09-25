export type TemplateKind = 'task' | 'note' | 'journal' | 'routine';

export interface TemplateBody {
  title?: string;
  content?: string;
  subtasks?: string[];
  priority?: string;
  dueOffsetDays?: number;
  prompts?: string[];
  items?: any[];
  tags?: string[];
}

export interface Template {
  id?: number;
  kind: TemplateKind;
  name: string;
  body: TemplateBody;
  usageCount: number;
  createdAt: number;
}
