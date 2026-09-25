import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useJournalEntry, useJournalStreak, notesRepo } from '../../db/notesRepo';
import { localDateStr, addDays, formatJournalDateHeader } from '../../lib/date';
import { MoodRow } from './MoodRow';
import { PromptChips } from './PromptChips';
import { OnThisDayCard } from './OnThisDayCard';
import type { JournalMood } from '../../types/note';

export function JournalScreen() {
  const { date } = useParams<{ date?: string }>();
  const navigate = useNavigate();

  // Validate date format YYYY-MM-DD, fallback to today's local date
  const isValidDate = Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date));
  const currentDateStr = isValidDate ? (date as string) : localDateStr();

  // If user navigated to /journal with an invalid date param, correct it
  useEffect(() => {
    if (date && !isValidDate) {
      navigate(`/journal/${localDateStr()}`, { replace: true });
    }
  }, [date, isValidDate, navigate]);

  const entry = useJournalEntry(currentDateStr);
  const streak = useJournalStreak();

  // Local editor states
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<JournalMood | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');

  // Distraction-free & serif preferences
  const [isSerif, setIsSerif] = useState(() => {
    try {
      return localStorage.getItem('notes_journal_serif') === 'true';
    } catch {
      return false;
    }
  });
  const [isFocusMode, setIsFocusMode] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeDateRef = useRef(currentDateStr);
  const entryIdRef = useRef<number | undefined>(entry?.id);

  // Keep references fresh
  activeDateRef.current = currentDateStr;
  entryIdRef.current = entry?.id;

  // Toggle Serif font mode
  const toggleSerif = () => {
    setIsSerif((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('notes_journal_serif', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Sync state when entry loads or date changes
  useEffect(() => {
    if (entry) {
      setContent(entry.content || '');
      setMood(entry.mood ?? null);
      setTags(entry.tags || []);
    } else {
      setContent('');
      setMood(null);
      setTags([]);
    }
    setSaveStatus('saved');
  }, [currentDateStr, entry?.id]);

  // Autosave implementation with 500ms debounce
  const debouncedSave = useCallback(
    (newContent: string, newMood: JournalMood | null, newTags: string[]) => {
      setSaveStatus('saving');
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }

      saveTimer.current = setTimeout(async () => {
        try {
          const targetDate = activeDateRef.current;
          const existingId = entryIdRef.current;

          if (existingId) {
            await notesRepo.updateNote(existingId, {
              content: newContent,
              mood: newMood,
              tags: newTags,
            });
          } else {
            // Materialize entry on first write
            const newEntry = await notesRepo.createNote({
              kind: 'journal',
              journalDate: targetDate,
              title: `Journal — ${targetDate}`,
              content: newContent,
              mood: newMood,
              tags: newTags,
              inbox: false,
              pinned: false,
              archived: false,
            });
            entryIdRef.current = newEntry.id;
          }
          setSaveStatus('saved');
        } catch (err) {
          console.error('Failed to autosave journal entry:', err);
          setSaveStatus('idle');
        }
      }, 500);
    },
    []
  );

  // Content change handler
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    debouncedSave(val, mood, tags);
  };

  // Mood change handler
  const handleMoodChange = (newMood: JournalMood | null) => {
    setMood(newMood);
    debouncedSave(content, newMood, tags);
  };

  // Add tag
  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      const nextTags = [...tags, trimmed];
      setTags(nextTags);
      setTagInput('');
      debouncedSave(content, mood, nextTags);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    debouncedSave(content, mood, nextTags);
  };

  // Prompt insertion handler
  const handleInsertPrompt = (promptText: string) => {
    const prefix = content.trim().length > 0 ? '\n\n' : '';
    const newContent = `${content.trimEnd()}${prefix}**${promptText}**\n\n`;
    setContent(newContent);
    debouncedSave(newContent, mood, tags);

    // Focus textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      }
    }, 50);
  };

  // Flush pending save on unmount or date switch
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [currentDateStr]);

  const headerInfo = formatJournalDateHeader(currentDateStr);
  const isToday = headerInfo.isToday;

  return (
    <div
      className={`min-h-[85vh] transition-all ${
        isFocusMode ? 'py-4 max-w-[68ch] mx-auto px-4' : 'max-w-3xl mx-auto px-4 py-6 space-y-6'
      }`}
    >
      {/* Top Header / Day Navigation */}
      <div className="flex flex-col gap-4 pb-4 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          {/* Day Navigation Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => navigate(`/journal/${addDays(currentDateStr, -1)}`)}
              className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => navigate(`/journal/${addDays(currentDateStr, 1)}`)}
              className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Next Day"
              aria-label="Next Day"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={() => navigate(`/journal/${localDateStr()}`)}
                className="px-3 py-1.5 rounded-pill text-xs font-semibold bg-accent-soft text-accent border border-accent/20 hover:opacity-90 transition-opacity cursor-pointer min-h-[44px]"
              >
                Jump to Today
              </button>
            )}

            {/* Hidden native datepicker trigger */}
            <label className="relative p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <input
                type="date"
                value={currentDateStr}
                onChange={(e) => {
                  if (e.target.value) {
                    navigate(`/journal/${e.target.value}`);
                  }
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Select Date"
                aria-label="Select Date"
              />
            </label>
          </div>

          {/* Right Toolbar Actions */}
          <div className="flex items-center gap-2">
            {/* Save indicator */}
            <span className="text-xs text-ink-muted/70 font-mono hidden sm:inline">
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : ''}
            </span>

            {/* Serif Font Toggle */}
            <button
              type="button"
              onClick={toggleSerif}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
                isSerif
                  ? 'border-accent bg-accent/10 text-accent font-serif'
                  : 'border-border bg-surface-2 text-ink-muted hover:text-ink'
              }`}
              title="Toggle Serif Font"
            >
              {isSerif ? 'Serif' : 'Sans'}
            </button>

            {/* Distraction Free Toggle */}
            <button
              type="button"
              onClick={() => setIsFocusMode(!isFocusMode)}
              className={`p-2 rounded-lg border transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center ${
                isFocusMode
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-surface-2 text-ink-muted hover:text-ink'
              }`}
              title={isFocusMode ? 'Exit focus mode' : 'Distraction-free focus mode'}
              aria-label="Toggle focus mode"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isFocusMode ? (
                  <>
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                ) : (
                  <>
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Big Date Header */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">
              {headerInfo.weekday}
            </h1>
            {headerInfo.relativeLabel && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-accent-soft text-accent border border-accent/20">
                {headerInfo.relativeLabel}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-ink-muted mt-0.5">
            {headerInfo.formattedDate}
          </p>
        </div>

        {/* Mood Selector Row */}
        <div className="pt-1">
          <MoodRow mood={mood} onChange={handleMoodChange} />
        </div>
      </div>

      {/* Editor Body */}
      <div className="space-y-4">
        {/* Full-bleed Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={14}
            value={content}
            onChange={handleContentChange}
            placeholder="Nothing written yet — that's fine.&#10;&#10;Type your thoughts or tap a prompt chip below to begin..."
            className={`w-full p-4 sm:p-6 rounded-card border border-border bg-surface text-ink text-base focus:outline-none focus:ring-2 focus:ring-accent leading-relaxed shadow-card resize-y min-h-[320px] placeholder:text-ink-muted/50 ${
              isSerif ? 'font-serif text-lg tracking-normal' : 'font-sans'
            }`}
          />
        </div>

        {/* Prompt Chips */}
        <PromptChips onSelectPrompt={handleInsertPrompt} />

        {/* Tags & Streak Tray */}
        <div className="p-4 rounded-card border border-border bg-surface space-y-3">
          {streak > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Streak</span>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <span>🔥</span>
                <span>{streak} day streak</span>
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-ink border border-border"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-danger cursor-pointer ml-0.5"
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add #tag..."
                className="flex-1 max-w-xs px-3 py-1.5 text-xs rounded-lg border border-border bg-surface-2 text-ink placeholder:text-ink-muted/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-1.5 rounded-lg border border-border bg-surface-2 hover:bg-surface text-xs font-semibold text-ink cursor-pointer"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* On This Day Card */}
        <OnThisDayCard currentDateStr={currentDateStr} />
      </div>
    </div>
  );
}
