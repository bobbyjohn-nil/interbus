// The quarter's report card (the M3 spec, item 9; exit check 3). Shown failing (TS-04): with V2's
// reliability for a company that runs nothing (100), the empty company is no longer fined; with every
// stop counted as covering its walk whether or not anything calls there (V2's orphan poles, EC-07),
// a pole raises coverage; with the day plan's three days of trips counted as a day's calls, an hourly
// line covers 0.92 of a line every 15 minutes, not 0.40.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from '../commands/debugLine';
import { setStopTier } from '../commands/setStopTier';
import { SECONDS_PER_DAY } from '../config/time';
import { mint } from '../core/ids';
import { dayDepartures } from '../rules/schedule';
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
  it('closes quarter 1 on day 8 with its card, and pays it as one of day 8’s rows (75.3 overall, measured: a festival on days 3–4 lifts Money; 76.3 while coverage counted three days of calls; 76.4 before stops had upkeep, D25; 76.1 on day 10 while a quarter was ten days)', () => {
    const world = game();
    const events = advance(world, 8 * SECONDS_PER_DAY);
    expect(events.map((e) => e.card !== null)).toEqual([false, false, false, false, false, false, false, true]);
    const card = events[7]!.card!;
    expect(card).toMatchObject({ quarter: 1, day: 8, reliability: 100, comfort: 80 });
    expect(card.overall).toBeCloseTo(75.3, 1);
    // $160 a point a day for the quarter's eight days: $1,280 a point (D25; $1,600 over ten days before).
    expect(card.payoutCents).toBe(Math.round((card.overall - 55) * 128_000));
    expect(events[7]!.rows.filter((r) => r.kind === 'card')).toEqual([{ day: 8, kind: 'card', amountCents: card.payoutCents }]);
  });

  it('fines a company that runs nothing $6,400, $800 a day of the quarter: every grade 0, reliability included', () => {
    const world = gameWithDepot();
    expect([coverageGrade(world), reliabilityGrade(world), comfortGrade(world), moneyGrade(world, 1, 8)]).toEqual([0, 0, 0, 0]);
    expect(gradeQuarter(world, 1, 8)).toMatchObject({ overall: 0, payoutCents: -640_000 });
  });

  it('grades a line short of its buses below 100 on reliability', () => {
    const world = game();
    world.state.lines[0]!.buses = 1; // its 20 minutes need 2
    recompute(world);
    expect(reliabilityGrade(world)).toBeLessThan(100);
    expect(reliabilityGrade(world)).toBeGreaterThan(0);
  });

  it('counts a day’s calls once: an hourly line’s stops count (19 ÷ 64)^0.75 = 0.40 of a line every 15 minutes', () => {
    const world = game();
    const line = world.state.lines[0]!;
    const graded = (headway: number) => {
      line.headways = { peak: headway, offpeak: headway, overnight: null };
      recompute(world);
      return coverageGrade(world);
    };
    const full = graded(15 * 60); // 76 calls a day, held at 64
    expect(dayDepartures(world.services.get(line.id)!.day.inputs.timing)).toHaveLength(76);
    const hourly = graded(60 * 60);
    expect(dayDepartures(world.services.get(line.id)!.day.inputs.timing)).toHaveLength(19);
    // Counting the day plan's three days of trips gave 57 calls, 0.92 of full.
    expect(hourly / full).toBeCloseTo((19 / 64) ** 0.75, 6);
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
    world.state.ledger.rows.push({ day: 5, kind: 'buses', amountCents: -1_000_000 });
    expect(moneyGrade(world, 1, 10)).toBe(before);
  });
});
