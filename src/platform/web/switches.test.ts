// The page's query switches (switches.ts), read from the address as the page opens.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { countsSwitch, fpsSwitch, gpuSwitch, lightSwitch } from './switches';

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

// The systems audit's twelfth round: the map counted what it drew for the e2e tests in every player's page, 15–17 ms after each
// frame on Inner Boston while time ran.
describe('the counts switch (the e2e tests’ own)', () => {
  it('has the map count what it draws with `?counts` alone, beside any other switch', () => {
    at('?gpu=full&counts');
    expect(countsSwitch()).toBe(true);
    for (const search of ['', '?count', '?fps', '?gpu=full']) {
      at(search);
      expect(countsSwitch(), search).toBe(false);
    }
  });
});
