import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { usePeople, peopleRepo } from '../../db/peopleRepo';
import { PersonAvatar } from './PersonAvatar';
import { Dialog } from '../../design/ui/Dialog';

interface PersonPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPersonId?: number | null;
  onSelectPerson: (personId: number | null) => void;
}

export function PersonPickerModal({
  isOpen,
  onClose,
  selectedPersonId,
  onSelectPerson,
}: PersonPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const people = usePeople(searchQuery);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setNewName('');
      setIsCreating(false);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleCreateNew = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    try {
      setIsCreating(true);
      const newPerson = await peopleRepo.createPerson({ name: trimmed });
      if (newPerson.id) {
        onSelectPerson(newPerson.id);
      }
      onClose();
    } catch (err) {
      console.error('Failed to create person:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleNewNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateNew();
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="👤 With Person"
      size="sm"
    >
      <div className="space-y-4">
        {/* Search input */}
        <div>
          <div className="relative">
            <svg
              className="w-3.5 h-3.5 absolute left-3 top-2.5 text-ink-muted pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* People list */}
        <div className="max-h-48 overflow-y-auto space-y-1 overscroll-contain">
          {people.length === 0 ? (
            <p className="text-xs text-ink-muted text-center py-4">
              {searchQuery ? 'No people match your search' : 'No people saved yet'}
            </p>
          ) : (
            people.map((person) => {
              const isSelected = selectedPersonId === person.id;
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    if (person.id) {
                      onSelectPerson(person.id);
                    }
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-accent/15 text-accent font-semibold'
                      : 'hover:bg-surface-2 text-ink'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PersonAvatar name={person.name} photoBlob={person.photoBlob} size="sm" />
                    <span className="text-xs truncate">{person.name}</span>
                  </div>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Inline Create New Person */}
        <div className="pt-2 border-t border-border/60 space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Create New Person Inline
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleNewNameKeyDown}
              placeholder="Name only required..."
              className="flex-1 px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={!newName.trim() || isCreating}
              onClick={handleCreateNew}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent hover:opacity-90 disabled:opacity-40 text-accent-ink transition-opacity cursor-pointer shrink-0 shadow-xs"
            >
              {isCreating ? 'Adding...' : '+ Add'}
            </button>
          </div>
        </div>

        {/* Footer with Clear & Cancel */}
        <div className="flex items-center justify-between pt-2 border-t border-border/60">
          <div>
            {selectedPersonId && (
              <button
                type="button"
                onClick={() => {
                  onSelectPerson(null);
                  onClose();
                }}
                className="text-xs text-rose-500 hover:underline cursor-pointer"
              >
                Clear person
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </Dialog>
  );
}
