// I4 (the M3 spec, item 13; EC-04, K05): splitting a line where both halves call at one stop never
// pays. A trip pays and feels its fare once, on its first line; a rider changing halves waits again
// and pays the stop's transfer penalty, so a day's fares and subsidy can only fall (the test allows
// +1%). V1 charged and felt every boarding, so the same split paid it +8% to +62%.
// Measured (`npm run bench split`) every 10 minutes: −6.9% to −24.0% on the debug line, and −4.8% to
// −32.6% on Inner Boston's ten corridors split in the middle. Shown failing (TS-04) with a change
// paying on the line it changes onto, as V1 charged: +2.0%, +13.2% and +19.4% here.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from '../commands/debugLine';
import { SPARROW } from '../config/fleet';
import { SECONDS_PER_DAY } from '../config/time';
import { mint } from '../core/ids';
import type { StopTier } from '../config/stops';
import { busesNeeded, cycleSeconds } from '../rules/cycle';
import { advance } from '../step';
import { gameWithDepot } from '../testing';
import { planLine, recompute, type World } from '../world';

/**
 * The debug line every 10 minutes by day with its stop `at` (1 = Symphony, 2 = the MFA) of tier
 * `tier`, whole or split into two halves that both call there, each with the buses it needs. At
 * every 20 minutes the second wait loses more riders than charging each boarding would gain, so the
 * test would not see V1's charge (−2.5% to −27.5%, measured).
 */
function network(at: number, tier: StopTier, split: boolean): World {
  const world = gameWithDepot();
  addDebugLine(world);
  const whole = world.state.lines[0]!;
  whole.headways = { peak: 600, offpeak: 600, overnight: null };
  world.state.stops.find((s) => s.id === whole.stopIds[at])!.tier = tier;
  if (split) {
    const [id, next] = mint(world.state.nextIds, 'line');
    world.state.nextIds = next;
    world.state.lines.push({ ...whole, id, name: 'Second half', stopIds: whole.stopIds.slice(at), boardedMilli: 0 });
    whole.stopIds = whole.stopIds.slice(0, at + 1);
  }
  for (const line of world.state.lines) {
    const plan = planLine(world, line)!;
    line.buses = busesNeeded(cycleSeconds(plan.stopDistM.at(-1)!, plan.stops.length, SPARROW.kmh), line.headways);
  }
  recompute(world);
  return world;
}

/** A day's fares and subsidy as banked, in cents. */
function income(world: World): number {
  advance(world, SECONDS_PER_DAY);
  return world.state.ledger.rows.filter((r) => r.kind === 'fares' || r.kind === 'subsidy').reduce((s, r) => s + r.amountCents, 0);
}

describe('I4: splitting a line', () => {
  it.each([
    ['Symphony', 1, 1],
    ['the MFA', 2, 1],
    ['Symphony, a Transfer Hub', 1, 5],
    ['the MFA, a Transfer Hub', 2, 5],
  ] as const)('at %s raises a day’s fares and subsidy by at most 1%%', (_, at, tier) => {
    const whole = income(network(at, tier, false));
    const world = network(at, tier, true);
    const changes = [...world.assignment.lines.values()].reduce((s, d) => s + d.transfersByStop.reduce((t, v) => t + v, 0), 0);
    expect(changes, 'riders changing halves').toBeGreaterThan(1);
    expect(income(world)).toBeLessThanOrEqual(whole * 1.01);
  });

  it('counts a changing rider as one trip and two boardings, paid on the first', () => {
    const world = network(2, 5, true);
    const lines = [...world.assignment.lines.values()];
    const changesOnto = lines.map((d) => d.transfersByStop.reduce((t, v) => t + v, 0));
    // Each way: towards Longwood onto the second half, towards Copley onto the first.
    changesOnto.forEach((c, k) => expect(c, `changes onto half ${k + 1}`).toBeGreaterThan(1));
    lines.forEach((d, k) => expect(d.paidPerDay, `half ${k + 1}`).toBeCloseTo(d.perDay - changesOnto[k]!, 6));
    const boardings = lines.reduce((s, d) => s + d.perDay, 0);
    expect(world.assignment.tripsPerDay).toBeCloseTo(boardings - changesOnto[0]! - changesOnto[1]!, 6);
  });
});
