import { describe, it, expect } from 'vitest';

describe('Text Expansion Snippets', () => {
  // Test snippet matching logic
  function matchSnippetTrigger(textBeforeCursor: string) {
    const match = textBeforeCursor.match(/(#\w*)$/);
    if (!match) return null;
    return {
      query: match[1].toLowerCase(),
      startIndex: textBeforeCursor.length - match[1].length,
      endIndex: textBeforeCursor.length,
    };
  }

  function expandSnippet(
    fullText: string,
    startIndex: number,
    endIndex: number,
    expansion: string
  ): string {
    const before = fullText.slice(0, startIndex);
    const after = fullText.slice(endIndex);
    return `${before}${expansion}${after}`;
  }

  it('detects snippet triggers starting with #', () => {
    const info = matchSnippetTrigger('Send to my #addr');
    expect(info).not.toBeNull();
    expect(info?.query).toBe('#addr');
    expect(info?.startIndex).toBe(11);
    expect(info?.endIndex).toBe(16);
  });

  it('expands snippet at cursor boundary accurately', () => {
    const fullText = 'Send to my #addr right away';
    // cursor was right after #addr (position 16)
    const expanded = expandSnippet(fullText, 11, 16, '123 Main Street, Suite 400');
    expect(expanded).toBe('Send to my 123 Main Street, Suite 400 right away');
  });

  it('handles empty query after hash', () => {
    const info = matchSnippetTrigger('Testing #');
    expect(info).not.toBeNull();
    expect(info?.query).toBe('#');
  });

  it('does not trigger on plain words without hash', () => {
    const info = matchSnippetTrigger('Testing addr');
    expect(info).toBeNull();
  });

  it('handles multi-line snippet expansions cleanly', () => {
    const sig = 'Best regards,\nAlex Vance\nLead Architect';
    const text = 'Thanks for your time.\n\n#sig';
    const info = matchSnippetTrigger(text);
    expect(info).not.toBeNull();
    if (info) {
      const result = expandSnippet(text, info.startIndex, info.endIndex, sig);
      expect(result).toBe('Thanks for your time.\n\nBest regards,\nAlex Vance\nLead Architect');
    }
  });

  it('matches default seeded snippets correctly', () => {
    const defaultTriggers = ['#addr', '#sig', '#email', '#phone', '#meet'];
    const testQuery = '#em';
    const matches = defaultTriggers.filter((t) => t.startsWith(testQuery));
    expect(matches).toEqual(['#email']);
  });
});
