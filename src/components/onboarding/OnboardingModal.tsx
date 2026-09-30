import { useState } from 'react';
import { Sparkles, Zap, Command, Palette, ArrowRight, Check } from 'lucide-react';
import { Dialog } from '../../design/ui/Dialog';
import { useTheme, THEME_COLORS, type ThemeColor } from '../../hooks/useTheme';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const { color, setColor, isDark, toggleTheme } = useTheme();

  const handleFinish = () => {
    localStorage.setItem('notes_onboarding_completed', 'true');
    onClose();
  };

  const steps = [
    {
      title: 'Welcome to Every Notes',
      subtitle: 'Your personal, private, local-first productivity workspace',
      icon: <Sparkles className="w-8 h-8 text-accent" />,
      content: (
        <div className="space-y-3 text-center">
          <p className="text-xs text-ink-muted leading-relaxed">
            Every Notes stores your thoughts, tasks, calendars, routines, and habits right in your device.
            Zero cloud requirement, complete privacy, and instant offline performance.
          </p>
          <div className="grid grid-cols-2 gap-2.5 pt-2 text-left">
            <div className="p-3 rounded-xl bg-surface-2/60 border border-border">
              <span className="text-base">🔒</span>
              <h4 className="text-xs font-semibold text-ink mt-1">100% Private</h4>
              <p className="text-[11px] text-ink-muted">Encrypted IndexedDB & OPFS storage.</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-2/60 border border-border">
              <span className="text-base">⚡</span>
              <h4 className="text-xs font-semibold text-ink mt-1">Instant Speed</h4>
              <p className="text-[11px] text-ink-muted">60fps interactions with zero lag.</p>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Fast Capture & Speed Dial',
      subtitle: 'Never lose a fleeting idea or task',
      icon: <Zap className="w-8 h-8 text-accent" />,
      content: (
        <div className="space-y-3 text-center">
          <p className="text-xs text-ink-muted leading-relaxed">
            Use the floating <strong className="text-ink">+</strong> button at the bottom-right for instant actions.
          </p>
          <div className="p-3.5 rounded-2xl bg-surface-2 border border-border text-left space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-accent/20 text-accent font-bold flex items-center justify-center text-[10px]">
                Tap
              </span>
              <span className="text-ink">Opens quick-action speed dial (Notes, Tasks, Journal, Drawing, Scratchpad)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-accent/20 text-accent font-bold flex items-center justify-center text-[10px]">
                Hold
              </span>
              <span className="text-ink">Long-press for 0.5s for instant 1-tap note capture</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-accent/20 text-accent font-bold flex items-center justify-center text-[10px]">
                Key
              </span>
              <span className="text-ink">Press <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border font-mono text-[10px]">N</kbd> anywhere on desktop</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Commands & Navigation',
      subtitle: 'Navigate with keystroke speed',
      icon: <Command className="w-8 h-8 text-accent" />,
      content: (
        <div className="space-y-3 text-center">
          <p className="text-xs text-ink-muted leading-relaxed">
            Access everything in seconds without ever taking your hands off the keyboard.
          </p>
          <div className="p-3.5 rounded-2xl bg-surface-2 border border-border space-y-2 text-left text-xs">
            <div className="flex items-center justify-between">
              <span className="text-ink font-medium">Command Palette & Search</span>
              <kbd className="px-2 py-0.5 rounded-md bg-surface border border-border font-mono text-[11px] text-ink font-semibold">
                ⌘K / Ctrl+K
              </kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink font-medium">Keyboard Shortcuts Help</span>
              <kbd className="px-2 py-0.5 rounded-md bg-surface border border-border font-mono text-[11px] text-ink font-semibold">
                ?
              </kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink font-medium">Link Note (Wikilinks)</span>
              <kbd className="px-2 py-0.5 rounded-md bg-surface border border-border font-mono text-[11px] text-ink font-semibold">
                [[
              </kbd>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Make It Yours',
      subtitle: 'Pick your look and feel',
      icon: <Palette className="w-8 h-8 text-accent" />,
      content: (
        <div className="space-y-3 text-center">
          <p className="text-xs text-ink-muted leading-relaxed">
            Select a color palette. You can switch between Light and Dark mode anytime.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {THEME_COLORS.map((t) => {
              const isSelected = color === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setColor(t.value as ThemeColor)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'border-accent bg-accent/15 text-accent shadow-xs'
                      : 'border-border bg-surface-2/60 text-ink hover:bg-surface-2'
                  }`}
                >
                  <span className="truncate">{t.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={toggleTheme}
              className="px-3.5 py-1.5 rounded-xl border border-border bg-surface-2 text-xs font-semibold text-ink hover:text-accent transition-colors cursor-pointer"
            >
              Toggle {isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleFinish}
      size="md"
      showCloseButton={true}
    >
      <div className="py-2 flex flex-col items-center">
        {/* Progress indicator */}
        <div className="flex items-center gap-1.5 mb-5">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                i === step ? 'w-6 bg-accent' : 'w-2 bg-border hover:bg-ink-muted/50'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Step Icon */}
        <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-3">
          {current.icon}
        </div>

        {/* Step Header */}
        <h3 className="text-base font-bold text-ink text-center">
          {current.title}
        </h3>
        <p className="text-xs text-ink-muted text-center mt-1 mb-4">
          {current.subtitle}
        </p>

        {/* Step Body */}
        <div className="w-full">
          {current.content}
        </div>

        {/* Footer Navigation */}
        <div className="w-full flex items-center justify-between pt-6 mt-2 border-t border-border/60">
          <button
            type="button"
            onClick={handleFinish}
            className="text-xs text-ink-muted hover:text-ink font-medium px-2 py-1.5 cursor-pointer"
          >
            Skip
          </button>

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              Next
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-accent text-accent-ink text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              Get Started
              <Sparkles className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export default OnboardingModal;
