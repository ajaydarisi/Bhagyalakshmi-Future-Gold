import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClient = vi.fn();
const createAdminClient = vi.fn();
const createRazorpayClient = vi.fn();
const verifyRazorpaySignature = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient,
}));

vi.mock('@/lib/razorpay/client', () => ({
  createRazorpayClient,
}));

vi.mock('@/lib/razorpay/verify', () => ({
  verifyRazorpaySignature,
}));

describe('offline checkout guards', () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockReset();
    createAdminClient.mockReset();
    createRazorpayClient.mockReset();
    verifyRazorpaySignature.mockReset();
    process.env.NEXT_PUBLIC_STORE_MODE = 'OFFLINE';
  });

  it('blocks createOrder before any side effects in offline mode', async () => {
    const { createOrder } = await import('@/app/[locale]/(store)/checkout/actions');

    await expect(createOrder('address-1')).rejects.toThrow('Store is currently offline');
    expect(createClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(createRazorpayClient).not.toHaveBeenCalled();
  });

  it('blocks verifyPayment before any side effects in offline mode', async () => {
    const { verifyPayment } = await import('@/app/[locale]/(store)/checkout/actions');

    await expect(
      verifyPayment('order-1', 'payment-1', 'razorpay-order-1', 'signature-1')
    ).rejects.toThrow('Store is currently offline');
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(verifyRazorpaySignature).not.toHaveBeenCalled();
  });

  it('blocks applyCoupon before any side effects in offline mode', async () => {
    const { applyCoupon } = await import('@/app/[locale]/(store)/checkout/actions');

    await expect(applyCoupon('SAVE10', 1000)).rejects.toThrow(
      'Store is currently offline'
    );
    expect(createClient).not.toHaveBeenCalled();
  });
});
