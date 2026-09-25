import { useState, useEffect } from 'react';
import { HOUR_HEIGHT } from '../lib/layoutEvents';

export function NowLine() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Update every 30s per EXPANSION_PLAN §5.3
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const totalMinutes = hours * 60 + minutes + seconds / 60;
  const topPx = (totalMinutes / 60) * HOUR_HEIGHT;

  return (
    <div
      data-testid="now-line"
      className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
      style={{ top: `${topPx}px` }}
    >
      {/* 2px accent line with accent dot per spec */}
      <div className="-ml-1.5 w-3 h-3 rounded-full bg-accent ring-2 ring-surface shadow-xs" />
      <div className="flex-1 h-[2px] bg-accent" />
    </div>
  );
}
