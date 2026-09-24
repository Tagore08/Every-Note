import { useState, useEffect } from 'react';
import { getInitials, getAvatarColor } from '../../utils/format';

interface PersonAvatarProps {
  name: string;
  photoBlob?: Blob | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-10 h-10 text-sm font-semibold',
  lg: 'w-16 h-16 text-xl font-bold',
  xl: 'w-24 h-24 text-3xl font-bold sm:w-28 sm:h-28',
};

export function PersonAvatar({
  name,
  photoBlob,
  size = 'md',
  className = '',
}: PersonAvatarProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoBlob) {
      setPhotoUrl(null);
      return;
    }

    try {
      const url = URL.createObjectURL(photoBlob);
      setPhotoUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (err) {
      console.warn('Failed to create object URL for photo blob:', err);
      setPhotoUrl(null);
    }
  }, [photoBlob]);

  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const colorClass = getAvatarColor(name);
  const initials = getInitials(name);

  if (photoUrl) {
    return (
      <div
        className={`relative shrink-0 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 ${sizeClass} ${className}`}
      >
        <img
          src={photoUrl}
          alt={name || 'Avatar'}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center border font-sans select-none tracking-tight ${sizeClass} ${colorClass} ${className}`}
    >
      {initials}
    </div>
  );
}
