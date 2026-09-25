export const AREA_PALETTE = [
  { id: 'area-1', color: 'var(--area-1, oklch(0.62 0.16 25))', label: 'Health' },
  { id: 'area-2', color: 'var(--area-2, oklch(0.58 0.13 250))', label: 'Work' },
  { id: 'area-3', color: 'var(--area-3, oklch(0.66 0.14 145))', label: 'Personal' },
  { id: 'area-4', color: 'var(--area-4, oklch(0.64 0.13 60))', label: 'Finance' },
  { id: 'area-5', color: 'var(--area-5, oklch(0.60 0.14 310))', label: 'Learning' },
  { id: 'area-6', color: 'var(--area-6, oklch(0.63 0.10 200))', label: 'Home' },
  { id: 'area-7', color: 'var(--area-7, oklch(0.61 0.17 0))', label: 'Relationships' },
  { id: 'area-8', color: 'var(--area-8, oklch(0.60 0.03 262))', label: 'Other' },
];

export interface ColorDotsProps {
  selectedColor?: string | null;
  onChange: (color: string) => void;
  className?: string;
}

export function ColorDots({
  selectedColor,
  onChange,
  className = '',
}: ColorDotsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Color selector"
      className={`flex items-center gap-2 flex-wrap ${className}`}
    >
      {AREA_PALETTE.map((item) => {
        const isSelected = selectedColor === item.color || selectedColor === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={item.label}
            title={item.label}
            onClick={() => onChange(item.color)}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer min-w-[44px] min-h-[44px]"
          >
            <span
              className={`w-6 h-6 rounded-full transition-all ${
                isSelected
                  ? 'ring-2 ring-offset-2 ring-ink ring-offset-surface scale-110'
                  : 'hover:scale-105 opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundColor: item.color }}
            />
          </button>
        );
      })}
    </div>
  );
}
