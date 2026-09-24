import { useBackupGate } from '../../db/backupGate';

export function BackupGateModal() {
  const { isUpgrading, message, error } = useBackupGate();

  if (!isUpgrading) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-md"
      role="alertdialog"
      aria-modal="true"
      aria-label="Database upgrade in progress"
    >
      <div className="w-full max-w-md p-6 rounded-card bg-surface border border-border shadow-float text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-accent-soft flex items-center justify-center text-accent">
          <svg
            className="w-6 h-6 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeLinecap="round" />
          </svg>
        </div>

        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ink">
            {error ? 'Upgrade Paused' : 'Upgrading Your Data'}
          </h2>
          <p className="text-sm text-ink-muted">
            {error || message || 'Saving a backup copy first to prevent any data loss…'}
          </p>
        </div>

        {error ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 rounded-pill bg-accent text-accent-ink font-medium text-sm hover:opacity-90 transition-opacity cursor-pointer min-h-[44px]"
          >
            Retry Upgrade
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs text-ink-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Automatic safety backup active</span>
          </div>
        )}
      </div>
    </div>
  );
}
