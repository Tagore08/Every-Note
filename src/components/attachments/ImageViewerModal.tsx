import { useEffect } from 'react';
import type { Attachment } from '../../types/attachment';
import { formatFileSize } from '../../utils/format';

interface ImageViewerModalProps {
  attachment: Attachment | null;
  imageUrl: string | null;
  onClose: () => void;
}

export function ImageViewerModal({ attachment, imageUrl, onClose }: ImageViewerModalProps) {
  useEffect(() => {
    if (!attachment) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attachment, onClose]);

  if (!attachment || !imageUrl) return null;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-between p-4 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150"
    >
      {/* Top Header */}
      <div className="w-full max-w-4xl flex items-center justify-between text-white/90 pb-3">
        <div className="flex flex-col min-w-0 pr-4">
          <span className="font-semibold text-sm sm:text-base truncate">{attachment.name}</span>
          <span className="text-xs text-white/60">{formatFileSize(attachment.size)}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close image viewer"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="flex-1 w-full max-w-4xl flex items-center justify-center p-2 min-h-0 overflow-hidden">
        <img
          src={imageUrl}
          alt={attachment.name}
          className="max-h-full max-w-full object-contain rounded-lg shadow-2xl transition-transform"
        />
      </div>

      {/* Bottom Hint */}
      <div className="text-xs text-white/40 pt-2">
        Press <kbd className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white/70">Esc</kbd> or click outside to dismiss
      </div>
    </div>
  );
}
