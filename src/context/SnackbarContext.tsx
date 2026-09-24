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
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm sm:max-w-md w-[calc(100%-2rem)] flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-slate-900 text-slate-100 dark:bg-white dark:text-slate-900 shadow-2xl border border-slate-700/50 dark:border-slate-200/80 text-sm animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <span className="font-medium text-xs sm:text-sm truncate">
            {currentSnackbar.message}
          </span>

          <div className="flex items-center gap-2 shrink-0">
            {currentSnackbar.action && (
              <button
                type="button"
                onClick={handleActionClick}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-blue-400 hover:text-blue-300 dark:text-blue-600 dark:hover:text-blue-700 bg-slate-800 hover:bg-slate-700 dark:bg-blue-50 dark:hover:bg-blue-100 transition-colors"
              >
                {currentSnackbar.action.label}
              </button>
            )}

            <button
              type="button"
              onClick={hideSnackbar}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 dark:text-slate-500 dark:hover:text-slate-800 transition-colors"
              aria-label="Dismiss notification"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
