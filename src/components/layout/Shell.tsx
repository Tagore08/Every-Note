import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useSnackbar } from '../../context/SnackbarContext';
import { useTheme } from '../../hooks/useTheme';
import { useInboxCount, notesRepo } from '../../db/notesRepo';
import { useTodoCount } from '../../db/tasksRepo';
import { startReminderScheduler } from '../../services/reminderService';
import { CaptureModal } from '../capture/CaptureModal';

interface NavItem {
  name: string;
  path: string;
  icon: (active: boolean) => React.ReactNode;
}

const mainNavItems: NavItem[] = [
  {
    name: 'Inbox',
    path: '/inbox',
    icon: (active) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
  },
  {
    name: 'Notes',
    path: '/notes',
    icon: (active) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    name: 'Tasks',
    path: '/tasks',
    icon: (active) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    name: 'Calendar',
    path: '/calendar',
    icon: (active) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    name: 'Search',
    path: '/search',
    icon: (active) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    name: 'Tags',
    path: '/tags',
    icon: (active) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
        <line x1="7" y1="7" x2="7.01" y2="7" />
      </svg>
    ),
  },
];


const storageNavItems: NavItem[] = [
  {
    name: 'Archive',
    path: '/archive',
    icon: (active) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="3" width="20" height="5" rx="1" />
        <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
        <path d="M10 12h4" />
      </svg>
    ),
  },
  {
    name: 'Trash',
    path: '/trash',
    icon: (active) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    ),
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: (active) => (
      <svg
        className={`w-5 h-5 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const mobileBottomNavItems: NavItem[] = [
  mainNavItems[0], // Inbox
  mainNavItems[1], // Notes
  mainNavItems[2], // Tasks
  mainNavItems[3], // Calendar
  storageNavItems[2], // Settings
];

export function Shell() {
  const navigate = useNavigate();
  const { mode, toggleTheme } = useTheme();
  const { showSnackbar } = useSnackbar();
  const location = useLocation();
  const inboxCount = useInboxCount();
  const todoCount = useTodoCount();
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);

  // Initialize reminder scheduler loop on app mount
  useEffect(() => {
    const cleanup = startReminderScheduler(navigate);
    return cleanup;
  }, [navigate]);


  // PWA Service Worker Registration & Update Notification
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates periodically (e.g. every 60 minutes)
        setInterval(() => {
          r.update().catch((e) => console.debug('SW check failed:', e));
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn('SW registration failed:', error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      showSnackbar({
        message: 'Update available — reload to apply latest changes',
        action: {
          label: 'Reload',
          onClick: () => {
            updateServiceWorker(true);
          },
        },
        duration: 30000,
      });
    }
  }, [needRefresh, showSnackbar, updateServiceWorker]);

  useEffect(() => {
    if (offlineReady) {
      showSnackbar({
        message: 'App is cached and ready for offline use',
        duration: 4000,
      });
    }
  }, [offlineReady, showSnackbar]);

  // Auto-purge trashed notes older than 30 days on app mount
  useEffect(() => {
    notesRepo.purgeOldTrash(30).catch((err) => {
      console.warn('Auto-purge trash failed:', err);
    });
  }, []);

  // Global keyboard shortcuts: Ctrl/Cmd+K or 'n'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCaptureOpen(true);
        return;
      }

      // 'n' when not typing in an input/textarea
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

  const allNavItems = [...mainNavItems, ...storageNavItems];
  const currentItem =
    allNavItems.find((item) => location.pathname.startsWith(item.path)) ?? mainNavItems[0];

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Desktop Sidebar (visible on md+) */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 h-screen p-4 justify-between">
        <div className="space-y-5">
          {/* Logo / App Name */}
          <Link to="/inbox" className="flex items-center gap-3 px-3 py-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white shadow-sm">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight tracking-tight">Notes App</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">Local-First</p>
            </div>
          </Link>

          {/* Desktop Capture Action */}
          <button
            type="button"
            onClick={() => setIsCaptureOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Capture</span>
            </div>
            <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-blue-700/80 text-blue-100 font-mono border border-blue-500/50">
              N
            </kbd>
          </button>

          {/* Main Navigation Links */}
          <div className="space-y-1">
            <nav className="space-y-1">
              {mainNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-3">
                        {item.icon(isActive)}
                        <span>{item.name}</span>
                      </div>
                      {item.name === 'Inbox' && inboxCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200">
                          {inboxCount}
                        </span>
                      )}
                      {item.name === 'Tasks' && todoCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200">
                          {todoCount}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Storage section in sidebar */}
            <div className="pt-4">
              <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Storage
              </div>
              <nav className="space-y-1">
                {storageNavItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/60'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {item.icon(isActive)}
                        <span>{item.name}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <button
            onClick={toggleTheme}
            type="button"
            className="flex items-center justify-between w-full px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle theme mode"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
              <span>Theme</span>
            </span>
            <span className="text-xs px-2 py-0.5 rounded capitalize bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              {mode}
            </span>
          </button>

          <div className="px-3 py-1 text-xs text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>Stage 4 · Offline PWA</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Offline PWA Ready" />
          </div>
        </div>
      </aside>

      {/* Mobile Top Header (visible on <md) */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20">
        <Link to="/inbox" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <span className="font-bold text-sm">Notes App</span>
          <span className="text-xs text-slate-400 dark:text-slate-500">· {currentItem.name}</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to="/archive"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Archive"
            aria-label="Archive"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="5" rx="1" />
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
            </svg>
          </Link>

          <Link
            to="/trash"
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Trash"
            aria-label="Trash"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            </svg>
          </Link>

          <button
            onClick={toggleTheme}
            type="button"
            className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle theme mode"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 md:pb-6 p-4 sm:p-6 lg:p-8">
        <Outlet context={{ openCapture: () => setIsCaptureOpen(true) }} />
      </main>

      {/* Mobile Floating Action Button (FAB) for Instant Capture */}
      <button
        type="button"
        onClick={() => setIsCaptureOpen(true)}
        className="md:hidden fixed bottom-18 right-4 z-40 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-xl flex items-center justify-center transition-all cursor-pointer border border-blue-400/30"
        aria-label="Quick capture note"
      >
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Mobile Bottom Navigation (visible on <md) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-30 px-2 py-1 flex items-center justify-around">
        {mobileBottomNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  {item.icon(isActive)}
                  {item.name === 'Inbox' && inboxCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      {inboxCount > 99 ? '99+' : inboxCount}
                    </span>
                  )}
                  {item.name === 'Tasks' && todoCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      {todoCount > 99 ? '99+' : todoCount}
                    </span>
                  )}
                </div>
                <span className="mt-1 text-[11px]">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Global Capture Modal */}
      <CaptureModal isOpen={isCaptureOpen} onClose={() => setIsCaptureOpen(false)} />
    </div>
  );
}
