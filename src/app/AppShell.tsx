import { useState, useEffect, useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { FolderArchive } from 'lucide-react';
import { useSnackbar } from '../context/SnackbarContext';
import { useTheme } from '../hooks/useTheme';
import { useInboxCount, notesRepo } from '../db/notesRepo';
import { useTodoCount } from '../db/tasksRepo';
import { startReminderScheduler } from '../services/reminderService';
import { useFeatureFlags } from './flags';
import { NAV_ITEMS } from './nav';
import { CaptureFab } from './CaptureFab';
import { HamburgerDrawer } from './HamburgerDrawer';
import { BackupGateModal } from '../components/layout/BackupGateModal';
import { runPreUpgradeBackupGate } from '../db/backupGate';
import { CommandPalette } from '../components/layout/CommandPalette';
import { VaultManagerModal } from '../features/vault/VaultManagerModal';
import { localVaultService, type LocalVaultMetadata } from '../services/vault/localVaultService';
import { initSafeArea } from '../services/safeArea';
import { SafeArea } from '../design/ui/SafeArea';
import { OnboardingModal } from '../components/onboarding/OnboardingModal';
import { KeyboardShortcutsModal } from '../components/help/KeyboardShortcutsModal';

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const { showSnackbar } = useSnackbar();
  const { flags } = useFeatureFlags();
  const inboxCount = useInboxCount();
  const todoCount = useTodoCount();

  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('notes_onboarding_completed') !== 'true';
    }
    return false;
  });
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [activeVault, setActiveVault] = useState<LocalVaultMetadata>(() => localVaultService.getActiveVault());

  const isNative = Capacitor.isNativePlatform();

  // Listen for vault metadata changes and modal open events
  useEffect(() => {
    const handleVaultChange = () => {
      setActiveVault(localVaultService.getActiveVault());
    };
    const handleOpenVaultModal = () => {
      setIsVaultModalOpen(true);
    };
    const handleOpenOnboarding = () => {
      setIsOnboardingOpen(true);
    };
    const handleOpenShortcuts = () => {
      setIsShortcutsOpen(true);
    };

    window.addEventListener('vault-changed', handleVaultChange);
    window.addEventListener('open-vault-modal', handleOpenVaultModal);
    window.addEventListener('open-onboarding-modal', handleOpenOnboarding);
    window.addEventListener('open-shortcuts-modal', handleOpenShortcuts);

    return () => {
      window.removeEventListener('vault-changed', handleVaultChange);
      window.removeEventListener('open-vault-modal', handleOpenVaultModal);
      window.removeEventListener('open-onboarding-modal', handleOpenOnboarding);
      window.removeEventListener('open-shortcuts-modal', handleOpenShortcuts);
    };
  }, []);

  // Initialize safe area insets on mobile / native
  useEffect(() => {
    const cleanup = initSafeArea();
    return cleanup;
  }, []);

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
        for (const reg of registrations) reg.unregister();
      });
    }
  }, [isNative]);

  // Native Splash Screen hide
  useEffect(() => {
    if (isNative) {
      SplashScreen.hide().catch((err) => console.debug('Failed to hide splash screen:', err));
    }
  }, [isNative]);

  // Native Status Bar
  useEffect(() => {
    if (isNative) {
      StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch((err) =>
        console.debug('StatusBar style error:', err)
      );
      StatusBar.setBackgroundColor({ color: isDark ? '#1B0C1A' : '#2F172C' }).catch((err) =>
        console.debug('StatusBar bg error:', err)
      );
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
      if (isNative) { r?.unregister(); return; }
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
        action: { label: 'Reload', onClick: () => updateServiceWorker(true) },
        duration: 30000,
      });
    }
  }, [needRefresh, showSnackbar, updateServiceWorker, isNative]);

  useEffect(() => {
    if (isNative) return;
    if (offlineReady) {
      showSnackbar({ message: 'App is cached and ready for offline use', duration: 4000 });
    }
  }, [offlineReady, showSnackbar, isNative]);

  // Auto-purge trash (opt-in via 'notes_auto_purge_trash')
  useEffect(() => {
    const isAutoPurgeEnabled = localStorage.getItem('notes_auto_purge_trash') === 'true';
    if (!isAutoPurgeEnabled) return;

    notesRepo
      .purgeOldTrash(30)
      .then((purgedCount) => {
        if (purgedCount > 0) {
          showSnackbar({
            message: `Auto-purged ${purgedCount} note${purgedCount === 1 ? '' : 's'} older than 30 days`,
            duration: 4000,
          });
        }
      })
      .catch((err) => console.warn('Auto-purge failed:', err));
  }, [showSnackbar]);

  // Global shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
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
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);
        if (!isEditable) {
          e.preventDefault();
          setIsShortcutsOpen((prev) => !prev);
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

  // Determine view title for compact header
  const currentTitle = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith('/today')) return 'Today';
    if (p.startsWith('/notes')) return 'Notes';
    if (p.startsWith('/inbox')) return 'Inbox';
    if (p.startsWith('/scratchpad')) return 'Scratchpad';
    if (p.startsWith('/journal')) return 'Journal';
    if (p.startsWith('/canvas')) return 'Canvas';
    if (p.startsWith('/graph')) return 'Knowledge Graph';
    if (p.startsWith('/tasks')) return 'Tasks';
    if (p.startsWith('/calendar')) return 'Calendar';
    if (p.startsWith('/routines')) return 'Routines';
    if (p.startsWith('/focus')) return 'Focus';
    if (p.startsWith('/habits')) return 'Habits';
    if (p.startsWith('/people')) return 'People';
    if (p.startsWith('/tags')) return 'Tags';
    if (p.startsWith('/text-expansion') || p.startsWith('/snippets') || p.startsWith('/expansions')) return 'Text Replace Shortcut';
    if (p.startsWith('/search')) return 'Search';
    if (p.startsWith('/archive')) return 'Archive';
    if (p.startsWith('/trash')) return 'Trash';
    if (p.startsWith('/settings')) return 'Settings';
    return 'Notes';
  }, [location.pathname]);

  return (
    <div className="flex flex-col h-[100dvh] max-h-[100dvh] w-full bg-bg text-ink items-center overflow-hidden">
      {/* Pre-upgrade safety backup gate dialog */}
      <BackupGateModal />

      {/* Main app container centered on screen for mobile view on desktop */}
      <div className="w-full max-w-lg sm:max-w-2xl md:max-w-4xl h-full flex flex-col bg-bg relative overflow-hidden">
        {/* ── Top Header — Space Optimized Minimal with SafeArea ─────────────── */}
        <SafeArea
          edges={['top']}
          as="header"
          offset={{ top: 8 }}
          className="shrink-0 px-4 pb-2.5 sticky top-0 z-20 bg-bg/90 backdrop-blur-xl border-b border-border/40 flex items-center justify-between min-h-12 box-content transition-all"
        >
          {/* Main navigation stairs-style icon + Brand & Streamlined title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 -ml-2 rounded-xl text-ink hover:text-accent hover:bg-surface-2/60 active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Open navigation menu"
              aria-expanded={isDrawerOpen}
            >
              {/* Stairs style menu icon (descending stepped lines) */}
              <svg className="w-5 h-5 text-ink" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="14" y2="12" />
                <line x1="4" y1="18" x2="8" y2="18" />
              </svg>
            </button>

            {/* App logo + Brand title + current section */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center text-accent-ink shadow-xs shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 leading-tight">
                  <h1 className="font-bold text-sm text-ink tracking-tight truncate">
                    Every Notes
                  </h1>
                  <span className="text-[10px] text-ink-faint hidden xs:inline font-mono">v2.0</span>
                </div>
                <span className="text-[11px] font-medium text-ink-muted capitalize truncate leading-none">
                  {currentTitle}
                </span>
              </div>
            </div>
          </div>

          {/* Header horizontal space: Active Local Vault indicator & switcher */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsVaultModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-border/60 bg-surface-1/80 text-ink/80 hover:text-accent hover:border-accent/40 hover:bg-surface-2 transition-all cursor-pointer shadow-xs active:scale-95"
              title={activeVault.isLinked ? `Vault: ${activeVault.name} (${activeVault.fileCount} files)` : 'Open or link a local folder vault'}
              aria-label="Manage Vault"
            >
              <FolderArchive className="w-3.5 h-3.5 text-accent" />
              <span className="max-w-[120px] truncate sm:max-w-[160px]">
                {activeVault.isLinked ? activeVault.name : 'Vault'}
              </span>
              {activeVault.isLinked && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          </div>
        </SafeArea>

        {/* ── Main Content Area (Single Scroll Owner) ──────────────────────── */}
        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(5.5rem+var(--safe-area-bottom,0px))] px-4 pt-2 sm:px-5">
          <Outlet context={{ openCapture: () => setIsCaptureOpen(true) }} />
        </main>

        {/* ── Clean Floating Bottom-Right Overlay (Search + Plus) ───────────── */}
        <CaptureFab
          isOpen={isCaptureOpen}
          onOpenChange={setIsCaptureOpen}
          showFAB={!location.pathname.startsWith('/canvas')}
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
        />

        {/* Global Command Palette */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onOpenCapture={() => setIsCaptureOpen(true)}
        />

        {/* Hamburger Slide-over Drawer */}
        <HamburgerDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          inboxCount={inboxCount}
          todoCount={todoCount}
          visibleNavItems={visibleNavItems}
        />

        {/* Local Folder Vault Manager Modal */}
        <VaultManagerModal
          isOpen={isVaultModalOpen}
          onClose={() => setIsVaultModalOpen(false)}
        />

        {/* First-Run Onboarding Tour Modal */}
        <OnboardingModal
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
        />

        {/* Keyboard Shortcuts Modal */}
        <KeyboardShortcutsModal
          isOpen={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />
      </div>
    </div>
  );
}
