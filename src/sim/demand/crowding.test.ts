// Crowding per half-hour (K27; the M3 spec, item 3): riders past the seats a line offers on its
// busiest leg are turned away in that half-hour only. Shown failing (TS-04): with V1's whole-day
// shedding restored (every half-hour cut by the fullest one's ratio), the off-peak half-hours lose
// riders; with one ratio per period, 06:30 does; with the world not passing the model's seats, the
// Metro 40 turns away as many as the Sparrow.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { addDebugLine } from '../commands/debugLine';
import { loadCity } from '../city/simfile';
import { HOURLY_PROFILE } from '../config/demand';
import { periodAt } from '../rules/periods';
import { newGame } from '../state';
import { createWorld, planLine, recompute } from '../world';
import { assign, SLOTS } from './assign';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;
const world = createWorld(city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
addDebugLine(world);
const debug = planLine(world, world.state.lines[0]!)!;
// Every 20 minutes, 1.5 departures a half-hour each way. With 10 seats a bus that is 15 seats, which
// the busiest leg (375 riders a day as if all were peak, measured) passes from 07:00 to 08:30 and
// 16:00 to 17:30, but not at 06:30 (10.3 riders) or in any off-peak half-hour (12.2 at most).
const roomy = assign(city, world.commuters, [{ ...debug, seats: 1e6 }]).lines.get(debug.id)!;
const tight = assign(city, world.commuters, [{ ...debug, seats: 10 }]).lines.get(debug.id)!;
const at = (hour: number, minute = 0) => hour * 2 + minute / 30;

describe('crowding per half-hour', () => {
  it('turns riders away only in the half-hours whose busiest leg passes the seats', () => {
    expect(roomy.shedPerDay).toBe(0);
    for (let s = 0; s < SLOTS; s++) {
      const period = periodAt(s * 1800 + 900);
      expect(tight.bySlot[s], `slot ${s}`).toBeLessThanOrEqual(roomy.bySlot[s]!);
      if (period !== 'peak') expect(tight.bySlot[s], `${period} slot ${s}`).toBe(roomy.bySlot[s]);
    }
    expect(tight.bySlot[at(6, 30)]).toBe(roomy.bySlot[at(6, 30)]);
    expect(tight.bySlot[at(18)]).toBe(roomy.bySlot[at(18)]);
    expect(tight.bySlot[at(17)]).toBeLessThan(roomy.bySlot[at(17)]!);
  });

  it('fills the fullest half-hour’s busiest leg to its seats, and counts the rest as turned away', () => {
    expect(tight.fullSlot).toBe(at(17));
    const load = tight.busiestLeg[0]! * (HOURLY_PROFILE[17]! / 2);
    const turnedAway = roomy.bySlot[at(17)]! - tight.bySlot[at(17)]!;
    expect(load - turnedAway).toBeCloseTo(1.5 * 10, 9);
    expect(tight.perDay + tight.shedPerDay).toBeCloseTo(roomy.perDay, 9);
    expect(tight.shedPerDay).toBeGreaterThan(0);
  });

  // Measured: Sparrows board 3,855.8 a day and turn away 1,876.2; Metro 40s board 5,228.4 and turn away 416.7.
  it('lets a Metro 40 carry riders a Sparrow turns away', () => {
    // Nine times the fixture's demand, so the debug line's buses fill.
    const busy = createWorld({ ...city, tripScalePermille: 1000 }, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
    addDebugLine(busy);
    const line = busy.state.lines[0]!;
    const sparrow = busy.assignment.lines.get(line.id)!;
    line.model = 'metro40';
    recompute(busy);
    const metro = busy.assignment.lines.get(line.id)!;
    expect(sparrow.shedPerDay).toBeGreaterThan(0);
    expect(metro.shedPerDay).toBeLessThan(sparrow.shedPerDay / 2);
    expect(metro.perDay).toBeGreaterThan(sparrow.perDay);
  });
});
