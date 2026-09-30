import { type FC } from 'react';
import { getPlantById } from './plantLibrary';

export interface UniversalPlantProps {
  varietyId: string;
  progress: number; // 0.0 to 1.0
  stage: 'seed' | 'growing' | 'bloomed' | 'withered';
  className?: string;
}

export const UniversalPlant: FC<UniversalPlantProps> = ({
  varietyId,
  progress,
  stage,
  className = '',
}) => {
  const variety = getPlantById(varietyId);
  const isWithered = stage === 'withered';
  const isBloomed = stage === 'bloomed' || progress >= 1;
  const isSeed = stage === 'seed' || (stage === 'growing' && progress < 0.15);

  // Smooth continuous growth factor 0.0 -> 1.0
  const growth = isWithered ? 0.65 : Math.min(1, Math.max(0, progress));

  // Render Pot according to potStyle with anime cel-shaded lighting
  const renderPot = () => {
    switch (variety.potStyle) {
      case 'terracotta':
        return (
          <g id="terracotta-pot">
            <path
              d="M 68 152 L 152 152 L 142 186 L 78 186 Z"
              fill="url(#animeTerracotta)"
              stroke="#7c2d12"
              strokeWidth="2"
            />
            {/* Cel-shaded shadow side */}
            <path d="M 68 152 L 95 152 L 87 186 L 78 186 Z" fill="black" opacity="0.15" />
            {/* Rim */}
            <rect x="64" y="146" width="92" height="9" rx="3" fill="#ea580c" stroke="#7c2d12" strokeWidth="2" />
            <rect x="66" y="148" width="40" height="2" fill="white" opacity="0.4" />
            <ellipse cx="110" cy="148" rx="42" ry="6" fill={isWithered ? '#44403c' : '#29180f'} />
          </g>
        );
      case 'stone':
        return (
          <g id="stone-pot">
            <path
              d="M 64 150 L 156 150 L 148 188 L 72 188 Z"
              fill="url(#animeStone)"
              stroke="#1e293b"
              strokeWidth="2"
            />
            <path d="M 64 150 L 90 150 L 82 188 L 72 188 Z" fill="black" opacity="0.18" />
            <rect x="60" y="145" width="100" height="8" rx="2" fill="#64748b" stroke="#1e293b" strokeWidth="2" />
            <line x1="64" y1="147" x2="105" y2="147" stroke="white" strokeWidth="1.5" opacity="0.5" />
            <ellipse cx="110" cy="147" rx="45" ry="6" fill={isWithered ? '#44403c' : '#1c1917'} />
          </g>
        );
      case 'porcelain':
        return (
          <g id="porcelain-pot">
            <path
              d="M 66 152 Q 62 170 76 186 L 144 186 Q 158 170 154 152 Z"
              fill="url(#animePorcelain)"
              stroke="#94a3b8"
              strokeWidth="2"
            />
            <rect x="62" y="147" width="96" height="8" rx="4" fill="#ffffff" stroke="#94a3b8" strokeWidth="2" />
            <line x1="66" y1="150" x2="154" y2="150" stroke="#f59e0b" strokeWidth="2" />
            <ellipse cx="110" cy="149" rx="44" ry="6" fill={isWithered ? '#44403c' : '#26170e'} />
          </g>
        );
      case 'bamboo':
        return (
          <g id="bamboo-pot">
            <rect x="66" y="152" width="88" height="34" rx="4" fill="url(#animeBamboo)" stroke="#78350f" strokeWidth="2" />
            <line x1="84" y1="152" x2="84" y2="186" stroke="#451a03" strokeWidth="1.5" />
            <line x1="102" y1="152" x2="102" y2="186" stroke="#451a03" strokeWidth="1.5" />
            <line x1="120" y1="152" x2="120" y2="186" stroke="#451a03" strokeWidth="1.5" />
            <line x1="138" y1="152" x2="138" y2="186" stroke="#451a03" strokeWidth="1.5" />
            <rect x="62" y="147" width="96" height="7" rx="3.5" fill="#d97706" stroke="#78350f" strokeWidth="2" />
            <ellipse cx="110" cy="149" rx="43" ry="5.5" fill={isWithered ? '#44403c' : '#26170e'} />
          </g>
        );
      case 'ceramic':
      default:
        return (
          <g id="ceramic-pot">
            <rect x="68" y="184" width="14" height="6" rx="2" fill="#0f172a" />
            <rect x="138" y="184" width="14" height="6" rx="2" fill="#0f172a" />
            <path
              d="M 55 160 L 165 160 L 158 184 L 62 184 Z"
              fill="url(#animeCeramic)"
              stroke="#0f172a"
              strokeWidth="2"
            />
            <path d="M 55 160 L 85 160 L 80 184 L 62 184 Z" fill="black" opacity="0.2" />
            <rect x="50" y="156" width="120" height="7" rx="3.5" fill="#334155" stroke="#0f172a" strokeWidth="1.5" />
            <line x1="56" y1="158" x2="100" y2="158" stroke="white" strokeWidth="1.5" opacity="0.4" />
            <ellipse cx="110" cy="158" rx="52" ry="7" fill={isWithered ? '#44403c' : '#26170e'} />
          </g>
        );
    }
  };

  // Render Anime Real-Look Plant Vegetation
  const renderPlantVegetation = () => {
    if (isSeed) {
      return (
        <g id="seed-sprout" className="animate-in fade-in duration-300">
          <ellipse cx="110" cy="146" rx="5" ry="3.5" fill="#78350f" stroke="#451a03" strokeWidth="1.5" />
          <path d="M 110 144 Q 107 135 112 130" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M 112 130 Q 116 127 116 132 Z" fill="#86efac" stroke="#15803d" strokeWidth="1" />
          <circle cx="112" cy="130" r="1.5" fill="#ffffff" opacity="0.8" />
        </g>
      );
    }

    const stemColor = isWithered ? '#78716c' : variety.primaryColor;
    const bloomColor = isWithered ? '#a8a29e' : variety.bloomedColor;

    switch (variety.id) {
      case 'cactus': {
        const height = 20 + growth * 54;
        const width = 18 + growth * 28;
        return (
          <g id="anime-cactus" className="transition-all duration-300">
            {/* Main Ribbed Cactus Stalk */}
            <rect
              x={110 - width / 2}
              y={148 - height}
              width={width}
              height={height}
              rx={width / 2}
              fill="url(#animeCactusGrad)"
              stroke={isWithered ? '#44403c' : '#065f46'}
              strokeWidth="2.5"
            />
            {/* Rib contour lines with spine clusters */}
            <line x1="110" y1={148 - height} x2="110" y2="148" stroke={isWithered ? '#57534e' : '#047857'} strokeWidth="2" />
            <line x1={110 - width / 4} y1={148 - height + 4} x2={110 - width / 4} y2="148" stroke={isWithered ? '#57534e' : '#047857'} strokeWidth="1.5" />
            <line x1={110 + width / 4} y1={148 - height + 4} x2={110 + width / 4} y2="148" stroke={isWithered ? '#57534e' : '#047857'} strokeWidth="1.5" />

            {/* Anime spines/needles */}
            {growth > 0.3 && (
              <g stroke="#fef08a" strokeWidth="1.5" strokeLinecap="round" opacity={isWithered ? 0.4 : 0.85}>
                <line x1={110 - width / 2} y1={148 - height * 0.4} x2={110 - width / 2 - 4} y2={148 - height * 0.4 - 2} />
                <line x1={110 + width / 2} y1={148 - height * 0.4} x2={110 + width / 2 + 4} y2={148 - height * 0.4 - 2} />
                <line x1={110 - width / 2} y1={148 - height * 0.7} x2={110 - width / 2 - 4} y2={148 - height * 0.7 - 2} />
                <line x1={110 + width / 2} y1={148 - height * 0.7} x2={110 + width / 2 + 4} y2={148 - height * 0.7 - 2} />
              </g>
            )}

            {/* Radiant Anime Flower Bloom */}
            {(isBloomed || growth > 0.75) && (
              <g id="cactus-bloom" transform={`translate(110, ${148 - height}) scale(${growth})`}>
                <ellipse cx="0" cy="-8" rx="10" ry="7" fill={bloomColor} stroke="#be123c" strokeWidth="1.5" />
                <ellipse cx="-5" cy="-7" rx="6" ry="8" fill="#fda4af" />
                <ellipse cx="5" cy="-7" rx="6" ry="8" fill="#fda4af" />
                <circle cx="0" cy="-8" r="4.5" fill="#fde047" stroke="#ca8a04" strokeWidth="1" />
                <circle cx="-1" cy="-9" r="1.5" fill="#ffffff" />
              </g>
            )}
          </g>
        );
      }

      case 'snake_plant': {
        const h = 25 + growth * 72;
        return (
          <g id="anime-snake-blades">
            {/* Center tall blade with yellow border & variegation */}
            <path
              d={`M 110 148 Q 105 ${148 - h * 0.55} 110 ${148 - h} Q 115 ${148 - h * 0.55} 110 148`}
              fill="url(#animeSnakeGrad)"
              stroke="#eab308"
              strokeWidth="2.5"
            />
            {/* Left curved blade */}
            <path
              d={`M 102 148 Q 90 ${148 - h * 0.5} 93 ${148 - h * 0.85} Q 100 ${148 - h * 0.5} 102 148`}
              fill="url(#animeSnakeGrad)"
              stroke="#eab308"
              strokeWidth="2"
            />
            {/* Right curved blade */}
            <path
              d={`M 118 148 Q 130 ${148 - h * 0.5} 127 ${148 - h * 0.85} Q 120 ${148 - h * 0.5} 118 148`}
              fill="url(#animeSnakeGrad)"
              stroke="#eab308"
              strokeWidth="2"
            />
          </g>
        );
      }

      case 'sunflower': {
        const stemH = 22 + growth * 70;
        const headScale = isBloomed ? 1 : Math.max(0.2, growth);
        return (
          <g id="anime-sunflower">
            {/* Thick sturdy stem with outline */}
            <path
              d={`M 110 148 Q ${isWithered ? '120' : '108'} ${148 - stemH * 0.5} 110 ${148 - stemH}`}
              stroke="#15803d"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={`M 110 148 Q ${isWithered ? '120' : '108'} ${148 - stemH * 0.5} 110 ${148 - stemH}`}
              stroke="#4ade80"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Broad anime leaves */}
            {growth > 0.28 && (
              <>
                <path
                  d={`M 108 ${148 - stemH * 0.38} Q 82 ${148 - stemH * 0.45} 80 ${148 - stemH * 0.3} Q 92 ${148 - stemH * 0.25} 108 ${148 - stemH * 0.38}`}
                  fill="#16a34a"
                  stroke="#14532d"
                  strokeWidth="1.5"
                />
                <path
                  d={`M 112 ${148 - stemH * 0.58} Q 138 ${148 - stemH * 0.65} 140 ${148 - stemH * 0.5} Q 128 ${148 - stemH * 0.45} 112 ${148 - stemH * 0.58}`}
                  fill="#16a34a"
                  stroke="#14532d"
                  strokeWidth="1.5"
                />
              </>
            )}

            {/* Vibrant anime sunflower head */}
            <g transform={`translate(110, ${148 - stemH}) scale(${headScale})`}>
              {Array.from({ length: 14 }).map((_, i) => (
                <ellipse
                  key={i}
                  cx="0"
                  cy="-17"
                  rx="4.5"
                  ry="10"
                  fill="url(#animeSunPetal)"
                  stroke="#ca8a04"
                  strokeWidth="1"
                  transform={`rotate(${i * 25.7})`}
                />
              ))}
              {/* Seed center with anime texture */}
              <circle cx="0" cy="0" r="11" fill="#451a03" stroke="#78350f" strokeWidth="2" />
              <circle cx="0" cy="0" r="8" fill="#29180f" />
              <circle cx="-3" cy="-3" r="2.5" fill="#fde047" opacity="0.7" />
            </g>
          </g>
        );
      }

      case 'bonsai': {
        const stemH = 16 + growth * 46;
        const foliageScale = isWithered ? 0.6 : Math.max(0.15, (growth - 0.15) / 0.85);
        return (
          <g id="anime-bonsai">
            {/* Classic Ghibli sculpted trunk */}
            <path
              d={`M 110 158 Q 125 138 102 ${158 - stemH} Q 90 ${158 - stemH - 10} 110 ${158 - stemH - 15}`}
              stroke="#451a03"
              strokeWidth="9"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={`M 110 158 Q 125 138 102 ${158 - stemH} Q 90 ${158 - stemH - 10} 110 ${158 - stemH - 15}`}
              stroke="#92400e"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Cloud canopy with anime shadows and highlights */}
            <g transform={`translate(110, ${158 - stemH - 15}) scale(${foliageScale})`}>
              {/* Dark base canopy */}
              <circle cx="-20" cy="-6" r="20" fill="#14532d" />
              <circle cx="18" cy="-8" r="22" fill="#14532d" />
              <circle cx="0" cy="-24" r="24" fill="#14532d" />

              {/* Lit foliage clusters */}
              <circle cx="-19" cy="-10" r="17" fill="#16a34a" />
              <circle cx="17" cy="-12" r="19" fill="#16a34a" />
              <circle cx="0" cy="-27" r="21" fill="#22c55e" />
              <circle cx="-5" cy="-32" r="12" fill="#86efac" opacity="0.6" />

              {/* Cherry blossoms if bloomed */}
              {isBloomed && (
                <g>
                  <circle cx="-14" cy="-16" r="4.5" fill="#f472b6" stroke="#db2777" strokeWidth="1" />
                  <circle cx="12" cy="-20" r="4.5" fill="#f472b6" stroke="#db2777" strokeWidth="1" />
                  <circle cx="3" cy="-32" r="5" fill="#fbcfe8" stroke="#db2777" strokeWidth="1" />
                  <circle cx="-24" cy="-8" r="3.5" fill="#fbcfe8" />
                  <circle cx="22" cy="-10" r="3.5" fill="#fbcfe8" />
                </g>
              )}
            </g>
          </g>
        );
      }

      case 'monstera': {
        const h = 20 + growth * 62;
        return (
          <g id="anime-monstera">
            <path d={`M 110 148 Q 104 ${148 - h * 0.5} 110 ${148 - h}`} stroke="#14532d" strokeWidth="4" fill="none" />
            <g transform={`translate(110, ${148 - h}) scale(${growth})`}>
              <path
                d="M 0 0 C -28 -12 -38 -45 0 -60 C 38 -45 28 -12 0 0 Z"
                fill="url(#animeMonsteraGrad)"
                stroke="#064e3b"
                strokeWidth="2"
              />
              {/* Highlight vein */}
              <path d="M 0 0 L 0 -55" stroke="#86efac" strokeWidth="1.5" opacity="0.6" />
              {growth > 0.5 && (
                <>
                  <ellipse cx="-13" cy="-32" rx="3.5" ry="8" fill="#1e293b" opacity="0.3" transform="rotate(-25, -13, -32)" />
                  <ellipse cx="13" cy="-32" rx="3.5" ry="8" fill="#1e293b" opacity="0.3" transform="rotate(25, 13, -32)" />
                </>
              )}
            </g>
          </g>
        );
      }

      case 'peace_lily': {
        const h = 20 + growth * 68;
        return (
          <g id="anime-peace-lily">
            <path d={`M 110 148 Q 96 ${148 - h * 0.5} 88 ${148 - h * 0.8}`} stroke="#14532d" strokeWidth="3" fill="none" />
            <path d={`M 110 148 Q 124 ${148 - h * 0.5} 132 ${148 - h * 0.8}`} stroke="#14532d" strokeWidth="3" fill="none" />
            <path d={`M 110 148 Q 108 ${148 - h * 0.6} 110 ${148 - h}`} stroke="#14532d" strokeWidth="3" fill="none" />
            {(isBloomed || growth > 0.7) && (
              <g transform={`translate(110, ${148 - h}) scale(${growth})`}>
                <path d="M 0 0 Q -12 -18 0 -34 Q 12 -18 0 0 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
                <line x1="0" y1="-6" x2="0" y2="-25" stroke="#facc15" strokeWidth="3" strokeLinecap="round" />
                <line x1="-3" y1="-18" x2="2" y2="-18" stroke="#fef08a" strokeWidth="1" />
              </g>
            )}
          </g>
        );
      }

      default: {
        const h = 20 + growth * 60;
        return (
          <g id="anime-generic-foliage">
            <path d={`M 110 148 Q ${isWithered ? '122' : '108'} ${148 - h * 0.5} 110 ${148 - h}`} stroke={stemColor} strokeWidth="3.5" fill="none" />
            <g transform={`translate(110, ${148 - h}) scale(${growth})`}>
              <ellipse cx="0" cy="-12" rx="16" ry="24" fill={stemColor} stroke="#0f172a" strokeWidth="1.5" />
              <ellipse cx="-16" cy="5" rx="14" ry="20" fill={stemColor} stroke="#0f172a" strokeWidth="1.5" transform="rotate(-35, -16, 5)" />
              <ellipse cx="16" cy="5" rx="14" ry="20" fill={stemColor} stroke="#0f172a" strokeWidth="1.5" transform="rotate(35, 16, 5)" />
              {/* Highlight */}
              <ellipse cx="-4" cy="-16" rx="8" ry="14" fill="#ffffff" opacity="0.25" />
              {isBloomed && (
                <circle cx="0" cy="-30" r="8" fill={bloomColor} stroke="#ffffff" strokeWidth="1.5" />
              )}
            </g>
          </g>
        );
      }
    }
  };

  return (
    <div className={`relative flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 220 220"
        className="w-56 h-56 sm:w-64 sm:h-64 transition-all duration-300 ease-out drop-shadow-md"
      >
        <defs>
          {/* Anime Gradients */}
          <linearGradient id="animeTerracotta" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="40%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#9a3412" />
          </linearGradient>

          <linearGradient id="animeStone" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="50%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          <linearGradient id="animePorcelain" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          <linearGradient id="animeBamboo" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#d97706" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          <linearGradient id="animeCeramic" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="60%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>

          <linearGradient id="animeCactusGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>

          <linearGradient id="animeSnakeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="50%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>

          <linearGradient id="animeSunPetal" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fef08a" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>

          <linearGradient id="animeMonsteraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="60%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
        </defs>

        {/* Ambient Ground Pedestal Shadow */}
        <ellipse cx="110" cy="190" rx="58" ry="7" fill="black" opacity="0.35" />

        {/* Pot */}
        {renderPot()}

        {/* Plant Stems & Foliage */}
        {renderPlantVegetation()}

        {/* Bloomed Celebration Star Dust */}
        {isBloomed && (
          <g className="animate-pulse">
            <text x="46" y="65" fontSize="16">✨</text>
            <text x="162" y="60" fontSize="16">✨</text>
            <text x="105" y="40" fontSize="18">🌸</text>
          </g>
        )}
      </svg>
    </div>
  );
};
