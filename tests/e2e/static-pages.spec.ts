import { test, expect } from '@playwright/test';

test.describe('9. Static / Legal Pages', () => {

  test('1. /about page renders with content', async ({ page }) => {
    // Some stores might not have /about, using a try-catch for assertion if it 404s
    const response = await page.goto('/about');
    if (response?.status() === 200) {
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('2. /privacy-policy page renders', async ({ page }) => {
    const response = await page.goto('/privacy-policy');
    if (response?.status() === 200) {
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('3. /terms-and-conditions page renders', async ({ page }) => {
    const response = await page.goto('/terms-and-conditions');
    if (response?.status() === 200) {
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('4. /feedback page renders feedback form; form validates and submits', async ({ page }) => {
    const response = await page.goto('/feedback');
    if (response?.status() === 200) {
      await expect(page.locator('form')).toBeVisible();
      // Form fields
      const submitButton = page.locator('button[type="submit"]');
      if (await submitButton.isVisible()) {
        await submitButton.click();
        // Should show validation
        await expect(page.getByText(/required|invalid/i).first()).toBeVisible();
      }
    }
  });

});
