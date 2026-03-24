import { expect, test, type Locator, type Page } from '@playwright/test';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AssistantApiResponse = {
  reply: {
    answer: string;
    citations: Array<{
      sourceType: 'product' | 'store_info' | 'faq' | 'legal';
      sourceKey: string;
      title: string;
      href?: string | null;
      productId?: string | null;
      slug?: string | null;
    }>;
    followUpSuggestions: Array<{
      label: string;
      prompt: string;
      sourceKeys: string[];
    }>;
    fallbackReason: 'unsupported_scope' | 'no_context' | 'generation_error' | null;
    recommendedProducts?: Array<{
      id: string;
      slug: string;
      sourceKey: string;
      name: string;
      name_telugu: string | null;
      primaryImage: string | null;
      categoryName: string | null;
      categoryNameTelugu: string | null;
      isSale: boolean;
      isRental: boolean;
      salePrice: number | null;
      saleOriginalPrice: number | null;
      rentalPrice: number | null;
      rentalOriginalPrice: number | null;
      setNumber: string | null;
    }>;
  };
  handoff: {
    type: 'whatsapp';
    label: string;
    url: string;
  } | null;
};

type StubProduct = {
  id: string;
  slug: string;
  name: string;
  href: string;
};

const FOLLOW_UP_LABEL = 'What materials do you use?';
const FAQ_CITATION = {
  sourceType: 'faq' as const,
  sourceKey: 'faq:en:q2',
  title: 'What types of jewellery are available at Bhagyalakshmi Future Gold?',
  href: '/about#faq-q2',
};
const PRODUCT_CITATION_SOURCE_KEY = 'product:assistant-stub-product';

function latestUserMessage(messages: ChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === 'user')?.content.trim() ?? '';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildAssistantResponseForMessage(
  message: string,
  recommendedProduct: StubProduct
): AssistantApiResponse {
  const normalized = message.toLowerCase();

  if (
    /^(hi|hello|hey|namaste|hii|hai|హాయ్|హలో|నమస్తే)\b/.test(normalized) ||
    /^(help|what can you do|what can you help with|capabilit(y|ies))\b/.test(normalized)
  ) {
    return {
      reply: {
        answer:
          'Hi! I can help you discover jewellery, explain rental options, and answer store or policy questions.',
        citations: [],
        followUpSuggestions: [],
        fallbackReason: null,
      },
      handoff: null,
    };
  }

  if (
    /(order status|track my order|refund|account|login|password|payment failed|change my address)/.test(
      normalized
    )
  ) {
    return {
      reply: {
        answer:
          'I can help with products, rentals, store information, and policy questions. For order or account-specific help, please contact the store on WhatsApp.',
        citations: [],
        followUpSuggestions: [],
        fallbackReason: 'unsupported_scope',
      },
      handoff: {
        type: 'whatsapp',
        label: 'Chat on WhatsApp',
        url: 'https://wa.me/919290011275?text=Hello',
      },
    };
  }

  if (normalized.includes('materials') || normalized.includes('types of materials')) {
    return {
      reply: {
        answer:
          'We use a range of jewellery finishes and materials across the catalog, including gold plated, panchaloha, antique, nakshi, GJ polish, CZ, and uncut stone designs.',
        citations: [FAQ_CITATION],
        followUpSuggestions: [],
        fallbackReason: null,
      },
      handoff: null,
    };
  }

  if (
    normalized.includes('wedding earrings') ||
    normalized.includes('elegant earrings')
  ) {
    return {
      reply: {
        answer:
          'Here are a few grounded product matches for wedding-ready earrings.',
        citations: [
          {
            sourceType: 'product',
            sourceKey: PRODUCT_CITATION_SOURCE_KEY,
            title: recommendedProduct.name,
            href: recommendedProduct.href,
            productId: recommendedProduct.id,
            slug: recommendedProduct.slug,
          },
        ],
        recommendedProducts: [
          {
            id: recommendedProduct.id,
            slug: recommendedProduct.slug,
            sourceKey: PRODUCT_CITATION_SOURCE_KEY,
            name: recommendedProduct.name,
            name_telugu: null,
            primaryImage: null,
            categoryName: 'Earrings',
            categoryNameTelugu: null,
            isSale: true,
            isRental: true,
            salePrice: 1299,
            saleOriginalPrice: 1499,
            rentalPrice: 299,
            rentalOriginalPrice: 349,
            setNumber: 'SET-12',
          },
        ],
        followUpSuggestions: [],
        fallbackReason: null,
      },
      handoff: null,
    };
  }

  if (normalized.includes('what types of jewellery are available')) {
    return {
      reply: {
        answer:
          'We offer earrings, necklaces, bangles, bracelets, rings, jewellery sets, and more. If you want, I can also explain the materials we use.',
        citations: [FAQ_CITATION],
        followUpSuggestions: [
          {
            label: FOLLOW_UP_LABEL,
            prompt: FOLLOW_UP_LABEL,
            sourceKeys: [FAQ_CITATION.sourceKey],
          },
        ],
        fallbackReason: null,
      },
      handoff: null,
    };
  }

  if (normalized.includes('long conversation')) {
    return {
      reply: {
        answer:
          'This is a longer assistant response intended to force the scroll area to overflow. '.repeat(18),
        citations: [FAQ_CITATION],
        followUpSuggestions: [],
        fallbackReason: null,
      },
      handoff: null,
    };
  }

  return {
      reply: {
        answer:
          'I can help with products, rentals, store information, and policies.',
        citations: [],
        followUpSuggestions: [],
        fallbackReason: null,
      },
    handoff: null,
  };
}

async function installAssistantStub(
  page: Page,
  getRecommendedProduct: () => StubProduct
) {
  await page.route('**/api/assistant/chat', async (route) => {
    const body = route.request().postDataJSON() as {
      messages?: ChatMessage[];
    };
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const response = buildAssistantResponseForMessage(
      latestUserMessage(messages),
      getRecommendedProduct()
    );

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

async function openAssistant(page: Page) {
  const launcher = page
    .locator(
      '[data-testid="assistant-launcher"], button[aria-label="Ask AI"], button:has(svg.lucide-sparkles)'
    )
    .last();
  await expect(launcher).toBeVisible({ timeout: 15000 });
  await launcher.click();

  const dialog = page.getByRole('dialog').last();
  await expect(dialog).toBeVisible();
  return dialog;
}

async function sendAssistantMessage(dialog: Locator, message: string) {
  const composer = dialog.locator('textarea').first();
  await expect(composer).toBeVisible();
  await composer.fill(message);
  await composer.press('Enter');
}

test.describe('Assistant regression coverage', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await installAssistantStub(page, () => ({
      id: 'assistant-stub-product',
      slug: 'assistant-stub-product',
      name: 'Assistant Stub Product',
      href: '/products/assistant-stub-product',
    }));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('1. Greeting, capability, and help prompts respond with bounded assistant replies', async ({ page }) => {
    const dialog = await openAssistant(page);

    for (const prompt of ['hi', 'what can you help with?', 'help']) {
      await sendAssistantMessage(dialog, prompt);
      await expect(dialog.getByText(prompt, { exact: true })).toBeVisible();
      await expect(
        dialog.getByText(
          /I can help with products, rentals, store information, and policies|Hi! I can help you discover jewellery/i
        ).first()
      ).toBeVisible();
    }
  });

  test('2. Unsupported order and account questions surface the WhatsApp handoff path', async ({ page }) => {
    const dialog = await openAssistant(page);

    await sendAssistantMessage(dialog, 'Can you tell me my order status?');

    await expect(
      dialog.getByText(
        /I can help with products, rentals, store information, and policy questions/i
      )
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Chat on WhatsApp/i })).toBeVisible();
  });

  test('3. Follow-up chips stay grounded and the follow-up question remains answerable', async ({ page }) => {
    const dialog = await openAssistant(page);

    await sendAssistantMessage(dialog, 'What types of jewellery are available at Bhagyalakshmi Future Gold?');
    const followUpChip = dialog.getByRole('button', { name: FOLLOW_UP_LABEL });
    await expect(followUpChip).toBeVisible();

    await followUpChip.click();
    await expect(
      dialog.getByText(
        /gold plated, panchaloha, antique, nakshi, GJ polish, CZ, and uncut stone/i
      )
    ).toBeVisible();
  });

  test('4. Citation clicks close the assistant and navigate to the anchored FAQ section', async ({ page }) => {
    const dialog = await openAssistant(page);

    await sendAssistantMessage(dialog, 'What types of jewellery are available at Bhagyalakshmi Future Gold?');

    const citation = dialog.getByRole('link', {
      name: FAQ_CITATION.title,
    });
    await expect(citation).toBeVisible();
    await citation.click();

    await page.waitForURL(/\/about#faq-q2$/);
    await expect(page.locator('#faq-q2')).toBeVisible();
    await expect(page.getByRole('dialog').last()).toBeHidden();
  });

  test('5. Long conversations keep the sheet scrollable and restore after refresh', async ({ page }) => {
    test.slow();

    const dialog = await openAssistant(page);

    for (let index = 0; index < 4; index += 1) {
      await sendAssistantMessage(dialog, `long conversation ${index + 1}`);
    }

    const viewport = dialog.locator('[data-radix-scroll-area-viewport]').first();
    await expect(viewport).toBeVisible();

    const metrics = await viewport.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

    await page.goto(page.url(), {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await expect(page.locator('main')).toBeVisible();

    const reopenedDialog = await openAssistant(page);
    await expect(reopenedDialog.locator('p.whitespace-pre-wrap')).toHaveCount(8);
  });

  test('6. Product-aware replies render compact product cards and clicking a card closes the assistant', async ({ page }) => {
    const firstProductHref =
      (await page
        .locator(
          'a[href^="/products/"]:not([href*="?"]), a[href^="/en/products/"]:not([href*="?"]), a[href^="/te/products/"]:not([href*="?"])'
        )
        .first()
        .getAttribute('href')) ??
      '/products/assistant-stub-product';
    const recommendedSlug =
      firstProductHref.match(/\/products\/(.+)$/)?.[1] ?? 'assistant-stub-product';

    await page.unroute('**/api/assistant/chat');
    await installAssistantStub(page, () => ({
      id: 'assistant-stub-product',
      slug: recommendedSlug,
      name: 'Assistant Stub Product',
      href: firstProductHref,
    }));

    const dialog = await openAssistant(page);
    await sendAssistantMessage(dialog, 'Show me elegant earrings for a wedding');

    const productCard = dialog.locator('[data-assistant-product-card]').first();
    await expect(productCard).toBeVisible();
    await expect(productCard).toContainText('Assistant Stub Product');
    await productCard.click();

    await page.waitForURL(new RegExp(`${escapeRegExp(firstProductHref)}$`));
    await expect(page.getByRole('dialog').last()).toBeHidden();
  });

  test('7. Non-product replies keep the current text-only assistant layout', async ({ page }) => {
    const dialog = await openAssistant(page);

    await sendAssistantMessage(dialog, 'What materials do you use?');

    await expect(dialog.locator('[data-assistant-product-card]')).toHaveCount(0);
    await expect(dialog.getByRole('link', { name: FAQ_CITATION.title })).toBeVisible();
  });
});
