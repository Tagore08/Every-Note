import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';

export function useInboxAnalytics() {
  return useLiveQuery(async () => {
    try {
      const allNotes = await db.notes.toArray();
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      // Captured this week (createdAt in last 7 days)
      const capturedThisWeek = allNotes.filter(
        (n) => new Date(n.createdAt).getTime() >= oneWeekAgo
      ).length;

      // Filed this week: inbox is false and updatedAt in last 7 days
      const filedNotes = allNotes.filter((n) => {
        if (n.inbox) return false;
        const updatedTime = new Date(n.updatedAt).getTime();
        const createdTime = new Date(n.createdAt).getTime();
        return updatedTime >= oneWeekAgo && updatedTime >= createdTime;
      });

      const filedThisWeek = filedNotes.length;

      // Durations to file for notes that were filed
      const durationsMs: number[] = [];
      for (const note of filedNotes) {
        const diff = new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime();
        if (diff > 1000) {
          durationsMs.push(diff);
        }
      }

      durationsMs.sort((a, b) => a - b);
      let medianMs: number | null = null;
      if (durationsMs.length > 0) {
        const mid = Math.floor(durationsMs.length / 2);
        medianMs =
          durationsMs.length % 2 === 0
            ? (durationsMs[mid - 1] + durationsMs[mid]) / 2
            : durationsMs[mid];
      }

      let avgTimeText = '—';
      if (medianMs !== null) {
        const mins = Math.round(medianMs / 60000);
        const hours = Math.round(medianMs / 3600000);
        const days = (medianMs / 86400000).toFixed(1);

        if (mins < 60) {
          avgTimeText = `${Math.max(1, mins)}m`;
        } else if (hours < 24) {
          avgTimeText = `${hours}h`;
        } else {
          avgTimeText = `${days.replace('.0', '')}d`;
        }
      }

      return {
        capturedThisWeek,
        filedThisWeek,
        avgTimeText,
      };
    } catch (err) {
      console.error('Failed to compute inbox analytics:', err);
      return {
        capturedThisWeek: 0,
        filedThisWeek: 0,
        avgTimeText: '—',
      };
    }
  }, []);
}

export function InboxAnalyticsHeader() {
  const analytics = useInboxAnalytics();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('notes_inbox_analytics_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('notes_inbox_analytics_collapsed', String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const captured = analytics?.capturedThisWeek ?? 0;
  const filed = analytics?.filedThisWeek ?? 0;
  const avgTime = analytics?.avgTimeText ?? '—';

  return (
    <div className="rounded-card border border-border bg-surface-2/40 overflow-hidden text-xs text-ink-muted transition-all">
      <button
        type="button"
        onClick={toggleCollapse}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-surface-2/70 transition-colors text-left cursor-pointer min-h-[44px]"
        aria-expanded={!isCollapsed}
        aria-label="Toggle inbox analytics strip"
      >
        <div className="flex items-center gap-2 font-medium text-ink">
          <svg
            className="w-4 h-4 text-accent shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span>
            {captured} captured · {filed} filed this week · avg {avgTime} to file
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-ink-muted">
          <span className="text-[11px] font-mono opacity-70">
            {isCollapsed ? 'Show details' : 'Hide'}
          </span>
          <svg
            className={`w-3.5 h-3.5 transform transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {!isCollapsed && (
        <div className="px-4 pb-3 pt-1 border-t border-border/50 grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-lg bg-surface border border-border/60">
            <div className="text-[10px] uppercase font-semibold text-ink-muted tracking-wider">
              Captures
            </div>
            <div className="text-base font-bold text-ink mt-0.5">{captured}</div>
            <div className="text-[10px] text-ink-muted">Last 7 days</div>
          </div>

          <div className="p-2.5 rounded-lg bg-surface border border-border/60">
            <div className="text-[10px] uppercase font-semibold text-ink-muted tracking-wider">
              Filed
            </div>
            <div className="text-base font-bold text-ink mt-0.5">{filed}</div>
            <div className="text-[10px] text-ink-muted">Triaged notes</div>
          </div>

          <div className="p-2.5 rounded-lg bg-surface border border-border/60">
            <div className="text-[10px] uppercase font-semibold text-ink-muted tracking-wider">
              Time to File
            </div>
            <div className="text-base font-bold text-accent mt-0.5">{avgTime}</div>
            <div className="text-[10px] text-ink-muted">Median turnaround</div>
          </div>
        </div>
      )}
    </div>
  );
}
