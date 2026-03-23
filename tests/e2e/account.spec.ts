import { test, expect } from '@playwright/test';

test.describe('5. Account', () => {

  test('1. Navigate to /account -> profile info displayed (name, email, avatar)', async ({ page }) => {
    test.skip(true, 'Requires authenticated state');
  });

  test('2. Edit profile (name, phone) -> changes saved, success toast', async ({ page }) => {
    test.skip(true, 'Requires authenticated state');
  });

  test('3. Account sidebar navigation works', async ({ page }) => {
    test.skip(true, 'Requires authenticated state');
  });

  test('4. Offline Mode: Verify "My Orders" tab/link is NOT visible in the sidebar or menu', async ({ page }) => {
    test.skip(true, 'Requires authenticated state');
  });

  test('5. Offline Mode: Verify "Addresses" tab/link is NOT visible in the sidebar or menu', async ({ page }) => {
    test.skip(true, 'Requires authenticated state');
  });

});
