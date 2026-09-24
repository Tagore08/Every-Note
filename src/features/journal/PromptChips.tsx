import { useTemplates } from '../../db/repos/templatesRepo';

interface PromptChipsProps {
  onSelectPrompt: (promptText: string) => void;
}

export function PromptChips({ onSelectPrompt }: PromptChipsProps) {
  const templates = useTemplates('journal');

  // Collect all unique prompts across active journal templates
  const prompts: string[] = [];
  for (const tmpl of templates) {
    if (tmpl.body.prompts) {
      for (const p of tmpl.body.prompts) {
        if (p && !prompts.includes(p)) {
          prompts.push(p);
        }
      }
    }
  }

  // Fallback defaults if no templates or prompts are loaded
  if (prompts.length === 0) {
    prompts.push(
      'What went well today?',
      'What drained my energy?',
      'Tomorrow I will focus on…'
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
        Prompt Ideas (Tap to insert)
      </div>
      <div className="flex flex-wrap gap-1.5">
        {prompts.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(prompt)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-pill bg-surface-2 hover:bg-surface border border-border hover:border-accent/40 text-xs font-medium text-ink transition-all cursor-pointer shadow-2xs group"
          >
            <span className="text-accent text-[11px] group-hover:scale-125 transition-transform">
              ✦
            </span>
            <span>{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
