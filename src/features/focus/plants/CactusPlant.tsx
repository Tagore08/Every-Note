import { type FC } from 'react';
import type { PlantProps } from './BonsaiPlant';

export const CactusPlant: FC<PlantProps> = ({ progress, stage, className = '' }) => {
  const isWithered = stage === 'withered';
  const isBloomed = stage === 'bloomed' || progress >= 1;
  const isSeed = stage === 'seed' || (stage === 'growing' && progress < 0.15);

  const growth = isWithered ? 0.75 : Math.min(1, Math.max(0, progress));
  const bodyHeight = 25 + growth * 55; // 25px -> 80px
  const armScale = isSeed ? 0 : Math.min(1, (growth - 0.35) / 0.5);
  const flowerScale = isSeed ? 0 : isBloomed ? 1 : Math.min(0.8, (growth - 0.5) / 0.5);

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 220 220"
        className="w-full h-full max-w-[240px] max-h-[240px] transition-all duration-700 ease-out"
      >
        <defs>
          {/* Ceramic Pot Gradient */}
          <linearGradient id="cacPotGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          {/* Cactus Body Gradient */}
          <linearGradient id="cacBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={isWithered ? '#64748b' : '#059669'} />
            <stop offset="50%" stopColor={isWithered ? '#94a3b8' : '#10b981'} />
            <stop offset="100%" stopColor={isWithered ? '#475569' : '#047857'} />
          </linearGradient>

          {/* Desert Flower Gradient */}
          <radialGradient id="cacFlowerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="60%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#9f1239" />
          </radialGradient>
        </defs>

        {/* Ambient Ground Pedestal */}
        <ellipse cx="110" cy="195" rx="75" ry="12" fill="currentColor" className="text-slate-300/40 dark:text-slate-900/60" />

        {/* Glazed Ceramic Bowl Pot */}
        <g id="pot">
          <path
            d="M 64 150 C 64 186 78 188 110 188 C 142 188 156 186 156 150 Z"
            fill="url(#cacPotGrad)"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />
          {/* Pot Rim */}
          <ellipse cx="110" cy="150" rx="46" ry="7" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1.2" />

          {/* White Pebbles & Soil */}
          <ellipse cx="110" cy="150" rx="42" ry="5.5" fill={isWithered ? '#64748b' : '#78716c'} />
          <circle cx="85" cy="150" r="2.5" fill="#f1f5f9" />
          <circle cx="95" cy="152" r="2.8" fill="#e2e8f0" />
          <circle cx="125" cy="151" r="3" fill="#f8fafc" />
          <circle cx="135" cy="149" r="2.3" fill="#e2e8f0" />
        </g>

        {/* SEED STAGE */}
        {isSeed && (
          <g id="seed-stage" className="transition-opacity duration-500">
            <ellipse cx="110" cy="146" rx="5" ry="3.5" fill="#475569" />
            {/* Baby Succulent Nub */}
            <path
              d="M 106 146 C 106 138 114 138 114 146 Z"
              fill="#10b981"
              stroke="#047857"
              strokeWidth="1"
            />
            <circle cx="110" cy="140" r="1.5" fill="#34d399" />
          </g>
        )}

        {/* CACTUS GROWTH */}
        {!isSeed && (
          <g
            id="cactus"
            className={`transition-all duration-700 ${isWithered ? 'rotate-12 origin-bottom' : ''}`}
          >
            {/* Main Trunk Body */}
            <path
              d={
                isWithered
                  ? `M 98 150 C 92 130 92 ${150 - bodyHeight * 0.7} 96 ${150 - bodyHeight} C 102 ${150 - bodyHeight - 12} 118 ${150 - bodyHeight - 12} 122 ${150 - bodyHeight} C 126 ${150 - bodyHeight * 0.7} 122 130 122 150 Z`
                  : `M 96 150 C 94 130 94 ${150 - bodyHeight * 0.7} 95 ${150 - bodyHeight} C 96 ${150 - bodyHeight - 14} 124 ${150 - bodyHeight - 14} 125 ${150 - bodyHeight} C 126 ${150 - bodyHeight * 0.7} 126 130 124 150 Z`
              }
              fill="url(#cacBodyGrad)"
              stroke={isWithered ? '#475569' : '#047857'}
              strokeWidth="1.2"
            />

            {/* Vertical Rib Lines on Main Body */}
            <path
              d={
                isWithered
                  ? `M 104 150 Q 102 125 106 ${150 - bodyHeight}`
                  : `M 104 150 Q 103 ${150 - bodyHeight * 0.5} 104 ${150 - bodyHeight - 6}`
              }
              stroke={isWithered ? '#475569' : '#047857'}
              strokeWidth="1"
              strokeDasharray="2 4"
              fill="none"
            />
            <path
              d={
                isWithered
                  ? `M 116 150 Q 114 125 116 ${150 - bodyHeight}`
                  : `M 116 150 Q 117 ${150 - bodyHeight * 0.5} 116 ${150 - bodyHeight - 6}`
              }
              stroke={isWithered ? '#475569' : '#047857'}
              strokeWidth="1"
              strokeDasharray="2 4"
              fill="none"
            />

            {/* Left Arm */}
            {armScale > 0 && (
              <g
                id="left-arm"
                style={{
                  transform: `scale(${armScale})`,
                  transformOrigin: '95px 120px',
                  transition: 'transform 0.5s ease-out',
                }}
              >
                <path
                  d="M 96 125 C 78 125 76 110 76 96 C 76 90 88 90 88 96 C 88 104 88 114 96 114 Z"
                  fill="url(#cacBodyGrad)"
                  stroke={isWithered ? '#475569' : '#047857'}
                  strokeWidth="1.2"
                />
              </g>
            )}

            {/* Right Arm */}
            {armScale > 0.4 && (
              <g
                id="right-arm"
                style={{
                  transform: `scale(${armScale})`,
                  transformOrigin: '125px 110px',
                  transition: 'transform 0.5s ease-out',
                }}
              >
                <path
                  d="M 124 116 C 142 116 144 102 144 88 C 144 82 132 82 132 88 C 132 96 132 105 124 105 Z"
                  fill="url(#cacBodyGrad)"
                  stroke={isWithered ? '#475569' : '#047857'}
                  strokeWidth="1.2"
                />
              </g>
            )}

            {/* Crown Flower or Bud */}
            {flowerScale > 0 && (
              <g
                id="crown-flower"
                transform={
                  isWithered
                    ? `translate(110, ${150 - bodyHeight}) rotate(30)`
                    : `translate(110, ${150 - bodyHeight - 12})`
                }
                style={{
                  transformOrigin: 'center',
                  transition: 'transform 0.5s ease-out',
                }}
              >
                {!isBloomed && !isWithered ? (
                  /* BUD STAGE */
                  <g id="flower-bud">
                    <circle cx="0" cy="0" r={6 * flowerScale} fill="#f43f5e" />
                    <path d="M -4 2 Q 0 -6 4 2" stroke="#be123c" strokeWidth="1.5" fill="none" />
                  </g>
                ) : (
                  /* FULL DESERT FLOWER */
                  <g id="full-bloom">
                    {/* Petal Starburst (8 pointed petals) */}
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                      <path
                        key={angle}
                        d={
                          isWithered
                            ? "M 0 0 C -2 -6 -1 -12 0 -14 C 1 -12 2 -6 0 0"
                            : "M 0 0 C -4 -8 -3 -18 0 -22 C 3 -18 4 -8 0 0"
                        }
                        fill={isWithered ? '#64748b' : 'url(#cacFlowerGrad)'}
                        stroke={isWithered ? '#475569' : '#be123c'}
                        strokeWidth="0.8"
                        transform={`rotate(${angle})`}
                      />
                    ))}
                    {/* Inner Yellow Core */}
                    <circle cx="0" cy="0" r={isWithered ? 3 : 5} fill={isWithered ? '#475569' : '#fde047'} />
                    {!isWithered && (
                      <circle cx="0" cy="0" r={2} fill="#ea580c" />
                    )}
                  </g>
                )}
              </g>
            )}

            {/* Sparkles on Bloom */}
            {isBloomed && (
              <g id="desert-sparkles" className="animate-pulse">
                <path d="M 65 65 L 67 69 L 71 71 L 67 73 L 65 77 L 63 73 L 59 71 L 63 69 Z" fill="#fb7185" />
                <path d="M 155 55 L 157 58 L 160 60 L 157 62 L 155 65 L 153 62 L 150 60 L 153 58 Z" fill="#fde047" />
                <circle cx="110" cy="30" r="2.5" fill="#f43f5e" />
              </g>
            )}
          </g>
        )}
      </svg>
    </div>
  );
};
