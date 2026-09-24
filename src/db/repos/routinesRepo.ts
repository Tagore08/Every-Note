import { useEffect, useState } from 'react';

export interface RoutineTimelineItem {
  id: string | number;
  title: string;
  time?: string;
  completed?: boolean;
}

export const routinesRepo = {
  /**
   * Returns active routine items for a given date.
   * Interface stubbed for Phase 4 routines feature.
   */
  async itemsFor(_date: Date): Promise<RoutineTimelineItem[]> {
    return [];
  },
};

export function useRoutinesForDate(date: Date): RoutineTimelineItem[] {
  const [items, setItems] = useState<RoutineTimelineItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    routinesRepo.itemsFor(date).then((res) => {
      if (!cancelled) setItems(res);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  return items;
}
