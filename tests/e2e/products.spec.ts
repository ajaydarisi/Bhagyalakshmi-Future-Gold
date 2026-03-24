import { test, expect } from '@playwright/test';

test.describe('3. Products', () => {
  const saleProductSlug = 'golden-bloom-necklace';
  const rentalProductSlug = 'temple-bridal-rental-set';
  const productCardSelector =
    `a[href="/products/${saleProductSlug}"], a[href="/en/products/${saleProductSlug}"], a[href="/te/products/${saleProductSlug}"]`;

  test.describe('3.1 Product Listing Page (PLP)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/products');
    });

    test('1. Navigate to /products -> product grid renders with cards', async ({ page }) => {
      await expect(page.locator('main')).toBeVisible();
      const productCards = page.locator(productCardSelector);
      await expect(productCards.first()).toBeVisible();
    });

    test('2. Each product card shows image, name, and price in offline mode', async ({ page }) => {
      const firstCard = page.locator(productCardSelector).first();
      await expect(firstCard).toBeVisible();
      await expect(firstCard.locator('img')).toBeVisible();
      await expect(firstCard).toContainText(/Golden Bloom Necklace/i);
      await expect(firstCard).toContainText(/₹|Rs/i);
    });

    test('3. Product cards DO NOT show "Sold Out" overlays regardless of stock (offline behavior)', async ({ page }) => {
      const soldOutBadge = page.getByText(/Sold Out/i);
      await expect(soldOutBadge).toHaveCount(0);
    });

    test('4. Product card click navigates to product detail page', async ({ page }) => {
      const firstProduct = page.locator(productCardSelector).first();
      await expect(firstProduct).toBeVisible();
      await firstProduct.click();
      await expect(page).toHaveURL(new RegExp(`/products/${saleProductSlug}$`));
    });
  });

  test.describe('3.2 Product Detail Page (PDP)', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/products/${saleProductSlug}`);
      await page.waitForURL(new RegExp(`/products/${saleProductSlug}$`));
    });

    test('1. Navigate to /products/[slug] -> product detail renders in offline mode', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /Golden Bloom Necklace/i })).toBeVisible();
      await expect(page.locator('img').first()).toBeVisible();
      await expect(page.locator('main')).toContainText(/₹|Rs/i);
    });

    test('2. Offline Mode: Verify "Check Availability" (WhatsApp) button is rendered instead of "Add to Cart"', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Check Availability/i })).toBeVisible();
      await expect(page.getByText(/Add to Cart/i, { exact: false })).toHaveCount(0);
    });

    test('3. Offline Mode: Verify clicking "Check Availability" opens a WhatsApp URL with the preview link', async ({ page }) => {
      const whatsappButton = page.getByRole('button', { name: /Check Availability/i });
      await expect(whatsappButton).toBeVisible();

      const popupPromise = page.waitForEvent('popup');
      await whatsappButton.click();
      const popup = await popupPromise;
      await expect
        .poll(() => popup.url())
        .toMatch(/(wa\.me\/91\d+\?text=|api\.whatsapp\.com\/send\/\?phone=91\d+&text=)/i);
      await expect.poll(() => decodeURIComponent(popup.url())).toMatch(/\/preview\//i);
      await popup.close();
    });

    test('4. Offline Mode: Verify there is NO stock availability text ("In Stock" / "Out of Stock") shown', async ({ page }) => {
      await expect(page.getByText(/In Stock|Out of Stock/i)).toHaveCount(0);
    });

    test('5. Offline Mode: rental products still expose the rental details and WhatsApp flow', async ({ page }) => {
      await page.goto(`/products/${rentalProductSlug}`);
      await expect(page.getByRole('heading', { name: /Temple Bridal Rental Set/i })).toBeVisible();
      await expect(page.locator('main')).toContainText(/Rental Details/i);
      await expect(page.locator('main')).toContainText(/Check Availability/i);
      await expect(page.locator('main')).toContainText(/day/i);
    });
  });

});
