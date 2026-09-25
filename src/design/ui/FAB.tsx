import { useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export interface FABProps {
  onClick: () => void;
  onLongPress?: () => void;
  icon: ReactNode;
  label?: string;
  badge?: string | number;
  className?: string;
  ariaLabel: string;
}

export function FAB({
  onClick,
  onLongPress,
  icon,
  label,
  badge,
  className = '',
  ariaLabel,
}: FABProps) {
  const shouldReduceMotion = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);

  const startPress = () => {
    isLongPressRef.current = false;
    if (onLongPress) {
      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        onLongPress();
      }, 500);
    }
  };

  const endPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = () => {
    if (!isLongPressRef.current) {
      onClick();
    }
    isLongPressRef.current = false;
  };

  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onClick={handleClick}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`relative inline-flex items-center justify-center w-14 h-14 rounded-full bg-accent text-accent-ink shadow-float border border-accent/20 cursor-pointer select-none min-w-[56px] min-h-[56px] ${className}`}
    >
      {icon}
      {label && <span className="sr-only">{label}</span>}
      {typeof badge !== 'undefined' && (
        <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-bold bg-danger text-white flex items-center justify-center shadow-xs">
          {badge}
        </span>
      )}
    </motion.button>
  );
}
