import { useNavigate } from 'react-router-dom';
import { useJournalEntry, useJournalStreak } from '../../db/notesRepo';
import { localDateStr } from '../../lib/date';
import { MOOD_DEFINITIONS } from './MoodRow';

export function JournalPromptSection() {
  const navigate = useNavigate();
  const todayStr = localDateStr();
  const todayEntry = useJournalEntry(todayStr);
  const streak = useJournalStreak();

  const hasWrittenToday =
    Boolean(todayEntry?.content && todayEntry.content.trim().length > 0) ||
    todayEntry?.mood != null;

  const moodDef = todayEntry?.mood ? MOOD_DEFINITIONS.find((m) => m.value === todayEntry.mood) : null;

  return (
    <div
      onClick={() => navigate('/journal')}
      className="p-4 sm:p-5 rounded-card border border-border bg-surface hover:border-accent/40 shadow-card transition-all cursor-pointer group space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink group-hover:text-accent transition-colors">
              {hasWrittenToday ? "Today's Reflection" : 'Daily Journal'}
            </h3>
            <p className="text-xs text-ink-muted">
              {hasWrittenToday ? 'Entry saved for today' : 'Take a moment to pause and reflect'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {moodDef && (
            <span className="text-lg" title={`Today's Mood: ${moodDef.label}`}>
              {moodDef.emoji}
            </span>
          )}
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <span>🔥</span>
              <span>{streak}d</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 text-xs">
        <span className="text-ink-muted line-clamp-1">
          {hasWrittenToday
            ? todayEntry?.content?.slice(0, 80) || 'Mood logged'
            : 'What went well today? What drained your energy?'}
        </span>
        <span className="text-accent font-semibold shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform">
          {hasWrittenToday ? 'Read entry →' : 'Write entry →'}
        </span>
      </div>
    </div>
  );
}
