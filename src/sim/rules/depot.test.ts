import { describe, expect, it } from 'vitest';
import type { XY } from '../core/geo';
import { checkDepotSite, depotPriceCents, type DepotSiteContext } from './depot';

describe('depot prices (V1 ladder)', () => {
  it('runs $150k, $225k, $340k, $505k, $760k', () => {
    expect([0, 1, 2, 3, 4].map(depotPriceCents)).toEqual([15_000_000, 22_500_000, 34_000_000, 50_500_000, 76_000_000]);
  });
});

describe('where a depot may stand (one predicate: card, command and tint)', () => {
  // A 200 m square of industrial land with a street node 50 m off its east side.
  const land: XY[][] = [[[0, 0], [200, 0], [200, 200], [0, 200]]];
  const ctx = (depots: XY[] = []): DepotSiteContext => ({
    land,
    nearestNode: (at, withinM) => {
      const d = Math.hypot(at[0] - 250, at[1] - 100);
      return d <= withinM ? { node: 7, distM: d } : null;
    },
    depots,
  });

  it('allows depot land with a street within 400 m, naming the node and the price', () => {
    expect(checkDepotSite(ctx(), [150, 100])).toEqual({ ok: true, node: 7, streetM: 100, priceCents: 15_000_000 });
  });

  it('refuses off depot land, beyond a street, too near another depot and past the fifth', () => {
    expect(checkDepotSite(ctx(), [300, 100])).toMatchObject({ ok: false, reason: 'not_depot_land' });
    const farStreet: DepotSiteContext = { ...ctx(), nearestNode: () => null };
    expect(checkDepotSite(farStreet, [100, 100])).toMatchObject({ ok: false, reason: 'too_far_from_street', limitM: 400 });
    expect(checkDepotSite(ctx([[100, 150]]), [100, 50])).toMatchObject({ ok: false, reason: 'too_close_to_depot', limitM: 120, nearestM: 100 });
    expect(checkDepotSite(ctx([[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]), [150, 100])).toMatchObject({ ok: false, reason: 'depot_limit' });
  });

  it('prices the next depot by how many stand', () => {
    expect(checkDepotSite(ctx([[10, 10]]), [180, 180])).toMatchObject({ ok: true, priceCents: 22_500_000 });
  });
});
