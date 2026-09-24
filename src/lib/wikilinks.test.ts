import { describe, it, expect } from 'vitest';
import {
  extractWikilinks,
  normalizeTitle,
  extractContextSnippet,
  parseContentSegments,
} from './wikilinks';

describe('extractWikilinks', () => {
  it('extracts a standard wikilink', () => {
    const text = 'Here is a note about [[Architecture]].';
    const links = extractWikilinks(text);
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      rawTitle: 'Architecture',
      heading: undefined,
      alias: undefined,
      index: 21,
      length: 16,
    });
  });

  it('extracts wikilink with alias', () => {
    const text = 'Refer to [[Project Roadmap|the roadmap]] for milestones.';
    const links = extractWikilinks(text);
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      rawTitle: 'Project Roadmap',
      heading: undefined,
      alias: 'the roadmap',
      index: 9,
      length: 31,
    });
  });

  it('extracts wikilink with heading anchor', () => {
    const text = 'Check out [[System Architecture#Storage Engine]] for details.';
    const links = extractWikilinks(text);
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      rawTitle: 'System Architecture',
      heading: 'Storage Engine',
      alias: undefined,
      index: 10,
      length: 38,
    });
  });

  it('extracts wikilink with both heading and alias', () => {
    const text = 'See [[Database Schema#Version 10|v10 schema]] now.';
    const links = extractWikilinks(text);
    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      rawTitle: 'Database Schema',
      heading: 'Version 10',
      alias: 'v10 schema',
      index: 4,
      length: 41,
    });
  });

  it('extracts multiple wikilinks in a single document', () => {
    const text = `
      # Daily Summary
      Met with [[Alice]] to review [[Q3 Goals#Revenue]].
      Later discussed [[Infrastructure|Cloud Setup]] with [[Bob#Backend]].
    `;
    const links = extractWikilinks(text);
    expect(links).toHaveLength(4);
    expect(links.map((l) => l.rawTitle)).toEqual([
      'Alice',
      'Q3 Goals',
      'Infrastructure',
      'Bob',
    ]);
    expect(links[1].heading).toBe('Revenue');
    expect(links[2].alias).toBe('Cloud Setup');
    expect(links[3].heading).toBe('Backend');
  });

  it('returns empty array when no links are present', () => {
    const text = 'This is ordinary text with [brackets] and (parentheses).';
    expect(extractWikilinks(text)).toEqual([]);
    expect(extractWikilinks('')).toEqual([]);
  });

  it('ignores empty brackets and whitespace-only links', () => {
    const text = 'Invalid: [[]] and [[   ]] should be ignored.';
    expect(extractWikilinks(text)).toEqual([]);
  });

  it('handles nested or malformed brackets gracefully', () => {
    // [[Outer [[Inner]]]]
    const text = 'Nested [[Outer [[Inner]]]] note';
    const links = extractWikilinks(text);
    // Because regex matches [^\[\]|#]+, it captures the inner [[Inner]]
    expect(links).toHaveLength(1);
    expect(links[0].rawTitle).toBe('Inner');
  });
});

describe('normalizeTitle', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalizeTitle('  Project   Roadmap  ')).toBe('project roadmap');
    expect(normalizeTitle('JOURNAL — 2026-09-24')).toBe('journal — 2026-09-24');
    expect(normalizeTitle('')).toBe('');
    expect(normalizeTitle('Alpha \n\t Beta')).toBe('alpha beta');
  });
});

describe('extractContextSnippet', () => {
  it('extracts surrounding context within ±60 chars and normalizes newlines', () => {
    const text = 'First line.\nThis is a rather long context block where [[Target Note]] is referenced in the middle of a sentence.\nEnd line.';
    const index = text.indexOf('[[Target Note]]');
    const length = '[[Target Note]]'.length;

    const snippet = extractContextSnippet(text, index, length, 30);
    expect(snippet).toContain('[[Target Note]]');
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet.endsWith('…')).toBe(true);
    expect(snippet).not.toContain('\n');
  });

  it('does not add ellipsis when match is at edges', () => {
    const text = '[[Start Link]] at the beginning';
    const snippet = extractContextSnippet(text, 0, 14, 20);
    expect(snippet.startsWith('…')).toBe(false);
  });
});

describe('parseContentSegments', () => {
  it('parses text into alternating plain text and wikilink segments', () => {
    const text = 'Hello [[World]]! Visit [[Next Note|Next]] soon.';
    const segments = parseContentSegments(text);

    expect(segments).toEqual([
      { type: 'text', text: 'Hello ' },
      {
        type: 'wikilink',
        text: '[[World]]',
        rawTitle: 'World',
        heading: undefined,
        alias: undefined,
        displayText: 'World',
      },
      { type: 'text', text: '! Visit ' },
      {
        type: 'wikilink',
        text: '[[Next Note|Next]]',
        rawTitle: 'Next Note',
        heading: undefined,
        alias: 'Next',
        displayText: 'Next',
      },
      { type: 'text', text: ' soon.' },
    ]);
  });
});
