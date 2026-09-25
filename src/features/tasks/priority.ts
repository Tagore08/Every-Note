import type { TaskPriority } from '../../types/task';

export type PriorityLevel = 'p1' | 'p2' | 'p3' | 'p4';

export interface PriorityMeta {
  level: PriorityLevel;
  shortLabel: string;
  name: string;
  flagColor: string;
  checkboxBorder: string;
  checkboxActive: string;
  badgeBg: string;
  text: string;
}

export const PRIORITY_CONFIG: Record<PriorityLevel, PriorityMeta> = {
  p1: {
    level: 'p1',
    shortLabel: 'P1',
    name: 'Priority 1',
    flagColor: '#ef4444',
    checkboxBorder: 'border-rose-500 hover:border-rose-600',
    checkboxActive: 'bg-rose-500 border-rose-500',
    badgeBg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20',
    text: 'text-rose-600 dark:text-rose-400',
  },
  p2: {
    level: 'p2',
    shortLabel: 'P2',
    name: 'Priority 2',
    flagColor: '#f59e0b',
    checkboxBorder: 'border-amber-500 hover:border-amber-600',
    checkboxActive: 'bg-amber-500 border-amber-500',
    badgeBg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
  },
  p3: {
    level: 'p3',
    shortLabel: 'P3',
    name: 'Priority 3',
    flagColor: '#3b82f6',
    checkboxBorder: 'border-blue-500 hover:border-blue-600',
    checkboxActive: 'bg-blue-500 border-blue-500',
    badgeBg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    text: 'text-blue-600 dark:text-blue-400',
  },
  p4: {
    level: 'p4',
    shortLabel: 'P4',
    name: 'Priority 4',
    flagColor: '#94a3b8',
    checkboxBorder: 'border-border hover:border-accent',
    checkboxActive: 'bg-accent border-accent',
    badgeBg: 'bg-surface-2 text-ink-muted border border-border',
    text: 'text-ink-muted',
  },
};

/**
 * Normalizes any TaskPriority ('high', 'medium', 'low', 'none', 'p1', 'p2', 'p3', 'p4')
 * into the canonical 'p1' | 'p2' | 'p3' | 'p4'.
 */
export function normalizePriority(p?: TaskPriority | string | null): PriorityLevel {
  if (!p) return 'p4';
  const lower = p.toLowerCase().trim();
  if (lower === 'p1' || lower === 'high' || lower === '1') return 'p1';
  if (lower === 'p2' || lower === 'medium' || lower === '2') return 'p2';
  if (lower === 'p3' || lower === 'low' || lower === '3') return 'p3';
  return 'p4';
}

export function getPriorityMeta(p?: TaskPriority | string | null): PriorityMeta {
  const level = normalizePriority(p);
  return PRIORITY_CONFIG[level];
}
