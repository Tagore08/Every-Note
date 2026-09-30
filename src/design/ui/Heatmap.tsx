import { useState, useMemo } from 'react';
import { Sheet } from './Sheet';
import { toLocalDateStr, parseLocalDateStr } from '../../db/habitsRepo';

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number; // e.g. 0, 1 (or multiple)
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapProps {
  logs: Record<string, boolean | number>;
  startDate?: Date;
  endDate?: Date;
  range?: 'month' | 'year';
  onToggleDate?: (dateStr: string) => void;
  className?: string;
}

export function Heatmap({
  logs,
  startDate: _startDate,
  endDate,
  range = 'year',
  onToggleDate,
  className = '',
}: HeatmapProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);
  const isMonth = range === 'month';
  const numWeeks = isMonth ? 5 : 52;

  // Compute weeks (5 for month, 52 for year) ending today or endDate
  const { weeks, monthLabels } = useMemo(() => {
    const end = endDate ? new Date(endDate) : new Date();
    // Align end date to Sunday of current week
    const endDayOfWeek = end.getDay(); // 0 is Sun, 1 is Mon...
    const daysToSun = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
    const endSun = new Date(end.getFullYear(), end.getMonth(), end.getDate() + daysToSun);

    const totalDays = numWeeks * 7;
    const startMon = new Date(endSun.getFullYear(), endSun.getMonth(), endSun.getDate() - totalDays + 1);

    const generatedWeeks: HeatmapDay[][] = [];
    const months: { label: string; weekIndex: number }[] = [];
    let currentWeek: HeatmapDay[] = [];
    let lastMonth = -1;

    for (let i = 0; i < totalDays; i++) {
      const cur = new Date(startMon.getFullYear(), startMon.getMonth(), startMon.getDate() + i);
      const dateStr = toLocalDateStr(cur);
      const dayOfWeek = cur.getDay(); // 0 Sun, 1 Mon...
      const m = cur.getMonth();

      // Check month boundary on first day of week
      if (dayOfWeek === 1 && m !== lastMonth) {
        months.push({
          label: cur.toLocaleDateString(undefined, { month: 'short' }),
          weekIndex: generatedWeeks.length,
        });
        lastMonth = m;
      }

      const val = logs[dateStr];
      const count = typeof val === 'number' ? val : val ? 1 : 0;
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (count > 0) {
        if (count >= 4) level = 4;
        else if (count >= 3) level = 3;
        else if (count >= 2) level = 2;
        else level = 1;
      }

      currentWeek.push({
        date: dateStr,
        count,
        level,
      });

      if (currentWeek.length === 7) {
        generatedWeeks.push(currentWeek);
        currentWeek = [];
      }
    }

    return { weeks: generatedWeeks, monthLabels: months };
  }, [logs, endDate, numWeeks]);

  const selectedDayInfo = useMemo(() => {
    if (!selectedDate) return null;
    const val = logs[selectedDate];
    const isDone = Boolean(val);
    const dateObj = parseLocalDateStr(selectedDate);
    return {
      dateStr: selectedDate,
      formattedDate: dateObj.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      isDone,
    };
  }, [selectedDate, logs]);

  const getCellBg = (level: 0 | 1 | 2 | 3 | 4) => {
    switch (level) {
      case 1:
        return 'color-mix(in oklch, var(--color-accent) 25%, transparent)';
      case 2:
        return 'color-mix(in oklch, var(--color-accent) 50%, transparent)';
      case 3:
        return 'color-mix(in oklch, var(--color-accent) 75%, transparent)';
      case 4:
        return 'var(--color-accent)';
      case 0:
      default:
        return 'var(--color-surface-2)';
    }
  };

  return (
    <div className={`w-full ${isMonth ? '' : 'overflow-x-auto'} select-none ${className}`}>
      <div className={`${isMonth ? 'w-fit' : 'min-w-[680px]'} p-2`}>
        {/* Month labels header */}
        <div className={`flex text-[11px] text-ink-muted mb-1.5 ${isMonth ? 'pl-7' : 'pl-6'} relative h-4`}>
          {monthLabels.map((m, idx) => (
            <span
              key={idx}
              className="absolute font-medium"
              style={{ left: `${m.weekIndex * (isMonth ? 19 : 13) + (isMonth ? 28 : 24)}px` }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="flex gap-1.5 items-start">
          {/* Day of week labels */}
          <div className={`flex flex-col gap-[3px] text-[9px] text-ink-muted pr-1.5 select-none w-5 text-right font-medium`}>
            <span className={`${isMonth ? 'h-3.5' : 'h-2.5'} leading-none flex items-center justify-end`}>M</span>
            <span className={`${isMonth ? 'h-3.5' : 'h-2.5'} leading-none opacity-0`}>T</span>
            <span className={`${isMonth ? 'h-3.5' : 'h-2.5'} leading-none flex items-center justify-end`}>W</span>
            <span className={`${isMonth ? 'h-3.5' : 'h-2.5'} leading-none opacity-0`}>T</span>
            <span className={`${isMonth ? 'h-3.5' : 'h-2.5'} leading-none flex items-center justify-end`}>F</span>
            <span className={`${isMonth ? 'h-3.5' : 'h-2.5'} leading-none opacity-0`}>S</span>
            <span className={`${isMonth ? 'h-3.5' : 'h-2.5'} leading-none opacity-0`}>S</span>
          </div>

          {/* Columns of 7 squares */}
          <div className="flex gap-[3px]">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-[3px]">
                {week.map((day) => {
                  const isToday = day.date === todayStr;
                  const isSelected = day.date === selectedDate;
                  const bg = getCellBg(day.level);

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDate(day.date)}
                      className={`${isMonth ? 'w-3.5 h-3.5 rounded-[3px]' : 'w-2.5 h-2.5 rounded-[2px]'} transition-all cursor-pointer relative ${
                        isToday
                          ? 'ring-1 ring-accent ring-offset-1 ring-offset-bg z-10'
                          : ''
                      } ${isSelected ? 'ring-2 ring-ink z-20' : ''}`}
                      style={{
                        backgroundColor: bg,
                        border: day.level === 0 ? '1px solid var(--color-border)' : 'none',
                      }}
                      title={`${day.date}: ${day.count} completion${day.count === 1 ? '' : 's'}`}
                      aria-label={`${day.date}: ${day.count}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1.5 text-[11px] text-ink-muted mt-3 pr-2">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-[2px] border border-border bg-surface-2" />
          <span
            className="w-2.5 h-2.5 rounded-[2px]"
            style={{ backgroundColor: getCellBg(1) }}
          />
          <span
            className="w-2.5 h-2.5 rounded-[2px]"
            style={{ backgroundColor: getCellBg(2) }}
          />
          <span
            className="w-2.5 h-2.5 rounded-[2px]"
            style={{ backgroundColor: getCellBg(3) }}
          />
          <span
            className="w-2.5 h-2.5 rounded-[2px]"
            style={{ backgroundColor: getCellBg(4) }}
          />
          <span>More</span>
        </div>
      </div>

      {/* Selected Day Sheet */}
      <Sheet
        isOpen={Boolean(selectedDate)}
        onClose={() => setSelectedDate(null)}
        title={selectedDayInfo?.formattedDate}
        description={selectedDate ? `Date: ${selectedDate}` : undefined}
      >
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between p-3 rounded-card bg-surface-2 border border-border">
            <span className="text-sm font-medium text-ink">Habit status for this day</span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                selectedDayInfo?.isDone
                  ? 'bg-success/15 text-success border border-success/30'
                  : 'bg-surface text-ink-muted border border-border'
              }`}
            >
              {selectedDayInfo?.isDone ? 'Completed' : 'Not completed'}
            </span>
          </div>

          {onToggleDate && selectedDate && (
            <button
              type="button"
              onClick={() => {
                onToggleDate(selectedDate);
              }}
              className="w-full py-2.5 px-4 rounded-pill font-semibold text-sm bg-accent text-accent-ink hover:opacity-95 transition-opacity"
            >
              {selectedDayInfo?.isDone ? 'Mark as Incomplete' : 'Mark as Completed'}
            </button>
          )}
        </div>
      </Sheet>
    </div>
  );
}
