import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncSafeArea, initSafeArea } from './safeArea';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    getInfo: vi.fn(),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
  },
}));

describe('safeArea service', () => {
  const properties = new Map<string, string>();

  const fakeDocument = {
    documentElement: {
      style: {
        setProperty: vi.fn((key: string, val: string) => properties.set(key, val)),
        removeProperty: vi.fn((key: string) => properties.delete(key)),
        getPropertyValue: vi.fn((key: string) => properties.get(key) || ''),
      },
    },
  };

  const fakeWindow = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    properties.clear();
    vi.stubGlobal('document', fakeDocument);
    vi.stubGlobal('window', fakeWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sets fallback CSS env insets on web (non-native)', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    const insets = await syncSafeArea();
    expect(insets.isNative).toBe(false);
    expect(insets.top).toBe(0);
    expect(fakeDocument.documentElement.style.getPropertyValue('--safe-area-top')).toBe(
      'env(safe-area-inset-top, 0px)'
    );
  });

  it('reads height from StatusBar.getInfo() on native platform', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(StatusBar.getInfo).mockResolvedValue({
      visible: true,
      overlays: true,
      height: 48,
      style: 'DARK' as any,
      color: '#000000',
    });

    const insets = await syncSafeArea();
    expect(insets.isNative).toBe(true);
    expect(insets.top).toBe(48);
    expect(fakeDocument.documentElement.style.getPropertyValue('--safe-area-top')).toBe('48px');
    expect(fakeDocument.documentElement.style.getPropertyValue('--status-bar-height')).toBe('48px');
  });

  it('applies safe fallback height if native StatusBar reports 0 while overlaid', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(StatusBar.getInfo).mockResolvedValue({
      visible: true,
      overlays: true,
      height: 0,
      style: 'DARK' as any,
      color: '#000000',
    });

    const insets = await syncSafeArea();
    expect(insets.isNative).toBe(true);
    expect(insets.top).toBe(40);
    expect(fakeDocument.documentElement.style.getPropertyValue('--safe-area-top')).toBe('40px');
  });

  it('initializes and registers listeners gracefully', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const cleanup = initSafeArea();
    expect(typeof cleanup).toBe('function');
    expect(fakeWindow.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(fakeWindow.addEventListener).toHaveBeenCalledWith('orientationchange', expect.any(Function));
    cleanup();
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('orientationchange', expect.any(Function));
  });
});
