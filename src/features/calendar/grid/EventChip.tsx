import { useState, useRef, useCallback } from 'react';
import type { PositionedEvent } from '../lib/layoutEvents';
import { formatEventTime } from '../../../utils/format';
import { HOUR_HEIGHT } from '../lib/layoutEvents';

interface EventChipProps {
  positioned: PositionedEvent;
  onClick: (occ: PositionedEvent['occurrence']) => void;
  onReschedule?: (
    occ: PositionedEvent['occurrence'],
    newStartAt: Date,
    newEndAt: Date | null
  ) => void;
}

type DragMode = 'move' | 'resize-top' | 'resize-bottom' | null;

// Soft color palette for event chips (cycles by eventId hash)
const EVENT_COLORS = [
  { bg: 'bg-violet-50 dark:bg-violet-950/40', bar: 'bg-violet-500', tag: 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300' },
  { bg: 'bg-blue-50 dark:bg-blue-950/40',     bar: 'bg-blue-500',   tag: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/40', bar: 'bg-emerald-500', tag: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' },
  { bg: 'bg-amber-50 dark:bg-amber-950/40',   bar: 'bg-amber-500',  tag: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300' },
  { bg: 'bg-rose-50 dark:bg-rose-950/40',     bar: 'bg-rose-500',   tag: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300' },
  { bg: 'bg-indigo-50 dark:bg-indigo-950/40', bar: 'bg-indigo-500', tag: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300' },
];

function getEventColor(eventId: string | number) {
  // Simple hash for consistent color per event
  const str = String(eventId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

export function EventChip({
  positioned,
  onClick,
  onReschedule,
}: EventChipProps) {
  const { occurrence, top, height, leftPercent, widthPercent } = positioned;

  // Active drag state
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [resizeDeltaPx, setResizeDeltaPx] = useState(0);
  const [activeDragMode, setActiveDragMode] = useState<DragMode>(null);

  const startPointerYRef = useRef(0);
  const initialTopRef = useRef(top);
  const initialHeightRef = useRef(height);
  const isDraggingRef = useRef(false);

  const colors = getEventColor(occurrence.eventId);

  // Helper to handle mouse drag start on desktop only
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
      if (e.pointerType === 'touch' || e.button !== 0 || !onReschedule) return;

      e.preventDefault();
      e.stopPropagation();

      setActiveDragMode(mode);
      startPointerYRef.current = e.clientY;
      initialTopRef.current = top;
      initialHeightRef.current = height;
      isDraggingRef.current = false;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaY = moveEvent.clientY - startPointerYRef.current;
        if (Math.abs(deltaY) > 4) isDraggingRef.current = true;

        const snapStepPx = (15 / 60) * HOUR_HEIGHT;
        const snappedDelta = Math.round(deltaY / snapStepPx) * snapStepPx;

        if (mode === 'move') {
          const newTop = Math.max(0, Math.min(24 * HOUR_HEIGHT - initialHeightRef.current, initialTopRef.current + snappedDelta));
          setDragOffsetPx(newTop - initialTopRef.current);
        } else if (mode === 'resize-bottom') {
          const newH = Math.max(snapStepPx, initialHeightRef.current + snappedDelta);
          setResizeDeltaPx(newH - initialHeightRef.current);
        } else if (mode === 'resize-top') {
          const newTop = Math.max(0, initialTopRef.current + snappedDelta);
          const newH = Math.max(snapStepPx, initialHeightRef.current - snappedDelta);
          if (newH >= snapStepPx) {
            setDragOffsetPx(newTop - initialTopRef.current);
            setResizeDeltaPx(newH - initialHeightRef.current);
          }
        }
      };

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);

        if (isDraggingRef.current) {
          const origStart = new Date(occurrence.startAt);
          const origEnd = occurrence.endAt
            ? new Date(occurrence.endAt)
            : new Date(origStart.getTime() + 60 * 60 * 1000);

          if (mode === 'move') {
            setDragOffsetPx((currOffset) => {
              const minutesDelta = (currOffset / HOUR_HEIGHT) * 60;
              const newStart = new Date(origStart.getTime() + minutesDelta * 60 * 1000);
              const duration = origEnd.getTime() - origStart.getTime();
              const newEnd = new Date(newStart.getTime() + duration);
              onReschedule(occurrence, newStart, newEnd);
              return 0;
            });
          } else if (mode === 'resize-bottom') {
            setResizeDeltaPx((currDelta) => {
              const minutesDelta = (currDelta / HOUR_HEIGHT) * 60;
              const newEnd = new Date(origEnd.getTime() + minutesDelta * 60 * 1000);
              onReschedule(occurrence, origStart, newEnd);
              return 0;
            });
          } else if (mode === 'resize-top') {
            setDragOffsetPx((currOffset) => {
              const minutesDelta = (currOffset / HOUR_HEIGHT) * 60;
              const newStart = new Date(origStart.getTime() + minutesDelta * 60 * 1000);
              onReschedule(occurrence, newStart, origEnd);
              return 0;
            });
            setResizeDeltaPx(0);
          }
        }

        setTimeout(() => {
          isDraggingRef.current = false;
          setActiveDragMode(null);
        }, 50);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [occurrence, top, height, onReschedule]
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDraggingRef.current) onClick(occurrence);
  };

  const currentTop = top + dragOffsetPx;
  const currentHeight = Math.max(44, height + resizeDeltaPx);

  return (
    <div
      data-testid={`event-chip-${occurrence.eventId}`}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onPointerDown={(e) => handlePointerDown(e, 'move')}
      style={{
        top: `${currentTop}px`,
        height: `${currentHeight}px`,
        left: `${leftPercent + 1}%`,
        width: `${widthPercent - 2}%`,
      }}
      className={`absolute group rounded-xl overflow-hidden text-left text-xs select-none cursor-pointer z-10 transition-shadow
        ${colors.bg} border border-transparent
        ${activeDragMode
          ? 'shadow-float ring-2 ring-accent opacity-90 cursor-grabbing'
          : 'hover:shadow-card hover:ring-1 hover:ring-accent/20'
        }`}
    >
      {/* Refleq-style: left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3.5px] rounded-l-xl ${colors.bar}`} />

      {/* Top resize handle (desktop only) */}
      <div
        onPointerDown={(e) => handlePointerDown(e, 'resize-top')}
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20 opacity-0 group-hover:opacity-100 hidden sm:block"
        title="Drag to resize start time"
      />

      {/* Content */}
      <div className="pl-3 pr-2 pt-1.5 pb-1 h-full flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-1">
            <span className="font-semibold text-[11px] sm:text-xs leading-tight text-ink line-clamp-2">
              {occurrence.title}
            </span>
            {occurrence.recurrence !== 'none' && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${colors.tag}`}>
                ↻
              </span>
            )}
          </div>
          <div className="text-[10px] text-ink-muted mt-0.5 truncate">
            {formatEventTime(occurrence.startAt, occurrence.endAt, occurrence.allDay)}
          </div>
        </div>

        {currentHeight >= 65 && occurrence.description && (
          <div className="text-[10px] text-ink-muted line-clamp-1 opacity-80 mt-0.5">
            {occurrence.description}
          </div>
        )}
      </div>

      {/* Bottom resize handle (desktop only) */}
      <div
        onPointerDown={(e) => handlePointerDown(e, 'resize-bottom')}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-20 opacity-0 group-hover:opacity-100 hidden sm:block"
        title="Drag to resize end time"
      />
    </div>
  );
}
