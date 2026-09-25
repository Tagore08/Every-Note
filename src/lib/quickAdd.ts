import * as chrono from 'chrono-node';
import type { TaskPriority } from '../types/task';

export interface QuickAddResult {
  title: string;
  dueAt?: Date;
  tags: string[];
  priority?: TaskPriority;
  rawMatchedDateText?: string;
  previewLabel?: string;
}

const TEMPORAL_KEYWORDS = /\b(today|tomorrow|tonight|yesterday|morning|afternoon|evening|night|noon|midnight|now|later|soon|next|this|in|at|every|daily|weekly|monthly|mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday|jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|september|oct|october|nov|november|dec|december|am|pm|days?|weeks?|months?|years?|hours?|hrs?|mins?|minutes?)\b/i;

/**
 * Natural language quick-add parser using chrono-node.
 * - Extracts `#tag` tokens -> tags array
 * - Extracts priority tokens (p1-p4, !1-!4, priority:1-4) -> priority
 * - Extracts natural date/time -> dueAt (strips matched text from title)
 * - Guards against false positives on plain numbers (e.g. "meeting with 3 people", "buy 2 apples")
 * 
 * Returns { title, dueAt?, tags[], priority?, rawMatchedDateText?, previewLabel? }
 */
export function parseQuickAdd(
  input: string,
  referenceDate: Date = new Date()
): QuickAddResult {
  if (!input || !input.trim()) {
    return {
      title: '',
      tags: [],
    };
  }

  let text = input;
  const tags: string[] = [];
  let priority: TaskPriority | undefined = undefined;

  // 1. Extract Priority tokens (e.g. 'p1', 'p2', 'p3', 'p4', '!1', '!2', '!3', '!4', 'priority 1')
  // We match isolated tokens so words like 'apple' or 'plan' are not affected.
  text = text.replace(/(?:^|\s)(?:p|priority)[:\s]*([1-4])\b/i, (_, num) => {
    priority = `p${num}` as TaskPriority;
    return ' ';
  });
  if (!priority) {
    text = text.replace(/(?:^|\s)!([1-4])\b/, (_, num) => {
      priority = `p${num}` as TaskPriority;
      return ' ';
    });
  }
  if (!priority) {
    text = text.replace(/(?:^|\s)\b(p[1-4])\b/i, (_, pToken) => {
      priority = pToken.toLowerCase() as TaskPriority;
      return ' ';
    });
  }

  // 2. Extract #tag tokens (alphanumeric, underscores, hyphens)
  // Replaces matched tag with a space so words don't collide
  text = text.replace(/(?:^|\s)#([a-zA-Z0-9_\-]+)/g, (match, tag) => {
    // Avoid stripping pure numbers like '#1' or issue references unless desired
    if (/^\d+$/.test(tag)) {
      return match;
    }
    const cleanTag = tag.trim();
    if (cleanTag && !tags.includes(cleanTag)) {
      tags.push(cleanTag);
    }
    return ' ';
  });

  // 3. Extract natural date/time with chrono-node
  let dueAt: Date | undefined = undefined;
  let rawMatchedDateText: string | undefined = undefined;

  const chronoResults = chrono.parse(text, referenceDate, { forwardDate: true });
  if (chronoResults && chronoResults.length > 0) {
    const candidate = chronoResults[0];
    const matchText = candidate.text.trim();

    // Guard: ignore bare numbers and require temporal words or time/date symbols
    const isBareNumber = /^\d+$/.test(matchText);
    const hasTemporalWord = TEMPORAL_KEYWORDS.test(matchText);
    const hasTimePattern = /\d{1,2}:\d{2}/.test(matchText) || /\d{1,2}[/-]\d{1,2}/.test(matchText);

    if (!isBareNumber && (hasTemporalWord || hasTimePattern)) {
      dueAt = candidate.date();
      rawMatchedDateText = matchText;
      // Strip date text from title
      text = text.slice(0, candidate.index) + ' ' + text.slice(candidate.index + candidate.text.length);
    }
  }

  // 4. Clean up whitespace
  const title = text.replace(/\s+/g, ' ').trim();

  // 5. Build human-readable preview label
  const previewParts: string[] = [];
  if (dueAt && rawMatchedDateText) {
    previewParts.push(`📅 ${rawMatchedDateText}`);
  }
  if (tags.length > 0) {
    previewParts.push(tags.map((t) => `#${t}`).join(' '));
  }
  if (priority && priority !== 'none' && priority !== 'p4') {
    previewParts.push(`🚩 ${String(priority).toUpperCase()}`);
  }
  const previewLabel = previewParts.length > 0 ? previewParts.join(' · ') : undefined;

  return {
    title,
    dueAt,
    tags,
    priority,
    rawMatchedDateText,
    previewLabel,
  };
}
