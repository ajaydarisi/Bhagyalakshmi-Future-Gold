import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
const single = vi.fn();
const eq = vi.fn(() => ({ eq, single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const createServerClient = vi.fn(() => ({
  auth: {
    getUser,
  },
  from,
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient,
}));

function createRequest(url: string, headers?: HeadersInit) {
  const nextUrl = new URL(url) as URL & { clone: () => URL };
  nextUrl.clone = () => new URL(url);

  return {
    nextUrl,
    headers: new Headers(headers),
    cookies: {
      getAll: () => [],
      set: vi.fn(),
    },
  };
}

describe('offline middleware route guards', () => {
  beforeEach(() => {
    vi.resetModules();
    getUser.mockReset();
    from.mockReset();
    select.mockReset();
    eq.mockReset();
    single.mockReset();

    getUser.mockResolvedValue({ data: { user: null } });
    from.mockImplementation(() => ({ select }));
    select.mockImplementation(() => ({ eq }));
    eq.mockImplementation(() => ({ eq, single }));
    single.mockResolvedValue({ data: { role: 'admin' } });
    process.env.NEXT_PUBLIC_STORE_MODE = 'OFFLINE';
  });

  it('redirects cart and checkout routes to home in offline mode', async () => {
    const { updateSession } = await import('@/lib/supabase/middleware');

    const cartResponse = await updateSession(createRequest('http://localhost/cart') as never);
    expect(cartResponse.headers.get('location')).toBe('http://localhost/');

    const checkoutResponse = await updateSession(
      createRequest('http://localhost/checkout') as never
    );
    expect(checkoutResponse.headers.get('location')).toBe('http://localhost/');
  });

  it('redirects offline-disabled account subroutes to home, including localized paths', async () => {
    const { updateSession } = await import('@/lib/supabase/middleware');

    const ordersResponse = await updateSession(
      createRequest('http://localhost/en/account/orders') as never
    );
    expect(ordersResponse.headers.get('location')).toBe('http://localhost/');

    const addressesResponse = await updateSession(
      createRequest('http://localhost/te/account/addresses') as never
    );
    expect(addressesResponse.headers.get('location')).toBe('http://localhost/');
  });

  it('still treats the main account page as auth-protected instead of offline-disabled', async () => {
    const { updateSession } = await import('@/lib/supabase/middleware');
    const response = await updateSession(
      createRequest('http://localhost/account') as never
    );

    expect(response.headers.get('location')).toBe(
      'http://localhost/login?redirect=%2Faccount'
    );
  });
});
