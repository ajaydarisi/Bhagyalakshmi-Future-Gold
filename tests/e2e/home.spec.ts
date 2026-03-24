import { test, expect } from '@playwright/test';

const featuredProductSelector =
  'a[href="/products/golden-bloom-necklace"], a[href="/en/products/golden-bloom-necklace"], a[href="/te/products/golden-bloom-necklace"]';

test.describe('2. Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('1. Home page loads with hero content visible in offline mode', async ({ page }) => {
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Celebrate This Wedding/i })).toBeVisible();
  });

  test('2. Offline wishlist CTA is rendered on the home page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Save Time at the Store/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Start Wishlisting/i })).toBeVisible();
  });

  test('3. Offline trust-bar copy is rendered instead of online commerce copy', async ({ page }) => {
    await expect(page.getByText(/WhatsApp Support/i)).toBeVisible();
    await expect(page.getByText(/Visit Our Store/i).first()).toBeVisible();
    await expect(page.getByText(/Save Your Favourites/i)).toBeVisible();
    await expect(page.getByText(/Secure Checkout/i)).toHaveCount(0);
  });

  test('4. Product cards remain browsable in offline mode', async ({ page }) => {
    const productCard = page.locator(featuredProductSelector).first();
    await expect(productCard).toBeVisible();
    await expect(productCard.locator('img').first()).toBeVisible();
    await productCard.click({ force: true });
    await expect(page).toHaveURL(/\/products\/golden-bloom-necklace$/, { timeout: 15000 });
  });

  test('5. Page is responsive in offline mode', async ({ page, isMobile }) => {
    if (isMobile) {
      await expect(page.getByRole('button', { name: /open menu/i }).first()).toBeVisible();
    } else {
      await expect(page.locator('nav').first()).toBeVisible();
    }
  });
});
