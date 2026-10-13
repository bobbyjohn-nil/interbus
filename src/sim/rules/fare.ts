// A line's fare and what a boarding earns: one predicate for the line card, the command and the
// forecast (GD-05). The band and the taper are V2's (the M3 spec, item 4; config/economy.ts).
import { FARE_MAX_CENTS, FARE_MIN_CENTS, FARE_STEP_CENTS, REFERENCE_FARE_CENTS, SUBSIDY_PER_BOARDING_CENTS, SUBSIDY_TAPER_EXPONENT } from '../config/economy';
import { ok, refuse, type Result } from '../core/result';

/** Every fare a line may charge, cheapest first. */
export const FARES_CENTS: readonly number[] = Array.from({ length: (FARE_MAX_CENTS - FARE_MIN_CENTS) / FARE_STEP_CENTS + 1 }, (_, k) => FARE_MIN_CENTS + k * FARE_STEP_CENTS);

export type FareRefusal = 'fare_out_of_range' | 'fare_not_a_step' | 'same_fare';

/** Whether a line may charge `fareCents`, where it now charges `currentCents`. */
export function checkFare(currentCents: number, fareCents: number): Result<object, FareRefusal, { limit?: number }> {
  if (!Number.isInteger(fareCents) || fareCents < FARE_MIN_CENTS || fareCents > FARE_MAX_CENTS) return refuse('fare_out_of_range');
  if ((fareCents - FARE_MIN_CENTS) % FARE_STEP_CENTS !== 0) return refuse('fare_not_a_step', { limit: FARE_STEP_CENTS });
  if (fareCents === currentCents) return refuse('same_fare');
  return ok({});
}

/** The city's subsidy for one boarding at this fare, in whole cents: full at $2.25 or less, tapering to nothing at $5.00. */
export function subsidyCents(fareCents: number): number {
  const gap = Math.max(0, fareCents - REFERENCE_FARE_CENTS) / (FARE_MAX_CENTS - REFERENCE_FARE_CENTS);
  return Math.round(SUBSIDY_PER_BOARDING_CENTS * (1 - Math.min(1, gap) ** SUBSIDY_TAPER_EXPONENT));
}
