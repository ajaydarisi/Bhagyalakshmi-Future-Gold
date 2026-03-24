import { describe, expect, it } from 'vitest';
import { ROUTES } from '@/lib/constants';
import {
  buildAvailabilityMessage,
  buildRentalAvailabilityMessage,
  getProductDetailDisplayState,
  getRentalDateConstraints,
  getVisibleStoreLinks,
  getWishlistPrimaryActionMode,
  shouldShowSoldOutOverlay,
} from '@/lib/offline-store-ui';

describe('offline UI helpers', () => {
  it('keeps only the profile link in the account sidebar for offline mode', () => {
    const accountLinks = [
      { href: ROUTES.account, onlineOnly: false },
      { href: ROUTES.accountOrders, onlineOnly: true },
      { href: ROUTES.accountAddresses, onlineOnly: true },
    ];

    expect(getVisibleStoreLinks(accountLinks, false).map((link) => link.href)).toEqual([
      '/account',
    ]);
    expect(getVisibleStoreLinks(accountLinks, true).map((link) => link.href)).toEqual([
      '/account',
      '/account/orders',
      '/account/addresses',
    ]);
  });

  it('builds WhatsApp messages with the preview URL for offline availability checks', () => {
    expect(
      buildAvailabilityMessage({
        productName: 'Temple Necklace',
        productSlug: 'temple-necklace',
        origin: 'https://example.com',
        intro: 'Hi, is this available?',
      })
    ).toBe(
      'Hi, is this available?\n\n*Temple Necklace*\nhttps://example.com/preview/temple-necklace'
    );

    expect(
      buildRentalAvailabilityMessage({
        productName: 'Rental Set',
        productSlug: 'rental-set',
        origin: 'https://example.com',
        intro: 'Hi, is this available for rent?',
        fromLabel: 'From',
        toLabel: 'To',
        startDate: new Date('2026-03-10T00:00:00.000Z'),
        endDate: new Date('2026-03-14T00:00:00.000Z'),
      })
    ).toContain('https://example.com/preview/rental-set');
  });

  it('computes rental date constraints from the selected start date', () => {
    const today = new Date('2026-03-01T10:00:00.000Z');
    const startDate = new Date('2026-03-10T00:00:00.000Z');
    const constraints = getRentalDateConstraints({
      startDate,
      maxRentalDays: 5,
      today,
    });

    expect(constraints.endDateMin.toISOString()).toBe(startDate.toISOString());
    expect(constraints.endDateMax?.toISOString()).toBe(
      new Date('2026-03-15T00:00:00.000Z').toISOString()
    );
  });

  it('switches product and wishlist actions to offline behavior', () => {
    expect(getProductDetailDisplayState(false)).toEqual({
      showCartAction: false,
      showAvailabilityAction: true,
      showStockAvailability: false,
    });
    expect(getWishlistPrimaryActionMode(false)).toBe('check-availability');
    expect(shouldShowSoldOutOverlay(0, false)).toBe(false);
    expect(shouldShowSoldOutOverlay(0, true)).toBe(true);
  });
});
