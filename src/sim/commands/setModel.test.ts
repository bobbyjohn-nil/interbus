import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { loadCity } from '../city/simfile';
import { pointInRing, toLngLat, type XY } from '../core/geo';
import { foundLedger, rowsOfDay } from '../economy/ledger';
import { forecastDay } from '../economy/costs';
import { newGame } from '../state';
import { createWorld } from '../world';
import { addDebugLine } from './debugLine';
import { placeDepot } from './placeDepot';
import { setModel } from './setModel';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;
// A depot in the fixture's largest parcel of depot land, as bench/day.ts places it: room for the buses.
const ring = [...city.depotLand].sort((a, b) => b.length - a.length)[0]!;
const [cx, cy] = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
const site = [...Array(21).keys()].map((k): XY => [cx + (ring[0]![0] - cx) * k * 0.05, cy + (ring[0]![1] - cy) * k * 0.05]).find((p) => pointInRing(ring, p))!;

/** The debug line's two Sparrows at a depot, with a million dollars to change them. */
function game() {
  const world = createWorld(city, { ...newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1), ledger: foundLedger(100_000_000) });
  if (!placeDepot(world, toLngLat(city.frame, site)).ok) throw new Error('no depot');
  const added = addDebugLine(world);
  if (!added.ok) throw new Error(added.reason);
  return { world, lineId: added.lineId };
}

describe('a line changing model (the M3 spec, item 2)', () => {
  it('sells its Sparrows at half price, buys the Metro 40s its headways need, and runs at their speed and cost', () => {
    const { world, lineId } = game();
    const before = world.services.get(lineId)!;
    const result = setModel(world, lineId, 'metro40');
    expect(result).toEqual({ ok: true, bought: 2, buyCents: 52_000_000, saleCents: 9_500_000 });
    // One Sales row and one Purchases row on day 1; cash moves by the difference, to the cent (I1).
    expect(rowsOfDay(world.state.ledger, 1).map((r) => [r.kind, r.amountCents]).slice(-2)).toEqual([
      ['sale', 9_500_000],
      ['purchase', -52_000_000],
    ]);
    expect(world.state.ledger.cashCents).toBe(100_000_000 - 15_000_000 + 9_500_000 - 52_000_000);
    const after = world.services.get(lineId)!;
    expect(world.state.lines[0]).toMatchObject({ model: 'metro40', buses: 2 });
    // 25 km/h, not 26: a longer round trip; $1.50 a km, not $0.90.
    expect(after.timing.cycle).toBeGreaterThan(before.timing.cycle);
    expect(after.costs.model.id).toBe('metro40');
    expect(forecastDay(after.costs).running / forecastDay(before.costs).running).toBeCloseTo(150 / 90, 2);
    expect(after.plan.kmh).toBe(25);
  });

  it('refuses the same model and a locked one, and changes nothing', () => {
    const { world, lineId } = game();
    expect(setModel(world, lineId, 'sparrow')).toEqual({ ok: false, reason: 'same_model' });
    expect(setModel(world, lineId, 'goliath')).toEqual({ ok: false, reason: 'model_locked' });
    expect(world.state.lines[0]).toMatchObject({ model: 'sparrow', buses: 2 });
    expect(world.state.ledger.cashCents).toBe(100_000_000 - 15_000_000);
  });
});
