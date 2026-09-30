import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../../db/database';
import { snippetsRepo } from '../../db/repos/snippetsRepo';

describe('Text Expansion Snippets Repository & Mechanics Integration', () => {
  beforeEach(async () => {
    await db.snippets.clear();
  });

  it('normalizes trigger with leading hash and sanitizes tags on creation', async () => {
    // 1. Without leading hash
    const created1 = await snippetsRepo.create({
      trigger: 'addr',
      expansion: '123 Main St, Suite 400',
      description: 'Office address',
      tags: ['#WORK', 'contact-info'],
    });

    expect(created1.id).toBeDefined();
    expect(created1.trigger).toBe('#addr');
    expect(created1.tags).toEqual(['work', 'contact-info']);

    // 2. With leading hash already
    const created2 = await snippetsRepo.create({
      trigger: '#sig',
      expansion: 'Kind regards,\nAlex Vance',
      description: 'Signature',
    });

    expect(created2.trigger).toBe('#sig');
    expect(created2.tags).toEqual([]);
  });

  it('retrieves all snippets and allows updating expansion and trigger', async () => {
    const snippet = await snippetsRepo.create({
      trigger: 'tel',
      expansion: '+1-555-0199',
    });

    await snippetsRepo.update(snippet.id!, {
      trigger: 'phone',
      expansion: '+1-555-0100',
      tags: ['urgent'],
    });

    const byTrigger = await snippetsRepo.getByTrigger('#phone');
    expect(byTrigger).toBeDefined();
    expect(byTrigger?.expansion).toBe('+1-555-0100');
    expect(byTrigger?.tags).toEqual(['urgent']);

    const byId = await db.snippets.get(snippet.id!);
    expect(byId).toBeDefined();
    expect(byId?.trigger).toBe('#phone');
  });

  it('deletes snippets and purges legacy demo shortcuts cleanly', async () => {
    const s1 = await snippetsRepo.create({ trigger: '#addr', expansion: '123 Main Street' });
    const s2 = await snippetsRepo.create({ trigger: '#custom', expansion: 'My custom expansion' });

    let all = await snippetsRepo.getAll();
    expect(all).toHaveLength(2);

    await snippetsRepo.delete(s2.id!);
    all = await snippetsRepo.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(s1.id);

    // Test demo shortcut purge
    await snippetsRepo.purgeDemoShortcuts();
    all = await snippetsRepo.getAll();
    expect(all).toHaveLength(0);
  });

  it('performs snippet expansion string replacement accurately', async () => {
    const snippet = await snippetsRepo.create({
      trigger: '#sig',
      expansion: 'Best regards,\nEngineering Team',
    });

    const fullText = 'Thank you for your response.\n\n#sig';
    const match = fullText.match(/(#\w*)$/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(snippet.trigger);

    const startIndex = fullText.length - match![1].length;
    const expanded = fullText.slice(0, startIndex) + snippet.expansion;

    expect(expanded).toBe('Thank you for your response.\n\nBest regards,\nEngineering Team');
  });
});
