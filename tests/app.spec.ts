import { test, expect } from '@playwright/test';

test('Game loads successfully', async ({ page }) => {
  // Go to the new port
  await page.goto('http://localhost:5174/');

  // Check title
  await expect(page).toHaveTitle(/Z-Tanks/);

  // Check if canvas exists
  const canvas = page.locator('#game-canvas');
  await expect(canvas).toBeVisible();

  // Check if UI layer exists
  const ui = page.locator('#ui-layer');
  await expect(ui).toBeVisible();

  // Verify no console errors (optional, but good)
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`Console Error: "${msg.text()}"`);
    }
  });
});
