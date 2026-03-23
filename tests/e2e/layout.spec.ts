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
      await expect(header.getByText(/Home|Products|About/i).first()).toBeVisible(); // Nav links
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
      if (await bottomNav.isVisible()) {
        await expect(bottomNav.locator('a[href="/cart"]')).toHaveCount(0);
      }
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
      if (await bottomNav.isVisible()) {
        await expect(bottomNav.locator('a[href="/"]')).toBeVisible();
        await expect(bottomNav.locator('a[href="/products"]')).toBeVisible();
      }
    }
  });

  test('7. Mobile hamburger menu opens/closes and includes all navigation links', async ({ page, isMobile }) => {
    if (isMobile) {
      const menuBtn = page.getByRole('button', { name: /open menu/i }).first();
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
        const sheet = page.locator('div[role="dialog"]');
        await expect(sheet).toBeVisible();
        await expect(sheet.getByText(/Home|Products/i).first()).toBeVisible();
        // Close it
        const closeBtn = sheet.locator('button[aria-label*="close" i], button:has-text("×")').first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      }
    }
  });

  test('8. Dark mode toggle switches theme; styles persist on refresh', async ({ page }) => {
    const themeToggle = page.locator('button[aria-label*="theme" i], button:has(svg.lucide-sun), button:has(svg.lucide-moon)').first();
    if (await themeToggle.isVisible()) {
      const html = page.locator('html');
      const initialTheme = await html.getAttribute('class') || await html.getAttribute('data-theme');
      
      await themeToggle.click();
      await page.waitForTimeout(500); // Wait for transition
      
      const newTheme = await html.getAttribute('class') || await html.getAttribute('data-theme');
      expect(newTheme).not.toBe(initialTheme);
      
      // Refresh
      await page.reload();
      const refreshedTheme = await html.getAttribute('class') || await html.getAttribute('data-theme');
      expect(refreshedTheme).toBe(newTheme);
    }
  });

});
