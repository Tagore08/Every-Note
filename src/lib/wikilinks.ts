/**
 * Wikilink Parsing & Utilities (Phase 2B)
 * Implements EXPANSION_PLAN §4 and §5.3 specs.
 */

export const WIKILINK_RE = /\[\[([^\[\]|#]+)(?:#([^\[\]|]*))?(?:\|([^\[\]]*))?\]\]/g;

export interface ExtractedWikilink {
  rawTitle: string;
  heading?: string;
  alias?: string;
  index: number;
  length: number;
}

/**
 * Normalizes title for case-insensitive and whitespace-tolerant matching.
 * E.g. "  My  Project  " -> "my project"
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Extracts all valid wikilinks from text content.
 * Returns empty array if no links exist or text is empty.
 */
export function extractWikilinks(content: string): ExtractedWikilink[] {
  if (!content) return [];

  const links: ExtractedWikilink[] = [];
  const regex = new RegExp(WIKILINK_RE.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const rawTitle = (match[1] || '').trim();
    // Ignore links that only contain whitespace
    if (!rawTitle) continue;

    const heading = match[2] !== undefined ? match[2].trim() : undefined;
    const alias = match[3] !== undefined ? match[3].trim() : undefined;

    links.push({
      rawTitle,
      heading: heading || undefined,
      alias: alias || undefined,
      index: match.index,
      length: match[0].length,
    });
  }

  return links;
}

/**
 * Extracts ±60 characters around a wikilink match for backlink context snippets.
 */
export function extractContextSnippet(
  content: string,
  index: number,
  length: number,
  radius = 60
): string {
  if (!content) return '';

  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + length + radius);

  let snippet = content.slice(start, end).replace(/[\r\n\t]+/g, ' ');

  if (start > 0) {
    snippet = '…' + snippet;
  }
  if (end < content.length) {
    snippet = snippet + '…';
  }

  return snippet;
}

export interface ContentSegment {
  type: 'text' | 'wikilink';
  text: string;
  rawTitle?: string;
  heading?: string;
  alias?: string;
  displayText?: string;
}

/**
 * Splits content into plain text segments and wikilink segments for rich rendering.
 */
export function parseContentSegments(content: string): ContentSegment[] {
  if (!content) return [{ type: 'text', text: '' }];

  const links = extractWikilinks(content);
  if (links.length === 0) {
    return [{ type: 'text', text: content }];
  }

  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  for (const link of links) {
    if (link.index > lastIndex) {
      segments.push({
        type: 'text',
        text: content.slice(lastIndex, link.index),
      });
    }

    const displayText = link.alias || link.rawTitle;
    segments.push({
      type: 'wikilink',
      text: content.slice(link.index, link.index + link.length),
      rawTitle: link.rawTitle,
      heading: link.heading,
      alias: link.alias,
      displayText,
    });

    lastIndex = link.index + link.length;
  }

  if (lastIndex < content.length) {
    segments.push({
      type: 'text',
      text: content.slice(lastIndex),
    });
  }

  return segments;
}
