import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
  isNative: boolean;
}

// Fallback status bar height in dp for native Android devices when overlays are enabled
// and exact insets are still being measured or return 0.
const DEFAULT_NATIVE_STATUS_BAR_HEIGHT = 40;

let isInitialized = false;
let currentInsets: SafeAreaInsets = {
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  isNative: Capacitor.isNativePlatform(),
};

const listeners = new Set<(insets: SafeAreaInsets) => void>();

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener(currentInsets);
    } catch (e) {
      console.error('Error in safeArea listener:', e);
    }
  }
}

/**
 * Updates the document root CSS variables so all stylesheets,
 * utility classes, and components have immediate access to accurate safe-area insets.
 */
function updateCssVariables(top: number) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  if (top > 0) {
    root.style.setProperty('--safe-area-top', `${top}px`);
    root.style.setProperty('--status-bar-height', `${top}px`);
  } else {
    // Fall back to CSS env(safe-area-inset-top)
    root.style.setProperty('--safe-area-top', 'env(safe-area-inset-top, 0px)');
    root.style.setProperty('--status-bar-height', 'env(safe-area-inset-top, 0px)');
  }
}

/**
 * Queries the native status bar height and synchronizes safe area values.
 */
export async function syncSafeArea(): Promise<SafeAreaInsets> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      const info = await StatusBar.getInfo();
      let topHeight = info.height;

      // When overlays are active on Android, we must guarantee safe padding
      // even if the OS reports 0 or hasn't finished measuring the window insets yet.
      if (info.overlays && (!topHeight || topHeight === 0)) {
        topHeight = DEFAULT_NATIVE_STATUS_BAR_HEIGHT;
      }

      currentInsets = {
        ...currentInsets,
        top: topHeight,
        isNative: true,
      };

      updateCssVariables(topHeight);
      notifyListeners();
      return currentInsets;
    } catch (err) {
      console.debug('StatusBar.getInfo() query failed, applying fallback:', err);
      currentInsets = {
        ...currentInsets,
        top: DEFAULT_NATIVE_STATUS_BAR_HEIGHT,
        isNative: true,
      };
      updateCssVariables(DEFAULT_NATIVE_STATUS_BAR_HEIGHT);
      notifyListeners();
      return currentInsets;
    }
  } else {
    // On web/PWA, CSS env(safe-area-inset-top) applies natively
    currentInsets = {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      isNative: false,
    };
    updateCssVariables(0);
    notifyListeners();
    return currentInsets;
  }
}

/**
 * Initialize safe area monitoring on app launch.
 * Idempotent: can be safely called multiple times.
 */
export function initSafeArea(): () => void {
  if (isInitialized) return () => {};
  isInitialized = true;

  // Immediate sync
  syncSafeArea().catch((err) => console.debug('Initial syncSafeArea error:', err));

  // Native status bar listeners
  let overlaySub: { remove: () => void } | null = null;
  let visibilitySub: { remove: () => void } | null = null;

  if (Capacitor.isNativePlatform()) {
    StatusBar.addListener('statusBarOverlayChanged', () => {
      syncSafeArea().catch((err) => console.debug('Overlay change sync error:', err));
    }).then((sub) => {
      overlaySub = sub;
    }).catch(() => {});

    StatusBar.addListener('statusBarVisibilityChanged', () => {
      syncSafeArea().catch((err) => console.debug('Visibility change sync error:', err));
    }).then((sub) => {
      visibilitySub = sub;
    }).catch(() => {});
  }

  // Handle orientation changes and window resizes
  const handleResize = () => {
    syncSafeArea().catch((err) => console.debug('Resize safe area sync error:', err));
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
  }

  return () => {
    isInitialized = false;
    overlaySub?.remove();
    visibilitySub?.remove();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    }
  };
}

/**
 * React hook to access current safe area insets and re-render on updates.
 */
export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(() => currentInsets);

  useEffect(() => {
    listeners.add(setInsets);
    // Ensure initial sync
    syncSafeArea().catch((err) => console.debug('Hook sync error:', err));

    return () => {
      listeners.delete(setInsets);
    };
  }, []);

  return insets;
}
