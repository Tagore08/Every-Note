import { usePerson } from '../../db/peopleRepo';
import { PersonAvatar } from './PersonAvatar';

interface PersonBadgeProps {
  personId?: number | null;
  onClick?: () => void;
  onClear?: () => void;
  size?: 'xs' | 'sm';
}

export function PersonBadge({
  personId,
  onClick,
  onClear,
  size = 'sm',
}: PersonBadgeProps) {
  const person = usePerson(personId);

  if (!personId || !person) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 ${
        size === 'xs' ? 'text-[11px]' : 'text-xs'
      } ${onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600' : ''}`}
      onClick={onClick}
    >
      <PersonAvatar
        name={person.name}
        photoBlob={person.photoBlob}
        size={size === 'xs' ? 'xs' : 'sm'}
      />
      <span className="font-medium truncate max-w-[120px]">{person.name}</span>
      {onClear && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="p-0.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
          title="Remove person"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </span>
  );
}
