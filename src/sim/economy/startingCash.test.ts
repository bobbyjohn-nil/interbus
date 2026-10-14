// I10's money clauses after the k tune (PLAN §5 and §6; D7; the M5 spec's tests; GD-11), on the
// fixture (Inner Boston's are `npm run bench firstline`, nightly): the best profitable first line a
// player could draw fits the starting cash and turns a daily profit within a quarter; the cheapest
// four-bus line, and so any four-bus line the sweep finds, costs at least 1.15x it, so the middle game
// still has to be earned; and k stays in D7's 1.0-1.8. The first line is found without the reference
// line (the debug line): each of Copley to Kenmore's and Kenmore to Longwood's corridor lines is drawn
// in a new game with a depot near its first stop, at the founding headways, and played for a quarter.
// Shown failing (TS-04): at k 1.334 the four-bus line costs 1.1497x the starting cash; and at a fare
// that loses money on every line, no first line is profitable, which the clause would refuse.
import { describe, expect, it } from 'vitest';
import { createLine } from '../commands/createLine';
import { DEBUG_STOPS } from '../commands/debugLine';
import { placeDepot } from '../commands/placeDepot';
import { setFare } from '../commands/setFare';
import { DEPOT_COST_CENTS, STARTER_STOPS, STARTING_CASH_K_PERMILLE, STOP_COST_CENTS } from '../config/economy';
import { SPARROW } from '../config/fleet';
import { DAYS_PER_QUARTER, SECONDS_PER_DAY } from '../config/time';
import { toXY } from '../core/geo';
import { corridorCandidates, depotNear } from '../pacing';
import { isOperating } from '../rules/money';
import { advance } from '../step';
import { COPLEY, fixtureGame, KENMORE } from '../testing';
import { foundingCapitalCents, rowsOfDay } from './ledger';

const LONGWOOD = DEBUG_STOPS[3]!.at;
/**
 * A fare at which every first line here loses money each day of its first quarter: $5.00, the band's
 * top, where the subsidy has tapered to nothing (at $1.00 and $3.00 most still profit on day 3, a
 * festival on seed 7).
 */
const LOSING_FARE_CENTS = 500;

/**
 * Each corridor line on its own in a new game, at the founding headways and `fareCents` (the default
 * fare when null): what it costs with its depot, its second day's net, and the first day of the
 * quarter whose running money (rules/money.ts isOperating) closes above $0.
 */
function firstLines(fareCents: number | null = null) {
  const candidates = corridorCandidates(fixtureGame(), [
    ['Copley to Kenmore', COPLEY, KENMORE],
    ['Kenmore to Longwood', KENMORE, LONGWOOD],
  ]);
  return candidates.flatMap((c) => {
    const world = fixtureGame();
    if (!placeDepot(world, depotNear(world.city, toXY(world.city.frame, c.stops[0]!))).ok) return [];
    const made = createLine(world, c.stops, c.headways);
    if (!made.ok) return [];
    if (fareCents !== null && !setFare(world, made.lineId, fareCents).ok) throw new Error(`no fare of ${fareCents} on ${c.name}`);
    advance(world, DAYS_PER_QUARTER * SECONDS_PER_DAY);
    const net = (day: number) => rowsOfDay(world.state.ledger, day).filter((r) => isOperating(r.kind)).reduce((s, r) => s + r.amountCents, 0);
    const days = Array.from({ length: DAYS_PER_QUARTER }, (_, k) => k + 1);
    const profitDay = days.find((d) => net(d) > 0) ?? null;
    return [{ name: c.name, costCents: DEPOT_COST_CENTS + made.priceCents, netCents: net(2), profitDay }];
  });
}

describe('I10, the starting cash against the lines it buys (D7, GD-11)', () => {
  it('fits the best profitable first line, found without the reference line, which turns a daily profit within a quarter', () => {
    const lines = firstLines();
    expect(lines.length).toBeGreaterThanOrEqual(3);
    const best = lines.filter((l) => l.profitDay !== null).sort((a, b) => b.netCents - a.netCents)[0];
    expect(best, 'no first line turns a daily profit within a quarter').toBeDefined();
    expect(best!.profitDay).toBeLessThanOrEqual(DAYS_PER_QUARTER);
    expect(best!.costCents).toBeLessThanOrEqual(foundingCapitalCents());
  });

  it('finds no profitable first line at a fare that loses money on every line (the clause above, shown failing)', () => {
    const lines = firstLines(LOSING_FARE_CENTS);
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.filter((l) => l.profitDay !== null)).toEqual([]);
  });

  it('leaves the cheapest four-bus line (a depot, four stops, four Sparrows: $546,000) at 1.15x the starting cash or more', () => {
    const fourBusCents = DEPOT_COST_CENTS + STARTER_STOPS * STOP_COST_CENTS + 4 * SPARROW.priceCents;
    expect(fourBusCents).toBe(54_600_000);
    expect(fourBusCents * 100).toBeGreaterThanOrEqual(foundingCapitalCents() * 115);
  });

  it('keeps k within 1.0-1.8', () => {
    expect(STARTING_CASH_K_PERMILLE).toBeGreaterThanOrEqual(1_000);
    expect(STARTING_CASH_K_PERMILLE).toBeLessThanOrEqual(1_800);
  });
});
