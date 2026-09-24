import { useState } from 'react';
import { useTemplates, templatesRepo } from '../../db/repos/templatesRepo';
import { LifeAreaPicker } from '../areas/LifeAreaPicker';
import { SectionHeader } from '../../design/ui/SectionHeader';
import { EmptyState } from '../../design/ui/EmptyState';
import { Segmented } from '../../design/ui/Segmented';
import { useSnackbar } from '../../context/SnackbarContext';
import type { Template, TemplateKind, TemplateBody } from '../../types/template';

export function TemplatesScreen() {
  const [selectedKind, setSelectedKind] = useState<TemplateKind>('task');
  const templates = useTemplates(selectedKind);
  const { showSnackbar } = useSnackbar();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [kind, setKind] = useState<TemplateKind>('task');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<string>('none');
  const [dueOffsetDays, setDueOffsetDays] = useState<number>(0);
  const [lifeAreaId, setLifeAreaId] = useState<number | null>(null);
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  const openCreateModal = () => {
    setEditingTemplate(null);
    setName('');
    setKind(selectedKind);
    setTitle('');
    setContent('');
    setPriority('none');
    setDueOffsetDays(0);
    setLifeAreaId(null);
    setSubtasks([]);
    setSubtaskInput('');
    setIsModalOpen(true);
  };

  const openEditModal = (t: Template) => {
    setEditingTemplate(t);
    setName(t.name);
    setKind(t.kind);
    setTitle(t.body.title || '');
    setContent(t.body.content || '');
    setPriority(t.body.priority || 'none');
    setDueOffsetDays(t.body.dueOffsetDays ?? 0);
    setLifeAreaId(t.body.lifeAreaId ?? null);
    setSubtasks(t.body.subtasks ? [...t.body.subtasks] : []);
    setSubtaskInput('');
    setIsModalOpen(true);
  };

  const handleAddSubtask = () => {
    const clean = subtaskInput.trim();
    if (!clean) return;
    setSubtasks([...subtasks, clean]);
    setSubtaskInput('');
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtasks(subtasks.filter((_, idx) => idx !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    const body: TemplateBody = {
      title: title.trim() || undefined,
      lifeAreaId: lifeAreaId,
    };

    if (kind === 'task') {
      body.priority = priority !== 'none' ? priority : undefined;
      body.dueOffsetDays = dueOffsetDays > 0 ? dueOffsetDays : undefined;
      body.subtasks = subtasks.length > 0 ? subtasks : undefined;
    } else {
      body.content = content || undefined;
    }

    if (editingTemplate && editingTemplate.id) {
      await templatesRepo.updateTemplate(editingTemplate.id, {
        name: cleanName,
        kind,
        body,
      });
      showSnackbar({ message: `Updated template "${cleanName}"` });
    } else {
      await templatesRepo.createTemplate({
        name: cleanName,
        kind,
        body,
      });
      showSnackbar({ message: `Created template "${cleanName}"` });
    }

    setIsModalOpen(false);
  };

  const handleDelete = async (id: number, templateName: string) => {
    if (window.confirm(`Delete template "${templateName}"?`)) {
      await templatesRepo.deleteTemplate(id);
      showSnackbar({ message: `Deleted "${templateName}"` });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Templates</h1>
          <p className="text-sm text-ink-muted mt-1">
            Reusable blueprints for tasks and notes to speed up your capture workflow.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-pill bg-accent text-accent-ink text-sm font-semibold hover:opacity-90 active:scale-95 transition-all shadow-card cursor-pointer min-h-[44px]"
        >
          <span>+ New Template</span>
        </button>
      </div>

      {/* Tabs */}
      <Segmented
        value={selectedKind}
        onChange={(val) => setSelectedKind(val as TemplateKind)}
        options={[
          { value: 'task', label: 'Task Templates' },
          { value: 'note', label: 'Note Templates' },
        ]}
      />

      {/* Templates List */}
      <div className="space-y-3">
        <SectionHeader
          title={`${selectedKind === 'task' ? 'Task' : 'Note'} Blueprints`}
          count={templates.length}
        />

        {templates.length === 0 ? (
          <EmptyState
            title={`No ${selectedKind} templates`}
            description={`Create your first ${selectedKind} template or seed starter presets.`}
            action={{
              label: 'Load default templates',
              onClick: () => templatesRepo.seedDefaults(),
            }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {templates.map((t) => {
              const subtaskCount = t.body.subtasks?.length ?? 0;
              return (
                <div
                  key={t.id}
                  className="rounded-card border border-border bg-surface p-4 shadow-card flex flex-col justify-between gap-3 hover:border-accent/40 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-ink">{t.name}</h3>
                      {t.usageCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-2 text-ink-muted">
                          {t.usageCount} uses
                        </span>
                      )}
                    </div>

                    {t.kind === 'task' ? (
                      <div className="space-y-1">
                        {t.body.title && (
                          <p className="text-xs text-ink">Title: {t.body.title}</p>
                        )}
                        {subtaskCount > 0 && (
                          <p className="text-xs text-ink-muted">
                            {subtaskCount} checklist item{subtaskCount === 1 ? '' : 's'}
                          </p>
                        )}
                        {t.body.dueOffsetDays && (
                          <p className="text-xs text-ink-muted">Due in +{t.body.dueOffsetDays} days</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-ink-muted line-clamp-3 whitespace-pre-wrap">
                        {t.body.content || 'Blank note skeleton'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => openEditModal(t)}
                      className="px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent-soft rounded transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => t.id && handleDelete(t.id, t.name)}
                      className="px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/10 rounded transition-colors cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-surface border border-border p-6 shadow-float space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-ink-muted hover:text-ink cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Template Kind */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Type
                </label>
                <div className="flex gap-2">
                  {(['task', 'note'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                        kind === k
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border bg-surface-2 text-ink-muted hover:text-ink'
                      }`}
                    >
                      {k === 'task' ? 'Task Template' : 'Note Template'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Template Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Weekly Review, Meeting Notes"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Default Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Pre-filled Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={kind === 'task' ? 'Default task title...' : 'e.g. Meeting: '}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>

              {/* Life Area Picker */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  Life Area (optional)
                </label>
                <div>
                  <LifeAreaPicker
                    selectedAreaId={lifeAreaId}
                    onSelect={(id) => setLifeAreaId(id)}
                  />
                </div>
              </div>

              {/* Task-specific fields */}
              {kind === 'task' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        Priority
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                      >
                        <option value="none">None</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                        Due Offset (Days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={dueOffsetDays}
                        onChange={(e) => setDueOffsetDays(parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>

                  {/* Subtasks Builder */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                      Checklist Subtasks ({subtasks.length})
                    </label>

                    {subtasks.length > 0 && (
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {subtasks.map((st, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-lg bg-surface-2 border border-border text-xs text-ink"
                          >
                            <span className="truncate">{st}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubtask(idx)}
                              className="text-ink-muted hover:text-danger p-0.5"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={subtaskInput}
                        onChange={(e) => setSubtaskInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSubtask();
                          }
                        }}
                        placeholder="+ Add checklist step (Enter)..."
                        className="flex-1 px-3 py-2 rounded-xl border border-border bg-surface-2 text-ink text-xs focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <button
                        type="button"
                        onClick={handleAddSubtask}
                        className="px-3 py-2 rounded-xl bg-surface-2 hover:bg-surface border border-border text-xs font-semibold text-ink cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Note-specific fields */}
              {kind === 'note' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    Content Skeleton (Markdown)
                  </label>
                  <textarea
                    rows={6}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="## Agenda&#10;- &#10;&#10;## Notes&#10;&#10;## Action Items&#10;- [ ] "
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-2 text-ink text-xs font-mono focus:outline-none focus:ring-2 focus:ring-accent leading-relaxed"
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-pill text-xs font-semibold text-ink-muted hover:text-ink cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-pill bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-all shadow-card cursor-pointer min-h-[44px]"
                >
                  {editingTemplate ? 'Save Template' : 'Create Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default TemplatesScreen;
