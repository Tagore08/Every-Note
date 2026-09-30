/**
 * Shared tag normalization and sanitization utilities.
 * Ensures consistent tag formatting across notes, tasks, events, canvases, and snippets.
 */

/**
 * Sanitizes a single tag string:
 * - Trims whitespace and strips leading '#'
 * - Converts to lowercase
 * - Normalizes special characters and spaces to hyphens (preserving alphanumeric, underscores, hyphens, and slashes)
 * - Collapses consecutive hyphens and trims leading/trailing hyphens/slashes
 */
export function sanitizeTag(rawTag: string): string {
  if (!rawTag || typeof rawTag !== 'string') return '';

  let tag = rawTag.trim();
  // Strip all leading #
  tag = tag.replace(/^#+/, '').trim();
  if (!tag) return '';

  tag = tag.toLowerCase();

  // Replace spaces and special characters with hyphens, preserving letters, numbers, underscores, and forward slashes
  tag = tag.replace(/[^a-z0-9_\-\/]/g, '-');

  // Collapse multiple consecutive hyphens
  tag = tag.replace(/-+/g, '-');

  // Trim leading/trailing hyphens and slashes
  tag = tag.replace(/^[-/]+|[-/]+$/g, '');

  return tag;
}

/**
 * Sanitizes an array or collection of tags:
 * - Normalizes each tag using sanitizeTag
 * - Filters out empty strings
 * - Deduplicates tags
 */
export function sanitizeTags(rawTags: unknown): string[] {
  if (!rawTags) return [];

  let tagList: string[] = [];
  if (Array.isArray(rawTags)) {
    tagList = rawTags.map((t) => (typeof t === 'string' ? t : String(t)));
  } else if (typeof rawTags === 'string') {
    tagList = rawTags.split(/[,\s]+/);
  } else {
    return [];
  }

  const seen = new Set<string>();
  const sanitized: string[] = [];

  for (const raw of tagList) {
    const clean = sanitizeTag(raw);
    if (clean && !seen.has(clean)) {
      seen.add(clean);
      sanitized.push(clean);
    }
  }

  return sanitized;
}

/**
 * Checks whether a tag is non-empty and consists only of valid characters.
 */
export function isValidTag(tag: string): boolean {
  if (!tag || typeof tag !== 'string') return false;
  return /^[a-z0-9_\-\/]+$/.test(tag);
}

/**
 * Extracts inline hashtags from markdown or plain text content.
 * Matches #tag, #nested/subtag, #work-2026 while ignoring pure numbers like #123.
 */
export function extractTagsFromText(content: string): string[] {
  if (!content || typeof content !== 'string') return [];

  const tags = new Set<string>();
  const tagRegex = /(?:^|\s)#([a-zA-Z0-9_\-\/]+)(?=\s|$|[.,!?;:()])/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(content)) !== null) {
    const raw = match[1];
    // Exclude purely numeric tags
    if (raw && !/^\d+$/.test(raw)) {
      const clean = sanitizeTag(raw);
      if (clean) {
        tags.add(clean);
      }
    }
  }

  return Array.from(tags);
}
