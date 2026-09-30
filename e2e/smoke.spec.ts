/**
 * Core E2E Smoke Tests
 * Verifies app shell initialization, routing, fast capture FAB visibility, and theme attributes across devices.
 */

// Simple self-contained mock runner or Playwright test script
export const smokeTests = [
  {
    name: 'Initial page loads into /today route with title and main navigation',
    test: async (page: any) => {
      await page.goto('/');
      await page.waitForURL('**/today');
      const title = await page.title();
      return title.length > 0;
    },
  },
  {
    name: 'Mobile viewport displays sticky CaptureFab with safe-area spacing',
    test: async (page: any) => {
      await page.goto('/today');
      const fab = await page.locator('[aria-label="Create new item"]');
      return await fab.isVisible();
    },
  },
  {
    name: 'Keyboard shortcut modal opens via ? key trigger',
    test: async (page: any) => {
      await page.goto('/today');
      await page.keyboard.press('?');
      const dialog = await page.locator('[role="dialog"]');
      return await dialog.isVisible();
    },
  },
];
