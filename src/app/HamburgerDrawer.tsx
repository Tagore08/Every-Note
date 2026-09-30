import { type ReactNode, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Home,
  Inbox,
  BookOpen,
  Palette,
  Edit3,
  FileText,
  Network,
  Users,
  Tag,
  Calendar,
  CheckSquare,
  Repeat,
  Target,
  Timer,
  Settings,
  Archive,
  Trash2,
  FlaskConical,
  Lock,
  Sun,
  Moon,
  Cloud,
  Zap,
  X,
} from 'lucide-react';
import { NAV_GROUPS, NAV_ITEMS } from './nav';
import type { NavGroup } from './nav';
import { useTheme, THEME_COLORS, ThemeColor } from '../hooks/useTheme';
import { Capacitor } from '@capacitor/core';

const DRAWER_ICON_MAP: Record<string, ReactNode> = {
  Home:         <Home className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Inbox:        <Inbox className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  BookOpen:     <BookOpen className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Palette:      <Palette className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Edit3:        <Edit3 className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  FileText:     <FileText className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Network:      <Network className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Lock:         <Lock className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Users:        <Users className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Tag:          <Tag className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Zap:          <Zap className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  CheckSquare:  <CheckSquare className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Calendar:     <Calendar className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Repeat:       <Repeat className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Target:       <Target className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Timer:        <Timer className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Settings:     <Settings className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Archive:      <Archive className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  Trash2:       <Trash2 className="w-[18px] h-[18px]" strokeWidth={1.75} />,
  FlaskConical: <FlaskConical className="w-[18px] h-[18px]" strokeWidth={1.75} />,
};

// Group dot colors (subtle colored dots beside group labels)
const GROUP_DOT: Partial<Record<NavGroup, string>> = {
  today:    'bg-violet-400',
  capture:  'bg-blue-400',
  organize: 'bg-emerald-400',
  plan:     'bg-amber-400',
  grow:     'bg-rose-400',
  system:   'bg-ink-faint',
};

// Group icon colors for active/hover
const GROUP_ICON_ACTIVE: Partial<Record<NavGroup, string>> = {
  today:    'text-violet-500',
  capture:  'text-blue-500',
  organize: 'text-emerald-500',
  plan:     'text-amber-500',
  grow:     'text-rose-500',
  system:   'text-ink-muted',
};

interface HamburgerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  inboxCount: number;
  todoCount: number;
  visibleNavItems: typeof NAV_ITEMS;
}

export function HamburgerDrawer({
  isOpen,
  onClose,
  inboxCount,
  todoCount,
  visibleNavItems,
}: HamburgerDrawerProps) {
  const shouldReduceMotion = useReducedMotion();
  const drawerRef = useRef<HTMLDivElement>(null);
  const { toggleTheme, isDark, color, setColor } = useTheme();
  const isNative = Capacitor.isNativePlatform();

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  // Touch swipe-to-close (swipe left)
  useEffect(() => {
    if (!isOpen) return;
    let startX = 0;
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
    const onTouchEnd = (e: TouchEvent) => {
      const delta = startX - e.changedTouches[0].clientX;
      if (delta > 60) onClose();
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
            className="absolute inset-0 bg-black/60"
            aria-hidden="true"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            initial={shouldReduceMotion ? { opacity: 0 } : { x: '-100%' }}
            animate={shouldReduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { x: '-100%' }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: 'spring', damping: 32, stiffness: 300 }
            }
            style={{
              paddingTop: 'calc(var(--safe-area-top, env(safe-area-inset-top, 0px)) + 8px)',
              paddingBottom: 'calc(var(--safe-area-bottom, env(safe-area-inset-bottom, 0px)) + 8px)',
            }}
            className="relative z-10 flex flex-col w-[80vw] max-w-[300px] h-full bg-surface border-r border-border/60 shadow-pop overflow-hidden"
          >
            {/* ── Drawer Header ── */}
            <div className="px-4 py-4 border-b border-border/50 shrink-0">
              <div className="flex items-center justify-between mb-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-accent-ink shadow-xs">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-ink leading-tight tracking-tight">Every Notes</p>
                    <p className="text-[11px] text-ink-faint">v2.0 · Local-First</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close menu"
                  className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Scrollable Nav Content ── */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {NAV_GROUPS.map((group) => {
                const items = visibleNavItems.filter((i) => i.group === group.id);
                if (items.length === 0) return null;

                return (
                  <div key={group.id} className="space-y-0.5">
                    {/* Group label with colored dot (omit for today to make minimal and avoid repeating Today twice) */}
                    {group.id !== 'today' && (
                      <div className="flex items-center gap-2 px-2 mb-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${GROUP_DOT[group.id] || 'bg-ink-faint'}`} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint">
                          {group.label}
                        </span>
                      </div>
                    )}

                    {items.map((item) => (
                      <NavLink
                        key={item.route}
                        to={item.route}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                            isActive
                              ? `bg-accent-soft ${GROUP_ICON_ACTIVE[item.group] || 'text-accent'} font-semibold`
                              : 'text-ink-muted hover:text-ink hover:bg-surface-2'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <div className="flex items-center gap-3">
                              <span className={`shrink-0 transition-colors ${isActive ? (GROUP_ICON_ACTIVE[item.group] || 'text-accent') : ''}`}>
                                {DRAWER_ICON_MAP[item.iconName]}
                              </span>
                              <span>{item.label}</span>
                            </div>
                            {item.badgeKey === 'inbox' && inboxCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-accent text-accent-ink min-w-[18px] text-center">
                                {inboxCount}
                              </span>
                            )}
                            {item.badgeKey === 'tasks' && todoCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-accent text-accent-ink min-w-[18px] text-center">
                                {todoCount}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* ── Drawer Footer ── */}
            <div className="shrink-0 border-t border-border/50 px-3 py-3 space-y-1">
              {/* Cloud Storage shortcut */}
              <NavLink
                to="/settings"
                onClick={onClose}
                className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-sm font-medium text-ink hover:bg-surface-2 transition-colors min-h-[40px] cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <Cloud className="w-[18px] h-[18px] text-emerald-500" strokeWidth={1.75} />
                  <span>Cloud Storage</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                  Sync
                </span>
              </NavLink>

              {/* Theme picker & toggle */}
              <div className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-ink bg-surface-2/50 border border-border/50 min-h-[44px]">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-3 transition-colors shrink-0"
                  aria-label="Toggle dark mode"
                >
                  {isDark ? (
                    <Moon className="w-[18px] h-[18px] text-accent" />
                  ) : (
                    <Sun className="w-[18px] h-[18px] text-amber-500" />
                  )}
                </button>
                <div className="h-4 w-px bg-border mx-1 shrink-0" />
                <select
                  value={color}
                  onChange={(e) => setColor(e.target.value as ThemeColor)}
                  className="flex-1 bg-transparent text-ink text-sm font-medium focus:outline-none cursor-pointer truncate appearance-none"
                  aria-label="Select theme color"
                >
                  {THEME_COLORS.map((theme) => (
                    <option key={theme.value} value={theme.value} className="bg-surface text-ink">
                      {theme.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none shrink-0 text-ink-muted">
                  <Palette className="w-4 h-4" />
                </div>
              </div>

              {/* Version info */}
              <div className="px-3 py-1.5 text-[11px] text-ink-faint flex items-center justify-between">
                <span>{isNative ? 'Android · Offline' : 'v2.0 · Local-First'}</span>
                <span
                  className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                  title={isNative ? 'Android Native Ready' : 'Local Storage Ready'}
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
