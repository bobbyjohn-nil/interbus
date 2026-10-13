import { describe, expect, it, vi } from 'vitest';

describe('replaced build signal', () => {
  it('reports once and tells late subscribers', async () => {
    vi.resetModules();
    const { onReplaced, reportReplaced } = await import('./replaced');
    const early = vi.fn();
    onReplaced(early);
    reportReplaced('chunk');
    reportReplaced('city-file');
    const late = vi.fn();
    onReplaced(late);
    expect(early.mock.calls).toEqual([['chunk']]);
    expect(late.mock.calls).toEqual([['chunk']]);
  });

  it('turns a failed lazy chunk into the card instead of a crash', async () => {
    vi.resetModules();
    const { onReplaced, watchChunkFailures } = await import('./replaced');
    const target = new EventTarget();
    watchChunkFailures(target as unknown as Window);
    const seen = vi.fn();
    onReplaced(seen);
    const event = new Event('vite:preloadError', { cancelable: true });
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(seen.mock.calls).toEqual([['chunk']]);
  });
});
