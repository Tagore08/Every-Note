import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { notesRepo } from '../../db/notesRepo';

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CaptureModal({ isOpen, onClose }: CaptureModalProps) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autofocus when modal opens
  useEffect(() => {
    if (isOpen) {
      setContent('');
      setIsSaving(false);
      // Small timeout ensures element is mounted and rendered before focus
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global escape key listener when open
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSaving) {
      onClose();
      return;
    }

    try {
      setIsSaving(true);
      await notesRepo.captureNote(trimmed);
      setContent('');
      onClose();
    } catch (err) {
      console.error('Failed to capture note:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Quick capture note"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all transform scale-100">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Quick Capture
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Capture Body */}
        <div className="p-4">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind?..."
            rows={4}
            className="w-full resize-none bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-base sm:text-lg focus:outline-none leading-relaxed"
          />
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/20 text-xs text-slate-500 dark:text-slate-400">
          <div className="hidden sm:flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-300 dark:border-slate-700">
              Enter
            </kbd>
            <span>to save</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-300 dark:border-slate-700">
              Shift+Enter
            </kbd>
            <span>newline</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-300 dark:border-slate-700">
              Esc
            </kbd>
            <span>close</span>
          </div>

          <div className="sm:hidden text-xs text-slate-400">
            Tap Save or press Enter
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!content.trim() || isSaving}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center gap-1.5"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
