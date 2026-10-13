// The credit line (the M3 spec, item 10; D10): one predicate for what a purchase may spend, read by
// every card that prices one and by the ledger's spend (GD-05), and for the countdown chip.
import { CREDIT_LIMIT_CENTS, FAILURE_CLOSES } from '../config/economy';

export { CREDIT_LIMIT_CENTS, FAILURE_CLOSES };

/** What a purchase may spend: the cash, and the credit line's room down to −$150k. */
export function spendableCents(cashCents: number): number {
  return cashCents + CREDIT_LIMIT_CENTS;
}

/** The run is over: five day closes in a row below the floor. */
export function runEnded(closesBelowFloor: number): boolean {
  return closesBelowFloor >= FAILURE_CLOSES;
}

/** Below the floor: owing more than the credit line allows. */
export function belowFloor(cashCents: number): boolean {
  return cashCents < -CREDIT_LIMIT_CENTS;
}
