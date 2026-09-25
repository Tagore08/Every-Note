import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../database';
import type { Template, TemplateKind } from '../../types/template';

export const DEFAULT_TEMPLATES: Omit<Template, 'id' | 'createdAt' | 'usageCount'>[] = [
  {
    kind: 'task',
    name: 'Weekly Review',
    body: {
      title: 'Weekly Review',
      priority: 'medium',
      subtasks: [
        'Review inbox & calendar',
        'Clear desktop & downloads',
        'Review active goals & projects',
        'Plan priority tasks for next week',
      ],
    },
  },
  {
    kind: 'task',
    name: 'Morning Startup Routine',
    body: {
      title: 'Morning Startup',
      priority: 'high',
      subtasks: [
        'Check calendar for today',
        'Process urgent inbox items',
        'Pick top 3 priorities for today',
      ],
    },
  },
  {
    kind: 'note',
    name: 'Meeting Notes',
    body: {
      title: 'Meeting: ',
      content: `## Attendees\n- \n\n## Agenda\n- \n\n## Discussion Notes\n\n\n## Action Items\n- [ ] `,
    },
  },
  {
    kind: 'note',
    name: 'Project Kickoff',
    body: {
      title: 'Project Kickoff: ',
      content: `## Objectives\n\n## Key Stakeholders\n\n## Milestones & Timeline\n\n## Next Steps\n- [ ] `,
    },
  },
  {
    kind: 'journal',
    name: 'Daily Reflection',
    body: {
      title: 'Daily Reflection',
      prompts: [
        'What went well today?',
        'What drained my energy?',
        'Tomorrow I will focus on…',
      ],
    },
  },
  {
    kind: 'routine',
    name: 'Morning Launch Routine',
    body: {
      title: 'Morning Launch',
      items: [
        { uid: 'seed-step-1', kind: 'custom', title: 'Drink glass of water', durationMin: 2 },
        { uid: 'seed-step-2', kind: 'custom', title: 'Stretch or light mobility', durationMin: 10 },
        { uid: 'seed-step-3', kind: 'journal', title: "Write today's journal entry", durationMin: 10 },
        { uid: 'seed-step-4', kind: 'custom', title: 'Plan top 3 daily priorities', durationMin: 5 },
      ],
    },
  },
];

export const templatesRepo = {
  /**
   * Seed default templates if templates table is empty. Idempotent.
   */
  async seedDefaults(): Promise<void> {
    const count = await db.templates.count();
    const now = Date.now();
    if (count === 0) {
      await db.templates.bulkAdd(
        DEFAULT_TEMPLATES.map((tmpl) => ({
          ...tmpl,
          usageCount: 0,
          createdAt: now,
        }))
      );
    } else {
      // Ensure journal template exists even if tasks/notes templates were previously seeded
      const journalCount = await db.templates.filter((t) => t.kind === 'journal').count();
      if (journalCount === 0) {
        await db.templates.add({
          kind: 'journal',
          name: 'Daily Reflection',
          body: {
            title: 'Daily Reflection',
            prompts: [
              'What went well today?',
              'What drained my energy?',
              'Tomorrow I will focus on…',
            ],
          },
          usageCount: 0,
          createdAt: now,
        });
      }

      // Ensure routine template exists
      const routineCount = await db.templates.filter((t) => t.kind === 'routine').count();
      if (routineCount === 0) {
        await db.templates.add({
          kind: 'routine',
          name: 'Morning Launch Routine',
          body: {
            title: 'Morning Launch',
            items: [
              { uid: 'seed-step-1', kind: 'custom', title: 'Drink glass of water', durationMin: 2 },
              { uid: 'seed-step-2', kind: 'custom', title: 'Stretch or light mobility', durationMin: 10 },
              { uid: 'seed-step-3', kind: 'journal', title: "Write today's journal entry", durationMin: 10 },
              { uid: 'seed-step-4', kind: 'custom', title: 'Plan top 3 daily priorities', durationMin: 5 },
            ],
          },
          usageCount: 0,
          createdAt: now,
        });
      }
    }
  },

  /**
   * Retrieves all templates sorted by usageCount desc, then createdAt desc.
   */
  async getAllTemplates(): Promise<Template[]> {
    const templates = await db.templates.toArray();
    return templates.sort((a, b) => b.usageCount - a.usageCount || b.createdAt - a.createdAt);
  },

  /**
   * Retrieves templates filtered by kind.
   */
  async getTemplatesByKind(kind: TemplateKind): Promise<Template[]> {
    const templates = await db.templates
      .where('kind')
      .equals(kind)
      .toArray();
    return templates.sort((a, b) => b.usageCount - a.usageCount || b.createdAt - a.createdAt);
  },

  /**
   * Retrieves a single template by ID.
   */
  async getTemplateById(id: number): Promise<Template | undefined> {
    return await db.templates.get(id);
  },

  /**
   * Creates a new template.
   */
  async createTemplate(draft: Omit<Template, 'id' | 'createdAt' | 'usageCount'>): Promise<Template> {
    const newTmpl: Template = {
      kind: draft.kind,
      name: draft.name.trim() || 'Untitled Template',
      body: draft.body || {},
      usageCount: 0,
      createdAt: Date.now(),
    };
    const id = await db.templates.add(newTmpl);
    return { ...newTmpl, id: id as number };
  },

  /**
   * Updates an existing template.
   */
  async updateTemplate(id: number, changes: Partial<Omit<Template, 'id' | 'createdAt'>>): Promise<void> {
    await db.templates.update(id, changes);
  },

  /**
   * Deletes a template.
   */
  async deleteTemplate(id: number): Promise<void> {
    await db.templates.delete(id);
  },

  /**
   * Increments the usage count of a template.
   */
  async incrementUsageCount(id: number): Promise<void> {
    const template = await db.templates.get(id);
    if (template) {
      await db.templates.update(id, { usageCount: (template.usageCount || 0) + 1 });
    }
  },

  /**
   * Export all templates.
   */
  async getAllTemplatesForExport(): Promise<Template[]> {
    return await db.templates.toArray();
  },

  /**
   * Import templates supporting merge or replace.
   */
  async importTemplates(
    rawTemplates: Partial<Template>[],
    strategy: 'merge' | 'replace'
  ): Promise<number> {
    const sanitized: Template[] = rawTemplates.map((raw) => ({
      id: typeof raw.id === 'number' ? raw.id : undefined,
      kind: (raw.kind as TemplateKind) || 'task',
      name: typeof raw.name === 'string' ? raw.name : 'Untitled Template',
      body: raw.body || {},
      usageCount: typeof raw.usageCount === 'number' ? raw.usageCount : 0,
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    }));

    if (strategy === 'replace') {
      await db.templates.clear();
      if (sanitized.length > 0) {
        await db.templates.bulkAdd(sanitized);
      }
      return sanitized.length;
    }

    let imported = 0;
    for (const t of sanitized) {
      if (typeof t.id === 'number') {
        const existing = await db.templates.get(t.id);
        if (existing) {
          await db.templates.put(t);
        } else {
          await db.templates.put(t);
        }
      } else {
        await db.templates.add(t);
      }
      imported++;
    }
    return imported;
  },
};

/**
 * Reactive hooks
 */
export function useTemplates(kind?: TemplateKind): Template[] {
  const templates = useLiveQuery(() => {
    if (kind) {
      return templatesRepo.getTemplatesByKind(kind);
    }
    return templatesRepo.getAllTemplates();
  }, [kind]);
  return templates ?? [];
}

export function useTemplate(id: number | null | undefined): Template | null {
  const template = useLiveQuery(async () => {
    if (typeof id !== 'number' || isNaN(id)) return null;
    return (await templatesRepo.getTemplateById(id)) ?? null;
  }, [id]);
  return template ?? null;
}
