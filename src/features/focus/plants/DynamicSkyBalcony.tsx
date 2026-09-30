import { useMemo, useState, useEffect, type ReactNode } from 'react';

export type TimeOfDay = 'dawn' | 'day' | 'sunset' | 'night';

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
  const hours = date.getHours() + date.getMinutes() / 60;
  if (hours >= 5 && hours < 8) return 'dawn';
  if (hours >= 8 && hours < 17) return 'day';
  if (hours >= 17 && hours < 19.5) return 'sunset';
  return 'night';
}

export interface DynamicSkyBalconyProps {
  children?: ReactNode;
  className?: string;
  forceTimeOfDay?: TimeOfDay;
}

export function DynamicSkyBalcony({
  children,
  className = '',
  forceTimeOfDay,
}: DynamicSkyBalconyProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const timeOfDay = forceTimeOfDay || getTimeOfDay(currentDate);

  const skyConfig = useMemo(() => {
    switch (timeOfDay) {
      case 'dawn':
        return {
          label: 'Morning Twilight',
          icon: '🌅',
          gradient: 'bg-gradient-to-b from-[#241c4f] via-[#b35368] to-[#f9a073] dark:from-[#130f2c] dark:via-[#632338] dark:to-[#8c462e]',
          sunGradient: 'from-[#fff4cc] via-[#ffb86c] to-[#ff79c6]',
          sunGlow: 'rgba(255, 184, 108, 0.45)',
          sunPos: 'bottom-6 left-[28%]',
          sunSize: 'w-16 h-16',
          hasSunRays: true,
          cloudShade: 'from-[#ffccd5]/40 to-[#c8b6ff]/20',
          deckBase: 'from-[#422216] via-[#2d160e] to-[#1c0c07]',
          deckLines: 'rgba(255, 180, 150, 0.12)',
          railingColor: 'border-[#713f12]/60 bg-[#2d160e]/50 text-[#fbcfe8]/40',
        };
      case 'day':
        return {
          label: 'Anime Sky (Day)',
          icon: '☀️',
          gradient: 'bg-gradient-to-b from-[#1976d2] via-[#42a5f5] to-[#bbdefb] dark:from-[#0d47a1] dark:via-[#1565c0] dark:to-[#1e3a5f]',
          sunGradient: 'from-[#ffffff] via-[#fff9c4] to-[#ffe082]',
          sunGlow: 'rgba(255, 255, 255, 0.65)',
          sunPos: 'top-5 right-[16%]',
          sunSize: 'w-16 h-16',
          hasSunRays: true,
          cloudShade: 'from-white/80 via-white/50 to-transparent',
          deckBase: 'from-[#5a341b] via-[#3d2212] to-[#251309]',
          deckLines: 'rgba(255, 230, 200, 0.15)',
          railingColor: 'border-[#334155]/60 bg-[#1e293b]/40 text-[#94a3b8]/40',
        };
      case 'sunset':
        return {
          label: 'Makoto Sunset',
          icon: '🌇',
          gradient: 'bg-gradient-to-b from-[#2e1065] via-[#9d174d] via-60%-[#ea580c] to-[#fbbf24] dark:from-[#1b083c] dark:via-[#5c0d2e] dark:to-[#7c2d12]',
          sunGradient: 'from-[#fffbeb] via-[#fde047] to-[#f97316]',
          sunGlow: 'rgba(249, 115, 22, 0.6)',
          sunPos: 'bottom-3 left-1/2 -translate-x-1/2',
          sunSize: 'w-20 h-20',
          hasSunRays: true,
          cloudShade: 'from-[#fda4af]/50 via-[#f43f5e]/30 to-[#831843]/20',
          deckBase: 'from-[#3b190f] via-[#27100a] to-[#150704]',
          deckLines: 'rgba(251, 146, 60, 0.18)',
          railingColor: 'border-[#7c2d12]/70 bg-[#3b190f]/60 text-[#fed7aa]/35',
        };
      case 'night':
      default:
        return {
          label: 'Anime Starlit Night',
          icon: '🌌',
          gradient: 'bg-gradient-to-b from-[#050714] via-[#0b1029] to-[#191942]',
          sunGradient: '',
          sunGlow: '',
          sunPos: '',
          sunSize: '',
          hasSunRays: false,
          cloudShade: 'from-[#312e81]/30 to-transparent',
          deckBase: 'from-[#19131a] via-[#100d14] to-[#08060a]',
          deckLines: 'rgba(199, 210, 254, 0.08)',
          railingColor: 'border-[#1e1b4b]/80 bg-[#0f172a]/60 text-[#6366f1]/25',
        };
    }
  }, [timeOfDay]);

  return (
    <div
      className={`relative w-full h-72 sm:h-88 rounded-2xl overflow-hidden border border-border/80 shadow-xs select-none flex flex-col ${className}`}
    >
      {/* ========================================================
          TOP HALF (50%): ANIME AESTHETIC SKY
          ======================================================== */}
      <div className={`relative w-full h-[52%] transition-all duration-1000 overflow-hidden ${skyConfig.gradient}`}>
        {/* Soft Sunbeams / God Rays (Anime Studio Ghibli style) */}
        {skyConfig.hasSunRays && (
          <div
            className="absolute inset-0 pointer-events-none opacity-40 mix-blend-screen"
            style={{
              background:
                'radial-gradient(ellipse 120% 80% at 50% 100%, rgba(255,255,255,0.45) 0%, rgba(255,240,200,0.2) 40%, transparent 75%)',
            }}
          />
        )}

        {/* Night Stars & Anime Nebula Dust */}
        {timeOfDay === 'night' && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Celestial Nebula Glow */}
            <div className="absolute inset-0 bg-radial from-violet-600/15 via-indigo-500/10 to-transparent opacity-80" />

            {/* Glowing anime stars */}
            <svg className="w-full h-full" viewBox="0 0 320 160" fill="none">
              {/* Twinkling big stars */}
              <g className="animate-pulse">
                <circle cx="45" cy="22" r="1.5" fill="#fff" />
                <path d="M 45 18 L 45 26 M 41 22 L 49 22" stroke="#fff" strokeWidth="0.5" opacity="0.8" />
                <circle cx="160" cy="38" r="1.8" fill="#e0e7ff" />
                <path d="M 160 34 L 160 42 M 156 38 L 164 38" stroke="#a5b4fc" strokeWidth="0.5" opacity="0.9" />
                <circle cx="275" cy="28" r="1.5" fill="#fef08a" />
                <path d="M 275 24 L 275 32 M 271 28 L 279 28" stroke="#fef08a" strokeWidth="0.5" opacity="0.8" />
              </g>

              {/* Star dust field */}
              <circle cx="20" cy="45" r="0.8" fill="#fff" opacity="0.7" />
              <circle cx="75" cy="50" r="1" fill="#c7d2fe" opacity="0.8" />
              <circle cx="110" cy="18" r="0.7" fill="#fff" opacity="0.6" />
              <circle cx="130" cy="65" r="1.2" fill="#fff" opacity="0.9" />
              <circle cx="195" cy="25" r="0.9" fill="#fbcfe8" opacity="0.8" />
              <circle cx="225" cy="55" r="1.1" fill="#fff" opacity="0.7" />
              <circle cx="245" cy="35" r="0.8" fill="#c7d2fe" opacity="0.7" />
              <circle cx="295" cy="65" r="0.9" fill="#fff" opacity="0.8" />
              <circle cx="95" cy="80" r="1.2" fill="#fef08a" opacity="0.85" />
              <circle cx="180" cy="75" r="0.8" fill="#fff" opacity="0.7" />

              {/* Faint Shooting Star Trail */}
              <line x1="80" y1="15" x2="135" y2="42" stroke="url(#shootingStarGrad)" strokeWidth="1.2" strokeLinecap="round" opacity="0.75" />
              <defs>
                <linearGradient id="shootingStarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                  <stop offset="80%" stopColor="#c7d2fe" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                </linearGradient>
              </defs>
            </svg>

            {/* Radiant Anime Crescent Moon */}
            <div className="absolute top-4 right-7 flex items-center justify-center">
              <div className="relative">
                <div className="absolute -inset-3 rounded-full bg-amber-200/25 blur-md" />
                <svg className="w-11 h-11 drop-shadow-[0_0_14px_rgba(254,240,138,0.9)]" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                    fill="#fef08a"
                    stroke="#fde047"
                    strokeWidth="0.8"
                  />
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Anime Sun (Dawn, Day, Sunset) */}
        {timeOfDay !== 'night' && (
          <div
            className={`absolute rounded-full transition-all duration-1000 ${skyConfig.sunPos} ${skyConfig.sunSize} bg-gradient-to-tr ${skyConfig.sunGradient}`}
            style={{
              boxShadow: `0 0 45px 18px ${skyConfig.sunGlow}, 0 0 90px 40px ${skyConfig.sunGlow}`,
            }}
          >
            {/* Core highlight */}
            <div className="w-full h-full rounded-full bg-white/70 blur-[1px]" />
          </div>
        )}

        {/* Anime Cumulus Cloud Layers (Fluffy anime style) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg className="w-full h-full transition-colors duration-1000" viewBox="0 0 400 160" preserveAspectRatio="none">
            {/* Background cloud silhouette */}
            <path
              d="M -30,130 Q 15,65 75,90 Q 130,45 190,85 Q 240,40 300,75 Q 360,45 420,100 L 420,160 L -30,160 Z"
              fill="white"
              opacity={timeOfDay === 'sunset' ? 0.35 : timeOfDay === 'night' ? 0.08 : 0.45}
            />
            {/* Foreground fluffy cloud billows */}
            <path
              d="M -10,140 C 20,80 80,85 110,110 C 150,70 220,75 250,115 C 290,65 370,80 410,130 L 410,160 L -10,160 Z"
              fill={timeOfDay === 'sunset' ? '#fbcfe8' : timeOfDay === 'dawn' ? '#fed7aa' : 'white'}
              opacity={timeOfDay === 'night' ? 0.12 : 0.65}
            />
          </svg>
        </div>

        {/* Time of Day Indicator Tag */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-md text-[10px] font-semibold text-white/95 border border-white/20 shadow-xs">
          <span>{skyConfig.icon}</span>
          <span>{skyConfig.label}</span>
        </div>
      </div>

      {/* ========================================================
          DIVIDER: BALCONY BALUSTRADE & HORIZON
          ======================================================== */}
      <div className={`relative z-20 w-full h-7 border-t border-b flex items-center justify-between px-3 backdrop-blur-sm shadow-xs ${skyConfig.railingColor}`}>
        <div className="w-full flex justify-between px-2">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="w-[2px] h-5 bg-current opacity-45 shadow-xs" />
          ))}
        </div>
      </div>

      {/* ========================================================
          BOTTOM HALF (48%): BALCONY WOOD DECK FLOOR
          ======================================================== */}
      <div className={`relative w-full h-[48%] overflow-hidden transition-colors duration-1000 bg-gradient-to-b ${skyConfig.deckBase}`}>
        {/* Perspective Wood Deck Planks */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Horizontal plank lines */}
          <div className="absolute inset-x-0 top-0 h-[25%] border-b border-black/45" />
          <div className="absolute inset-x-0 top-[25%] h-[25%] border-b border-black/45" />
          <div className="absolute inset-x-0 top-[50%] h-[25%] border-b border-black/45" />
          <div className="absolute inset-x-0 top-[75%] h-[25%] border-b border-black/45" />

          {/* Perspective diagonal lines */}
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            <line x1="12" y1="0" x2="3" y2="100" stroke={skyConfig.deckLines} strokeWidth="1" />
            <line x1="38" y1="0" x2="32" y2="100" stroke={skyConfig.deckLines} strokeWidth="1" />
            <line x1="62" y1="0" x2="68" y2="100" stroke={skyConfig.deckLines} strokeWidth="1" />
            <line x1="88" y1="0" x2="97" y2="100" stroke={skyConfig.deckLines} strokeWidth="1" />
          </svg>
        </div>

        {/* Ambient Floor Shadow under Plant */}
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-44 h-8 rounded-full bg-black/60 blur-md pointer-events-none" />

        {/* Bottom edge shadow */}
        <div className="absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
      </div>

      {/* ========================================================
          PLANT CONTENT OVERLAY
          ======================================================== */}
      <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none [&>*]:pointer-events-auto">
        {children}
      </div>
    </div>
  );
}
