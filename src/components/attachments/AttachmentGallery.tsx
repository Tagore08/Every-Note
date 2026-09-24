import { useState, useEffect, useMemo } from 'react';
import type { Attachment } from '../../types/attachment';
import { formatFileSize } from '../../utils/format';
import { ImageViewerModal } from './ImageViewerModal';

interface AttachmentGalleryProps {
  attachments: Attachment[];
  onDeleteAttachment: (id: number) => void;
}

export function AttachmentGallery({ attachments, onDeleteAttachment }: AttachmentGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<Attachment | null>(null);

  // Group attachments by kind
  const imageAttachments = useMemo(
    () => attachments.filter((a) => a.kind === 'image' && a.data),
    [attachments]
  );
  const fileAttachments = useMemo(
    () => attachments.filter((a) => a.kind === 'file'),
    [attachments]
  );
  const linkAttachments = useMemo(
    () => attachments.filter((a) => a.kind === 'link'),
    [attachments]
  );

  // Map of attachment id -> Object URL for image rendering
  const [objectUrls, setObjectUrls] = useState<Record<number, string>>({});

  useEffect(() => {
    const urls: Record<number, string> = {};
    for (const att of imageAttachments) {
      if (att.id && att.data) {
        urls[att.id] = URL.createObjectURL(att.data);
      }
    }
    setObjectUrls(urls);

    return () => {
      // Clean up object URLs on unmount or update
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [imageAttachments]);

  const handleDownloadFile = (att: Attachment) => {
    if (!att.data) return;
    const url = URL.createObjectURL(att.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (attachments.length === 0) return null;

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <span>Attachments ({attachments.length})</span>
      </div>

      {/* 1. Image Thumbnails Grid */}
      {imageAttachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {imageAttachments.map((att) => {
            const url = att.id ? objectUrls[att.id] : undefined;
            if (!url) return null;

            return (
              <div
                key={att.id}
                className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 overflow-hidden shadow-xs hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer"
                onClick={() => setSelectedImage(att)}
              >
                <div className="aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                  <img
                    src={url}
                    alt={att.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                </div>

                {/* Overlay with info & delete */}
                <div className="p-2 flex items-center justify-between bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                  <div className="truncate pr-1">
                    <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{att.name}</p>
                    <p className="text-slate-400 text-[10px]">{formatFileSize(att.size)}</p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (att.id) onDeleteAttachment(att.id);
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                    title="Remove image"
                    aria-label="Remove image"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. File Attachments (Includes .heic per requirements) */}
      {fileAttachments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {fileAttachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all"
            >
              <div
                onClick={() => handleDownloadFile(att)}
                className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                title="Tap to download file"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate hover:text-blue-600 transition-colors">
                    {att.name}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    {formatFileSize(att.size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(att)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                  title="Download file"
                  aria-label="Download file"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (att.id) onDeleteAttachment(att.id);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  title="Remove file"
                  aria-label="Remove file"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Link Attachments */}
      {linkAttachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {linkAttachments.map((att) => (
            <div
              key={att.id}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs shadow-xs hover:border-blue-400 dark:hover:border-blue-500 transition-colors group"
            >
              <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>

              <a
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:underline max-w-[200px] truncate"
              >
                {att.name}
              </a>

              <svg className="w-3 h-3 text-slate-400 group-hover:text-blue-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>

              <button
                type="button"
                onClick={() => {
                  if (att.id) onDeleteAttachment(att.id);
                }}
                className="ml-1 p-0.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                title="Remove link"
                aria-label="Remove link"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Image Modal */}
      <ImageViewerModal
        attachment={selectedImage}
        imageUrl={selectedImage?.id ? objectUrls[selectedImage.id] ?? null : null}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}
