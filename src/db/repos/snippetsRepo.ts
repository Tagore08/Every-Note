import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database';
import { sanitizeTags } from '../../lib/tags';
import type { Snippet } from '../../types/snippet';

export const DEFAULT_SNIPPETS: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>[] = [];

export const snippetsRepo = {
  /**
   * Seed default snippets if empty and purge legacy demo shortcuts.
   */
  async seedDefaults(): Promise<void> {
    try {
      await this.purgeDemoShortcuts();
    } catch (e) {
      console.warn('Failed to clean demo shortcuts:', e);
    }
  },

  /**
   * Purge legacy demo shortcuts (#addr 123 Main Street, etc.)
   */
  async purgeDemoShortcuts(): Promise<void> {
    try {
      const all = await db.snippets.toArray();
      const demoTriggers = ['#addr', '#sig', '#meet'];
      for (const s of all) {
        if (
          demoTriggers.includes(s.trigger) ||
          s.expansion.includes('123 Main Street') ||
          s.expansion.includes('Sent from my second brain') ||
          s.expansion.includes('meet.google.com/abc-defg-hij') ||
          (s.trigger === '#email' && s.expansion === 'hello@example.com') ||
          (s.trigger === '#phone' && s.expansion === '+1 (555) 019-2834')
        ) {
          if (s.id) await db.snippets.delete(s.id);
        }
      }
    } catch (e) {
      console.warn('Failed to purge demo shortcuts:', e);
    }
  },

  async clearAll(): Promise<void> {
    await db.snippets.clear();
  },

  async getAll(): Promise<Snippet[]> {
    return await db.snippets.toArray();
  },

  async create(draft: { trigger: string; expansion: string; description?: string; tags?: string[] }): Promise<Snippet> {
    const now = new Date();
    let trigger = draft.trigger.trim();
    if (!trigger.startsWith('#')) {
      trigger = `#${trigger}`;
    }

    const item: Snippet = {
      trigger,
      expansion: draft.expansion,
      description: draft.description?.trim() || undefined,
      tags: sanitizeTags(draft.tags),
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
    if (changes.tags !== undefined) {
      updatePayload.tags = sanitizeTags(changes.tags);
    }
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

  async getAllForExport(): Promise<Snippet[]> {
    return await db.snippets.toArray();
  },

  async importSnippets(snippets: Snippet[], strategy: 'merge' | 'replace' = 'merge'): Promise<number> {
    if (strategy === 'replace') {
      await db.snippets.clear();
    }
    if (snippets.length === 0) return 0;
    const sanitized = snippets.map((s) => ({
      ...s,
      tags: sanitizeTags(s.tags),
      createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
      updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
    }));
    await db.snippets.bulkPut(sanitized);
    return sanitized.length;
  },
};

export function useSnippets(): Snippet[] {
  const list = useLiveQuery(async () => {
    return await db.snippets.toArray();
  }, []);
  return list ?? [];
}
