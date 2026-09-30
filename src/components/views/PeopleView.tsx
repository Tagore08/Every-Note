import { useState, useRef, type ChangeEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePeople, peopleRepo } from '../../db/peopleRepo';
import { PersonAvatar } from '../people/PersonAvatar';
import { useSnackbar } from '../../context/SnackbarContext';

export function PeopleView() {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const people = usePeople(searchQuery);

  // New person form state
  const [newName, setNewName] = useState('');
  const [newContactInfo, setNewContactInfo] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newPhotoBlob, setNewPhotoBlob] = useState<Blob | null>(null);
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenAddModal = () => {
    setNewName('');
    setNewContactInfo('');
    setNewNotes('');
    setNewPhotoBlob(null);
    setNewPhotoPreview(null);
    setIsAddModalOpen(true);
  };

  const handlePhotoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNewPhotoBlob(file);
    const url = URL.createObjectURL(file);
    setNewPhotoPreview(url);
  };

  const handleCreatePerson = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      showSnackbar({ message: 'Please enter a name for the person' });
      return;
    }

    try {
      const created = await peopleRepo.createPerson({
        name: trimmed,
        contactInfo: newContactInfo.trim() || undefined,
        notes: newNotes.trim() || undefined,
        photoBlob: newPhotoBlob,
      });

      setIsAddModalOpen(false);
      showSnackbar({ message: `Added ${created.name}` });
      if (created.id) {
        navigate(`/people/${created.id}`);
      }
    } catch (err) {
      console.error('Failed to create person:', err);
      showSnackbar({ message: 'Failed to create person' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Subheader Toolbar */}
      <div className="flex flex-row items-center justify-between gap-4 pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          {people.length > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-surface-2 text-ink/70">
              {people.length} {people.length === 1 ? 'person' : 'people'}
            </span>
          )}
          <p className="text-xs text-ink-muted hidden sm:inline">
            Personal connections linked to your events, tasks, and notes.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-accent text-accent-ink hover:opacity-90 shadow-xs transition-opacity cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Person</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <svg
          className="w-4 h-4 absolute left-3.5 top-3 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search people by name..."
          className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* People Grid / List */}
      {people.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {searchQuery ? 'No matching people found' : 'No people added yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No people matched "${searchQuery}". Try a different name.`
                : 'Keep track of people you meet and link them to scheduled events, tasks, or notes.'}
            </p>
          </div>
          {!searchQuery && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Add First Person</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {people.map((person) => {
            const firstContactLine = person.contactInfo?.split('\n').filter(Boolean)[0];
            return (
              <Link
                key={person.id}
                to={`/people/${person.id}`}
                className="group flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs transition-all cursor-pointer"
              >
                <PersonAvatar
                  name={person.name}
                  photoBlob={person.photoBlob}
                  size="md"
                  className="transition-transform group-hover:scale-105"
                />

                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white truncate block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {person.name}
                  </span>
                  {firstContactLine ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate block mt-0.5">
                      {firstContactLine}
                    </span>
                  ) : person.notes ? (
                    <span className="text-xs text-slate-400 dark:text-slate-500 truncate block mt-0.5 italic">
                      {person.notes}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5">
                      Tap to view profile
                    </span>
                  )}
                </div>

                <svg
                  className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            );
          })}
        </div>
      )}

      {/* Add Person Modal */}
      {isAddModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                New Person
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Photo Upload & Preview */}
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative cursor-pointer group"
                >
                  {newPhotoPreview ? (
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-blue-500">
                      <img src={newPhotoPreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <PersonAvatar name={newName || '?'} size="lg" />
                  )}
                  <div className="absolute inset-0 rounded-full bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {newPhotoBlob ? 'Change photo' : 'Add photo (optional)'}
                  </button>
                  <p className="text-[11px] text-slate-400">Stored locally in IndexedDB</p>
                </div>
              </div>

              {/* Name (Required) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Contact info lines (Optional) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Contact Info (optional)
                </label>
                <textarea
                  rows={2}
                  value={newContactInfo}
                  onChange={(e) => setNewContactInfo(e.target.value)}
                  placeholder="email: jane@example.com&#10;phone: +1 555 0192"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono"
                />
              </div>

              {/* Notes (Optional) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Freeform context, role, reminders..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newName.trim()}
                onClick={handleCreatePerson}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white shadow-xs transition-colors cursor-pointer"
              >
                Create Person
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
