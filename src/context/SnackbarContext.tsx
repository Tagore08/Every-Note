import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react';

export interface SnackbarAction {
  label: string;
  onClick: () => void | Promise<void>;
}

export interface SnackbarOptions {
  message: string;
  action?: SnackbarAction;
  duration?: number; // ms, defaults to 6000
}

interface SnackbarContextType {
  showSnackbar: (options: SnackbarOptions) => void;
  showUndo: (message: string, undoFn: () => void | Promise<void>, duration?: number) => void;
  hideSnackbar: () => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [currentSnackbar, setCurrentSnackbar] = useState<(SnackbarOptions & { id: number }) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideSnackbar = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setCurrentSnackbar(null);
  }, []);

  const showSnackbar = useCallback(
    (options: SnackbarOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      const id = Date.now();
      const duration = options.duration ?? 6000;

      setCurrentSnackbar({
        ...options,
        id,
      });

      timerRef.current = setTimeout(() => {
        setCurrentSnackbar((current) => (current?.id === id ? null : current));
        timerRef.current = null;
      }, duration);
    },
    []
  );

  const showUndo = useCallback(
    (message: string, undoFn: () => void | Promise<void>, duration = 6000) => {
      showSnackbar({
        message,
        action: {
          label: 'Undo',
          onClick: undoFn,
        },
        duration,
      });
    },
    [showSnackbar]
  );

  const handleActionClick = async () => {
    if (currentSnackbar?.action) {
      const action = currentSnackbar.action;
      hideSnackbar();
      try {
        await action.onClick();
      } catch (err) {
        console.error('Snackbar action failed:', err);
      }
    }
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar, showUndo, hideSnackbar }}>
      {children}

      {/* Floating Global Snackbar */}
      {currentSnackbar && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm sm:max-w-md w-[calc(100%-2rem)] flex items-center justify-between gap-3 px-4 py-2.5 rounded-card bg-surface text-ink shadow-float border border-border text-sm transition-all"
        >
          <span className="font-medium text-xs sm:text-sm truncate">
            {currentSnackbar.message}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {currentSnackbar.action && (
              <button
                type="button"
                onClick={handleActionClick}
                className="px-3 py-1 rounded-pill text-xs font-semibold text-accent bg-accent-soft hover:opacity-90 transition-opacity cursor-pointer min-h-[44px] flex items-center"
              >
                {currentSnackbar.action.label}
              </button>
            )}

            <button
              type="button"
              onClick={hideSnackbar}
              className="p-2 rounded-lg text-ink-muted hover:text-ink transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Dismiss notification"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
}
