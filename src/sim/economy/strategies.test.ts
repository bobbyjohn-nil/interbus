// I3's strategies (PLAN §6; the M2 spec's tests). V2 graded a whole day's quantities per hour, so a
// line run mostly at night paid +149% to +461% (EC-03). Here a line's day is its riders' fares and
// subsidy against the costs of the plan it runs, and the headway rules leave no night-only line to
// find: every daytime period runs at least hourly, and overnight no more often than off-peak.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { loadCity } from '../city/simfile';
import { addDebugLine } from '../commands/debugLine';
import { SUBSIDY_PER_BOARDING_CENTS } from '../config/economy';
import { busesNeeded } from '../rules/cycle';
import { checkHeadways, type Headways } from '../rules/periods';
import { newGame } from '../state';
import { createWorld, recompute } from '../world';
import { forecastDay } from './costs';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
addDebugLine(world);
const line = world.state.lines[0]!;

/** The debug line's day at these headways, with the buses they need: riders, and fares and subsidy less costs, in cents. */
function day(headways: Headways): { riders: number; netCents: number; overnightRiders: number } {
  line.headways = headways;
  line.buses = busesNeeded(world.services.get(line.id)!.timing.cycle, headways);
  recompute(world);
  const demand = world.assignment.lines.get(line.id)!;
  const c = forecastDay(world.services.get(line.id)!.costs);
  const netCents = Math.floor(demand.perDay) * (line.fareCents + SUBSIDY_PER_BOARDING_CENTS) - c.running - c.wages - c.deadhead;
  return { riders: demand.perDay, netCents, overnightRiders: demand.bySlot.slice(0, 10).reduce((s, v) => s + v, 0) };
}

const STEPS = [300, 600, 900, 1_200, 1_800, 2_700, 3_600];
const SETTINGS: Headways[] = STEPS.flatMap((peak) =>
  STEPS.flatMap((offpeak) => [null, ...STEPS].map((overnight) => ({ peak, offpeak, overnight }))),
).filter((h) => checkHeadways(h).ok);

describe('I3, the strategies (EC-03)', () => {
  const results = SETTINGS.map((h) => ({ h, ...day(h) }));
  const best = results.reduce((a, b) => (b.netCents > a.netCents ? b : a));

  it('refuses a night-only line: no daytime period longer than an hour, and overnight no more often than off-peak', () => {
    expect(checkHeadways({ peak: 3_600, offpeak: 3_600, overnight: 600 })).toMatchObject({ ok: false, reason: 'overnight_more_often_than_offpeak' });
    expect(checkHeadways({ peak: 7_200, offpeak: 7_200, overnight: 600 })).toMatchObject({ ok: false, reason: 'daytime_headway_too_long' });
  });

  it('earns less from "daytime longest, overnight shortest" than from the best setting for every period', () => {
    const nightHeavy = results.find((r) => r.h.peak === 3_600 && r.h.offpeak === 3_600 && r.h.overnight === 3_600)!;
    expect(nightHeavy.netCents).toBeLessThan(best.netCents);
    expect(best.h.overnight).toBeNull(); // nobody pays for a bus at 03:00 on this line
  });

  it('carries no rider in a period the line does not run (I3)', () => {
    for (const r of results.filter((x) => x.h.overnight === null)) expect(r.overnightRiders).toBe(0);
    expect(results.find((r) => r.h.overnight !== null)!.overnightRiders).toBeGreaterThan(0);
  });

  it('finds its best headway inside the range, not at either end (an interior optimum)', () => {
    expect(best.h.peak).toBeGreaterThan(STEPS[0]!);
    expect(best.h.peak).toBeLessThan(STEPS.at(-1)!);
  });
});
