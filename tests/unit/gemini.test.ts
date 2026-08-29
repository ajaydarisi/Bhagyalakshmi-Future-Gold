import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

describe('Gemini JSON generation', () => {
  beforeEach(() => {
    vi.resetModules();
    generateContent.mockReset();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('forwards cancellation signals to the provider request', async () => {
    generateContent.mockResolvedValue({ text: '{"prompt":"clean request"}' });
    const { generateJson } = await import('@/lib/ai/gemini');
    const controller = new AbortController();

    await expect(
      generateJson<{ prompt: string }>('clean this', { signal: controller.signal })
    ).resolves.toEqual({ prompt: 'clean request' });

    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ abortSignal: controller.signal }),
      })
    );
  });
});
