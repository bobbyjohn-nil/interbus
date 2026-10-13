// The failure floor (the M3 spec, item 10; D10): cash may go to −$150k on one lender's credit line,
// at 0.06% a day on what is owed, as an Interest row; five day closes in a row below −$150k end the
// run. Shown failing (TS-04) with the counter not reset by a close above the floor: a company that
// climbs back is still ended.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from '../commands/debugLine';
import { SECONDS_PER_DAY } from '../config/time';
import { runEnded } from '../rules/credit';
import { advance } from '../step';
import { gameWithDepot } from '../testing';
import { post, spend } from './ledger';

function owing(cents: number) {
  const world = gameWithDepot();
  if (!addDebugLine(world).ok) throw new Error('no line');
  // Owe `cents` at once, as a purchase past anything the credit line would allow.
  post(world.state.ledger, { day: 1, kind: 'purchase', amountCents: -(world.state.ledger.cashCents + cents) });
  return world;
}

describe('the failure floor', () => {
  it('lets a purchase spend to −$150k and no further', () => {
    const world = gameWithDepot();
    const cash = world.state.ledger.cashCents;
    expect(spend(world.state.ledger, cash + 15_000_001, 1)).toMatchObject({ ok: false, shortCents: 1 });
    expect(spend(world.state.ledger, cash + 15_000_000, 1).ok).toBe(true);
    expect(world.state.ledger.cashCents).toBe(-15_000_000);
  });

  it('charges 0.06% a day on what is owed at each close, as an Interest row', () => {
    const world = owing(10_000_000);
    const [event] = advance(world, SECONDS_PER_DAY);
    const interest = event!.rows.find((r) => r.kind === 'interest')!;
    const owedAtClose = -(event!.cashAfterCents - interest.amountCents);
    expect(owedAtClose).toBeGreaterThan(9_000_000);
    expect(interest.amountCents).toBe(-Math.round(owedAtClose * 0.0006));
    const inCredit = owing(-1); // $0.01 in hand, then a day's running in profit
    expect(advance(inCredit, SECONDS_PER_DAY)[0]!.rows.some((r) => r.kind === 'interest')).toBe(false);
  });

  it('counts closes below −$150k, and the fifth in a row ends the run', () => {
    const world = owing(20_000_000);
    advance(world, 4 * SECONDS_PER_DAY);
    expect(world.state.closesBelowFloor).toBe(4);
    expect(runEnded(world.state.closesBelowFloor)).toBe(false);
    advance(world, SECONDS_PER_DAY);
    expect(world.state.closesBelowFloor).toBe(5);
    expect(runEnded(world.state.closesBelowFloor)).toBe(true);
  });

  it('starts the count again when a day closes above the floor', () => {
    const world = owing(20_000_000);
    advance(world, 2 * SECONDS_PER_DAY);
    expect(world.state.closesBelowFloor).toBe(2);
    post(world.state.ledger, { day: 3, kind: 'sale', amountCents: 10_000_000 });
    advance(world, SECONDS_PER_DAY);
    expect(world.state.closesBelowFloor).toBe(0);
  });
});
