import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { EventOccurrence } from '../../../types/event';
import type { Task } from '../../../types/task';
import type { Note } from '../../../types/note';
import {
  formatDateKey,
  formatEventTime,
  isOverdue,
  getContentSnippet,
} from '../../../utils/format';
import { addDays, startOfDay } from '../lib/calendarDate';
import { routinesRepo, type RoutineTimelineItem } from '../../../db/repos/routinesRepo';

interface TimelineViewProps {
  currentDate?: Date;
  occurrences: EventOccurrence[];
  tasksDue: Task[];
  scheduledNotes: Note[];
  onEventClick: (occ: EventOccurrence) => void;
  onToggleTask?: (task: Task) => void;
}

type TimelineItemKind = 'event' | 'task' | 'note' | 'routine';

interface TimelineItem {
  id: string;
  kind: TimelineItemKind;
  dateKey: string;
  sortTime: number; // timestamp in ms for ordering
  eventData?: EventOccurrence;
  taskData?: Task;
  noteData?: Note;
  routineData?: RoutineTimelineItem;
}

export function TimelineView({
  occurrences,
  tasksDue,
  scheduledNotes,
  onEventClick,
  onToggleTask,
}: TimelineViewProps) {
  const navigate = useNavigate();
  const [daysCount, setDaysCount] = useState(14); // Today -> +14 days per §5.3
  const [routineItems, setRoutineItems] = useState<Record<string, RoutineTimelineItem[]>>({});
  const nowDividerRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);

  // Generate range of days from today
  const today = useMemo(() => startOfDay(new Date()), []);
  const rangeDays = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < daysCount; i++) {
      list.push(addDays(today, i));
    }
    return list;
  }, [today, daysCount]);

  // Query routine items for visible range (Phase 4 stub)
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      rangeDays.map(async (day) => {
        const items = await routinesRepo.itemsFor(day);
        return { key: formatDateKey(day), items };
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, RoutineTimelineItem[]> = {};
      for (const r of results) {
        if (r.items.length > 0) map[r.key] = r.items;
      }
      setRoutineItems(map);
    });
    return () => {
      cancelled = true;
    };
  }, [rangeDays]);

  // Merge and group items by day
  const groupedTimeline = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const day of rangeDays) {
      map.set(formatDateKey(day), []);
    }

    // 1. Events
    for (const occ of occurrences) {
      const key = occ.occurrenceDate;
      const list = map.get(key);
      if (list) {
        const start = new Date(occ.startAt);
        list.push({
          id: `ev-${occ.eventId}-${key}`,
          kind: 'event',
          dateKey: key,
          sortTime: occ.allDay ? 0 : start.getTime(),
          eventData: occ,
        });
      }
    }

    // 2. Due Tasks
    for (const task of tasksDue) {
      if (!task.dueAt) continue;
      const taskDate = new Date(task.dueAt);
      const key = formatDateKey(taskDate);
      const list = map.get(key);
      if (list) {
        list.push({
          id: `task-${task.id}`,
          kind: 'task',
          dateKey: key,
          sortTime: taskDate.getTime(),
          taskData: task,
        });
      }
    }

    // 3. Scheduled Notes
    for (const note of scheduledNotes) {
      if (!note.scheduledAt) continue;
      const noteDate = new Date(note.scheduledAt);
      const key = formatDateKey(noteDate);
      const list = map.get(key);
      if (list) {
        list.push({
          id: `note-${note.id}`,
          kind: 'note',
          dateKey: key,
          sortTime: noteDate.getTime(),
          noteData: note,
        });
      }
    }

    // 4. Routines
    for (const [key, routines] of Object.entries(routineItems)) {
      const list = map.get(key);
      if (list) {
        for (const r of routines) {
          list.push({
            id: `routine-${r.id}-${key}`,
            kind: 'routine',
            dateKey: key,
            sortTime: 0,
            routineData: r,
          });
        }
      }
    }

    // Sort items within each day
    for (const list of map.values()) {
      list.sort((a, b) => a.sortTime - b.sortTime);
    }

    return map;
  }, [rangeDays, occurrences, tasksDue, scheduledNotes, routineItems]);

  // Scroll to Now divider on open
  useEffect(() => {
    if (scrolledRef.current || !nowDividerRef.current) return;
    nowDividerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    scrolledRef.current = true;
  }, []);

  const now = new Date();
  const todayKey = formatDateKey(today);
  const tomorrowKey = formatDateKey(addDays(today, 1));

  return (
    <div data-testid="timeline-view" className="space-y-6 max-w-3xl mx-auto pb-12">
      {rangeDays.map((day) => {
        const key = formatDateKey(day);
        const items = groupedTimeline.get(key) || [];
        const isToday = key === todayKey;
        const isTomorrow = key === tomorrowKey;

        const dayTitle = isToday
          ? 'Today'
          : isTomorrow
            ? 'Tomorrow'
            : day.toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              });

        const daySubtitle = !isToday && !isTomorrow
          ? undefined
          : day.toLocaleDateString(undefined, {
              month: 'long',
              day: 'numeric',
            });

        return (
          <div
            key={`timeline-group-${key}`}
            className="bg-surface border border-border rounded-card p-4 sm:p-5 shadow-card"
          >
            {/* Header for Day Group */}
            <div className="flex items-baseline justify-between pb-3 border-b border-border/80 mb-3">
              <div className="flex items-baseline gap-2">
                <h3
                  className={`text-base sm:text-lg font-bold ${
                    isToday ? 'text-accent' : 'text-ink'
                  }`}
                >
                  {dayTitle}
                </h3>
                {daySubtitle && (
                  <span className="text-xs text-ink-muted">{daySubtitle}</span>
                )}
              </div>
              <span className="text-xs font-semibold text-ink-muted">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* Empty state for day */}
            {items.length === 0 ? (
              <div className="py-4 text-center text-xs text-ink-muted italic">
                Nothing scheduled
              </div>
            ) : (
              <div className="space-y-2.5 relative">
                {items.map((item, index) => {
                  const isPast = isToday && item.sortTime > 0 && item.sortTime < now.getTime();
                  const nextItem = items[index + 1];
                  const showNowLineAfter =
                    isToday &&
                    item.sortTime > 0 &&
                    item.sortTime < now.getTime() &&
                    (!nextItem || nextItem.sortTime >= now.getTime());

                  return (
                    <div key={item.id} className="space-y-2.5">
                      {/* Render based on item kind */}
                      {item.kind === 'event' && item.eventData && (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => onEventClick(item.eventData!)}
                          className={`flex items-start gap-3 p-3 rounded-xl border border-border hover:border-accent/40 bg-surface-2/60 hover:bg-surface-2 transition-all cursor-pointer ${
                            isPast ? 'opacity-70' : ''
                          }`}
                        >
                          <div className="w-8 h-8 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0 mt-0.5">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-ink truncate">
                                {item.eventData.title}
                              </span>
                              <span className="text-[11px] font-semibold text-ink-muted shrink-0">
                                {formatEventTime(
                                  item.eventData.startAt,
                                  item.eventData.endAt,
                                  item.eventData.allDay
                                )}
                              </span>
                            </div>

                            {item.eventData.description && (
                              <p className="text-xs text-ink-muted line-clamp-1 mt-0.5">
                                {item.eventData.description}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {item.kind === 'task' && item.taskData && (
                        <div
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                            item.taskData.status === 'done'
                              ? 'border-border bg-surface-2/30 opacity-60'
                              : isOverdue(item.taskData.dueAt)
                                ? 'border-danger/40 bg-danger/5'
                                : 'border-border bg-surface-2/60'
                          }`}
                        >
                          {onToggleTask && (
                            <button
                              type="button"
                              onClick={() => onToggleTask(item.taskData!)}
                              className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer ${
                                item.taskData.status === 'done'
                                  ? 'bg-success border-success text-white'
                                  : 'border-ink-muted hover:border-accent'
                              }`}
                              aria-label="Toggle task"
                            >
                              {item.taskData.status === 'done' && (
                                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-warning">
                                ⏰ Due Task
                              </span>
                              {item.taskData.priority && item.taskData.priority !== 'none' && (
                                <span className="text-[10px] font-semibold text-ink-muted uppercase">
                                  · {item.taskData.priority}
                                </span>
                              )}
                              {isOverdue(item.taskData.dueAt) && item.taskData.status !== 'done' && (
                                <span className="text-[10px] font-bold text-danger">
                                  · Overdue
                                </span>
                              )}
                            </div>

                            <span
                              className={`text-xs sm:text-sm font-medium block truncate text-ink ${
                                item.taskData.status === 'done' ? 'line-through text-ink-muted' : ''
                              }`}
                            >
                              {item.taskData.title}
                            </span>
                          </div>
                        </div>
                      )}

                      {item.kind === 'note' && item.noteData && (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => navigate(`/notes/${item.noteData!.id}`)}
                          className="flex items-start gap-3 p-3 rounded-xl border border-border hover:border-purple-400 bg-surface-2/60 hover:bg-surface-2 transition-all cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-sm">📌</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                                Scheduled Note
                              </span>
                              <span className="text-[10px] text-ink-muted">Tap to open</span>
                            </div>

                            <h4 className="text-xs sm:text-sm font-semibold text-ink truncate">
                              {item.noteData.title || 'Untitled Note'}
                            </h4>

                            {item.noteData.content && (
                              <p className="text-xs text-ink-muted line-clamp-1 mt-0.5">
                                {getContentSnippet(item.noteData.content, 1, 90)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {item.kind === 'routine' && item.routineData && (
                        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2/40">
                          <span className="text-sm">🔄</span>
                          <span className="text-xs font-medium text-ink truncate">
                            {item.routineData.title}
                          </span>
                        </div>
                      )}

                      {/* Now-divider line between past & upcoming */}
                      {showNowLineAfter && (
                        <div
                          ref={nowDividerRef}
                          data-testid="timeline-now-divider"
                          className="flex items-center gap-2 py-1 my-1"
                        >
                          <div className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
                          <div className="h-[2px] bg-accent flex-1 rounded-full" />
                          <span className="text-[10px] font-bold text-accent uppercase tracking-wider shrink-0">
                            Now
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Infinite scroll / Load more days button */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => setDaysCount((prev) => prev + 14)}
          className="px-4 py-2 rounded-pill text-xs font-semibold bg-surface-2 hover:bg-surface border border-border text-ink hover:text-accent transition-colors cursor-pointer min-h-[44px]"
        >
          Load 14 more days
        </button>
      </div>
    </div>
  );
}
