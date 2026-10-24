// The credit line (the M3 spec, item 10; D10): one predicate for what a change is short, shortfallCents, read by
// every card and command that prices one (GD-05), the same test as the ledger's spendParts, and for the countdown chip.
import { CREDIT_LIMIT_CENTS, FAILURE_CLOSES, INTEREST_PER_DAY_PPM } from '../config/economy';

export { CREDIT_LIMIT_CENTS, FAILURE_CLOSES };

/** What a purchase may spend: the cash, and the credit line's room down to −$150k. */
export function spendableCents(cashCents: number): number {
  return cashCents + CREDIT_LIMIT_CENTS;
}

/**
 * What a change costing `priceCents` (net of what it sells back) is short of what may be spent; 0 when
 * it may go through. A change that spends nothing or gives money back (a headway cut, a reordered or
 * shorter route, a swap that sells more than it buys) is no purchase, and goes through below the
 * floor too, as the ledger's spendParts lets it.
 */
export function shortfallCents(priceCents: number, cashCents: number): number {
  return priceCents > 0 ? Math.max(0, priceCents - spendableCents(cashCents)) : 0;
}

/** The run is over: five day closes in a row below the floor. */
export function runEnded(closesBelowFloor: number): boolean {
  return closesBelowFloor >= FAILURE_CLOSES;
}

/** Below the floor: owing more than the credit line allows. */
export function belowFloor(cashCents: number): boolean {
  return cashCents < -CREDIT_LIMIT_CENTS;
}

/** The lender's interest a close charges on what is owed (D10), whole cents: none while cash is not below zero. */
export function interestCents(cashCents: number): number {
  return cashCents < 0 ? Math.round((-cashCents * INTEREST_PER_DAY_PPM) / 1_000_000) : 0;
}
