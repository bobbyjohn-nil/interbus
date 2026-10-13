// The place-depot command on the fixture: the shared rule decides, the ledger pays (I1, I6).
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { loadCity } from '../city/simfile';
import { pointInRing, toLngLat, toXY, type XY } from '../core/geo';
import { checkDepotSite } from '../rules/depot';
import { newGame } from '../state';
import { createWorld, depotSiteContext, type World } from '../world';
import { placeDepot } from './placeDepot';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;
const game = (): World => createWorld(city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));

/** A point inside the fixture's largest parcel of industrial land. */
function insideLand(): XY {
  const ring = [...city.depotLand].sort((a, b) => b.length - a.length)[0]!;
  const [cx, cy] = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  for (let t = 0; t <= 1; t += 0.05) {
    const p: XY = [cx + (ring[0]![0] - cx) * t, cy + (ring[0]![1] - cy) * t];
    if (pointInRing(ring, p)) return p;
  }
  throw new Error('no point inside the parcel');
}

describe('placing a depot on mini-Boston', () => {
  it('buys a depot on industrial land for $150k, one Purchases row, and saves it by place', () => {
    const world = game();
    const at = toLngLat(city.frame, insideLand());
    const before = world.state.ledger.cashCents;
    const placed = placeDepot(world, at);
    expect(placed).toMatchObject({ ok: true, priceCents: 15_000_000 });
    expect(world.state.ledger.cashCents).toBe(before - 15_000_000);
    expect(world.state.ledger.rows.at(-1)).toEqual({ day: 1, kind: 'purchase', amountCents: -15_000_000 });
    expect(world.state.depots).toEqual([{ id: 1, lon: at[0], lat: at[1] }]);
  });

  it('refuses a second depot on the same spot, and a depot in Back Bay, without spending', () => {
    const world = game();
    const at = toLngLat(city.frame, insideLand());
    placeDepot(world, at);
    const cash = world.state.ledger.cashCents;
    expect(placeDepot(world, at)).toMatchObject({ ok: false, reason: 'too_close_to_depot' });
    expect(placeDepot(world, [-71.0776, 42.3496])).toMatchObject({ ok: false, reason: 'not_depot_land' });
    expect(world.state.ledger.cashCents).toBe(cash);
    expect(world.state.depots).toHaveLength(1);
  });

  it('refuses in money when cash is short, naming the shortfall', () => {
    const world = game();
    world.state.ledger.cashCents = -5_000_000; // $50k owed leaves $100k of the $150k credit line (D10)
    expect(placeDepot(world, toLngLat(city.frame, insideLand()))).toMatchObject({ ok: false, reason: 'insufficient_funds', shortCents: 5_000_000 });
  });

  it('gives the same verdict as the rule the cursor card calls, everywhere on a 60 m grid over the fixture (I6)', () => {
    const world = game();
    const ctx = depotSiteContext(world);
    const [x0, y0] = toXY(city.frame, [-71.11, 42.335]);
    const [x1, y1] = toXY(city.frame, [-71.07, 42.36]);
    let allowed = 0;
    for (let x = x0; x < x1; x += 60) {
      for (let y = y0; y < y1; y += 60) {
        const card = checkDepotSite(ctx, [x, y]);
        const { nextIds, ledger } = world.state;
        const rows = ledger.rows.length;
        const cash = ledger.cashCents;
        const done = placeDepot(world, toLngLat(city.frame, [x, y]));
        expect(done.ok, `at ${x.toFixed(0)}, ${y.toFixed(0)}`).toBe(card.ok);
        if (!card.ok && !done.ok) expect(done.reason).toBe(card.reason);
        if (done.ok) {
          allowed++;
          // Put the world back, so every point is judged against no depot.
          world.state.depots = [];
          world.state.nextIds = nextIds;
          ledger.rows.length = rows;
          ledger.cashCents = cash;
        }
      }
    }
    expect(allowed).toBeGreaterThan(0);
  });
});
