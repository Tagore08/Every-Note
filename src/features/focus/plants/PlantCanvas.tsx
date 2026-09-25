import { type FC } from 'react';
import { BonsaiPlant } from './BonsaiPlant';
import { SunflowerPlant } from './SunflowerPlant';
import { CactusPlant } from './CactusPlant';

export type PlantType = 'bonsai' | 'sunflower' | 'cactus';
export type PlantStage = 'seed' | 'growing' | 'bloomed' | 'withered';

export interface PlantCanvasProps {
  plantType: PlantType;
  onSelectPlant?: (type: PlantType) => void;
  progress: number; // 0.0 to 1.0
  stage: PlantStage;
  isTimerRunning: boolean;
  className?: string;
}

export const PLANT_OPTIONS: { id: PlantType; label: string; icon: string; name: string }[] = [
  { id: 'bonsai', label: 'Bonsai', icon: '🌳', name: 'Zen Bonsai' },
  { id: 'sunflower', label: 'Sunflower', icon: '🌻', name: 'Golden Sunflower' },
  { id: 'cactus', label: 'Cactus', icon: '🌵', name: 'Desert Bloom' },
];

export const PlantCanvas: FC<PlantCanvasProps> = ({
  plantType,
  onSelectPlant,
  progress,
  stage,
  isTimerRunning,
  className = '',
}) => {
  const renderPlant = () => {
    switch (plantType) {
      case 'bonsai':
        return <BonsaiPlant progress={progress} stage={stage} />;
      case 'sunflower':
        return <SunflowerPlant progress={progress} stage={stage} />;
      case 'cactus':
        return <CactusPlant progress={progress} stage={stage} />;
    }
  };

  const getStageInfo = () => {
    switch (stage) {
      case 'bloomed':
        return { label: 'Bloomed!', icon: '✨', color: 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
      case 'withered':
        return { label: 'Withered', icon: '🥀', color: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-500/30' };
      case 'growing':
        if (progress < 0.25) {
          return { label: 'Sprouting', icon: '🌱', color: 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-500/30' };
        }
        if (progress < 0.75) {
          return { label: 'Growing', icon: '🌿', color: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
        }
        return { label: 'Budding', icon: '🌸', color: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-500/30' };
      case 'seed':
      default:
        return { label: 'Ready to Plant', icon: '🌰', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700' };
    }
  };

  const stageInfo = getStageInfo();

  return (
    <div className={`flex flex-col items-center justify-center space-y-4 ${className}`}>
      {/* Plant Selection Strip (only when not actively running or in withered/bloomed state) */}
      {onSelectPlant && (
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60">
          {PLANT_OPTIONS.map((p) => {
            const isSelected = plantType === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={isTimerRunning}
                onClick={() => onSelectPlant(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  isSelected
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs scale-102'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span className="text-sm">{p.icon}</span>
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Central Plant Display Container */}
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center rounded-3xl bg-gradient-to-b from-slate-50/60 to-slate-100/80 dark:from-slate-800/40 dark:to-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-inner overflow-hidden p-4">
        {/* Soft Ambient Radial Glow Behind Plant */}
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            stage === 'bloomed'
              ? 'bg-radial from-amber-400/20 via-emerald-400/10 to-transparent opacity-100'
              : stage === 'withered'
              ? 'bg-radial from-rose-500/10 to-transparent opacity-80'
              : stage === 'growing'
              ? 'bg-radial from-emerald-400/15 via-blue-400/5 to-transparent opacity-90'
              : 'opacity-0'
          }`}
        />

        {/* Plant SVG */}
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          {renderPlant()}
        </div>

        {/* Stage Badge on Bottom Right */}
        <div className="absolute bottom-3 right-3 z-20">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shadow-xs transition-all ${stageInfo.color}`}
          >
            <span>{stageInfo.icon}</span>
            <span>{stageInfo.label}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
