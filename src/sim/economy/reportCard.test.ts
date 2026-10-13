// The quarter's report card (the M3 spec, item 9; exit check 3). Shown failing (TS-04): with V2's
// reliability for a company that runs nothing (100), the empty company is no longer fined; with every
// stop counted as covering its walk whether or not anything calls there (V2's orphan poles, EC-07),
// a pole raises coverage.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from '../commands/debugLine';
import { setStopTier } from '../commands/setStopTier';
import { SECONDS_PER_DAY } from '../config/time';
import { mint } from '../core/ids';
import { advance } from '../step';
import { gameWithDepot } from '../testing';
import { recompute } from '../world';
import { comfortGrade, coverageGrade, gradeQuarter, moneyGrade, reliabilityGrade } from './reportCard';

function game() {
  const world = gameWithDepot();
  if (!addDebugLine(world).ok) throw new Error('no line');
  return world;
}

describe('the report card', () => {
  it('closes quarter 1 on day 10 with its card, and pays it as one of day 10’s rows (74.3 overall, measured)', () => {
    const world = game();
    const events = advance(world, 10 * SECONDS_PER_DAY);
    expect(events.map((e) => e.card !== null)).toEqual([false, false, false, false, false, false, false, false, false, true]);
    const card = events[9]!.card!;
    expect(card).toMatchObject({ quarter: 1, day: 10, reliability: 100, comfort: 80 });
    expect(card.overall).toBeCloseTo(74.3, 1);
    expect(card.payoutCents).toBe(Math.round((card.overall - 55) * 160_000));
    expect(events[9]!.rows.filter((r) => r.kind === 'card')).toEqual([{ day: 10, kind: 'card', amountCents: card.payoutCents }]);
  });

  it('fines a company that runs nothing $8,000: every grade 0, reliability included', () => {
    const world = gameWithDepot();
    expect([coverageGrade(world), reliabilityGrade(world), comfortGrade(world), moneyGrade(world, 1, 10)]).toEqual([0, 0, 0, 0]);
    expect(gradeQuarter(world, 1, 10)).toMatchObject({ overall: 0, payoutCents: -800_000 });
  });

  it('grades a line short of its buses below 100 on reliability', () => {
    const world = game();
    world.state.lines[0]!.buses = 1; // its 20 minutes need 2
    recompute(world);
    expect(reliabilityGrade(world)).toBeLessThan(100);
    expect(reliabilityGrade(world)).toBeGreaterThan(0);
  });

  it('counts no resident for a pole nothing calls at', () => {
    const world = game();
    const before = coverageGrade(world);
    const [id, next] = mint(world.state.nextIds, 'stop');
    world.state.nextIds = next;
    world.state.stops.push({ id, lon: -71.0905, lat: 42.3445, tier: 1 }); // the Fenway, off the line
    expect(coverageGrade(world)).toBe(before);
  });

  it('counts the stops’ tiers in comfort: Stations at all four stops add a tenth', () => {
    const world = game();
    for (const id of world.state.lines[0]!.stopIds) expect(setStopTier(world, id, 3).ok).toBe(true);
    expect(comfortGrade(world)).toBeCloseTo(90, 6);
  });

  it('leaves capital out of Money: a purchase on day 5 moves nothing', () => {
    const world = game();
    advance(world, 10 * SECONDS_PER_DAY);
    const before = moneyGrade(world, 1, 10);
    world.state.ledger.rows.push({ day: 5, kind: 'purchase', amountCents: -1_000_000 });
    expect(moneyGrade(world, 1, 10)).toBe(before);
  });
});
