// advance() moves the clock over the steps between hour boundaries at once (step.ts): the world it
// leaves, and what it returns, are the same as stepping one second at a time.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from './commands/debugLine';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR, STEP_SECONDS } from './config/time';
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
});
