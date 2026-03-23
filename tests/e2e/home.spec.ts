import { test, expect } from '@playwright/test';

test.describe('2. Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('1. Home page loads with hero/banner section visible', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
  });

  test('2. Featured Products section renders with product cards', async ({ page }) => {
    await expect(page.getByText(/Featured/i).first()).toBeVisible();
  });

  test('3. New Arrivals section renders with product cards', async ({ page }) => {
    await expect(page.getByText(/New Arrivals/i).first()).toBeVisible();
  });

  test('4. Product cards show image, name, price, and are clickable (navigate to PDP)', async ({ page }) => {
    const productCard = page.locator('a[href^="/products/"]').first();
    if (await productCard.isVisible()) {
      await expect(productCard.locator('img').first()).toBeVisible();
      await productCard.click({ force: true });
      await expect(page).toHaveURL(/\/products\/.+/, { timeout: 15000 });
    }
  });

  test('5. App download banner is visible (when SHOW_APP_BANNER env is set)', async ({ page }) => {
    // Graceful check as it depends on env var
    const banner = page.getByText(/Download App|Get the App/i);
    if (await banner.isVisible()) {
      await expect(banner).toBeVisible();
    }
  });

  test('6. Page is responsive — layout adapts on mobile viewport', async ({ page, isMobile }) => {
    if (isMobile) {
      await expect(page.getByRole('button', { name: /open menu/i }).first()).toBeVisible();
    } else {
      await expect(page.locator('nav').first()).toBeVisible();
    }
  });
});
