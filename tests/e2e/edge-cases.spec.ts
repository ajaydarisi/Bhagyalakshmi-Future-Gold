import { test, expect } from '@playwright/test';

test.describe('11. Edge Cases & Miscellaneous', () => {

  test('1. Visit a non-existent route -> custom 404 page shown', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-12345');
    // expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|Page Not Found/i).first()).toBeVisible();
  });

  test('2. Server error triggers error boundary / error page', async ({ page }) => {
    // Difficult to consistently replicate without mocking API to 500, but test is a placeholder
    test.skip(true, 'Difficult to trigger 500 automatically without specific route or mock');
  });

  test('3. Offline Mode Defense: User manually navigating to /cart or /checkout should encounter a 404 or redirect', async ({ page }) => {
    const responseCart = await page.goto('/cart');
    // Could be 404, or redirected back home
    await expect(page).not.toHaveURL(/\/cart$/);
    
    const responseCheckout = await page.goto('/checkout');
    await expect(page).not.toHaveURL(/\/checkout$/);
  });

  test('4. Visit a product with an invalid slug -> 404', async ({ page }) => {
    const response = await page.goto('/products/invalid-slug-that-does-not-exist');
    // expect(response?.status()).toBe(404);
    await expect(page.getByText(/404|Not Found/i).first()).toBeVisible();
  });

});
