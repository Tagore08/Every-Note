import type { Flag } from './flags';

export type NavGroup = 'today' | 'capture' | 'organize' | 'plan' | 'grow' | 'system';

export interface NavItemConfig {
  id: string;
  label: string;
  route: string;
  group: NavGroup;
  iconName: string;
  badgeKey?: 'inbox' | 'tasks';
  flag?: Flag;
  inLibrarySheet?: boolean;
}

export const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'capture', label: 'Capture' },
  { id: 'organize', label: 'Organize' },
  { id: 'plan', label: 'Plan' },
  { id: 'grow', label: 'Grow' },
  { id: 'system', label: 'System' },
];

export const NAV_ITEMS: NavItemConfig[] = [
  // TODAY
  {
    id: 'today',
    label: 'Today',
    route: '/today',
    group: 'today',
    iconName: 'Home',
  },
  {
    id: 'insights',
    label: 'Insights',
    route: '/insights',
    group: 'today',
    iconName: 'Sparkles',
    flag: 'insights',
    inLibrarySheet: true,
  },

  // CAPTURE
  {
    id: 'inbox',
    label: 'Inbox',
    route: '/inbox',
    group: 'capture',
    iconName: 'Inbox',
    badgeKey: 'inbox',
    inLibrarySheet: true,
  },
  {
    id: 'journal',
    label: 'Journal',
    route: '/journal',
    group: 'capture',
    iconName: 'BookOpen',
    flag: 'journal',
    inLibrarySheet: true,
  },
  {
    id: 'canvas',
    label: 'Canvas',
    route: '/canvas',
    group: 'capture',
    iconName: 'Palette',
    flag: 'canvas',
    inLibrarySheet: true,
  },

  // ORGANIZE
  {
    id: 'notes',
    label: 'Notes',
    route: '/notes',
    group: 'organize',
    iconName: 'FileText',
    inLibrarySheet: true,
  },
  {
    id: 'graph',
    label: 'Graph',
    route: '/graph',
    group: 'organize',
    iconName: 'Network',
    flag: 'graph',
    inLibrarySheet: true,
  },
  {
    id: 'areas',
    label: 'Life Areas',
    route: '/areas',
    group: 'organize',
    iconName: 'Compass',
    inLibrarySheet: true,
  },
  {
    id: 'people',
    label: 'People',
    route: '/people',
    group: 'organize',
    iconName: 'Users',
    inLibrarySheet: true,
  },
  {
    id: 'tags',
    label: 'Tags',
    route: '/tags',
    group: 'organize',
    iconName: 'Tag',
    inLibrarySheet: true,
  },

  // PLAN
  {
    id: 'calendar',
    label: 'Calendar',
    route: '/calendar',
    group: 'plan',
    iconName: 'Calendar',
    inLibrarySheet: true,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    route: '/tasks',
    group: 'plan',
    iconName: 'CheckSquare',
    badgeKey: 'tasks',
    inLibrarySheet: true,
  },
  {
    id: 'matrix',
    label: 'Eisenhower',
    route: '/matrix',
    group: 'plan',
    iconName: 'LayoutGrid',
    inLibrarySheet: true,
  },
  {
    id: 'routines',
    label: 'Routines',
    route: '/routines',
    group: 'plan',
    iconName: 'Repeat',
    flag: 'routines',
    inLibrarySheet: true,
  },

  // GROW
  {
    id: 'habits',
    label: 'Habits',
    route: '/habits',
    group: 'grow',
    iconName: 'Target',
    inLibrarySheet: true,
  },
  {
    id: 'focus',
    label: 'Focus',
    route: '/focus',
    group: 'grow',
    iconName: 'Timer',
    inLibrarySheet: true,
  },

  // SYSTEM
  {
    id: 'settings',
    label: 'Settings',
    route: '/settings',
    group: 'system',
    iconName: 'Settings',
    inLibrarySheet: true,
  },
  {
    id: 'archive',
    label: 'Archive',
    route: '/archive',
    group: 'system',
    iconName: 'Archive',
    inLibrarySheet: true,
  },
  {
    id: 'trash',
    label: 'Trash',
    route: '/trash',
    group: 'system',
    iconName: 'Trash2',
    inLibrarySheet: true,
  },
  {
    id: 'labs',
    label: 'Labs',
    route: '/settings/labs',
    group: 'system',
    iconName: 'FlaskConical',
    inLibrarySheet: true,
  },
];

export const MOBILE_BOTTOM_SLOTS = [
  { id: 'today', label: 'Today', route: '/today', iconName: 'Home' },
  { id: 'search', label: 'Search', route: '/search', iconName: 'Search' },
  { id: 'fab', label: 'Capture', route: '#capture', iconName: 'Plus' },
  { id: 'calendar', label: 'Calendar', route: '/calendar', iconName: 'Calendar' },
  { id: 'library', label: 'Library', route: '#library', iconName: 'Library' },
];
