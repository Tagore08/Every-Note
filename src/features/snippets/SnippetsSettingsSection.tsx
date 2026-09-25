import { useState } from 'react';
import { snippetsRepo, useSnippets } from '../../db/repos/snippetsRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import type { Snippet } from '../../types/snippet';

export function SnippetsSettingsSection() {
  const snippets = useSnippets();
  const { showSnackbar } = useSnackbar();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  const [trigger, setTrigger] = useState('');
  const [expansion, setExpansion] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreate = () => {
    setEditingSnippet(null);
    setTrigger('#');
    setExpansion('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEdit = (s: Snippet) => {
    setEditingSnippet(s);
    setTrigger(s.trigger);
    setExpansion(s.expansion);
    setDescription(s.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trigger.trim() || !expansion.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      if (editingSnippet?.id) {
        await snippetsRepo.update(editingSnippet.id, {
          trigger: trigger.trim(),
          expansion: expansion.trim(),
          description: description.trim() || undefined,
        });
        showSnackbar({ message: 'Snippet updated' });
      } else {
        await snippetsRepo.create({
          trigger: trigger.trim(),
          expansion: expansion.trim(),
          description: description.trim() || undefined,
        });
        showSnackbar({ message: 'Snippet created' });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save snippet:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id?: number) => {
    if (!id) return;
    try {
      await snippetsRepo.delete(id);
      showSnackbar({ message: 'Snippet deleted' });
    } catch (err) {
      console.error('Failed to delete snippet:', err);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Text Expansion Snippets</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold">
              Smart Typing
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Type triggers like <code className="text-blue-600 dark:text-blue-400 font-mono">#addr</code> in Notes, Tasks, or Capture to instantly expand full text.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <span>+ Add Snippet</span>
        </button>
      </div>

      {snippets.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400">
          No snippets defined yet. Create your first snippet above!
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {snippets.map((snippet) => (
            <div
              key={snippet.id}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300">
                    {snippet.trigger}
                  </span>
                  {snippet.description && (
                    <span className="text-[11px] font-medium text-slate-400 truncate">
                      {snippet.description}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-2 whitespace-pre-wrap font-sans">
                  {snippet.expansion}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(snippet)}
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Edit Snippet"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(snippet.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  title="Delete Snippet"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingSnippet ? 'Edit Snippet' : 'New Snippet'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Trigger Keyword
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="#addr"
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-400">
                  Starts with <code className="font-mono">#</code> (e.g. #addr, #sig, #email)
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Expanded Text
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter full text to replace trigger with..."
                  value={expansion}
                  onChange={(e) => setExpansion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Description / Label (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Home Address"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!trigger.trim() || !expansion.trim() || isSubmitting}
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editingSnippet ? 'Save Changes' : 'Create Snippet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
