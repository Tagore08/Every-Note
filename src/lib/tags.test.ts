import { describe, it, expect } from 'vitest';
import { sanitizeTag, sanitizeTags, isValidTag, extractTagsFromText } from './tags';

describe('tags utility', () => {
  describe('sanitizeTag', () => {
    it('strips leading # and trims whitespace', () => {
      expect(sanitizeTag('#work')).toBe('work');
      expect(sanitizeTag('  ###project  ')).toBe('project');
    });

    it('converts to lowercase', () => {
      expect(sanitizeTag('ReactJS')).toBe('reactjs');
      expect(sanitizeTag('#Frontend')).toBe('frontend');
    });

    it('normalizes spaces and special characters to hyphens', () => {
      expect(sanitizeTag('project alpha!')).toBe('project-alpha');
      expect(sanitizeTag('c++')).toBe('c');
      expect(sanitizeTag('next.js')).toBe('next-js');
      expect(sanitizeTag('#hello@world$')).toBe('hello-world');
    });

    it('preserves underscores, hyphens, and slashes for nested tags', () => {
      expect(sanitizeTag('work_items')).toBe('work_items');
      expect(sanitizeTag('area/finance')).toBe('area/finance');
      expect(sanitizeTag('sub-system/v2')).toBe('sub-system/v2');
    });

    it('collapses consecutive hyphens and trims boundary hyphens/slashes', () => {
      expect(sanitizeTag('---tag---')).toBe('tag');
      expect(sanitizeTag('/nested/')).toBe('nested');
      expect(sanitizeTag('foo---bar')).toBe('foo-bar');
    });

    it('returns empty string for invalid inputs', () => {
      expect(sanitizeTag('')).toBe('');
      expect(sanitizeTag('###')).toBe('');
      expect(sanitizeTag('!!!')).toBe('');
      expect(sanitizeTag(null as any)).toBe('');
    });
  });

  describe('sanitizeTags', () => {
    it('sanitizes and deduplicates array of tags', () => {
      const input = ['#WORK', 'work', '  work-item  ', 'Work'];
      expect(sanitizeTags(input)).toEqual(['work', 'work-item']);
    });

    it('filters out empty or invalid tags', () => {
      const input = ['', '   ', '###', 'valid-tag', '!@#'];
      expect(sanitizeTags(input)).toEqual(['valid-tag']);
    });

    it('handles comma-separated string input', () => {
      const input = 'work, #finance, personal, WORK';
      expect(sanitizeTags(input)).toEqual(['work', 'finance', 'personal']);
    });
  });

  describe('isValidTag', () => {
    it('validates tag strings accurately', () => {
      expect(isValidTag('work')).toBe(true);
      expect(isValidTag('work-2026')).toBe(true);
      expect(isValidTag('area/sub')).toBe(true);
      expect(isValidTag('tag_name')).toBe(true);

      expect(isValidTag('')).toBe(false);
      expect(isValidTag('#work')).toBe(false);
      expect(isValidTag('work space')).toBe(false);
      expect(isValidTag('tag!')).toBe(false);
    });
  });

  describe('extractTagsFromText', () => {
    it('extracts hashtags from text', () => {
      const text = 'Meeting about #ProjectAlpha and #deadline-2026 with #team/core.';
      expect(extractTagsFromText(text)).toEqual(['projectalpha', 'deadline-2026', 'team/core']);
    });

    it('ignores pure numeric hashtags', () => {
      const text = 'Issue #123 and #456 fixed in #release-v1.';
      expect(extractTagsFromText(text)).toEqual(['release-v1']);
    });
  });
});
