/**
 * Utility functions for text formatting, relative timestamps, snippet extraction, and file sizes.
 */

export function formatRelativeTime(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 5) return 'just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'yesterday';
  if (diffInDays < 7) return `${diffInDays}d ago`;

  // Format as short date (e.g. "Oct 12" or "Oct 12, 2025")
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  };
  return date.toLocaleDateString(undefined, options);
}

/**
 * Returns a clean display title:
 * If title is present and non-empty, returns it.
 * Otherwise, derives a title from the first non-empty line of content truncated to 60 characters.
 * Defaults to "Untitled Note" if neither exists.
 */
export function getDisplayTitle(note: { title?: string; content?: string }): string {
  if (note.title && note.title.trim().length > 0) {
    return note.title.trim();
  }

  if (note.content && note.content.trim().length > 0) {
    const firstLine = note.content.trim().split('\n')[0].trim();
    if (firstLine.length > 60) {
      return firstLine.slice(0, 57) + '...';
    }
    return firstLine;
  }

  return 'Untitled Note';
}

/**
 * Extracts a 2-line snippet from note content.
 */
export function getContentSnippet(content: string, maxLines = 2, maxChars = 140): string {
  if (!content) return '';
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  const snippet = lines.slice(0, maxLines).join(' ');
  if (snippet.length > maxChars) {
    return snippet.slice(0, maxChars - 3) + '...';
  }
  return snippet;
}

/**
 * Extracts a snippet centered around the query match.
 */
export function getSearchSnippet(content: string, query: string, snippetLength = 120): string {
  if (!content || !query) return getContentSnippet(content);

  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerContent.indexOf(lowerQuery);

  if (matchIndex === -1) {
    return getContentSnippet(content);
  }

  const start = Math.max(0, matchIndex - Math.floor(snippetLength / 3));
  const end = Math.min(content.length, start + snippetLength);

  let snippet = content.slice(start, end).replace(/\n+/g, ' ');
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  return snippet;
}

/**
 * Formats a file size in bytes to a human-readable string (B, KB, MB, GB).
 */
export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const formatted = (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1);
  return `${formatted} ${units[i] || 'GB'}`;
}
