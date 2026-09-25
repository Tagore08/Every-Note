import { type FC } from 'react';
import type { PlantProps } from './BonsaiPlant';

export const SunflowerPlant: FC<PlantProps> = ({ progress, stage, className = '' }) => {
  const isWithered = stage === 'withered';
  const isBloomed = stage === 'bloomed' || progress >= 1;
  const isSeed = stage === 'seed' || (stage === 'growing' && progress < 0.15);

  const growth = isWithered ? 0.75 : Math.min(1, Math.max(0, progress));
  const stemHeight = 20 + growth * 70; // 20px -> 90px
  const leafScale = isSeed ? 0 : Math.min(1, (growth - 0.15) / 0.6);
  const headScale = isSeed ? 0 : isBloomed ? 1 : Math.min(0.9, (growth - 0.3) / 0.7);

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 220 220"
        className="w-full h-full max-w-[240px] max-h-[240px] transition-all duration-700 ease-out"
      >
        <defs>
          {/* Terracotta Pot Gradient */}
          <linearGradient id="sunPotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#9a3412" />
          </linearGradient>

          {/* Stem Gradient */}
          <linearGradient id="sunStemGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isWithered ? '#78716c' : '#4ade80'} />
            <stop offset="100%" stopColor={isWithered ? '#57534e' : '#15803d'} />
          </linearGradient>

          {/* Petal Gradient */}
          <linearGradient id="sunPetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isWithered ? '#a8a29e' : '#fde047'} />
            <stop offset="100%" stopColor={isWithered ? '#78716c' : '#ca8a04'} />
          </linearGradient>

          {/* Flower Center Gradient */}
          <radialGradient id="sunCenterGrad" cx="45%" cy="45%" r="55%">
            <stop offset="0%" stopColor={isWithered ? '#57534e' : '#713f12'} />
            <stop offset="85%" stopColor={isWithered ? '#44403c' : '#451a03'} />
            <stop offset="100%" stopColor="#1c1917" />
          </radialGradient>
        </defs>

        {/* Ambient Ground Pedestal */}
        <ellipse cx="110" cy="195" rx="75" ry="12" fill="currentColor" className="text-slate-300/40 dark:text-slate-900/60" />

        {/* Terracotta Pot */}
        <g id="pot">
          <path
            d="M 68 152 L 152 152 L 142 186 L 78 186 Z"
            fill="url(#sunPotGrad)"
            stroke="#9a3412"
            strokeWidth="1.5"
          />
          {/* Pot Rim */}
          <rect x="64" y="146" width="92" height="9" rx="3" fill="#ea580c" stroke="#9a3412" strokeWidth="1" />
          {/* Soil Mound */}
          <ellipse cx="110" cy="148" rx="42" ry="6" fill={isWithered ? '#57534e' : '#451a03'} />
        </g>

        {/* SEED STAGE */}
        {isSeed && (
          <g id="seed-stage" className="transition-opacity duration-500">
            {/* Seed Body */}
            <ellipse cx="110" cy="144" rx="5" ry="3.5" fill="#3f3f46" stroke="#18181b" strokeWidth="1" />
            <line x1="108" y1="142" x2="112" y2="146" stroke="#71717a" strokeWidth="0.8" />
            {/* Baby Sprout */}
            <path
              d="M 110 142 Q 112 135 110 130"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="108" cy="130" r="2.5" fill="#4ade80" />
            <circle cx="112" cy="130" r="2.5" fill="#22c55e" />
          </g>
        )}

        {/* STEM & LEAVES */}
        {!isSeed && (
          <g id="sunflower-growth">
            {/* Main Stem */}
            <path
              d={
                isWithered
                  ? `M 110 148 Q 112 110 95 ${148 - stemHeight * 0.7} Q 80 ${148 - stemHeight * 0.9} 85 ${148 - stemHeight}`
                  : `M 110 148 Q 108 ${148 - stemHeight * 0.5} 110 ${148 - stemHeight}`
              }
              stroke="url(#sunStemGrad)"
              strokeWidth={isWithered ? 4.5 : 5.5}
              strokeLinecap="round"
              fill="none"
            />

            {/* Lower Leaves */}
            {leafScale > 0 && (
              <g
                id="leaves"
                style={{
                  transform: `scale(${leafScale})`,
                  transformOrigin: '110px 130px',
                  transition: 'transform 0.5s ease-out',
                }}
              >
                {/* Left Leaf */}
                <path
                  d={
                    isWithered
                      ? "M 108 126 C 90 128 72 142 66 150 C 74 148 94 140 108 132"
                      : "M 108 126 C 88 120 70 126 62 118 C 72 132 94 136 108 132"
                  }
                  fill={isWithered ? '#78716c' : '#22c55e'}
                  stroke={isWithered ? '#57534e' : '#15803d'}
                  strokeWidth="0.8"
                />

                {/* Right Leaf */}
                {growth > 0.35 && (
                  <path
                    d={
                      isWithered
                        ? "M 112 114 C 130 118 148 132 152 142 C 144 138 126 128 112 120"
                        : "M 112 114 C 132 108 150 114 158 106 C 148 120 126 124 112 120"
                    }
                    fill={isWithered ? '#78716c' : '#16a34a'}
                    stroke={isWithered ? '#57534e' : '#14532d'}
                    strokeWidth="0.8"
                  />
                )}
              </g>
            )}

            {/* FLOWER HEAD / BUD */}
            {headScale > 0 && (
              <g
                id="flower-head"
                transform={
                  isWithered
                    ? `translate(85, ${148 - stemHeight}) rotate(35)`
                    : `translate(110, ${148 - stemHeight})`
                }
                style={{
                  transformOrigin: 'center',
                  transition: 'transform 0.5s ease-out',
                }}
              >
                {!isBloomed && !isWithered ? (
                  /* UNOPENED BUD STAGE */
                  <g id="bud">
                    <circle cx="0" cy="0" r={14 * headScale} fill="#15803d" />
                    <circle cx="0" cy="0" r={8 * headScale} fill="#facc15" />
                    {/* Calyx sepals */}
                    <path d="M -12 2 Q 0 -16 12 2" stroke="#16a34a" strokeWidth="2.5" fill="none" />
                    <path d="M -8 10 Q 0 -18 8 10" stroke="#15803d" strokeWidth="2.5" fill="none" />
                  </g>
                ) : (
                  /* BLOOMED OR WITHERED FLOWER */
                  <g id="full-flower">
                    {/* Radiant Golden Petals (12 petals in circle) */}
                    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, idx) => {
                      if (isWithered && idx % 3 === 0) return null; // Missing petals when withered
                      return (
                        <path
                          key={angle}
                          d={
                            isWithered
                              ? "M 0 0 C -4 -12 -2 -22 0 -26 C 2 -22 4 -12 0 0"
                              : "M 0 0 C -7 -14 -6 -32 0 -36 C 6 -32 7 -14 0 0"
                          }
                          fill="url(#sunPetalGrad)"
                          stroke={isWithered ? '#78716c' : '#eab308'}
                          strokeWidth="0.8"
                          transform={`rotate(${angle})`}
                          className="transition-all duration-500"
                        />
                      );
                    })}

                    {/* Flower Center Disc */}
                    <circle
                      cx="0"
                      cy="0"
                      r={isWithered ? 13 : 16}
                      fill="url(#sunCenterGrad)"
                      stroke={isWithered ? '#44403c' : '#713f12'}
                      strokeWidth="1.5"
                    />

                    {/* Center Seeds Texture Pattern */}
                    {!isWithered && (
                      <g fill="#ca8a04" opacity="0.6">
                        <circle cx="-5" cy="-5" r="1.2" />
                        <circle cx="0" cy="-6" r="1.2" />
                        <circle cx="5" cy="-5" r="1.2" />
                        <circle cx="-6" cy="0" r="1.2" />
                        <circle cx="0" cy="0" r="1.5" fill="#fde047" />
                        <circle cx="6" cy="0" r="1.2" />
                        <circle cx="-5" cy="5" r="1.2" />
                        <circle cx="0" cy="6" r="1.2" />
                        <circle cx="5" cy="5" r="1.2" />
                      </g>
                    )}
                  </g>
                )}
              </g>
            )}

            {/* Sparkles on Bloom */}
            {isBloomed && (
              <g id="bloomed-sparkles" className="animate-pulse">
                <circle cx="65" cy="50" r="2.5" fill="#fef08a" />
                <path d="M 65 42 L 67 47 L 72 49 L 67 51 L 65 56 L 63 51 L 58 49 L 63 47 Z" fill="#fde047" />
                <path d="M 155 45 L 157 49 L 161 51 L 157 53 L 155 57 L 153 53 L 149 51 L 153 49 Z" fill="#fde047" />
                <circle cx="152" cy="70" r="2" fill="#fef08a" />
              </g>
            )}

            {/* Fallen Dried Petals on Wither */}
            {isWithered && (
              <g id="fallen-petals">
                <path d="M 88 150 Q 82 153 80 151 Q 84 148 88 150" fill="#78716c" />
                <path d="M 130 152 Q 136 155 138 153 Q 134 150 130 152" fill="#57534e" />
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
};
