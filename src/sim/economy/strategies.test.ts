// I3's strategies (PLAN §6; the M2 spec's tests). V2 graded a whole day's quantities per hour, so a
// line run mostly at night paid +149% to +461% (EC-03). Here a line's day is its riders' fares and
// subsidy against the costs of the plan it runs, and the headway rules leave no night-only line to
// find: every daytime period runs at least hourly, and overnight no more often than off-peak. The
// fare's optimum is the M3 spec's (item 4): shown failing (TS-04) with a fare riders do not feel,
// where the taper alone puts the best fare at $4.50.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { loadCity } from '../city/simfile';
import { addDebugLine } from '../commands/debugLine';
import { busesNeeded } from '../rules/cycle';
import { FARES_CENTS, subsidyCents } from '../rules/fare';
import { checkHeadways, type Headways } from '../rules/periods';
import { newGame } from '../state';
import { createWorld, recompute } from '../world';
import { forecastDay } from './costs';
import { fareBand } from './fareBand';

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
  const netCents = Math.floor(demand.perDay) * (line.fareCents + subsidyCents(line.fareCents)) - c.running - c.wages - c.deadhead;
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

  it('finds its best headways inside the range, not at either end (an interior optimum)', () => {
    for (const period of ['peak', 'offpeak'] as const) {
      expect(best.h[period], period).toBeGreaterThan(STEPS[0]!);
      expect(best.h[period], period).toBeLessThan(STEPS.at(-1)!);
    }
  });

  it('earns 60% of the best or less from a starved line: hourly all day on one bus (I3, K28)', () => {
    // With V1's waits (70% of riders timed at every headway, every wait capped at 15 min) this was
    // 98.5% of the best; V2's waits (EC-08) make a long headway cost riders.
    const starved = results.find((r) => r.h.peak === 3_600 && r.h.offpeak === 3_600 && r.h.overnight === null)!;
    expect(starved.netCents).toBeLessThanOrEqual(0.6 * best.netCents);
  });

  it('finds its best fare inside the range, at $1.75–$3.25 (the M3 spec’s magnitude), on the starter’s and the best headways', () => {
    for (const h of [{ peak: 1_200, offpeak: 1_200, overnight: null }, best.h]) {
      day(h);
      const band = fareBand(world, line.id)!;
      expect(band.bestCents).toBeGreaterThan(FARES_CENTS[0]!);
      expect(band.bestCents).toBeLessThan(FARES_CENTS.at(-1)!);
      expect(band.bestCents).toBeGreaterThanOrEqual(175);
      expect(band.bestCents).toBeLessThanOrEqual(325);
    }
  });
});
