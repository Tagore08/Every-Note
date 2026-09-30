import { type FC } from 'react';
import { DynamicSkyBalcony, type TimeOfDay } from './DynamicSkyBalcony';
import { UniversalPlant } from './UniversalPlant';
import { getPlantById, PLANT_LIBRARY } from './plantLibrary';

export type PlantType = string;
export type PlantStage = 'seed' | 'growing' | 'bloomed' | 'withered';

export interface PlantCanvasProps {
  plantType: PlantType;
  onSelectPlant?: (type: PlantType) => void;
  progress: number; // 0.0 to 1.0
  stage: PlantStage;
  isTimerRunning: boolean;
  className?: string;
  forceTimeOfDay?: TimeOfDay;
}

export const PLANT_OPTIONS = PLANT_LIBRARY.map((p) => ({
  id: p.id,
  label: p.name,
  icon: p.icon,
  name: p.name,
}));

export const PlantCanvas: FC<PlantCanvasProps> = ({
  plantType,
  progress,
  stage,
  className = '',
  forceTimeOfDay,
}) => {
  const currentPlant = getPlantById(plantType);

  const getStageInfo = () => {
    switch (stage) {
      case 'bloomed':
        return {
          label: 'Bloomed!',
          icon: '✨',
          color: 'bg-emerald-100/90 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-500/40',
        };
      case 'withered':
        return {
          label: 'Withered',
          icon: '🥀',
          color: 'bg-rose-100/90 dark:bg-rose-950/90 text-rose-800 dark:text-rose-200 border-rose-500/40',
        };
      case 'growing':
        if (progress < 0.25) {
          return {
            label: 'Sprouting',
            icon: '🌱',
            color: 'bg-blue-100/90 dark:bg-blue-950/90 text-blue-800 dark:text-blue-200 border-blue-500/40',
          };
        }
        if (progress < 0.75) {
          return {
            label: 'Growing',
            icon: '🌿',
            color: 'bg-emerald-100/90 dark:bg-emerald-950/90 text-emerald-800 dark:text-emerald-200 border-emerald-500/40',
          };
        }
        return {
          label: 'Budding',
          icon: '🌸',
          color: 'bg-amber-100/90 dark:bg-amber-950/90 text-amber-800 dark:text-amber-200 border-amber-500/40',
        };
      case 'seed':
      default:
        return {
          label: 'Planted Seed',
          icon: '🌰',
          color: 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700',
        };
    }
  };

  const stageInfo = getStageInfo();

  return (
    <div className={`relative w-full flex flex-col items-center justify-center select-none ${className}`}>
      {/* Dynamic Sky & Balcony Floor Background */}
      <DynamicSkyBalcony forceTimeOfDay={forceTimeOfDay}>
        {/* Plant resting on the balcony floor */}
        <div className="relative w-full h-full flex flex-col items-center justify-end pb-3 sm:pb-4">
          <UniversalPlant
            varietyId={plantType}
            progress={progress}
            stage={stage}
          />
        </div>

        {/* Plant name & stage badges */}
        <div className="absolute top-2.5 right-2.5 z-30 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-black/35 backdrop-blur-md text-white border border-white/15 shadow-xs">
            <span>{currentPlant.icon}</span>
            <span>{currentPlant.name}</span>
          </span>

          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border backdrop-blur-md shadow-xs transition-all ${stageInfo.color}`}
          >
            <span>{stageInfo.icon}</span>
            <span>{stageInfo.label}</span>
          </span>
        </div>
      </DynamicSkyBalcony>
    </div>
  );
};
