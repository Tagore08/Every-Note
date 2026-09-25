import type { EventOccurrence } from '../../../types/event';
import { startOfDay, endOfDay } from './calendarDate';

export interface PositionedEvent {
  occurrence: EventOccurrence;
  top: number;          // pixels from top of grid
  height: number;       // height in pixels (min 44px)
  leftPercent: number;  // 0..100
  widthPercent: number; // 0..100
  startMinutes: number;
  endMinutes: number;
}

export const HOUR_HEIGHT = 60; // 60px per hour per EXPANSION_PLAN §5.3
export const MIN_CHIP_HEIGHT = 44; // 44px min tap target per house rules

/**
 * Calculates horizontal column layout for overlapping events on a single calendar day.
 */
export function layoutDayEvents(occurrences: EventOccurrence[], targetDate: Date): {
  timedEvents: PositionedEvent[];
  allDayEvents: EventOccurrence[];
} {
  const allDayEvents: EventOccurrence[] = [];
  const timedRaw: { occ: EventOccurrence; startMin: number; endMin: number }[] = [];

  const dayStart = startOfDay(targetDate);
  const dayEnd = endOfDay(targetDate);

  for (const occ of occurrences) {
    if (occ.allDay) {
      allDayEvents.push(occ);
      continue;
    }

    const start = new Date(occ.startAt);
    const end = occ.endAt ? new Date(occ.endAt) : new Date(start.getTime() + 60 * 60 * 1000);

    // If completely outside target day, skip
    if (end.getTime() <= dayStart.getTime() || start.getTime() >= dayEnd.getTime()) {
      continue;
    }

    // Determine start minutes clamped to 00:00 of target day
    let startMin = 0;
    if (start.getTime() > dayStart.getTime()) {
      startMin = start.getHours() * 60 + start.getMinutes();
    }

    // Determine end minutes clamped to 24:00 (1440 min)
    let endMin = 24 * 60;
    if (end.getTime() < dayEnd.getTime()) {
      endMin = end.getHours() * 60 + end.getMinutes();
    }

    // Guarantee minimum span for positioning
    if (endMin <= startMin) {
      endMin = Math.min(24 * 60, startMin + 30);
    }

    timedRaw.push({ occ, startMin, endMin });
  }

  // Sort by start time, then duration (longer events first)
  timedRaw.sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

  // Cluster overlapping events together
  const clusters: { occ: EventOccurrence; startMin: number; endMin: number }[][] = [];
  let currentCluster: { occ: EventOccurrence; startMin: number; endMin: number }[] = [];
  let clusterEnd = -1;

  for (const item of timedRaw) {
    if (item.startMin >= clusterEnd) {
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }
      currentCluster = [item];
      clusterEnd = item.endMin;
    } else {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const timedEvents: PositionedEvent[] = [];

  // Assign columns within each cluster
  for (const cluster of clusters) {
    const columns: { occ: EventOccurrence; startMin: number; endMin: number }[][] = [];

    for (const item of cluster) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c][columns[c].length - 1];
        if (item.startMin >= lastInCol.endMin) {
          columns[c].push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([item]);
      }
    }

    const totalCols = columns.length;
    const colWidth = 100 / totalCols;

    for (let c = 0; c < totalCols; c++) {
      for (const item of columns[c]) {
        const top = (item.startMin / 60) * HOUR_HEIGHT;
        const durationMin = item.endMin - item.startMin;
        const rawHeight = (durationMin / 60) * HOUR_HEIGHT;
        const height = Math.max(MIN_CHIP_HEIGHT, rawHeight);

        timedEvents.push({
          occurrence: item.occ,
          top,
          height,
          leftPercent: c * colWidth,
          widthPercent: colWidth,
          startMinutes: item.startMin,
          endMinutes: item.endMin,
        });
      }
    }
  }

  return { timedEvents, allDayEvents };
}
