import { describe, expect, it } from 'vitest';
import { isCurrentAssistantRequest } from '@/lib/assistant-request-state';

describe('assistant request finalization', () => {
  it('rejects a cancelled first voice turn after a second request becomes active', () => {
    expect(
      isCurrentAssistantRequest({
        activeRequestId: 'second-turn',
        requestId: 'first-turn',
        wasCancelled: true,
      })
    ).toBe(false);
  });

  it('accepts the final result only for the active, uncancelled request', () => {
    expect(
      isCurrentAssistantRequest({
        activeRequestId: 'current-turn',
        requestId: 'current-turn',
        wasCancelled: false,
      })
    ).toBe(true);
  });
});
