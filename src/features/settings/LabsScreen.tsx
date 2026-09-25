import { Link } from 'react-router-dom';
import { useFeatureFlags, FLAG_INFO, FEATURE_FLAGS, type Flag } from '../../app/flags';

export function LabsScreen() {
  const { flags, toggleFlag, resetAllFlags } = useFeatureFlags();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/settings"
              className="text-xs text-ink-muted hover:text-ink transition-colors flex items-center gap-1"
            >
              <span>← Settings</span>
            </Link>
          </div>
          <h1 className="text-2xl font-semibold text-ink mt-1">Experimental Labs</h1>
          <p className="text-sm text-ink-muted mt-1">
            Toggle expansion modules on or off. Toggled-off modules hide from navigation and tools, but their IndexedDB data is always safely preserved.
          </p>
        </div>

        <button
          type="button"
          onClick={resetAllFlags}
          className="self-start sm:self-auto px-3 py-1.5 rounded-pill bg-surface-2 hover:bg-surface border border-border text-xs font-medium text-ink transition-colors cursor-pointer min-h-[44px]"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Flag List */}
      <div className="rounded-card bg-surface border border-border divide-y divide-border shadow-card overflow-hidden">
        {FEATURE_FLAGS.map((flagKey: Flag) => {
          const info = FLAG_INFO[flagKey];
          const isEnabled = flags[flagKey];

          return (
            <div
              key={flagKey}
              className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4 hover:bg-surface-2/40 transition-colors"
            >
              <div className="space-y-1 pr-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-ink">{info.label}</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent-soft text-accent">
                    {info.phase}
                  </span>
                  <span className="font-mono text-[10px] text-ink-muted">
                    ({flagKey})
                  </span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {info.description}
                </p>
              </div>

              {/* iOS-style accessible toggle switch (>=44px touch target) */}
              <label
                className="relative inline-flex items-center cursor-pointer shrink-0 min-w-[44px] min-h-[44px] justify-center"
                aria-label={`Toggle ${info.label}`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={() => toggleFlag(flagKey)}
                  className="sr-only peer"
                />
                <div
                  className={`w-11 h-6 rounded-full transition-colors duration-200 relative ${
                    isEnabled ? 'bg-accent' : 'bg-surface-2 border border-border'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 absolute top-0.5 left-0.5 ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </label>
            </div>
          );
        })}
      </div>

      {/* Developer note */}
      <div className="p-4 rounded-card bg-surface-2 border border-border text-xs text-ink-muted space-y-1">
        <span className="font-semibold text-ink">Expansion Safety Contract:</span>
        <p>
          Per EXPANSION_PLAN §0 rule 5, every new module ships behind a feature flag. If an in-development feature needs to be hidden, toggle it off here instantly with zero risk to local data.
        </p>
      </div>
    </div>
  );
}
