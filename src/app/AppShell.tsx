import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import {
  Home,
  Search,
  Calendar,
  Library as LibraryIcon,
  Inbox,
  BookOpen,
  Palette,
  FileText,
  Network,
  Compass,
  Users,
  Tag,
  CheckSquare,
  LayoutGrid,
  Repeat,
  Target,
  Timer,
  Settings,
  Archive,
  Trash2,
  FlaskConical,
  Sun,
  Moon,
  Sparkles,
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useSnackbar } from '../context/SnackbarContext';
import { useTheme } from '../hooks/useTheme';
import { useInboxCount, notesRepo } from '../db/notesRepo';
import { useTodoCount } from '../db/tasksRepo';
import { startReminderScheduler } from '../services/reminderService';
import { useFeatureFlags } from './flags';
import { NAV_ITEMS, NAV_GROUPS } from './nav';
import { CaptureFab } from './CaptureFab';
import { Sheet } from '../design/ui/Sheet';
import { BackupGateModal } from '../components/layout/BackupGateModal';
import { runPreUpgradeBackupGate } from '../db/backupGate';

const ICON_MAP: Record<string, ReactNode> = {
  Home: <Home className="w-5 h-5" strokeWidth={1.75} />,
  Search: <Search className="w-5 h-5" strokeWidth={1.75} />,
  Calendar: <Calendar className="w-5 h-5" strokeWidth={1.75} />,
  Library: <LibraryIcon className="w-5 h-5" strokeWidth={1.75} />,
  Inbox: <Inbox className="w-5 h-5" strokeWidth={1.75} />,
  BookOpen: <BookOpen className="w-5 h-5" strokeWidth={1.75} />,
  Palette: <Palette className="w-5 h-5" strokeWidth={1.75} />,
  FileText: <FileText className="w-5 h-5" strokeWidth={1.75} />,
  Network: <Network className="w-5 h-5" strokeWidth={1.75} />,
  Compass: <Compass className="w-5 h-5" strokeWidth={1.75} />,
  Users: <Users className="w-5 h-5" strokeWidth={1.75} />,
  Tag: <Tag className="w-5 h-5" strokeWidth={1.75} />,
  CheckSquare: <CheckSquare className="w-5 h-5" strokeWidth={1.75} />,
  LayoutGrid: <LayoutGrid className="w-5 h-5" strokeWidth={1.75} />,
  Repeat: <Repeat className="w-5 h-5" strokeWidth={1.75} />,
  Target: <Target className="w-5 h-5" strokeWidth={1.75} />,
  Timer: <Timer className="w-5 h-5" strokeWidth={1.75} />,
  Settings: <Settings className="w-5 h-5" strokeWidth={1.75} />,
  Archive: <Archive className="w-5 h-5" strokeWidth={1.75} />,
  Trash2: <Trash2 className="w-5 h-5" strokeWidth={1.75} />,
  FlaskConical: <FlaskConical className="w-5 h-5" strokeWidth={1.75} />,
  Sparkles: <Sparkles className="w-5 h-5" strokeWidth={1.75} />,
  Plus: <Plus className="w-6 h-6" strokeWidth={2.5} />,
};

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleTheme, isDark } = useTheme();
  const { showSnackbar } = useSnackbar();
  const { flags } = useFeatureFlags();
  const inboxCount = useInboxCount();
  const todoCount = useTodoCount();

  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const isNative = Capacitor.isNativePlatform();

  // Initialize backup gate on app boot
  useEffect(() => {
    runPreUpgradeBackupGate().catch((err) => {
      console.warn('Backup gate check failed:', err);
    });
  }, []);

  // Native WebView service worker cleanup
  useEffect(() => {
    if (isNative && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const reg of registrations) {
          reg.unregister();
        }
      });
    }
  }, [isNative]);

  // Native Splash Screen hide
  useEffect(() => {
    if (isNative) {
      SplashScreen.hide().catch((err) => {
        console.debug('Failed to hide splash screen:', err);
      });
    }
  }, [isNative]);

  // Native Status Bar
  useEffect(() => {
    if (isNative) {
      StatusBar.setStyle({
        style: isDark ? Style.Dark : Style.Light,
      }).catch((err) => console.debug('StatusBar style error:', err));

      StatusBar.setBackgroundColor({
        color: isDark ? '#171720' : '#f8fafc',
      }).catch((err) => console.debug('StatusBar bg error:', err));
    }
  }, [isNative, isDark]);

  // Reminders scheduler
  useEffect(() => {
    const cleanup = startReminderScheduler(navigate);
    return cleanup;
  }, [navigate]);

  // PWA Service Worker
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: !isNative,
    onRegistered(r) {
      if (isNative) {
        r?.unregister();
        return;
      }
      if (r) {
        setInterval(() => {
          r.update().catch((e) => console.debug('SW check failed:', e));
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      if (!isNative) console.warn('SW registration failed:', error);
    },
  });

  useEffect(() => {
    if (isNative) return;
    if (needRefresh) {
      showSnackbar({
        message: 'Update available — reload to apply latest changes',
        action: {
          label: 'Reload',
          onClick: () => updateServiceWorker(true),
        },
        duration: 30000,
      });
    }
  }, [needRefresh, showSnackbar, updateServiceWorker, isNative]);

  useEffect(() => {
    if (isNative) return;
    if (offlineReady) {
      showSnackbar({
        message: 'App is cached and ready for offline use',
        duration: 4000,
      });
    }
  }, [offlineReady, showSnackbar, isNative]);

  // Auto-purge trash
  useEffect(() => {
    notesRepo.purgeOldTrash(30).catch((err) => console.warn('Auto-purge failed:', err));
  }, []);

  // Global capture shortcut ('n' outside inputs, Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCaptureOpen(true);
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);

        if (!isEditable && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          setIsCaptureOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter nav items by feature flags
  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (!item.flag) return true;
      return flags[item.flag] === true;
    });
  }, [flags]);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  // Find active nav item name
  const currentItem =
    visibleNavItems.find((item) => location.pathname.startsWith(item.route)) ??
    (location.pathname.startsWith('/today') || location.pathname === '/'
      ? { label: 'Today' }
      : { label: 'Notes App' });

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-bg text-ink transition-colors">
      {/* Pre-upgrade safety backup gate dialog */}
      <BackupGateModal />

      {/* Desktop Grouped Collapsible Sidebar (visible on md+) */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-border bg-surface/80 backdrop-blur-md sticky top-0 h-screen p-4 justify-between z-30">
        <div className="space-y-4 overflow-y-auto pr-1">
          {/* Brand Logo */}
          <Link
            to="/today"
            className="flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg hover:bg-surface-2 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-accent-ink shadow-card">
              <FileText className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight tracking-tight text-ink">
                Notes App
              </h1>
              <p className="text-[11px] text-ink-muted">v2.0 Local-First</p>
            </div>
          </Link>

          {/* Desktop Capture Action */}
          <button
            type="button"
            onClick={() => setIsCaptureOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-pill text-sm font-semibold bg-accent hover:opacity-90 active:scale-[0.98] text-accent-ink shadow-card transition-all cursor-pointer min-h-[44px]"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              <span>Capture</span>
            </div>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 text-accent-ink font-mono">
              N
            </kbd>
          </button>

          {/* Grouped Navigation */}
          <nav className="space-y-4 pt-1">
            {NAV_GROUPS.map((group) => {
              const itemsInGroup = visibleNavItems.filter((i) => i.group === group.id);
              if (itemsInGroup.length === 0) return null;
              const isCollapsed = collapsedGroups[group.id] ?? false;

              return (
                <div key={group.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(group.id)}
                    className="w-full flex items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink transition-colors cursor-pointer"
                  >
                    <span>{group.label}</span>
                    <span className="text-ink-muted">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="space-y-0.5">
                      {itemsInGroup.map((item) => (
                        <NavLink
                          key={item.route}
                          to={item.route}
                          className={({ isActive }) =>
                            `flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all min-h-[38px] ${
                              isActive
                                ? 'bg-accent-soft text-accent font-semibold shadow-xs'
                                : 'text-ink-muted hover:text-ink hover:bg-surface-2'
                            }`
                          }
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="shrink-0">{ICON_MAP[item.iconName]}</span>
                            <span>{item.label}</span>
                          </div>

                          {item.badgeKey === 'inbox' && inboxCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-accent-ink">
                              {inboxCount}
                            </span>
                          )}
                          {item.badgeKey === 'tasks' && todoCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-accent-ink">
                              {todoCount}
                            </span>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-3 border-t border-border space-y-2">
          <button
            onClick={toggleTheme}
            type="button"
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs font-medium text-ink-muted hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px]"
            aria-label="Toggle theme mode"
          >
            <span className="flex items-center gap-2 text-ink">
              {isDark ? (
                <Moon className="w-4 h-4 text-accent" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              <span>Theme</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded capitalize bg-surface-2 text-ink-muted border border-border">
              {mode}
            </span>
          </button>

          <div className="px-3 py-1 text-[11px] text-ink-muted flex items-center justify-between">
            <span>{isNative ? 'Android · Offline' : 'v2.0 · Local-First'}</span>
            <span
              className="w-2 h-2 rounded-full bg-emerald-500"
              title={isNative ? 'Android Native Ready' : 'Local Storage Ready'}
            />
          </div>
        </div>
      </aside>

      {/* Mobile Top Header (visible on <md) */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-20">
        <Link to="/today" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-accent-ink shadow-xs">
            <FileText className="w-4 h-4" strokeWidth={2} />
          </div>
          <span className="font-bold text-sm text-ink">Notes App</span>
          <span className="text-xs text-ink-muted">· {currentItem.label}</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to="/search"
            className="p-2 rounded-lg text-ink-muted hover:bg-surface-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            title="Search"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </Link>

          <button
            onClick={toggleTheme}
            type="button"
            className="p-2 rounded-lg text-ink-muted hover:bg-surface-2 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle theme mode"
          >
            {isDark ? (
              <Moon className="w-4 h-4 text-accent" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-6 p-4 sm:p-6 lg:p-8">
        <Outlet context={{ openCapture: () => setIsCaptureOpen(true) }} />
      </main>

      {/* Capture FAB component (mobile floating action button + sheet) */}
      <CaptureFab
        isOpen={isCaptureOpen}
        onOpenChange={setIsCaptureOpen}
        showFAB={true}
      />

      {/* Mobile 5-Slot Bottom Navigation per EXPANSION_PLAN §3.1 */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface/90 backdrop-blur-lg border-t border-border z-30 px-2 py-1 flex items-center justify-around">
        {/* 1. Today */}
        <NavLink
          to="/today"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[11px] font-medium transition-colors min-h-[44px] ${
              isActive
                ? 'text-accent font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`
          }
        >
          <Home className="w-5 h-5" strokeWidth={1.75} />
          <span className="mt-1">Today</span>
        </NavLink>

        {/* 2. Search */}
        <NavLink
          to="/search"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[11px] font-medium transition-colors min-h-[44px] ${
              isActive
                ? 'text-accent font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`
          }
        >
          <Search className="w-5 h-5" strokeWidth={1.75} />
          <span className="mt-1">Search</span>
        </NavLink>

        {/* 3. Empty slot spacer for center FAB */}
        <div className="w-12 h-10 flex items-center justify-center">
          {/* FAB floats above */}
        </div>

        {/* 4. Calendar */}
        <NavLink
          to="/calendar"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[11px] font-medium transition-colors min-h-[44px] ${
              isActive
                ? 'text-accent font-semibold'
                : 'text-ink-muted hover:text-ink'
            }`
          }
        >
          <Calendar className="w-5 h-5" strokeWidth={1.75} />
          <span className="mt-1">Calendar</span>
        </NavLink>

        {/* 5. Library Sheet Trigger */}
        <button
          type="button"
          onClick={() => setIsLibraryOpen(true)}
          className="flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[11px] font-medium text-ink-muted hover:text-ink transition-colors cursor-pointer min-h-[44px]"
          aria-label="Open Library drawer"
        >
          <LibraryIcon className="w-5 h-5" strokeWidth={1.75} />
          <span className="mt-1">Library</span>
        </button>
      </nav>

      {/* Mobile Library Bottom Sheet */}
      <Sheet
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        title="Library & Navigation"
        description="All workspaces, views, and system settings"
      >
        <div className="space-y-5 pb-4">
          {NAV_GROUPS.map((group) => {
            const itemsInGroup = visibleNavItems.filter((i) => i.group === group.id);
            if (itemsInGroup.length === 0) return null;

            return (
              <div key={group.id} className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted px-1">
                  {group.label}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {itemsInGroup.map((item) => (
                    <NavLink
                      key={item.route}
                      to={item.route}
                      onClick={() => setIsLibraryOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between p-3 rounded-card text-xs font-medium border transition-colors min-h-[44px] ${
                          isActive
                            ? 'bg-accent-soft text-accent border-accent/30 font-semibold'
                            : 'bg-surface-2 text-ink border-border hover:bg-surface'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span className="shrink-0">{ICON_MAP[item.iconName]}</span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badgeKey === 'inbox' && inboxCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-accent text-accent-ink shrink-0">
                          {inboxCount}
                        </span>
                      )}
                      {item.badgeKey === 'tasks' && todoCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-accent text-accent-ink shrink-0">
                          {todoCount}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
