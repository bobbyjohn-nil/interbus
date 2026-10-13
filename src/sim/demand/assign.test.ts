// The week-3 speed-up (bench/: 13 s to about 50 ms on the 812-cell grid) groups sub-points that
// reach the same stops, so it is held to the reference loop's riders rather than equal to them.
// Shown failing (TS-04): with the coverage masks removed, four overlapping lines count trips twice
// (+118%); with every stop credited to the whole cell, the debug line gains 4.3% at peak.
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
const both = (plans: LinePlan[]) => ({ fast: assign(world.city, world.commuters, plans), ref: spread(plans, assignNaive(world.city, world.commuters, plans)) });
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
    }
  });
});
