import { useNavigate } from 'react-router-dom';
import { useOnThisDay } from '../../db/notesRepo';
import { MOOD_DEFINITIONS } from './MoodRow';

interface OnThisDayCardProps {
  currentDateStr: string;
}

export function OnThisDayCard({ currentDateStr }: OnThisDayCardProps) {
  const navigate = useNavigate();
  const pastEntries = useOnThisDay(currentDateStr);

  if (pastEntries.length === 0) return null;

  const currentYear = Number(currentDateStr.split('-')[0]);

  return (
    <div className="space-y-3 pt-6 border-t border-border">
      <div className="flex items-center gap-2">
        <span className="text-base">🕰️</span>
        <h3 className="text-sm font-semibold text-ink">On This Day</h3>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {pastEntries.map((entry) => {
          const entryYear = Number((entry.journalDate || '').split('-')[0]);
          const yearsAgo = currentYear - entryYear;
          const moodDef = MOOD_DEFINITIONS.find((m) => m.value === entry.mood);

          return (
            <div
              key={entry.id ?? entry.journalDate}
              onClick={() => entry.journalDate && navigate(`/journal/${entry.journalDate}`)}
              className="p-4 rounded-card border border-border bg-surface hover:border-accent/40 shadow-xs hover:shadow-card transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-accent">
                    {yearsAgo} year{yearsAgo === 1 ? '' : 's'} ago
                  </span>
                  <span className="text-xs text-ink-muted">({entry.journalDate})</span>
                </div>
                {moodDef && (
                  <span className="text-sm" title={`Mood: ${moodDef.label}`}>
                    {moodDef.emoji}
                  </span>
                )}
              </div>

              <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
                {entry.content || <span className="italic opacity-60">No written text</span>}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
