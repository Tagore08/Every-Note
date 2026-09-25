import { useMemo, useCallback } from 'react';
import { useSnippets } from '../../db/repos/snippetsRepo';
import type { Snippet } from '../../types/snippet';

export interface UseSnippetAutocompleteProps {
  value: string;
  onChange: (newValue: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
}

export function useSnippetAutocomplete({
  value,
  onChange,
  inputRef,
}: UseSnippetAutocompleteProps) {
  const snippets = useSnippets();

  // Detect word starting with '#' right before cursor or at end of string
  const matchInfo = useMemo(() => {
    if (!value) return null;

    let textBeforeCursor = value;
    let cursorPos = value.length;

    if (inputRef?.current) {
      cursorPos = inputRef.current.selectionStart ?? value.length;
      textBeforeCursor = value.slice(0, cursorPos);
    }

    const match = textBeforeCursor.match(/(#\w*)$/);
    if (!match) return null;

    const query = match[1].toLowerCase();
    const startIndex = cursorPos - query.length;
    const endIndex = cursorPos;

    const matches = snippets.filter((s) =>
      s.trigger.toLowerCase().startsWith(query)
    );

    return {
      query,
      startIndex,
      endIndex,
      matches,
    };
  }, [value, snippets, inputRef]);

  const matchingSnippets = matchInfo?.matches || [];
  const hasMatches = matchingSnippets.length > 0 && Boolean(matchInfo?.query && matchInfo.query.length >= 2);

  const applySnippet = useCallback(
    (snippet: Snippet) => {
      if (!matchInfo) return;

      const before = value.slice(0, matchInfo.startIndex);
      const after = value.slice(matchInfo.endIndex);
      const nextValue = `${before}${snippet.expansion}${after}`;

      onChange(nextValue);

      // Restore focus and position cursor right after expanded text
      requestAnimationFrame(() => {
        if (inputRef?.current) {
          inputRef.current.focus();
          const newPos = before.length + snippet.expansion.length;
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      });
    },
    [value, matchInfo, onChange, inputRef]
  );

  // Handle keydown for Tab / Enter completion if suggestion is active
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!hasMatches || matchingSnippets.length === 0) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        applySnippet(matchingSnippets[0]);
      }
    },
    [hasMatches, matchingSnippets, applySnippet]
  );

  return {
    hasMatches,
    matchingSnippets,
    applySnippet,
    handleKeyDown,
  };
}
