import { useTemplates, templatesRepo } from '../../db/repos/templatesRepo';
import { Sheet } from '../../design/ui/Sheet';
import { EmptyState } from '../../design/ui/EmptyState';
import type { Template, TemplateKind } from '../../types/template';

interface TemplatePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  kind?: TemplateKind;
  onSelectTemplate: (template: Template) => void;
}

export function TemplatePickerSheet({
  isOpen,
  onClose,
  kind,
  onSelectTemplate,
}: TemplatePickerSheetProps) {
  const templates = useTemplates(kind);

  const handleSelect = async (tmpl: Template) => {
    if (tmpl.id) {
      await templatesRepo.incrementUsageCount(tmpl.id);
    }
    onSelectTemplate(tmpl);
    onClose();
  };

  const handleSeedDefaults = async () => {
    await templatesRepo.seedDefaults();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={kind ? `Pick a ${kind === 'task' ? 'Task' : 'Note'} Template` : 'Choose a Template'}
      description="Start with a predefined skeleton or checklist."
    >
      {templates.length === 0 ? (
        <EmptyState
          title="No templates found"
          description="You can seed default templates or create custom templates in Settings."
          action={{
            label: 'Load starter templates',
            onClick: handleSeedDefaults,
          }}
        />
      ) : (
        <div className="space-y-3">
          {templates.map((tmpl) => {
            const isTask = tmpl.kind === 'task';
            const subtaskCount = tmpl.body.subtasks?.length ?? 0;

            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => handleSelect(tmpl)}
                className="w-full text-left p-4 rounded-card border border-border bg-surface hover:bg-surface-2 transition-all shadow-xs flex flex-col gap-1.5 cursor-pointer group"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink group-hover:text-accent transition-colors">
                    {tmpl.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-surface-2 text-ink-muted border border-border">
                    {tmpl.kind}
                  </span>
                </div>

                {isTask ? (
                  <p className="text-xs text-ink-muted line-clamp-1">
                    {subtaskCount > 0
                      ? `${subtaskCount} checklist item${subtaskCount === 1 ? '' : 's'}: ${tmpl.body.subtasks?.slice(0, 2).join(', ')}...`
                      : 'Empty task template'}
                  </p>
                ) : (
                  <p className="text-xs text-ink-muted line-clamp-2">
                    {tmpl.body.content ? tmpl.body.content.slice(0, 100).replace(/[#*\n]/g, ' ') : 'Note skeleton'}
                  </p>
                )}

                {tmpl.usageCount > 0 && (
                  <span className="text-[10px] text-ink-muted/80 self-end">
                    Used {tmpl.usageCount} time{tmpl.usageCount === 1 ? '' : 's'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
export default TemplatePickerSheet;
