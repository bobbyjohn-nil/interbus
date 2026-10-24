// advance() moves the clock over the steps between hour boundaries at once (step.ts): the world it
// leaves, and what it returns, are the same as stepping one second at a time.
import { describe, expect, it } from 'vitest';
import { acceptContract } from './commands/acceptContract';
import { addDebugLine } from './commands/debugLine';
import { CONTRACT_ASKS } from './config/contracts';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR, STEP_SECONDS } from './config/time';
import { toCalendarTime } from './core/calendar';
import { rollOffers } from './economy/contracts';
import { post } from './economy/ledger';
import { belowFloor } from './rules/credit';
import { advance, cashAtClose, simStep, type SimEvent } from './step';
import { gameWithDepot } from './testing';
import type { World } from './world';

function running(): World {
  const world = gameWithDepot(5);
  if (!addDebugLine(world).ok) throw new Error('no debug line');
  return world;
}

/**
 * The debug line's game holding Longwood's 20-minute contract, which it meets, from day `from`'s start (05:00 on day 1, midnight
 * on day 2), played to the start of the day the contract pays its $60,000, its eighth met: day 8, the quarter's last, or day 9.
 */
function payingTonight(from: 1 | 2): World {
  const world = running();
  rollOffers(world, 1);
  if (from === 2) advance(world, 19 * SECONDS_PER_HOUR);
  const c = world.state.contracts.find((k) => k.landmark === 'Longwood')!;
  Object.assign(c, CONTRACT_ASKS.find((a) => a.kind === 'headway' && a.ask === 1_200)!);
  if (!acceptContract(world, c.id).ok) throw new Error('not taken');
  advance(world, 7 * SECONDS_PER_DAY);
  return world;
}

describe('advance', () => {
  it('leaves the same world and the same day closes as one step at a time, over boundaries and odd lengths', () => {
    // Two days and a few odd seconds: from 05:00 over two midnights and the hours between, in pieces
    // that start and end off the hour, one of them exactly an hour and one a single step.
    const pieces = [1, 3_599, 3_600, 7_201, 59, SECONDS_PER_DAY, 20 * 3_600 + 17, STEP_SECONDS];
    const byStep = running();
    const stepped: SimEvent[] = [];
    const total = pieces.reduce((s, p) => s + p, 0);
    for (let s = 0; s < total; s += STEP_SECONDS) stepped.push(...simStep(byStep));
    const byAdvance = running();
    const advanced = pieces.flatMap((p) => advance(byAdvance, p));
    expect(byAdvance.state.elapsed).toBe(total);
    expect(advanced.map((e) => e.day)).toEqual([1, 2]);
    expect(advanced).toEqual(stepped);
    expect(JSON.stringify(byAdvance.state)).toBe(JSON.stringify(byStep.state));
  });

  it('refuses a part of a step and a negative length', () => {
    const world = running();
    expect(() => advance(world, -1)).toThrow(RangeError);
    expect(() => advance(world, 0.5)).toThrow(RangeError);
    expect(advance(world, 0)).toEqual([]);
    expect(world.state.elapsed).toBe(0);
  });
});

// The countdown's words judged the cash now, and the close counts it after the hours left in the day and the interest on what is
// owed then: four closes behind and $50 above the floor at 23:50, the chip said to stay above tonight as the close took $158.28
// and ended the run (the systems audit's fifteenth round). Shown failing (TS-04) with the cash now in its place.
describe('cashAtClose', () => {
  it('is the cash the coming close counts, the hours left banked and the interest after them, and leaves the world as it was', () => {
    // Day 2, owing $149,950 from its start; asked at 00:00, 09:30, 23:00 and 23:50, an hour's riders not banked till its end.
    for (const into of [0, 9.5 * SECONDS_PER_HOUR, 23 * SECONDS_PER_HOUR, 23 * SECONDS_PER_HOUR + 50 * 60]) {
      const world = running();
      advance(world, 19 * SECONDS_PER_HOUR); // day 1 closes at 24:00, 19 hours from 05:00
      post(world.state.ledger, { day: 2, kind: 'buses', amountCents: -(world.state.ledger.cashCents + 14_995_000) });
      advance(world, into);
      const before = JSON.stringify(world.state);
      const said = cashAtClose(world);
      expect(JSON.stringify(world.state)).toBe(before);
      const [close] = advance(world, SECONDS_PER_DAY - into);
      expect(close).toMatchObject({ day: 2, card: null, contracts: [] });
      expect(said).toBe(close!.cashAfterCents);
      expect(close!.rows.find((r) => r.kind === 'interest')!.amountCents).toBeLessThan(0);
    }
  });

  it('counts below the floor where the close does, a company just above it now', () => {
    // The fifteenth round's case: $50 above the floor at 23:50, the last hour's costs and the interest take it below.
    const world = running();
    advance(world, 19 * SECONDS_PER_HOUR + 23 * SECONDS_PER_HOUR + 50 * 60); // day 2, 23:50
    post(world.state.ledger, { day: 2, kind: 'buses', amountCents: -(world.state.ledger.cashCents + 14_995_000) });
    expect(belowFloor(world.state.ledger.cashCents)).toBe(false);
    expect(belowFloor(cashAtClose(world))).toBe(true);
    advance(world, 10 * 60);
    expect(world.state.closesBelowFloor).toBe(1);
  });

  // Counting neither, the chip said "Heading below -$150k tonight" on a night a held contract paid $60,000, $50 above the floor
  // at 23:50 and four closes behind, and might have sold buses at half price on it; a quarter's fine, as well, could take a
  // close below under "Stay above" (the review of the fifteenth round's fixes). Shown failing (TS-04) with the hours and the
  // interest alone counted.
  it('counts a held contract’s reward on the night it pays, and a quarter’s card on its last day, as the close does', () => {
    for (const from of [1, 2] as const) {
      // Asked as the day starts, at half past nine and at 23:50.
      for (const ahead of [0, 4.5 * SECONDS_PER_HOUR, -10 * 60]) {
        const world = payingTonight(from);
        const left = SECONDS_PER_DAY - toCalendarTime(world.state.elapsed).secondOfDay;
        const into = ahead < 0 ? left + ahead : ahead;
        advance(world, into);
        const before = JSON.stringify(world.state);
        const said = cashAtClose(world);
        expect(JSON.stringify(world.state)).toBe(before);
        const [close] = advance(world, left - into);
        expect(close).toMatchObject({ day: from === 1 ? 8 : 9, contracts: [{ outcome: 'paid' }] });
        if (from === 1) expect(close!.card!.payoutCents).toBeGreaterThan(0);
        else expect(close!.card).toBeNull();
        expect(said).toBe(close!.cashAfterCents);
      }
    }
  });

  it('counts above the floor where the close does, a held contract paying tonight', () => {
    const world = payingTonight(2);
    advance(world, 23 * SECONDS_PER_HOUR + 50 * 60); // day 9, 23:50
    post(world.state.ledger, { day: 9, kind: 'buses', amountCents: -(world.state.ledger.cashCents + 14_995_000) });
    world.state.closesBelowFloor = 4;
    expect(belowFloor(cashAtClose(world))).toBe(false);
    const [close] = advance(world, 10 * 60);
    expect(belowFloor(close!.cashAfterCents - 6_000_000)).toBe(true);
    expect(world.state.closesBelowFloor).toBe(0);
  });
});
