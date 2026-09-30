import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Dialog } from '../../design/ui/Dialog';

interface AddLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddLink: (url: string, title?: string) => void;
}

export function AddLinkModal({ isOpen, onClose, onAddLink }: AddLinkModalProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setTitle('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    onAddLink(url.trim(), title.trim() || undefined);
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add Link"
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-ink-muted mb-1.5">
            URL *
          </label>
          <input
            ref={inputRef}
            type="text"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink text-xs focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-muted mb-1.5">
            Title (Optional)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Reference Documentation"
            className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink text-xs focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!url.trim()}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-accent hover:opacity-90 disabled:opacity-50 text-accent-ink shadow-xs transition-opacity cursor-pointer"
          >
            Add Link
          </button>
        </div>
      </form>
    </Dialog>
  );
}

