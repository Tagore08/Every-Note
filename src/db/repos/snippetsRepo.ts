import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database';
import type { Snippet } from '../../types/snippet';

export const DEFAULT_SNIPPETS: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    trigger: '#addr',
    expansion: '123 Main Street, Suite 400',
    description: 'Home / Office Address',
  },
  {
    trigger: '#sig',
    expansion: 'Best regards,\nSent from my second brain',
    description: 'Email / Message Signature',
  },
  {
    trigger: '#email',
    expansion: 'hello@example.com',
    description: 'Primary Email Address',
  },
  {
    trigger: '#phone',
    expansion: '+1 (555) 019-2834',
    description: 'Phone Number',
  },
  {
    trigger: '#meet',
    expansion: 'https://meet.google.com/abc-defg-hij',
    description: 'Meeting Link',
  },
];

export const snippetsRepo = {
  /**
   * Seed default snippets if empty.
   */
  async seedDefaults(): Promise<void> {
    try {
      const count = await db.snippets.count();
      if (count > 0) return;

      const now = new Date();
      for (const item of DEFAULT_SNIPPETS) {
        await db.snippets.add({
          ...item,
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch (e) {
      console.warn('Failed to seed default snippets:', e);
    }
  },

  async getAll(): Promise<Snippet[]> {
    return await db.snippets.toArray();
  },

  async create(draft: { trigger: string; expansion: string; description?: string }): Promise<Snippet> {
    const now = new Date();
    let trigger = draft.trigger.trim();
    if (!trigger.startsWith('#')) {
      trigger = `#${trigger}`;
    }

    const item: Snippet = {
      trigger,
      expansion: draft.expansion,
      description: draft.description?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const id = await db.snippets.add(item);
    return { ...item, id: Number(id) };
  },

  async update(id: number, changes: Partial<Omit<Snippet, 'id' | 'createdAt'>>): Promise<void> {
    const updatePayload: any = {
      ...changes,
      updatedAt: new Date(),
    };
    if (changes.trigger) {
      let trigger = changes.trigger.trim();
      if (!trigger.startsWith('#')) {
        trigger = `#${trigger}`;
      }
      updatePayload.trigger = trigger;
    }
    await db.snippets.update(id, updatePayload);
  },

  async delete(id: number): Promise<void> {
    await db.snippets.delete(id);
  },

  /**
   * Look up snippet by exact trigger string.
   */
  async getByTrigger(trigger: string): Promise<Snippet | undefined> {
    return await db.snippets.where('trigger').equals(trigger).first();
  },
};

export function useSnippets(): Snippet[] {
  const list = useLiveQuery(async () => {
    return await db.snippets.toArray();
  }, []);
  return list ?? [];
}
