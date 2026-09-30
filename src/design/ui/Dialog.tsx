import { useEffect, useRef, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  role?: 'dialog' | 'alertdialog';
  ariaLabel?: string;
  className?: string;
  headerAction?: ReactNode;
  footer?: ReactNode;
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-4xl',
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnEscape = true,
  closeOnBackdropClick = true,
  role = 'dialog',
  ariaLabel,
  className = '',
  headerAction,
  footer,
}: DialogProps) {
  const dialogId = useId();
  const titleId = `${dialogId}-title`;
  const descId = `${dialogId}-desc`;

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap & Escape listener
  useEffect(() => {
    if (!isOpen) return;

    // Cache active element before dialog opened
    previousActiveElement.current = document.activeElement as HTMLElement | null;

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus first focusable element
    const timer = setTimeout(() => {
      if (!dialogRef.current) return;
      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        dialogRef.current.focus();
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null); // only visible

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || document.activeElement === dialogRef.current) {
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

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);

      // Restore previously focused element
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role={role}
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description ? descId : undefined}
      aria-label={!title ? ariaLabel : undefined}
      tabIndex={-1}
      onClick={(e) => {
        if (closeOnBackdropClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`w-full ${SIZE_CLASSES[size]} rounded-2xl bg-surface border border-border text-ink shadow-float overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)] animate-in zoom-in-95 duration-150 focus:outline-none ${className}`}
      >
        {/* Header */}
        {(title || showCloseButton || headerAction) && (
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/70 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              {title && (
                <h3 id={titleId} className="text-sm font-bold text-ink truncate">
                  {title}
                </h3>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {headerAction}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close dialog"
                  className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Optional Description */}
        {description && (
          <div id={descId} className="px-5 pt-2 text-xs text-ink-muted shrink-0">
            {description}
          </div>
        )}

        {/* Content body */}
        <div className="p-5 overflow-y-auto flex-1 overscroll-contain">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-border/70 bg-surface-2/30 flex items-center justify-end gap-2 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Dialog;
