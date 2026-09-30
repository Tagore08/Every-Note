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
  maxHeight = 'max-h-[88vh]',
  showClose = true,
}: SheetProps) {
  const shouldReduceMotion = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);

  // Trap focus and close on Escape key (A11y Pass)
  useEffect(() => {
    if (!isOpen) return;
    const container = sheetRef.current;
    if (!container) return;

    // Focus first focusable element
    const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableEls = container.querySelectorAll<HTMLElement>(focusableSelector);
    if (focusableEls.length > 0) {
      setTimeout(() => focusableEls[0].focus(), 50);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const elements = container.querySelectorAll<HTMLElement>(focusableSelector);
        if (elements.length === 0) return;
        const first = elements[0];
        const last = elements[elements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
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
            transition={{ duration: shouldReduceMotion ? 0 : 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/65 dark:bg-black/80"
            aria-hidden="true"
          />

          {/* Sheet container */}
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'sheet-title' : undefined}
            initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0.6 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { type: 'spring', damping: 32, stiffness: 380 }
            }
            className={`relative z-10 w-full sm:max-w-lg bg-surface border-t sm:border border-border/60 rounded-t-sheet sm:rounded-card shadow-pop overflow-hidden flex flex-col ${maxHeight}`}
          >
            {/* Grab handle for touch users — wider & thicker */}
            <div className="pt-4 pb-2 flex justify-center sm:hidden">
              <div className="w-14 h-1.5 rounded-full bg-border" />
            </div>

            {/* Header */}
            {(title || showClose) && (
              <div className="flex items-start justify-between px-6 pt-2 pb-4 border-b border-border/40">
                <div className="pr-4">
                  {title && (
                    <h2 id="sheet-title" className="text-xl font-bold text-ink tracking-tight">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-sm font-medium text-ink-muted mt-1">{description}</p>
                  )}
                </div>
                {showClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 -mr-2 rounded-full text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                    aria-label="Close sheet"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
