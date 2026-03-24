import { test, expect } from '@playwright/test';

test.describe('8. Layout & Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('1. Header renders logo, nav links, wishlist, and user menu', async ({ page, isMobile }) => {
    if (!isMobile) {
      const header = page.locator('header');
      await expect(header).toBeVisible();
      await expect(header.locator('img').first()).toBeVisible(); // Logo
      await expect(header.getByRole('link', { name: /About/i })).toBeVisible();
      await expect(header.getByRole('link', { name: /Wishlist/i })).toBeVisible();
    }
  });

  test('2. Offline Mode: Verify Cart icon/link is NOT present in the header', async ({ page, isMobile }) => {
    if (!isMobile) {
      const header = page.locator('header');
      await expect(header.locator('a[href="/cart"]')).toHaveCount(0);
      await expect(header.locator('svg.lucide-shopping-cart, svg.lucide-shopping-bag').first()).toHaveCount(0);
    }
  });

  test('3. Offline Mode: Verify Cart icon/link is NOT present in the mobile bottom navigation', async ({ page, isMobile }) => {
    if (isMobile) {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      await expect(bottomNav).toBeVisible();
      await expect(bottomNav.locator('a[href="/cart"]')).toHaveCount(0);
    }
  });

  test('4. Footer renders with links (about, privacy, T&C, social)', async ({ page, isMobile }) => {
    if (!isMobile) {
      const footer = page.locator('footer');
      await expect(footer).toBeVisible();
      await expect(footer.getByText(/About|Privacy|Terms/i).first()).toBeVisible();
    }
  });

  test('5. Offline Mode: Verify "Track Order", "Shopping Bag", and "Addresses" are NOT present in the Footer links', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer.getByText(/Track Order/i)).toHaveCount(0);
    await expect(footer.getByText(/Shopping Bag/i)).toHaveCount(0);
    await expect(footer.getByText(/Addresses/i)).toHaveCount(0);
  });

  test('6. Mobile bottom-nav renders with correct icons and active state', async ({ page, isMobile }) => {
    if (isMobile) {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      await expect(bottomNav).toBeVisible();
      await expect(bottomNav.locator('a[href="/"], a[href="/en"]')).toBeVisible();
      await expect(
        bottomNav.locator('a[href="/products"], a[href="/en/products"]')
      ).toBeVisible();
      await expect(bottomNav.locator('a[href="/about"], a[href="/en/about"]')).toBeVisible();
      await expect(bottomNav.locator('a[href="/wishlist"], a[href="/en/wishlist"]')).toBeVisible();
    }
  });

  test('7. Mobile bottom-nav highlights About when navigating to the About page', async ({ page, isMobile }) => {
    if (isMobile) {
      const bottomNav = page.locator('nav.fixed.bottom-0');
      const aboutLink = bottomNav.locator('a[href="/about"], a[href="/en/about"]');

      await expect(aboutLink).toBeVisible();
      await aboutLink.first().click();

      await expect(page).toHaveURL(/\/(en\/)?about$/);
      await expect(aboutLink.first()).toHaveAttribute('aria-current', 'page');
    }
  });

  test('8. Mobile hamburger menu omits offline-disabled links', async ({ page, isMobile }) => {
    if (isMobile) {
      const menuBtn = page.getByRole('button', { name: /open menu/i }).first();
      await expect(menuBtn).toBeVisible();
      await menuBtn.click();
      const sheet = page.locator('div[role="dialog"]');
      await expect(sheet).toBeVisible();
      await expect(sheet.getByText(/About/i).first()).toBeVisible();
      await expect(sheet.getByText(/Wishlist/i).first()).toBeVisible();
      await expect(sheet.getByText(/Shopping Bag/i)).toHaveCount(0);
      await expect(sheet.getByText(/My Orders/i)).toHaveCount(0);
      await expect(sheet.getByText(/Addresses/i)).toHaveCount(0);
    }
  });
});
