import { useState, useMemo } from 'react';
import { Sheet } from '../../../design/ui/Sheet';
import {
  PLANT_LIBRARY,
  PLANT_CATEGORIES,
  type PlantCategoryId,
  type PlantVariety,
} from './plantLibrary';

export interface PlantLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlantId: string;
  onSelectPlant: (plantId: string) => void;
}

export function PlantLibraryModal({
  isOpen,
  onClose,
  selectedPlantId,
  onSelectPlant,
}: PlantLibraryModalProps) {
  const [activeCategory, setActiveCategory] = useState<PlantCategoryId | 'all'>('all');

  const filteredPlants = useMemo(() => {
    if (activeCategory === 'all') return PLANT_LIBRARY;
    return PLANT_LIBRARY.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const handleSelect = (plant: PlantVariety) => {
    onSelectPlant(plant.id);
    onClose();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Plant Library"
      description="Choose a companion for your focus sessions based on water and maintenance needs."
      maxHeight="max-h-[90vh]"
    >
      <div className="space-y-4 pb-6 select-none">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            All Varieties ({PLANT_LIBRARY.length})
          </button>

          {PLANT_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            const count = PLANT_LIBRARY.filter((p) => p.category === cat.id).length;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.badge}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Plants Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
          {filteredPlants.map((plant) => {
            const isCurrent = selectedPlantId === plant.id;
            return (
              <div
                key={plant.id}
                onClick={() => handleSelect(plant)}
                className={`p-3.5 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-3xl p-2 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                        {plant.icon}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {plant.name}
                          </h4>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] italic text-slate-400">
                          {plant.scientificName}
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {plant.description}
                  </p>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                      💧 {plant.waterNeeds}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                      ☀️ {plant.sunlight}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2 flex items-center justify-end">
                  <button
                    type="button"
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-600 hover:text-white'
                    }`}
                  >
                    {isCurrent ? 'Current Companion' : 'Choose Plant'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
