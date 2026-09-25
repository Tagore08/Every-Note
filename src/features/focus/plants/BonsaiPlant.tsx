import { type FC } from 'react';

export interface PlantProps {
  progress: number; // 0.0 to 1.0
  stage: 'seed' | 'growing' | 'bloomed' | 'withered';
  className?: string;
}

export const BonsaiPlant: FC<PlantProps> = ({ progress, stage, className = '' }) => {
  const isWithered = stage === 'withered';
  const isBloomed = stage === 'bloomed' || progress >= 1;
  const isSeed = stage === 'seed' || (stage === 'growing' && progress < 0.15);

  // Growth interpolation factors
  const growth = isWithered ? 0.7 : Math.min(1, Math.max(0, progress));
  const stemHeight = 15 + growth * 45; // 15px -> 60px
  const foliageScale = isSeed ? 0 : Math.min(1, (growth - 0.15) / 0.7);

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 220 220"
        className="w-full h-full max-w-[240px] max-h-[240px] transition-all duration-700 ease-out"
      >
        <defs>
          {/* Pot Gradient */}
          <linearGradient id="bonsaiPotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          {/* Trunk Gradient */}
          <linearGradient id="bonsaiTrunkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={isWithered ? '#78716c' : '#854d0e'} />
            <stop offset="100%" stopColor={isWithered ? '#57534e' : '#713f12'} />
          </linearGradient>

          {/* Foliage Gradients */}
          <radialGradient id="bonsaiLeafGrad" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stopColor={isWithered ? '#a8a29e' : '#4ade80'} />
            <stop offset="70%" stopColor={isWithered ? '#78716c' : '#16a34a'} />
            <stop offset="100%" stopColor={isWithered ? '#57534e' : '#14532d'} />
          </radialGradient>

          {/* Blossom Gradient */}
          <radialGradient id="bonsaiBlossomGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#fdf2f8" />
            <stop offset="60%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#db2777" />
          </radialGradient>
        </defs>

        {/* Ambient Ground Pedestal */}
        <ellipse cx="110" cy="195" rx="75" ry="12" fill="currentColor" className="text-slate-300/40 dark:text-slate-900/60" />

        {/* Bonsai Ceramic Pot */}
        <g id="pot">
          {/* Pot Feet */}
          <rect x="68" y="184" width="14" height="6" rx="2" fill="#1e293b" />
          <rect x="138" y="184" width="14" height="6" rx="2" fill="#1e293b" />

          {/* Main Pot Body */}
          <path
            d="M 55 160 L 165 160 L 158 184 L 62 184 Z"
            fill="url(#bonsaiPotGrad)"
            stroke="#475569"
            strokeWidth="1.5"
          />
          {/* Pot Rim */}
          <rect x="50" y="156" width="120" height="7" rx="3.5" fill="#475569" />

          {/* Soil Mound */}
          <ellipse cx="110" cy="158" rx="52" ry="7" fill={isWithered ? '#57534e' : '#451a03'} />
        </g>

        {/* SEED STAGE */}
        {isSeed && (
          <g id="seed-stage" className="transition-opacity duration-500">
            {/* Seed Body in Soil */}
            <ellipse cx="110" cy="154" rx="6" ry="4" fill="#92400e" stroke="#713f12" strokeWidth="1" />
            {/* Tiny First Shoot */}
            <path
              d="M 110 152 Q 108 144 112 140"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 112 140 Q 116 138 116 142 Q 114 144 112 140"
              fill="#4ade80"
            />
            <path
              d="M 112 140 Q 106 138 107 143 Q 110 144 112 140"
              fill="#22c55e"
            />
          </g>
        )}

        {/* TREE GROWTH STAGE */}
        {!isSeed && (
          <g id="tree" className={`transition-all duration-700 ${isWithered ? 'rotate-6 origin-bottom' : ''}`}>
            {/* Main Trunk */}
            <path
              d={
                isWithered
                  ? `M 106 155 Q 104 135 95 ${155 - stemHeight * 0.7} Q 92 ${155 - stemHeight} 100 ${155 - stemHeight} Q 112 ${155 - stemHeight * 0.6} 114 155 Z`
                  : `M 106 155 Q 102 130 96 ${155 - stemHeight * 0.6} Q 94 ${155 - stemHeight} 110 ${155 - stemHeight} Q 116 ${155 - stemHeight * 0.5} 114 155 Z`
              }
              fill="url(#bonsaiTrunkGrad)"
            />

            {/* Left Branch */}
            {growth > 0.3 && (
              <path
                d={
                  isWithered
                    ? `M 100 ${155 - stemHeight * 0.5} Q 80 ${155 - stemHeight * 0.4} 70 ${155 - stemHeight * 0.35}`
                    : `M 100 ${155 - stemHeight * 0.5} Q 82 ${155 - stemHeight * 0.55} 72 ${155 - stemHeight * 0.58}`
                }
                stroke="url(#bonsaiTrunkGrad)"
                strokeWidth={isWithered ? 3.5 : 4.5}
                strokeLinecap="round"
                fill="none"
              />
            )}

            {/* Right Branch */}
            {growth > 0.45 && (
              <path
                d={
                  isWithered
                    ? `M 105 ${155 - stemHeight * 0.7} Q 130 ${155 - stemHeight * 0.6} 145 ${155 - stemHeight * 0.5}`
                    : `M 105 ${155 - stemHeight * 0.7} Q 128 ${155 - stemHeight * 0.75} 144 ${155 - stemHeight * 0.8}`
                }
                stroke="url(#bonsaiTrunkGrad)"
                strokeWidth={isWithered ? 3 : 4}
                strokeLinecap="round"
                fill="none"
              />
            )}

            {/* FOLIAGE CLUSTERS */}
            {foliageScale > 0 && (
              <g
                id="foliage"
                style={{
                  transform: `scale(${foliageScale})`,
                  transformOrigin: '110px 140px',
                  transition: 'transform 0.5s ease-out',
                }}
              >
                {/* Center Crown Cluster */}
                <ellipse
                  cx={isWithered ? 104 : 112}
                  cy={isWithered ? 155 - stemHeight + 8 : 155 - stemHeight - 6}
                  rx={26 * foliageScale}
                  ry={17 * foliageScale}
                  fill="url(#bonsaiLeafGrad)"
                />
                <ellipse
                  cx={isWithered ? 96 : 100}
                  cy={isWithered ? 155 - stemHeight + 4 : 155 - stemHeight - 12}
                  rx={20 * foliageScale}
                  ry={14 * foliageScale}
                  fill="url(#bonsaiLeafGrad)"
                  opacity="0.95"
                />

                {/* Left Branch Foliage */}
                {growth > 0.35 && (
                  <ellipse
                    cx={isWithered ? 68 : 70}
                    cy={isWithered ? 155 - stemHeight * 0.35 + 4 : 155 - stemHeight * 0.58}
                    rx={20 * foliageScale}
                    ry={13 * foliageScale}
                    fill="url(#bonsaiLeafGrad)"
                  />
                )}

                {/* Right Branch Foliage */}
                {growth > 0.5 && (
                  <ellipse
                    cx={isWithered ? 144 : 146}
                    cy={isWithered ? 155 - stemHeight * 0.5 + 4 : 155 - stemHeight * 0.8}
                    rx={22 * foliageScale}
                    ry={14 * foliageScale}
                    fill="url(#bonsaiLeafGrad)"
                  />
                )}
              </g>
            )}

            {/* BLOOMED BLOSSOMS */}
            {isBloomed && (
              <g id="blossoms" className="animate-in fade-in zoom-in duration-700">
                {/* Blossom 1 - Center */}
                <circle cx="106" cy={155 - stemHeight - 14} r="4.5" fill="url(#bonsaiBlossomGrad)" />
                <circle cx="106" cy={155 - stemHeight - 14} r="1.5" fill="#fef08a" />

                {/* Blossom 2 - Top Right */}
                <circle cx="124" cy={155 - stemHeight - 8} r="4" fill="url(#bonsaiBlossomGrad)" />
                <circle cx="124" cy={155 - stemHeight - 8} r="1.2" fill="#fef08a" />

                {/* Blossom 3 - Left Branch */}
                <circle cx="68" cy={155 - stemHeight * 0.58 - 4} r="4" fill="url(#bonsaiBlossomGrad)" />
                <circle cx="68" cy={155 - stemHeight * 0.58 - 4} r="1.2" fill="#fef08a" />

                {/* Blossom 4 - Right Branch */}
                <circle cx="150" cy={155 - stemHeight * 0.8 - 4} r="4.5" fill="url(#bonsaiBlossomGrad)" />
                <circle cx="150" cy={155 - stemHeight * 0.8 - 4} r="1.5" fill="#fef08a" />

                {/* Sparkle Stars floating */}
                <g className="animate-pulse">
                  <path d="M 52 75 L 54 80 L 59 82 L 54 84 L 52 89 L 50 84 L 45 82 L 50 80 Z" fill="#fbcfe8" />
                  <path d="M 168 65 L 170 69 L 174 71 L 170 73 L 168 77 L 166 73 L 162 71 L 166 69 Z" fill="#fde047" />
                  <path d="M 112 45 L 114 48 L 118 50 L 114 52 L 112 55 L 110 52 L 106 50 L 110 48 Z" fill="#fbcfe8" />
                </g>
              </g>
            )}

            {/* WITHERED FALLEN LEAF */}
            {isWithered && (
              <g id="fallen-leaves">
                <ellipse cx="85" cy="159" rx="5" ry="2.5" fill="#78716c" transform="rotate(-15 85 159)" />
                <ellipse cx="132" cy="160" rx="4" ry="2" fill="#57534e" transform="rotate(25 132 160)" />
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
};
