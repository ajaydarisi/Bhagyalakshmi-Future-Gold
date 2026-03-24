import { beforeEach, describe, expect, it, vi } from 'vitest';

const createAdminClient = vi.fn();
const embedText = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient,
}));

vi.mock('@/lib/ai/gemini', () => ({
  embedText,
  serializeVector: (values: number[]) => `[${values.join(',')}]`,
}));

function createKeywordPublicQueryBuilder(rows: unknown[]) {
  const builder = {
    select: vi.fn(() => builder),
    in: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    textSearch: vi.fn(() => builder),
    range: vi.fn(async () => ({
      data: rows,
      error: null,
    })),
  };

  return builder;
}

function createProductFallbackQueryBuilder(rows: unknown[], orCalls: string[]) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    overlaps: vi.fn(() => builder),
    or: vi.fn((filters: string) => {
      orCalls.push(filters);
      return builder;
    }),
    order: vi.fn(() => builder),
    range: vi.fn(async () => ({
      data: rows,
      error: null,
      count: rows.length,
    })),
  };

  return builder;
}

describe('assistant retrieval hardening', () => {
  beforeEach(() => {
    vi.resetModules();
    createAdminClient.mockReset();
    embedText.mockReset();
  });

  it('keeps keyword public-document matches when semantic retrieval fails', async () => {
    const keywordRows = [
      {
        id: 'doc-1',
        source_type: 'legal',
        source_key: 'legal:en:terms:returnsAndExchanges',
        product_id: null,
        locale: 'en',
        title: 'Returns and Exchanges',
        content: 'Return policy details',
        metadata: {
          href: '/terms-and-conditions#returnsAndExchanges',
        },
        content_hash: 'hash-1',
        index_status: 'ready',
        embedding: null,
        last_indexed_at: null,
        last_index_error: null,
        updated_at: new Date().toISOString(),
      },
    ];
    const admin = {
      from: vi.fn(() => createKeywordPublicQueryBuilder(keywordRows)),
    };
    createAdminClient.mockReturnValue(admin);
    embedText.mockRejectedValueOnce(new Error('embedding unavailable'));

    const { searchPublicDocuments } = await import('@/lib/retrieval/catalog');
    const result = await searchPublicDocuments({
      query: 'return policy',
      locale: 'en',
      sourceTypes: ['legal'],
      limit: 5,
      offset: 0,
      mode: 'assistant',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.sourceKey).toBe(
      'legal:en:terms:returnsAndExchanges'
    );
    expect(result.mode).toBe('assistant');
  });

  it('skips broad text search for generic filtered product queries', async () => {
    const orCalls: string[] = [];
    const admin = {
      rpc: vi.fn(async () => ({ data: [], error: null })),
      from: vi.fn((table: string) => {
        if (table !== 'products') {
          throw new Error(`Unexpected table ${table}`);
        }

        return createProductFallbackQueryBuilder(
          [
            {
              id: 'product-1',
              name: 'Temple Necklace',
              name_telugu: null,
              slug: 'temple-necklace',
              description: 'Bridal necklace',
              description_telugu: null,
              price: 999,
              discount_price: null,
              category_id: 'cat-1',
              stock: 2,
              material: 'Gold Plated',
              tags: ['Trending'],
              images: [],
              is_active: true,
              featured: false,
              is_sale: true,
              is_rental: false,
              rental_price: null,
              rental_discount_price: null,
              rental_deposit: null,
              max_rental_days: null,
              set_number: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              category: {
                name: 'Necklaces',
                name_telugu: null,
                slug: 'necklaces',
              },
            },
          ],
          orCalls
        );
      }),
    };
    createAdminClient.mockReturnValue(admin);
    embedText.mockRejectedValueOnce(new Error('embedding unavailable'));

    const { searchProducts } = await import('@/lib/retrieval/catalog');
    const result = await searchProducts({
      query: 'jewellery',
      locale: 'en',
      filters: {
        maxPrice: 1000,
        type: 'sale',
      },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe('product-1');
    expect(orCalls.some((filters) => filters.includes('name.ilike'))).toBe(false);
  });

  it('resolves public retrieval locales with english fallback for telugu', async () => {
    const {
      isGenericAssistantProductFallbackQuery,
      resolvePublicRetrievalLocales,
    } = await import('@/lib/retrieval/catalog');

    expect(resolvePublicRetrievalLocales('en')).toEqual(['en']);
    expect(resolvePublicRetrievalLocales('te')).toEqual(['te', 'en']);
    expect(isGenericAssistantProductFallbackQuery('rental jewellery')).toBe(
      true
    );
    expect(isGenericAssistantProductFallbackQuery('wedding earrings')).toBe(
      false
    );
  });
});
