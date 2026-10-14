import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { loadCity } from '../city/simfile';
import { BUS_MODELS } from '../config/fleet';
import { toCalendarTime } from '../core/calendar';
import { pointInRing, toLngLat, type XY } from '../core/geo';
import { foundLedger, rowsOfDay } from '../economy/ledger';
import { forecastDay } from '../economy/costs';
import { busesNeeded } from '../rules/cycle';
import { checkModelChange } from '../rules/line';
import { newGame } from '../state';
import { createWorld, fleetContext, lineEdges, recompute, snowToday } from '../world';
import { addDebugLine } from './debugLine';
import { placeDepot } from './placeDepot';
import { setHeadways } from './setHeadways';
import { setModel } from './setModel';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;
// A depot in the fixture's largest parcel of depot land, as bench/day.ts places it: room for the buses.
const ring = [...city.depotLand].sort((a, b) => b.length - a.length)[0]!;
const [cx, cy] = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
const site = [...Array(21).keys()].map((k): XY => [cx + (ring[0]![0] - cx) * k * 0.05, cy + (ring[0]![1] - cy) * k * 0.05]).find((p) => pointInRing(ring, p))!;

/** The debug line's two Sparrows at a depot, with a million dollars (or `cents`) to change them. */
function game(cents = 100_000_000) {
  const world = createWorld(city, { ...newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1), ledger: foundLedger(cents) });
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
    // A Buses sold row and a Buses bought row on day 1, each the line's; cash moves by the difference, to the cent (I1).
    expect(rowsOfDay(world.state.ledger, 1).map((r) => [r.kind, r.amountCents, r.lineId]).slice(-2)).toEqual([
      ['busSales', 9_500_000, lineId],
      ['buses', -52_000_000, lineId],
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

// The line card prices a swap on the round trip snow or roadworks make today, as the timetable runs
// it; Buy and swap counted on clear streets, so with a bus every 15 minutes in the snow the card named
// 3 Metro 40s for $780k and the command bought 2 for $520k, leaving the line a bus short. Shown
// failing (TS-04) with the command's rule given no snow and no roadworks.
describe('a line changing model on a snow day or under roadworks', () => {
  for (const kind of ['snow', 'roadworks'] as const) {
    it(`buys the buses the ${kind} round trip needs, at the price the line card names (GD-05)`, () => {
      const { world, lineId } = game(500_000_000);
      if (!setHeadways(world, lineId, { peak: 900, offpeak: 900, overnight: null }).ok) throw new Error('no headways');
      const line = world.state.lines[0]!;
      const today = toCalendarTime(world.state.elapsed).day;
      world.state.event =
        kind === 'snow'
          ? { kind, startDay: today, endDay: today, street: '', edges: [], at: null }
          : { kind, startDay: today, endDay: today + 2, street: 'Huntington Avenue', edges: lineEdges(world, line), at: null };
      recompute(world);
      const plan = world.services.get(lineId)!.plan;
      // The line card's call (ui/game/LineCard.tsx), and the same on clear streets.
      const swap = { routeM: plan.stopDistM.at(-1)!, stops: plan.stops.length, rush: plan.rush ?? 0, buses: line.buses, model: BUS_MODELS[line.model], headways: line.headways };
      const card = checkModelChange(fleetContext(world), { ...swap, worksM: plan.worksM ?? 0, snow: snowToday(world.state) }, BUS_MODELS.metro40);
      const clear = checkModelChange(fleetContext(world), swap, BUS_MODELS.metro40);
      if (!card.ok || !clear.ok) throw new Error('no swap');
      expect(card.needed).toBeGreaterThan(clear.needed);
      expect(setModel(world, lineId, 'metro40')).toEqual({ ok: true, bought: card.needed, buyCents: card.buyCents, saleCents: card.saleCents });
      expect(line.buses).toBe(busesNeeded(world.services.get(lineId)!.timing.cycles!, line.headways));
    });
  }
});
