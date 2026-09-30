import { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  Tag,
  Plus,
  Search,
  Copy,
  Check,
  Edit2,
  Trash2,
  Pencil,
  X,
} from 'lucide-react';
import { snippetsRepo, useSnippets } from '../../db/repos/snippetsRepo';
import { notesRepo, useTagsWithCounts } from '../../db/notesRepo';
import { useSnackbar } from '../../context/SnackbarContext';
import type { Snippet } from '../../types/snippet';
import { sanitizeTag, sanitizeTags } from '../../lib/tags';

export interface ShortcutTemplate {
  tag: string;
  name: string;
  trigger: string;
  placeholder: string;
}

export const SHORTCUT_TEMPLATES: ShortcutTemplate[] = [
  {
    tag: '#address',
    name: 'Home / Office Address',
    trigger: '#address',
    placeholder: '123 Avenue, Suite 100, City, State, ZIP',
  },
  {
    tag: '#email',
    name: 'Primary Email Address',
    trigger: '#email',
    placeholder: 'hello@example.com',
  },
  {
    tag: '#number',
    name: 'Phone / Mobile Number',
    trigger: '#number',
    placeholder: '+1 (555) 012-3456',
  },
  {
    tag: '#link',
    name: 'Quick Link / URL',
    trigger: '#link',
    placeholder: 'https://meet.google.com/abc-defg-hij',
  },
];

export function TextExpansionAndTagsSection() {
  const snippets = useSnippets();
  const tagList = useTagsWithCounts() || [];
  const { showSnackbar } = useSnackbar();

  // On mount, purge legacy seed shortcuts (#addr 123 Main Street) if present
  useEffect(() => {
    snippetsRepo.purgeDemoShortcuts().catch((err) => {
      console.debug('Purge demo shortcuts error:', err);
    });
  }, []);

  // ── Search & Filter State ───────────────────────────────────────────────────
  const [snippetSearch, setSnippetSearch] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);

  // ── Snippet Modal State ─────────────────────────────────────────────────────
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Form fields
  const [trigger, setTrigger] = useState('');
  const [expansion, setExpansion] = useState('');
  const [description, setDescription] = useState('');
  const [snippetTagsInput, setSnippetTagsInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Tag Management State ────────────────────────────────────────────────────
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [tagToRename, setTagToRename] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [isNewTagModalOpen, setIsNewTagModalOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

  // ── Interactive Test Sandbox ────────────────────────────────────────────────
  const [sandboxText, setSandboxText] = useState('');

  // Combined tags with snippet counts and note counts
  const unifiedTags = useMemo(() => {
    const map = new Map<string, { noteCount: number; snippetCount: number }>();
    for (const { tag, count } of tagList) {
      const lower = tag.toLowerCase();
      map.set(lower, { noteCount: count, snippetCount: 0 });
    }
    for (const item of snippets) {
      if (item.tags) {
        for (const t of item.tags) {
          const lower = t.toLowerCase();
          const curr = map.get(lower) || { noteCount: 0, snippetCount: 0 };
          curr.snippetCount++;
          map.set(lower, curr);
        }
      }
    }
    return Array.from(map.entries())
      .map(([tag, counts]) => ({
        tag,
        noteCount: counts.noteCount,
        snippetCount: counts.snippetCount,
        total: counts.noteCount + counts.snippetCount,
      }))
      .sort((a, b) => b.total - a.total || a.tag.localeCompare(b.tag));
  }, [tagList, snippets]);

  // Filtered snippets
  const filteredSnippets = useMemo(() => {
    return snippets.filter((s) => {
      if (selectedTagFilter && !s.tags?.includes(selectedTagFilter)) return false;
      if (!snippetSearch.trim()) return true;
      const q = snippetSearch.toLowerCase();
      const trigMatch = s.trigger.toLowerCase().includes(q);
      const descMatch = (s.description || '').toLowerCase().includes(q);
      const expMatch = s.expansion.toLowerCase().includes(q);
      const tagMatch = s.tags?.some((t) => t.toLowerCase().includes(q));
      return trigMatch || descMatch || expMatch || tagMatch;
    });
  }, [snippets, snippetSearch, selectedTagFilter]);

  // ── Snippet Actions ─────────────────────────────────────────────────────────

  const openCreateSnippet = (initialTemplate?: ShortcutTemplate) => {
    setEditingSnippet(null);
    if (initialTemplate) {
      setTrigger(initialTemplate.trigger);
      setDescription(initialTemplate.name);
      setSnippetTagsInput(initialTemplate.tag.replace('#', ''));
      setExpansion(initialTemplate.placeholder);
    } else {
      setTrigger('#');
      setExpansion('');
      setDescription('');
      setSnippetTagsInput(selectedTagFilter || '');
    }
    setIsSnippetModalOpen(true);
  };

  const openEditSnippet = (s: Snippet) => {
    setEditingSnippet(s);
    setTrigger(s.trigger);
    setExpansion(s.expansion);
    setDescription(s.description || '');
    setSnippetTagsInput((s.tags || []).join(', '));
    setIsSnippetModalOpen(true);
  };

  const handleSaveSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trigger.trim() || !expansion.trim()) return;

    setIsSubmitting(true);
    try {
      const parsedTags = sanitizeTags(snippetTagsInput);

      if (editingSnippet?.id) {
        await snippetsRepo.update(editingSnippet.id, {
          trigger: trigger.trim(),
          expansion: expansion.trim(),
          description: description.trim() || undefined,
          tags: parsedTags,
        });
        showSnackbar({ message: `Updated shortcut ${trigger.trim()}` });
      } else {
        await snippetsRepo.create({
          trigger: trigger.trim(),
          expansion: expansion.trim(),
          description: description.trim() || undefined,
          tags: parsedTags,
        });
        showSnackbar({ message: `Created shortcut ${trigger.trim()}` });
      }
      setIsSnippetModalOpen(false);
    } catch (err) {
      console.error('Failed to save snippet:', err);
      showSnackbar({ message: 'Failed to save shortcut snippet' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSnippet = async (id: number, trig: string) => {
    try {
      await snippetsRepo.delete(id);
      showSnackbar({ message: `Deleted shortcut ${trig}` });
    } catch (err) {
      console.error('Failed to delete snippet:', err);
      showSnackbar({ message: 'Failed to delete shortcut snippet' });
    }
  };

  const handleCopyExpansion = async (id: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      showSnackbar({ message: 'Copied expansion text to clipboard' });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showSnackbar({ message: 'Could not copy to clipboard' });
    }
  };

  // ── Sandbox Live Expansion ──────────────────────────────────────────────────
  const handleSandboxChange = (text: string) => {
    let updated = text;
    for (const s of snippets) {
      const regex = new RegExp(`(^|\\s)${escapeRegex(s.trigger)}(\\s|$)`, 'gi');
      if (regex.test(updated)) {
        updated = updated.replace(regex, `$1${s.expansion}$2`);
      }
    }
    setSandboxText(updated);
  };

  function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // ── Tag Management Actions ──────────────────────────────────────────────────

  const openRenameTag = (tag: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTagToRename(tag);
    setNewTagName(tag);
    setIsRenameModalOpen(true);
  };

  const handleRenameTag = async () => {
    if (!tagToRename || !newTagName.trim()) return;
    try {
      const res = await notesRepo.renameTag(tagToRename, newTagName.trim());
      setIsRenameModalOpen(false);
      showSnackbar({
        message: `Renamed #${tagToRename} to #${newTagName.trim()} (${res.affectedNotes} notes updated).`,
      });
    } catch (err) {
      console.error('Failed to rename tag:', err);
      showSnackbar({ message: 'Failed to rename tag' });
    }
  };

  const handleDeleteTag = async (tag: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (confirm(`Remove #${tag} from all notes and shortcuts? This cannot be undone.`)) {
      try {
        const res = await notesRepo.deleteTag(tag);
        if (selectedTagFilter === tag) setSelectedTagFilter(null);
        showSnackbar({
          message: `Removed #${tag} from ${res.affectedNotes} notes.`,
        });
      } catch (err) {
        console.error('Failed to delete tag:', err);
        showSnackbar({ message: 'Failed to delete tag' });
      }
    }
  };

  const handleCreateNewTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sanitizeTag(newTagInput);
    if (!clean) return;
    try {
      await snippetsRepo.create({
        trigger: `#${clean}`,
        expansion: `Template for #${clean}`,
        tags: [clean],
      });
      setNewTagInput('');
      setIsNewTagModalOpen(false);
      showSnackbar({ message: `Created tag #${clean}` });
    } catch (err) {
      console.error('Failed to create tag:', err);
      showSnackbar({ message: 'Failed to create tag' });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-soft text-accent flex items-center justify-center shadow-xs">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink tracking-tight">Text Replace Shortcut</h2>
              <p className="text-xs text-ink-muted">
                Create quick text replacement triggers and manage workspace tags in one place.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsNewTagModalOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-2 hover:bg-surface border border-border text-ink transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Tag className="w-3.5 h-3.5 text-accent" />
            <span>+ New Tag</span>
          </button>
          <button
            type="button"
            onClick={() => openCreateSnippet()}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-accent text-accent-ink hover:opacity-95 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Shortcut</span>
          </button>
        </div>
      </div>

      {/* ── Combined Tags Filter Bar ────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
            <Tag className="w-3.5 h-3.5 text-accent" />
            <span>Tags ({unifiedTags.length})</span>
          </div>
          {selectedTagFilter && (
            <button
              type="button"
              onClick={() => setSelectedTagFilter(null)}
              className="text-[11px] text-accent hover:underline cursor-pointer"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* All Tags Pill */}
          <button
            type="button"
            onClick={() => setSelectedTagFilter(null)}
            className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              selectedTagFilter === null
                ? 'bg-accent text-accent-ink font-semibold shadow-xs'
                : 'bg-surface-2 text-ink-muted hover:text-ink border border-border/60'
            }`}
          >
            All ({snippets.length})
          </button>

          {/* Individual Tag Chips */}
          {unifiedTags.map(({ tag, noteCount, snippetCount }) => {
            const isSelected = selectedTagFilter === tag;
            return (
              <div
                key={tag}
                onClick={() => setSelectedTagFilter(isSelected ? null : tag)}
                className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-accent-soft text-accent border-accent/40 font-semibold shadow-xs'
                    : 'bg-surface-2 text-ink-muted hover:text-ink hover:bg-surface border-border/60'
                }`}
              >
                <span>#{tag}</span>
                <span className="text-[10px] opacity-60 font-mono">
                  {snippetCount > 0 ? `${snippetCount}s` : ''}
                  {snippetCount > 0 && noteCount > 0 ? '/' : ''}
                  {noteCount > 0 ? `${noteCount}n` : ''}
                </span>

                {/* Inline Actions: Rename & Delete (visible on mobile, hover on desktop) */}
                <span className="inline-flex items-center gap-0.5 ml-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => openRenameTag(tag, e)}
                    className="p-0.5 hover:text-accent rounded"
                    title={`Rename #${tag}`}
                  >
                    <Pencil className="w-2.5 h-2.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteTag(tag, e)}
                    className="p-0.5 hover:text-danger rounded"
                    title={`Delete #${tag}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Search & Shortcuts List ─────────────────────────────────────────── */}
      <div className="space-y-3.5">
        {/* Search Bar */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={snippetSearch}
            onChange={(e) => setSnippetSearch(e.target.value)}
            placeholder="Search shortcuts by trigger, expansion text, or tag…"
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-surface-2 text-ink text-xs placeholder-ink-faint focus:outline-none focus:border-accent"
          />
        </div>

        {/* Shortcuts Cards Grid */}
        {filteredSnippets.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-border/80 text-center space-y-4 bg-surface-2/20">
            <Zap className="w-8 h-8 text-ink-faint mx-auto opacity-50" />
            <div>
              <div className="text-sm font-semibold text-ink">No shortcuts configured</div>
              <p className="text-xs text-ink-muted max-w-sm mx-auto mt-0.5">
                {snippetSearch
                  ? 'No shortcuts matched your search.'
                  : 'Start with one of the quick templates below or create your own.'}
              </p>
            </div>

            {/* Quick Template Starter Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {SHORTCUT_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.tag}
                  type="button"
                  onClick={() => openCreateSnippet(tmpl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-accent-soft hover:text-accent hover:border-accent/40 text-xs font-medium transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <span className="font-semibold text-accent">{tmpl.tag}</span>
                  <span className="text-ink-muted">{tmpl.name}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredSnippets.map((snippet) => (
              <div
                key={snippet.id}
                className="p-3.5 rounded-2xl border border-border bg-surface hover:border-border/90 shadow-card flex flex-col justify-between gap-2.5 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-accent-soft text-accent border border-accent/20">
                        {snippet.trigger}
                      </span>
                      {snippet.description && (
                        <span className="text-xs font-semibold text-ink truncate max-w-[180px]">
                          {snippet.description}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyExpansion(snippet.id!, snippet.expansion)}
                        className="p-1.5 text-ink-muted hover:text-ink rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                        title="Copy expansion text"
                      >
                        {copiedId === snippet.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditSnippet(snippet)}
                        className="p-1.5 text-ink-muted hover:text-accent rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                        title="Edit shortcut"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSnippet(snippet.id!, snippet.trigger)}
                        className="p-1.5 text-ink-muted hover:text-danger rounded-lg hover:bg-surface-2 transition-colors cursor-pointer"
                        title="Delete shortcut"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 p-2.5 rounded-xl bg-surface-2/60 border border-border/40 font-mono text-xs text-ink/90 whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                    {snippet.expansion}
                  </div>
                </div>

                {snippet.tags && snippet.tags.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-border/40">
                    {snippet.tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTagFilter(t)}
                        className="inline-flex items-center gap-0.5 text-[10px] font-medium text-ink-muted hover:text-accent bg-surface-2 px-1.5 py-0.5 rounded-md border border-border/50 cursor-pointer"
                      >
                        <Tag className="w-2.5 h-2.5 text-ink-faint" />
                        <span>#{t}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Interactive Test Sandbox ────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-ink">Test Your Shortcuts</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-semibold">
              Live Sandbox
            </span>
          </div>
          {sandboxText && (
            <button
              type="button"
              onClick={() => setSandboxText('')}
              className="text-[11px] text-ink-muted hover:text-ink cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          rows={3}
          value={sandboxText}
          onChange={(e) => handleSandboxChange(e.target.value)}
          placeholder="Type any shortcut trigger followed by a space (e.g. #email, #address, #number, #link) to watch it auto-expand here…"
          className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink text-xs focus:outline-none focus:border-accent font-mono resize-none"
        />
      </div>

      {/* ── New / Edit Shortcut Modal (with Small Option Template Buttons) ──── */}
      {isSnippetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-md rounded-3xl bg-surface border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">
                {editingSnippet ? 'Edit Shortcut Snippet' : 'New Shortcut Snippet'}
              </h3>
              <button
                type="button"
                onClick={() => setIsSnippetModalOpen(false)}
                className="p-1 rounded-lg text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Small Option Buttons for Templates */}
            <div className="space-y-1.5 pb-2 border-b border-border/50">
              <span className="text-[11px] font-semibold text-ink-muted">Quick Templates:</span>
              <div className="flex flex-wrap gap-1.5">
                {SHORTCUT_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.tag}
                    type="button"
                    onClick={() => {
                      setTrigger(tmpl.trigger);
                      setDescription(tmpl.name);
                      setSnippetTagsInput(tmpl.tag.replace('#', ''));
                      setExpansion(tmpl.placeholder);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-surface-2 hover:bg-accent-soft hover:text-accent hover:border-accent/40 text-[11px] font-medium transition-all cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <span className="font-semibold text-accent">{tmpl.tag}</span>
                    <span className="text-ink-muted">{tmpl.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveSnippet} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-ink">Trigger Shortcut</label>
                <input
                  type="text"
                  required
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                  placeholder="#email, #address, #number, #link"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink font-mono focus:outline-none focus:border-accent"
                />
                <p className="text-[11px] text-ink-muted">Trigger starts with '#' (e.g. #email, #number)</p>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink">Expansion Text</label>
                <textarea
                  required
                  rows={4}
                  value={expansion}
                  onChange={(e) => setExpansion(e.target.value)}
                  placeholder="The text that will automatically replace the trigger shortcut..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink font-mono focus:outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink">Name / Description (Optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Primary Email Address, Office Phone, etc."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-ink">Tags (Optional, comma-separated)</label>
                <input
                  type="text"
                  value={snippetTagsInput}
                  onChange={(e) => setSnippetTagsInput(e.target.value)}
                  placeholder="email, address, contact"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsSnippetModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-medium text-ink-muted hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !trigger.trim() || !expansion.trim()}
                  className="px-4 py-2 rounded-xl font-semibold bg-accent text-accent-ink hover:opacity-95 active:scale-95 disabled:opacity-40 transition-all cursor-pointer shadow-xs"
                >
                  {isSubmitting ? 'Saving…' : 'Save Shortcut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Create New Tag Modal ────────────────────────────────────────────── */}
      {isNewTagModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-3xl bg-surface border border-border p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-ink">Create New Tag</h3>
            <form onSubmit={handleCreateNewTag} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-ink">Tag Name</label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  placeholder="e.g. project, urgent, reference"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink focus:outline-none focus:border-accent"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsNewTagModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl font-medium text-ink-muted hover:bg-surface-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTagInput.trim()}
                  className="px-4 py-1.5 rounded-xl font-semibold bg-accent text-accent-ink hover:opacity-95 disabled:opacity-40 cursor-pointer shadow-xs"
                >
                  Create Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Tag Rename Modal ─────────────────────────────────────────────────── */}
      {isRenameModalOpen && tagToRename && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-sm rounded-3xl bg-surface border border-border p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-ink">Rename Tag</h3>
            <p className="text-xs text-ink-muted">
              Rename <strong>#{tagToRename}</strong> globally across all notes and shortcuts.
            </p>

            <div className="space-y-1 text-xs">
              <label className="font-semibold text-ink">New Tag Name</label>
              <input
                type="text"
                autoFocus
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="new-tag-name"
                className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink focus:outline-none focus:border-accent font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60 text-xs">
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl font-medium text-ink-muted hover:bg-surface-2 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newTagName.trim() || newTagName.trim() === tagToRename}
                onClick={handleRenameTag}
                className="px-4 py-1.5 rounded-xl font-semibold bg-accent text-accent-ink hover:opacity-95 disabled:opacity-40 transition-opacity cursor-pointer shadow-xs"
              >
                Rename Across Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
