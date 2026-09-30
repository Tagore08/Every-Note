import { useState, useEffect, useRef } from 'react';

export interface DebouncedFunction<Args extends any[]> {
  (...args: Args): void;
  cancel: () => void;
  flush: () => void;
}

/**
 * Creates a debounced function that delays invoking `fn` until after
 * `delayMs` milliseconds have elapsed since the last time it was invoked.
 */
export function debounce<Args extends any[]>(
  fn: (...args: Args) => void,
  delayMs: number
): DebouncedFunction<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;

  const debounced = (...args: Args) => {
    lastArgs = args;
    if (timer !== null) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs !== null) {
        fn(...lastArgs);
        lastArgs = null;
      }
    }, delayMs);
  };

  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  };

  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (lastArgs !== null) {
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  return debounced;
}

/**
 * React hook that returns a debounced copy of the provided value.
 * The returned value updates only after `delayMs` have passed with no new values.
 */
export function useDebounce<T>(value: T, delayMs = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
      timerRef.current = null;
    }, delayMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, delayMs]);

  return debouncedValue;
}
