/**
 * Playwright E2E Configuration
 * Multi-device coverage across Desktop and Mobile devices (Android Pixel 7 & iOS iPhone 14).
 */

export interface DeviceConfig {
  name: string;
  use: {
    viewport: { width: number; height: number };
    isMobile?: boolean;
    hasTouch?: boolean;
    userAgent?: string;
  };
}

export interface PlaywrightConfig {
  testDir: string;
  timeout: number;
  expect?: { timeout: number };
  fullyParallel?: boolean;
  retries?: number;
  reporter?: string | any[];
  use?: {
    baseURL?: string;
    trace?: string;
    video?: string;
  };
  projects?: DeviceConfig[];
  webServer?: {
    command: string;
    port: number;
    reuseExistingServer?: boolean;
  };
}

const config: PlaywrightConfig = {
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: {
        viewport: { width: 1280, height: 720 },
        isMobile: false,
        hasTouch: false,
      },
    },
    {
      name: 'Mobile Pixel 7 (Android)',
      use: {
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'Mobile iPhone 14 (iOS)',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
};

export default config;
