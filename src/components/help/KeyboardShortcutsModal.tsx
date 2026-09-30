import { Dialog } from '../../design/ui/Dialog';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  title: string;
  items: ShortcutItem[];
}

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const sections: ShortcutSection[] = [
    {
      title: 'Global Navigation',
      items: [
        { keys: ['⌘', 'K'], description: 'Open Command Palette & Global Search' },
        { keys: ['Ctrl', 'K'], description: 'Open Command Palette (Windows/Linux)' },
        { keys: ['N'], description: 'Quick Capture Note or Task (when not typing)' },
        { keys: ['?'], description: 'Toggle this Keyboard Shortcuts Help' },
        { keys: ['Esc'], description: 'Close active modal, drawer, or palette' },
      ],
    },
    {
      title: 'Note Editor',
      items: [
        { keys: ['⌘', 'S'], description: 'Instant Save Note' },
        { keys: ['[', '['], description: 'Trigger Wikilink Note Autocomplete' },
        { keys: ['#'], description: 'Add Tag to Note' },
        { keys: ['/'], description: 'Trigger Editor Command / Slash Menu' },
        { keys: ['⌘', 'B'], description: 'Bold Text' },
        { keys: ['⌘', 'I'], description: 'Italic Text' },
      ],
    },
    {
      title: 'Tasks & Habits',
      items: [
        { keys: ['Enter'], description: 'Add new task in quick entry' },
        { keys: ['Space'], description: 'Toggle task or habit checkbox when focused' },
      ],
    },
  ];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="⌨️ Keyboard Shortcuts"
      size="md"
    >
      <div className="space-y-5">
        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              {section.title}
            </h4>
            <div className="rounded-xl border border-border bg-surface-2/40 divide-y divide-border/60 overflow-hidden">
              {section.items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3.5 py-2 text-xs"
                >
                  <span className="text-ink">{item.description}</span>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    {item.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="px-2 py-0.5 rounded-md bg-surface border border-border text-[11px] font-mono font-semibold text-ink shadow-xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

export default KeyboardShortcutsModal;
