import { useEffect, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  maxHeight?: string;
  showClose?: boolean;
}

export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxHeight = 'max-h-[85vh]',
  showClose = true,
}: SheetProps) {
  const shouldReduceMotion = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/60 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Sheet container */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'sheet-title' : undefined}
            initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0.5 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: 'spring', damping: 28, stiffness: 300 }
            }
            className={`relative z-10 w-full sm:max-w-lg bg-surface border-t sm:border border-border rounded-t-sheet sm:rounded-card shadow-float overflow-hidden flex flex-col ${maxHeight}`}
          >
            {/* Grab handle for touch users */}
            <div className="pt-3 pb-1 flex justify-center sm:hidden">
              <div className="w-10 h-1.5 rounded-full bg-border" />
            </div>

            {/* Header */}
            {(title || showClose) && (
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-2/40">
                <div>
                  {title && (
                    <h2 id="sheet-title" className="text-base font-semibold text-ink">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-xs text-ink-muted mt-0.5">{description}</p>
                  )}
                </div>
                {showClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    aria-label="Close sheet"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Scrollable Content */}
            <div className="p-5 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
