// The page's query switches (switches.ts), read from the address as the page opens.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fpsSwitch, gpuSwitch, lightSwitch } from './switches';

const at = (search: string) => vi.stubGlobal('location', { search });
afterEach(() => void vi.unstubAllGlobals());

describe('the light switch (until the owner’s Nov 8 token pick, PLAN §8)', () => {
  it('asks for V1’s paper with `?light=paper` alone, beside any other switch', () => {
    at('?light=paper');
    expect(lightSwitch()).toBe('paper');
    at('?gpu=full&light=paper&fps');
    expect([lightSwitch(), gpuSwitch(), fpsSwitch()]).toEqual(['paper', 'full', true]);
  });

  it('asks for nothing otherwise, so the page draws the warm-neutral set', () => {
    for (const search of ['', '?light', '?light=warm', '?light=Paper', '?paper']) {
      at(search);
      expect(lightSwitch(), search).toBeNull();
    }
  });

  it('asks for nothing with no address at all, as in the sim’s worker', () => {
    expect(lightSwitch()).toBeNull();
  });
});
