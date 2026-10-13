import { describe, expect, it } from 'vitest';
import { afterIdle, afterMountError, afterTimeout } from './status';

describe('map status', () => {
  it('is ready on an idle frame with features, and empty on one without', () => {
    expect(afterIdle('loading', 120)).toBe('ready');
    expect(afterIdle('loading', 0)).toBe('empty');
  });

  it('lets a late first frame clear the timeout (a background tab draws only once shown)', () => {
    expect(afterIdle(afterTimeout('loading'), 120)).toBe('ready');
  });

  it('keeps the replaced-build state whatever happens next', () => {
    expect(afterIdle('replaced', 120)).toBe('replaced');
    expect(afterTimeout('replaced')).toBe('replaced');
    expect(afterMountError('replaced')).toBe('replaced');
  });

  it('times out only while loading', () => {
    expect(afterTimeout('loading')).toBe('failed');
    expect(afterTimeout('ready')).toBe('ready');
    expect(afterMountError('loading')).toBe('failed');
  });
});
