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
    navigation?: {
      kind:
        | 'page'
        | 'product_filters'
        | 'product_detail'
        | 'order_detail'
        | 'checkout_confirmation';
      destination: string;
      href: string;
    } | null;
    navigationOptions?: Array<{
      id: string;
      label: string;
      description?: string | null;
      navigation: {
        kind: 'page' | 'product_filters' | 'product_detail' | 'order_detail' | 'checkout_confirmation';
        destination: string;
        href: string;
      };
    }>;
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
  primaryImage?: string;
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
    normalized.includes('take me to your terms') ||
    normalized.includes('nannu terms page ki teesukellandi')
  ) {
    const isRomanizedTelugu = normalized.includes('nannu terms page ki teesukellandi');
    return {
      reply: {
        answer: isRomanizedTelugu
          ? 'మిమ్మల్ని నిబంధనలు మరియు షరతుల పేజీకి తీసుకెళ్తున్నాను.'
          : 'Opening terms and conditions.',
        citations: [],
        followUpSuggestions: [],
        fallbackReason: null,
        navigation: {
          kind: 'page',
          destination: 'terms',
          href: '/terms-and-conditions',
        },
      },
      handoff: null,
    };
  }

  if (normalized.includes('show me products that are under 1000')) {
    return {
      reply: {
        answer: 'Opening products under 1000 rupees.',
        citations: [],
        followUpSuggestions: [],
        fallbackReason: null,
        navigation: {
          kind: 'product_filters',
          destination: 'products',
          href: '/products?type=rental&maxPrice=1000',
        },
      },
      handoff: null,
    };
  }

  if (normalized.includes('open ambiguous necklace')) {
    return {
      reply: {
        answer: 'I found a few matching products. Choose one to open. Say or select first, second, or third: 1. Lotus Necklace; 2. Temple Necklace',
        citations: [],
        followUpSuggestions: [],
        fallbackReason: null,
        navigationOptions: [
          {
            id: 'product:lotus-necklace',
            label: 'Lotus Necklace',
            description: 'Set number 42',
            navigation: {
              kind: 'product_detail',
              destination: 'product_detail',
              href: '/products/lotus-necklace',
            },
          },
          {
            id: 'product:temple-necklace',
            label: 'Temple Necklace',
            description: 'Set number 43',
            navigation: {
              kind: 'product_detail',
              destination: 'product_detail',
              href: '/products/temple-necklace',
            },
          },
        ],
      },
      handoff: null,
    };
  }

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
            primaryImage: recommendedProduct.primaryImage ?? null,
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
    const midpoint = Math.max(1, Math.floor(response.reply.answer.length / 2));
    const events = [
      { type: 'start' },
      { type: 'answer_delta', delta: response.reply.answer.slice(0, midpoint) },
      { type: 'answer_delta', delta: response.reply.answer.slice(midpoint) },
      { type: 'result', ...response },
    ];

    await route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson; charset=utf-8',
      body: `${events.map((event) => JSON.stringify(event)).join('\n')}\n`,
    });
  });
}

async function openAssistant(page: Page) {
  const launcher = page
    .locator(
      '[data-testid="assistant-launcher"], button[aria-label="Ask AI"]'
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

async function installVoiceBrowserMocks(page: Page) {
  await page.route('**/api/voice/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'e2e-voice-token' }),
    });
  });

  await page.evaluate(() => {
    type VoiceMessage = Record<string, unknown>;

    const controls: VoiceMessage[] = [];
    let activeSocket: MockWebSocket | null = null;

    class MockWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;

      readonly CONNECTING = 0;
      readonly OPEN = 1;
      readonly CLOSING = 2;
      readonly CLOSED = 3;
      readyState = MockWebSocket.CONNECTING;
      bufferedAmount = 0;
      binaryType = 'blob';
      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;

      constructor(readonly url: string) {
        // The latest instance is exposed to the test driver so it can emulate
        // server events after the browser has opened the session.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        activeSocket = this;
        window.setTimeout(() => {
          this.readyState = MockWebSocket.OPEN;
          this.onopen?.(new Event('open'));
          this.emit({ type: 'state', value: 'listening' });
        }, 0);
      }

      send(data: string | ArrayBuffer) {
        if (typeof data !== 'string') return;
        const message = JSON.parse(data) as VoiceMessage;
        controls.push(message);
        if (message.type === 'speak_start') {
          this.emit({ type: 'state', value: 'speaking' });
        }
        if (message.type === 'speak_delta') {
          this.emit({
            type: 'assistant_text',
            utteranceId: message.utteranceId,
            text: message.text,
          });
        }
        if (message.type === 'speak_reset') {
          this.emit({ type: 'state', value: 'thinking' });
          this.emit({ type: 'state', value: 'speaking' });
        }
        if (message.type === 'speak_end') {
          window.setTimeout(() => {
            this.emit({ type: 'utterance_end', utteranceId: message.utteranceId });
            this.emit({ type: 'state', value: 'listening' });
          }, 20);
        }
      }

      close(code = 1000, reason = '') {
        this.readyState = MockWebSocket.CLOSED;
        this.onclose?.({ code, reason } as CloseEvent);
      }

      emit(message: VoiceMessage) {
        this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent<string>);
      }
    }

    class MockAudioWorkletNode {
      port = { onmessage: null as ((event: MessageEvent<ArrayBuffer>) => void) | null };
      connect() {}
      disconnect() {}
    }

    class MockAudioContext {
      state: AudioContextState = 'running';
      sampleRate = 48000;
      destination = {} as AudioDestinationNode;
      audioWorklet = { addModule: async () => {} } as AudioWorklet;
      resume = async () => {};
      close = async () => {
        this.state = 'closed';
      };
      createMediaStreamSource() {
        return { connect() {}, disconnect() {} } as unknown as MediaStreamAudioSourceNode;
      }
      decodeAudioData = async () => {
        throw new Error('No audio payload expected in this test');
      };
    }

    const track = { stop() {} } as MediaStreamTrack;
    const stream = {
      getTracks: () => [track],
      getAudioTracks: () => [track],
    } as MediaStream;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => stream },
    });
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    });
    Object.defineProperty(window, 'AudioWorkletNode', {
      configurable: true,
      value: MockAudioWorkletNode,
    });
    Object.defineProperty(window, 'WebSocket', {
      configurable: true,
      value: MockWebSocket,
    });

    Object.assign(window, {
      __voiceE2E: {
        controls,
        emit(message: VoiceMessage) {
          activeSocket?.emit(message);
        },
        transcript(text: string, utteranceId: number) {
          activeSocket?.emit({ type: 'state', value: 'thinking' });
          activeSocket?.emit({ type: 'transcript', text, utteranceId });
        },
      },
    });
  });
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
    await expect(reopenedDialog.locator('[data-assistant-message]')).toHaveCount(8);
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

    const assistantBubble = productCard.locator(
      'xpath=ancestor::*[@data-assistant-message="assistant"][1]/*[@data-assistant-message-content]'
    );
    const layout = await assistantBubble.evaluate((bubble) => {
      const bubbleRect = bubble.getBoundingClientRect();
      const response = bubble.querySelector('[data-assistant-response]');
      const card = bubble.querySelector('[data-assistant-product-card]');
      const responseRect = response?.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();

      return {
        bubbleBottom: bubbleRect.bottom,
        bubbleLeft: bubbleRect.left,
        bubbleRight: bubbleRect.right,
        cardBottom: cardRect?.bottom ?? Number.POSITIVE_INFINITY,
        cardLeft: cardRect?.left ?? Number.NEGATIVE_INFINITY,
        cardRight: cardRect?.right ?? Number.POSITIVE_INFINITY,
        cardTop: cardRect?.top ?? Number.NEGATIVE_INFINITY,
        responseBottom: responseRect?.bottom ?? Number.POSITIVE_INFINITY,
      };
    });

    expect(layout.cardLeft).toBeGreaterThanOrEqual(layout.bubbleLeft - 1);
    expect(layout.cardRight).toBeLessThanOrEqual(layout.bubbleRight + 1);
    expect(layout.cardBottom).toBeLessThanOrEqual(layout.bubbleBottom + 1);
    expect(layout.cardTop).toBeGreaterThanOrEqual(layout.responseBottom - 1);

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

  test('8. Voice uses the grounded shopping flow with product imagery and citations', async ({ page }) => {
    const vadAsset = await page.request.get('/vad/vad.worklet.bundle.min.js');
    expect(vadAsset.ok()).toBe(true);

    const tokenResponse = await page.evaluate(async () => {
      const response = await fetch('/api/voice/token', { method: 'POST' });
      return {
        body: await response.json(),
        cacheControl: response.headers.get('cache-control'),
        status: response.status,
      };
    });
    expect(tokenResponse.status).toBe(200);
    expect(tokenResponse.cacheControl).toContain('no-store');
    expect(tokenResponse.body).toMatchObject({ token: expect.any(String) });

    const rejectedOrigin = await page.request.post(
      `${new URL(page.url()).origin}/api/voice/token`, {
      headers: { Origin: 'https://attacker.example' },
      },
    );
    expect(rejectedOrigin.status()).toBe(403);

    await installVoiceBrowserMocks(page);
    await page.unroute('**/api/assistant/chat');
    await installAssistantStub(page, () => ({
      id: 'assistant-stub-product',
      slug: 'assistant-stub-product',
      name: 'Assistant Stub Product',
      href: '/products/assistant-stub-product',
      primaryImage: '/icon.png',
    }));
    const dialog = await openAssistant(page);
    await dialog.getByRole('button', { name: /Tap to talk/i }).click();
    await expect(dialog.getByText('Listening…')).toBeVisible();

    await page.evaluate(() => {
      (window as typeof window & {
        __voiceE2E: { transcript(text: string, utteranceId: number): void };
      }).__voiceE2E.transcript('Show me elegant earrings for a wedding', 1);
    });

    await expect(
      dialog.getByText('Show me elegant earrings for a wedding', { exact: true }),
    ).toBeVisible();
    const productCard = dialog.locator('[data-assistant-product-card]').first();
    await expect(productCard).toBeVisible();
    await expect(productCard.locator('img')).toBeVisible();
    await expect(
      dialog.getByRole('link', { name: 'Assistant Stub Product' }).last(),
    ).toBeVisible();

    const controls = await page.evaluate(() =>
      (window as typeof window & {
        __voiceE2E: { controls: Array<Record<string, unknown>> };
      }).__voiceE2E.controls,
    );
    expect(
      controls.some((message) => message.type === 'speak_start' && message.utteranceId === 1),
    ).toBe(true);
    expect(
      controls.some(
        (message) =>
          message.type === 'speak_delta' &&
          message.utteranceId === 1 &&
          String(message.text).includes('grounded product matches'),
      ),
    ).toBe(true);
    expect(
      controls.some((message) => message.type === 'speak_end' && message.utteranceId === 1),
    ).toBe(true);
  });

  test('9. Typed navigation closes the sheet and preserves the selected site locale', async ({ page }) => {
    await page.goto('/te', { waitUntil: 'domcontentloaded' });
    const dialog = await openAssistant(page);

    await sendAssistantMessage(dialog, 'Take me to your terms and conditions page');

    await page.waitForURL(/\/te\/terms-and-conditions$/);
    await expect(page.getByRole('dialog').last()).toBeHidden();
  });

  test('10. Typed budget browsing applies the rental-first product URL', async ({ page }) => {
    const dialog = await openAssistant(page);

    await sendAssistantMessage(dialog, 'Show me products that are under 1000');

    await page.waitForURL(/\/en\/products\?type=rental&maxPrice=1000$/);
    await expect(page.getByRole('dialog').last()).toBeHidden();
  });

  test('11. Ask AI remains available on auth pages and preserves the locale when navigating away', async ({ page }) => {
    await page.goto('/en/login', { waitUntil: 'domcontentloaded' });
    const dialog = await openAssistant(page);

    await sendAssistantMessage(dialog, 'Take me to your terms and conditions page');

    await page.waitForURL(/\/en\/terms-and-conditions$/);
    await expect(page.getByRole('dialog').last()).toBeHidden();
  });

  test('12. Typed disambiguation choices only navigate through their validated destination', async ({ page }) => {
    const dialog = await openAssistant(page);

    await sendAssistantMessage(dialog, 'Open ambiguous necklace');
    const firstOption = dialog.locator('[data-assistant-navigation-option="1"]');
    await expect(firstOption).toContainText('Lotus Necklace');
    await firstOption.click();

    await page.waitForURL(/\/en\/products\/lotus-necklace$/);
    await expect(page.getByRole('dialog').last()).toBeHidden();
  });

  test('13. Voice navigation speaks the detected query language and uses the same safe route', async ({ page }) => {
    await installVoiceBrowserMocks(page);
    const dialog = await openAssistant(page);
    await dialog.getByRole('button', { name: /Tap to talk/i }).click();

    await page.evaluate(() => {
      (window as typeof window & {
        __voiceE2E: { transcript(text: string, utteranceId: number): void };
      }).__voiceE2E.transcript('nannu terms page ki teesukellandi', 2);
    });

    await page.waitForURL(/\/en\/terms-and-conditions$/);
    const controls = await page.evaluate(() =>
      (window as typeof window & {
        __voiceE2E: { controls: Array<Record<string, unknown>> };
      }).__voiceE2E.controls,
    );
    expect(
      controls.some(
        (message) =>
          message.type === 'speak_start' &&
          message.utteranceId === 2 &&
          message.language === 'te',
      ),
    ).toBe(true);
    expect(
      controls.some(
        (message) =>
          message.type === 'speak_delta' &&
          message.utteranceId === 2 &&
          String(message.text).includes('నిబంధనలు మరియు షరతుల'),
      ),
    ).toBe(true);
  });

  test('14. Voice can select an ambiguous destination by ordinal in the original query language', async ({ page }) => {
    await installVoiceBrowserMocks(page);
    const dialog = await openAssistant(page);
    await dialog.getByRole('button', { name: /Tap to talk/i }).click();

    await page.evaluate(() => {
      (window as typeof window & {
        __voiceE2E: { transcript(text: string, utteranceId: number): void };
      }).__voiceE2E.transcript('Open ambiguous necklace', 4);
    });
    await expect(dialog.locator('[data-assistant-navigation-option="1"]')).toBeVisible();

    await page.evaluate(() => {
      (window as typeof window & {
        __voiceE2E: { transcript(text: string, utteranceId: number): void };
      }).__voiceE2E.transcript('first', 5);
    });

    await page.waitForURL(/\/en\/products\/lotus-necklace$/);
    const controls = await page.evaluate(() =>
      (window as typeof window & {
        __voiceE2E: { controls: Array<Record<string, unknown>> };
      }).__voiceE2E.controls,
    );
    expect(
      controls.some(
        (message) =>
          message.type === 'speak_start' &&
          message.utteranceId === 5 &&
          message.language === 'en',
      ),
    ).toBe(true);
  });

  test('15. A cancelled voice turn cannot apply a late navigation reply', async ({ page }) => {
    await page.unroute('**/api/assistant/chat');
    await page.route('**/api/assistant/chat', async (route) => {
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 200,
        contentType: 'application/x-ndjson; charset=utf-8',
        body: `${JSON.stringify({ type: 'start' })}\n${JSON.stringify({
          type: 'result',
          reply: {
            answer: 'Opening terms and conditions.',
            citations: [],
            followUpSuggestions: [],
            fallbackReason: null,
            navigation: {
              kind: 'page',
              destination: 'terms',
              href: '/terms-and-conditions',
            },
          },
          handoff: null,
        })}\n`,
      }).catch(() => undefined);
    });

    await installVoiceBrowserMocks(page);
    const dialog = await openAssistant(page);
    await dialog.getByRole('button', { name: /Tap to talk/i }).click();

    await page.evaluate(() => {
      (window as typeof window & {
        __voiceE2E: { transcript(text: string, utteranceId: number): void };
      }).__voiceE2E.transcript('Take me to your terms and conditions page', 3);
    });
    await expect(
      dialog.getByText('Take me to your terms and conditions page', { exact: true }),
    ).toBeVisible();

    await page.evaluate(() => {
      (window as typeof window & {
        __voiceE2E: {
          emit(message: { type: string; utteranceId: number; reason: string }): void;
        };
      }).__voiceE2E.emit({
        type: 'turn_cancelled',
        utteranceId: 3,
        reason: 'barge_in',
      });
    });

    await page.waitForTimeout(400);
    await expect(page).toHaveURL(/\/en$/);
  });
});
