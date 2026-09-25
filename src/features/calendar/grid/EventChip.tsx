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

  const chipColor = 'var(--color-accent)';

  // Helper to handle mouse drag start on desktop only
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
      // Mobile tap only (EXPANSION_PLAN §5.3 / Phase 3 spec: desktop only drag)
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
        if (Math.abs(deltaY) > 4) {
          isDraggingRef.current = true;
        }

        // Snap to 15-minute intervals (15 min = 15px with 60px/hr)
        const snapStepPx = (15 / 60) * HOUR_HEIGHT; // 15px
        const snappedDelta = Math.round(deltaY / snapStepPx) * snapStepPx;

        if (mode === 'move') {
          // Clamp so top doesn't go below 0 or above grid
          const newTop = Math.max(0, Math.min(24 * HOUR_HEIGHT - initialHeightRef.current, initialTopRef.current + snappedDelta));
          setDragOffsetPx(newTop - initialTopRef.current);
        } else if (mode === 'resize-bottom') {
          // Minimum 15-min height
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
          // Calculate new startAt and endAt from applied deltas
          const origStart = new Date(occurrence.startAt);
          const origEnd = occurrence.endAt
            ? new Date(occurrence.endAt)
            : new Date(origStart.getTime() + 60 * 60 * 1000);

          if (mode === 'move') {
            // Minutes delta
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
    if (!isDraggingRef.current) {
      onClick(occurrence);
    }
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
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        borderLeftColor: chipColor,
      }}
      className={`absolute group border-l-[3.5px] rounded-lg px-2 py-1 text-left text-xs transition-shadow select-none cursor-pointer overflow-hidden z-10 ${
        activeDragMode
          ? 'shadow-float ring-2 ring-accent opacity-90 cursor-grabbing'
          : 'shadow-xs hover:shadow-card hover:brightness-95 dark:hover:brightness-110'
      } bg-surface-2 dark:bg-surface border border-border`}
    >
      {/* Top resize handle (desktop only) */}
      <div
        onPointerDown={(e) => handlePointerDown(e, 'resize-top')}
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-20 opacity-0 group-hover:opacity-100 hidden sm:block"
        title="Drag to resize start time"
      />

      <div className="flex items-center justify-between gap-1 leading-tight">
        <span className="font-semibold text-ink truncate text-[11px] sm:text-xs">
          {occurrence.title}
        </span>
        {occurrence.recurrence !== 'none' && (
          <span className="text-[10px] text-ink-muted shrink-0" title="Recurring event">
            ↻
          </span>
        )}
      </div>

      <div className="text-[10px] text-ink-muted truncate mt-0.5">
        {formatEventTime(occurrence.startAt, occurrence.endAt, occurrence.allDay)}
      </div>

      {currentHeight >= 55 && occurrence.description && (
        <div className="text-[10px] text-ink-muted line-clamp-1 mt-0.5 opacity-80">
          {occurrence.description}
        </div>
      )}

      {/* Bottom resize handle (desktop only) */}
      <div
        onPointerDown={(e) => handlePointerDown(e, 'resize-bottom')}
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-20 opacity-0 group-hover:opacity-100 hidden sm:block"
        title="Drag to resize end time"
      />
    </div>
  );
}
