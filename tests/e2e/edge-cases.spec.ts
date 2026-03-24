import { test, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

async function getRedirectLocation(request: APIRequestContext, path: string) {
  const response = await request.get(path, {
    failOnStatusCode: false,
    maxRedirects: 0,
  });

  expect([301, 302, 303, 307, 308]).toContain(response.status());
  return response.headers()['location'] ?? '';
}

test.describe('11. Edge Cases & Miscellaneous', () => {
  test('1. Visit a non-existent route -> custom 404 page shown', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-12345');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: /Page Not Found/i })).toBeVisible();
  });

  test('2. Offline Mode Defense: /cart is redirected away', async ({ request }) => {
    const location = await getRedirectLocation(request, '/cart');
    expect(location).toBeTruthy();
    expect(location).not.toContain('/cart');
  });

  test('3. Offline Mode Defense: /checkout is redirected away', async ({ request }) => {
    const location = await getRedirectLocation(request, '/checkout');
    expect(location).toBeTruthy();
    expect(location).not.toContain('/checkout');
  });

  test('4. Offline Mode Defense: /account/orders is redirected away', async ({ request }) => {
    const location = await getRedirectLocation(request, '/account/orders');
    expect(location).toBeTruthy();
    expect(location).not.toContain('/account/orders');
  });

  test('5. Offline Mode Defense: /account/addresses is redirected away', async ({ request }) => {
    const location = await getRedirectLocation(request, '/account/addresses');
    expect(location).toBeTruthy();
    expect(location).not.toContain('/account/addresses');
  });

  test('6. Offline Mode Defense: /account still redirects to login', async ({ request }) => {
    const location = await getRedirectLocation(request, '/account');
    expect(location).toContain('/login');
    expect(location).toContain('redirect=');
  });

  test('7. Visit a product with an invalid slug -> 404', async ({ page }) => {
    await page.goto('/products/invalid-slug-that-does-not-exist');
    await expect(page).toHaveTitle(/Product Not Found/i);
  });
});
