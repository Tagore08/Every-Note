import type { JournalMood } from '../../types/note';

interface MoodRowProps {
  mood?: JournalMood | null;
  onChange: (mood: JournalMood | null) => void;
}

export const MOOD_DEFINITIONS: { value: JournalMood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😫', label: 'Rough' },
  { value: 2, emoji: '🙁', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Neutral' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

export function MoodRow({ mood, onChange }: MoodRowProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
        Mood
      </span>
      <div className="flex items-center gap-1.5 p-1 rounded-full bg-surface-2/60 border border-border">
        {MOOD_DEFINITIONS.map((m) => {
          const isSelected = mood === m.value;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => onChange(isSelected ? null : m.value)}
              title={`${m.label} (${m.value}/5)`}
              aria-label={m.label}
              aria-pressed={isSelected}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all cursor-pointer ${
                isSelected
                  ? 'bg-surface shadow-xs border-2 border-accent scale-110'
                  : 'hover:bg-surface/50 opacity-50 hover:opacity-100'
              }`}
            >
              <span>{m.emoji}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
