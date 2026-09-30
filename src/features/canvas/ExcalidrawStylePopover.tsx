import type { CanvasElement, FillStyle, StrokeStyle } from '../../types/canvas';

interface ExcalidrawStylePopoverProps {
  element: CanvasElement | null;
  currentStrokeColor: string;
  currentBgColor: string;
  currentFillStyle: FillStyle;
  currentStrokeWidth: number;
  currentStrokeStyle: StrokeStyle;
  currentRoughness: number;
  currentRoundness: number;
  onUpdateElement: (patch: Partial<CanvasElement>) => void;
  onDeleteElement?: () => void;
  onDuplicateElement?: () => void;
  onOpenCardNote?: (noteId: number) => void;
}

const STROKE_COLORS = [
  '#18181b', // Ink Black
  '#e03131', // Red
  '#2f9e44', // Green
  '#1971c2', // Blue
  '#f08c00', // Amber
  '#9c36b5', // Purple
  '#0ca678', // Teal
  '#868e96', // Slate
];

const BG_COLORS = [
  'transparent',
  '#ffffff',
  '#ffc9c9',
  '#b2f2bb',
  '#a5d8ff',
  '#ffec99',
  '#eebefa',
  '#63e6be',
];

export function ExcalidrawStylePopover({
  element,
  currentStrokeColor,
  currentBgColor,
  currentFillStyle,
  currentStrokeWidth,
  currentStrokeStyle,
  currentRoughness,
  currentRoundness,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onOpenCardNote,
}: ExcalidrawStylePopoverProps) {
  const strokeColor = element ? element.strokeColor : currentStrokeColor;
  const bgColor = element ? element.backgroundColor : currentBgColor;
  const fillStyle = element ? element.fillStyle : currentFillStyle;
  const strokeWidth = element ? element.strokeWidth : currentStrokeWidth;
  const strokeStyle = element ? element.strokeStyle : currentStrokeStyle;
  const roughness = element ? element.roughness : currentRoughness;
  const roundness = element ? element.roundness : currentRoundness;

  return (
    <div className="flex flex-col gap-3 p-3 bg-surface/95 dark:bg-surface/95 backdrop-blur-md border border-border rounded-xl shadow-float text-ink text-xs w-64 select-none">
      {/* Title / Element type tag */}
      <div className="flex items-center justify-between border-b border-border/60 pb-2">
        <span className="font-semibold text-ink uppercase tracking-wider text-[10px]">
          {element ? `${element.type} Properties` : 'Default Styles'}
        </span>
        {element && (
          <div className="flex items-center gap-1">
            {element.type === 'card' && element.noteId && onOpenCardNote && (
              <button
                type="button"
                onClick={() => onOpenCardNote(element.noteId!)}
                className="px-2 py-0.5 rounded-md bg-accent/10 hover:bg-accent/20 text-accent font-medium text-[10px] cursor-pointer"
                title="Open note in editor"
              >
                Open Note
              </button>
            )}
            {onDuplicateElement && (
              <button
                type="button"
                onClick={onDuplicateElement}
                className="p-1 rounded-md text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
                title="Duplicate (Ctrl+D)"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            )}
            {onDeleteElement && (
              <button
                type="button"
                onClick={onDeleteElement}
                className="p-1 rounded-md text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Delete element"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stroke Color */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-ink-muted">Stroke</label>
        <div className="flex items-center gap-1.5 flex-wrap">
          {STROKE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onUpdateElement({ strokeColor: c })}
              className={`w-5 h-5 rounded-full border border-black/15 dark:border-white/20 transition-transform cursor-pointer shrink-0 ${
                strokeColor === c ? 'ring-2 ring-accent ring-offset-1 scale-110' : 'hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Background Fill Color (only for closed shapes or cards) */}
      {(!element || ['rectangle', 'diamond', 'ellipse', 'card'].includes(element.type)) && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-ink-muted">Background</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {BG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onUpdateElement({ backgroundColor: c })}
                className={`w-5 h-5 rounded-full border border-black/15 dark:border-white/20 transition-transform cursor-pointer shrink-0 relative overflow-hidden ${
                  bgColor === c ? 'ring-2 ring-accent ring-offset-1 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: c === 'transparent' ? '#fff' : c }}
                title={c === 'transparent' ? 'Transparent' : c}
              >
                {c === 'transparent' && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-red-500 font-bold">
                    /
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Fill Style */}
      {(!element || ['rectangle', 'diamond', 'ellipse'].includes(element.type)) && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-ink-muted">Fill Style</label>
          <div className="grid grid-cols-4 gap-1 p-0.5 bg-surface-2 rounded-lg border border-border">
            {(['none', 'semi', 'solid', 'hachure'] as FillStyle[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onUpdateElement({ fillStyle: f })}
                className={`py-1 text-center text-[10px] font-medium rounded capitalize cursor-pointer transition-colors ${
                  fillStyle === f ? 'bg-surface text-accent shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stroke Width */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-ink-muted">Stroke Width</label>
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-surface-2 rounded-lg border border-border">
          {[
            { label: 'Thin', val: 2 },
            { label: 'Medium', val: 4 },
            { label: 'Bold', val: 8 },
          ].map((w) => (
            <button
              key={w.val}
              type="button"
              onClick={() => onUpdateElement({ strokeWidth: w.val })}
              className={`py-1 text-center text-[10px] font-medium rounded cursor-pointer transition-colors ${
                strokeWidth === w.val ? 'bg-surface text-accent shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stroke Style */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-ink-muted">Stroke Style</label>
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-surface-2 rounded-lg border border-border">
          {(['solid', 'dashed', 'dotted'] as StrokeStyle[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onUpdateElement({ strokeStyle: s })}
              className={`py-1 text-center text-[10px] font-medium rounded capitalize cursor-pointer transition-colors ${
                strokeStyle === s ? 'bg-surface text-accent shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Sloppiness / Roughness */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-medium text-ink-muted">Sloppiness</label>
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-surface-2 rounded-lg border border-border">
          {[
            { label: 'Neat', val: 0 },
            { label: 'Sketchy', val: 1 },
            { label: 'Cartoon', val: 2 },
          ].map((r) => (
            <button
              key={r.val}
              type="button"
              onClick={() => onUpdateElement({ roughness: r.val })}
              className={`py-1 text-center text-[10px] font-medium rounded cursor-pointer transition-colors ${
                roughness === r.val ? 'bg-surface text-accent shadow-xs' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Roundness (rectangle / card only) */}
      {(!element || ['rectangle', 'card'].includes(element.type)) && (
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-ink-muted">Corners</label>
          <div className="grid grid-cols-2 gap-1 p-0.5 bg-surface-2 rounded-lg border border-border">
            {[
              { label: 'Sharp', val: 0 },
              { label: 'Rounded', val: 1 },
            ].map((c) => (
              <button
                key={c.val}
                type="button"
                onClick={() => onUpdateElement({ roundness: c.val })}
                className={`py-1 text-center text-[10px] font-medium rounded cursor-pointer transition-colors ${
                  roundness === c.val ? 'bg-surface text-accent shadow-xs' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
