// The week-3 speed-up (bench/: 13 s to about 50 ms on the 812-cell grid) groups sub-points that
// reach the same stops, so it is held to the reference loop's riders rather than equal to them.
// Shown failing (TS-04): with the coverage masks removed, four overlapping lines count trips twice
// (+118%); with every stop credited to the whole cell, the debug line gains 4.3% at peak; with the
// down direction's rides counted with the wrong sign, its busiest leg falls short; with boardings
// and alightings swapped, the first stop's boardings are 15% off.
// `npm run bench compare` prints this comparison, and the synthetic grid's, in full.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { createLine } from '../commands/createLine';
import { addDebugLine } from '../commands/debugLine';
import { loadCity } from '../city/simfile';
import type { LineId } from '../core/ids';
import { PERIODS, periodAt } from '../rules/periods';
import { newGame } from '../state';
import { gameWithDepot } from '../testing';
import { createWorld, planLine, runningPlans } from '../world';
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
  const { riders, busiest, ends, paid } = assignNaive(world.city, world.commuters, plans);
  return spread(plans, riders, busiest, ends, paid);
};
const byPeriod = (slots: Float64Array) => PERIODS.map((p) => slots.reduce((sum, v, s) => sum + (s < SLOTS && periodAt(s * 1800 + 900) === p ? v : 0), 0));
const off = (got: number, want: number) => Math.abs(got - want) / want;

describe('rush hour in the riders (the M3 spec, item 15)', () => {
  it('moves the debug line’s riders off the peak onto the rest of the day, the day’s trips within 1%', () => {
    // Measured: peak 323.3 → 304.3 (−5.9%), off-peak 322.6 → 335.4 (+4.0%), the day 645.9 → 639.7
    // (−1.0%), with buses driving one-way streets both ways (2026-10-14; before it, peak 307.5 → 290.4
    // and rush 1.072). Shown failing (TS-04) with the demand model ignoring the rush: the peak does not move.
    expect(debug.rush).toBeCloseTo(1.065, 3);
    const calm = assign(world.city, world.commuters, [{ ...debug, rush: 0 }]).lines.get(debug.id)!;
    const busy = assign(world.city, world.commuters, [debug]).lines.get(debug.id)!;
    const [calmPeak, calmOff] = byPeriod(calm.bySlot);
    const [busyPeak, busyOff] = byPeriod(busy.bySlot);
    expect(busyPeak! / calmPeak!).toBeLessThan(0.97);
    expect(busyOff! / calmOff!).toBeGreaterThan(1.03);
    expect(Math.abs(busy.perDay / calm.perDay - 1)).toBeLessThan(0.01);
  });
});

describe('assign against the reference loop', () => {
  it('gives one line its riders within 2.5% in every period (measured: 2.0% at peak and 1.1% off-peak with item 15’s rush hour, 1.3% without)', () => {
    // The groups' approximation, which the rush lands on unevenly: at twice the debug line's rush
    // weight the two periods are 0.8% and 0.4% off.
    const { fast, ref } = both([debug]);
    const got = byPeriod(fast.lines.get(debug.id)!.bySlot);
    const want = byPeriod(ref.lines.get(debug.id)!.bySlot);
    expect(want[0]).toBeGreaterThan(250);
    PERIODS.forEach((p, k) => {
      if (want[k]! === 0) expect(got[k], p).toBe(0);
      else expect(off(got[k]!, want[k]!), p).toBeLessThan(0.025);
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

  it('changes riders between two lines at Kenmore as the reference does: trips within 6%, each line within 7%, changes within 9%', () => {
    // Copley to Kenmore and Kenmore to Longwood, joined at Kenmore (exit check 5). Measured: trips
    // −4.7%, the lines −5.7% and −5.4%, changes onto the second line −8.1% (−7.2% before item 15's
    // rush hour). Each line alone is already
    // −5.3% and −4.6%, the groups' approximation on a line of two stops, so changes add nothing to it.
    // Shown failing (TS-04) with the change's walk and penalty left out of the fast loop: trips 13.0% off.
    const kenmore = gameWithDepot();
    createLine(kenmore, [[-71.077, 42.3499], [-71.09721, 42.34883]]);
    createLine(kenmore, [[-71.09721, 42.34883], [-71.1035, 42.336]]);
    const plans = runningPlans(kenmore);
    const fast = assign(kenmore.city, kenmore.commuters, plans);
    const naive = assignNaive(kenmore.city, kenmore.commuters, plans);
    const ref = spread(plans, naive.riders, naive.busiest, naive.ends, naive.paid);
    const changes = (a: typeof fast, id: LinePlan['id']) => a.lines.get(id)!.transfersByStop.reduce((s, v) => s + v, 0);
    expect(changes(ref, plans[1]!.id)).toBeGreaterThan(40);
    expect(off(fast.tripsPerDay, ref.tripsPerDay)).toBeLessThan(0.06);
    for (const plan of plans) expect(off(fast.lines.get(plan.id)!.perDay, ref.lines.get(plan.id)!.perDay), `line ${plan.id}`).toBeLessThan(0.07);
    expect(off(changes(fast, plans[1]!.id), changes(ref, plans[1]!.id))).toBeLessThan(0.09);
  });
});

describe('an express line (the M4 spec, below the cut: V1’s rule)', () => {
  // The debug line's four stops with their street stretched: 5,300 m (1,767 m apart) is express,
  // 4,900 m is not, so the express line's ride is longer and still feels shorter (0.85 × 5.3 < 4.9).
  const stretched = (metres: number): LinePlan => ({ ...debug, stopDistM: debug.stopDistM.map((m) => (m * metres) / debug.stopDistM[debug.stopDistM.length - 1]!) });
  const riders = (plan: LinePlan) => assign(world.city, world.commuters, [plan]).lines.get(debug.id)!.perDay;

  it('draws more riders than a shorter line that is not express, and the reference loop agrees', () => {
    const express = stretched(5_300);
    expect(riders(express)).toBeGreaterThan(riders(stretched(4_900)));
    const { fast, ref } = both([express]);
    expect(off(fast.lines.get(debug.id)!.perDay, ref.lines.get(debug.id)!.perDay)).toBeLessThan(0.015);
  });

  it('loses fewer of its riders to a dear fare: its fare is minded half as much', () => {
    // The same 5,300 m with two stops more, each standing on one of its own, is not express (1,060 m apart).
    const express = stretched(5_300);
    const local: LinePlan = { ...express, stops: [express.stops[0]!, express.stops[1]!, express.stops[1]!, express.stops[2]!, express.stops[2]!, express.stops[3]!], stopDistM: [express.stopDistM[0]!, express.stopDistM[1]!, express.stopDistM[1]!, express.stopDistM[2]!, express.stopDistM[2]!, express.stopDistM[3]!] };
    // Measured: a $4.00 fare loses the express line 43% of its riders and the local one 62% (61% for
    // the express one were its fare minded fully).
    const lost = (plan: LinePlan) => 1 - riders({ ...plan, fareCents: 400 }) / riders(plan);
    expect(lost(express)).toBeLessThan(0.8 * lost(local));
  });
});
