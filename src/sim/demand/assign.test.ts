// The week-3 speed-up (bench/: 13 s to about 50 ms on the 812-cell grid) groups sub-points that
// reach the same stops, so it is held to the reference loop's riders rather than equal to them.
// Shown failing (TS-04): with the coverage masks removed, four overlapping lines count trips twice
// (+118%); with every stop credited to the whole cell, the debug line gains 4.3% at peak; with the
// down direction's rides counted with the wrong sign, its busiest leg falls short; with boardings
// and alightings swapped, the first stop's boardings are 15% off.
// `npm run bench compare` prints this comparison, and the synthetic grid's, in full.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { addDebugLine } from '../commands/debugLine';
import { loadCity } from '../city/simfile';
import type { LineId } from '../core/ids';
import { PERIODS, periodAt } from '../rules/periods';
import { newGame } from '../state';
import { createWorld, planLine } from '../world';
import { assign, SLOTS, spread, type LinePlan } from './assign';
import { assignNaive } from './reference/assignNaive';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
addDebugLine(world);
const debug = planLine(world, world.state.lines[0]!)!;
const shifted = (id: number, dx: number, dy: number, change: Partial<LinePlan> = {}): LinePlan => ({
  ...debug,
  id: id as LineId,
  stops: debug.stops.map(([x, y]) => [x + dx, y + dy] as const),
  ...change,
});
const overlapping: LinePlan[] = [
  debug,
  shifted(2, 300, 200, { headways: { peak: 600, offpeak: 900, overnight: 1800 } }),
  shifted(3, -250, 350, { fareCents: 300 }),
  shifted(4, 60, -40, { fareCents: 150, headways: { peak: 900, offpeak: 900, overnight: null } }),
];
const both = (plans: LinePlan[]) => ({ fast: assign(world.city, world.commuters, plans), ref: reference(plans) });
const reference = (plans: LinePlan[]) => {
  const { riders, busiest, ends } = assignNaive(world.city, world.commuters, plans);
  return spread(plans, riders, busiest, ends);
};
const byPeriod = (slots: Float64Array) => PERIODS.map((p) => slots.reduce((sum, v, s) => sum + (s < SLOTS && periodAt(s * 1800 + 900) === p ? v : 0), 0));
const off = (got: number, want: number) => Math.abs(got - want) / want;

describe('assign against the reference loop', () => {
  it('gives one line its riders within 1.5% in every period (0.5% measured)', () => {
    const { fast, ref } = both([debug]);
    const got = byPeriod(fast.lines.get(debug.id)!.bySlot);
    const want = byPeriod(ref.lines.get(debug.id)!.bySlot);
    expect(want[0]).toBeGreaterThan(300);
    PERIODS.forEach((p, k) => {
      if (want[k]! === 0) expect(got[k], p).toBe(0);
      else expect(off(got[k]!, want[k]!), p).toBeLessThan(0.015);
    });
  });

  // Run backwards, the debug line carries its busiest leg the other way.
  const routeM = debug.stopDistM[debug.stopDistM.length - 1]!;
  const backwards: LinePlan = { ...debug, stops: [...debug.stops].reverse(), stopDistM: [...debug.stopDistM].reverse().map((m) => routeM - m) };
  it.each([
    ['forwards', debug],
    ['backwards', backwards],
  ])('counts one line’s busiest leg within 3% of the reference, rider by rider, in every period, run %s (1.07% measured)', (_, plan) => {
    const { fast, ref } = both([plan]);
    const got = fast.lines.get(plan.id)!.busiestLeg;
    const want = ref.lines.get(plan.id)!.busiestLeg;
    expect(want[0]).toBeGreaterThan(300);
    PERIODS.forEach((p, k) => {
      if (want[k]! === 0) expect(got[k], p).toBe(0);
      else expect(off(got[k]!, want[k]!), p).toBeLessThan(0.03);
    });
  });

  it('counts each stop’s boardings and alightings within 6% or 2 riders of the reference (4.7% measured), every rider once each way', () => {
    const { fast, ref } = both([debug]);
    const got = fast.lines.get(debug.id)!;
    const want = ref.lines.get(debug.id)!;
    debug.stops.forEach((_, q) => {
      for (const side of ['boardingsByStop', 'alightingsByStop'] as const) {
        expect(Math.abs(got[side][q]! - want[side][q]!), `${side} at stop ${q}`).toBeLessThan(Math.max(0.06 * want[side][q]!, 2));
      }
    });
    expect(got.boardingsByStop.reduce((sum, v) => sum + v, 0)).toBeCloseTo(got.perDay, 9);
    expect(got.alightingsByStop.reduce((sum, v) => sum + v, 0)).toBeCloseTo(got.perDay, 9);
  });

  it('takes a stop’s tier off the walk to it as the reference does: within 1.5% with a Station and a Shelter', () => {
    const tiered: LinePlan = { ...debug, walkBonusMin: [0, 1.8, 0.8, 0] };
    const { fast, ref } = both([tiered]);
    const got = fast.lines.get(debug.id)!.perDay;
    expect(off(got, ref.lines.get(debug.id)!.perDay)).toBeLessThan(0.015);
    expect(got).toBeGreaterThan(both([debug]).fast.lines.get(debug.id)!.perDay * 1.1);
  });

  it('keeps trips within 2% where four lines overlap, and each line’s day within 10% or 2 riders', () => {
    // Measured with V2's waits: trips −1.2%, and the split moves up to 4.5% a day on a line of 311
    // riders, because a group of sub-points picks one line together where the reference lets each
    // pick its own. A line of 5.7 riders a day is 0.8 riders off (14%), so a handful is held in riders.
    const { fast, ref } = both(overlapping);
    expect(off(fast.tripsPerDay, ref.tripsPerDay)).toBeLessThan(0.02);
    for (const plan of overlapping) {
      const want = ref.lines.get(plan.id)!.perDay;
      expect(want, `line ${plan.id}`).toBeGreaterThan(5);
      expect(Math.abs(fast.lines.get(plan.id)!.perDay - want), `line ${plan.id}`).toBeLessThan(Math.max(0.1 * want, 2));
      // Busiest legs: 5.6% off on a 44-rider leg, and 1 rider on a 4-rider one (measured).
      const leg = ref.lines.get(plan.id)!.busiestLeg[0]!;
      expect(Math.abs(fast.lines.get(plan.id)!.busiestLeg[0]! - leg), `line ${plan.id} busiest leg`).toBeLessThan(Math.max(0.1 * leg, 2));
    }
  });
});
