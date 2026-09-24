import { useLocation } from 'react-router-dom';

interface StageZeroPlaceholderProps {
  title: string;
  description: string;
}

export function StageZeroPlaceholder({ title, description }: StageZeroPlaceholderProps) {
  const location = useLocation();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        </div>
        <div className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Stage 0 OK
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
            System Status
          </div>
          <div className="text-xs font-mono text-slate-400 dark:text-slate-500">
            Route: {location.pathname}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-750">
            <div className="text-xs text-slate-500 dark:text-slate-400">Core Runtime</div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              React 19 + TypeScript
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-750">
            <div className="text-xs text-slate-500 dark:text-slate-400">Styling</div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              Tailwind CSS v4 (Vite)
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-750">
            <div className="text-xs text-slate-500 dark:text-slate-400">Database</div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              Dexie 4 (IndexedDB)
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-750">
            <div className="text-xs text-slate-500 dark:text-slate-400">Storage Scope</div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              Local-First (Offline)
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-750">
            <div className="text-xs text-slate-500 dark:text-slate-400">Routing</div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              react-router-dom v7
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-750">
            <div className="text-xs text-slate-500 dark:text-slate-400">PWA Manifest</div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              vite-plugin-pwa
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
