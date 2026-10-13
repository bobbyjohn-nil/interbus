// The company's money as ledger rows in whole cents. Ported from V3's cent treasury
// (`Intralines_City@dc63602:src/game/economy/ledger.ts`, S01) with three changes on the way in:
// - every movement is a row, and cash is the sum of the rows, the first being "Founding capital"
//   (I1, AR-12); V3 changed a bare cashCents and kept no rows, so the day card could not add up;
// - founding capital is derived, k × the starter line (D7), not a fixed $500,000;
// - amounts are integer cents end to end, and a caller bug (a negative or fractional amount) throws
//   instead of V3's console.error and a misleading 'insufficient_funds'.
// Income rows (K40: V3's income was always zero) are posted by the demand step from M1.
import { STARTER_LINE_CENTS, STARTING_CASH_K_PERMILLE } from '../config/economy';
import type { LineId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';

export const ROW_KINDS = ['founding', 'fares', 'subsidy', 'purchase', 'refund'] as const;
export type RowKind = (typeof ROW_KINDS)[number];

export interface LedgerRow {
  /** The game day the row belongs to; the day closes at 24:00 (docs/specs/current.md). */
  readonly day: number;
  readonly kind: RowKind;
  /** Positive for money in, negative for money out. */
  readonly amountCents: number;
  readonly lineId?: LineId;
}

export interface Ledger {
  readonly rows: LedgerRow[];
  /** Always Σ rows.amountCents (I1); kept so reading cash is not a sum over the whole game. */
  cashCents: number;
}

function assertCents(amount: number, what: string): void {
  if (!Number.isSafeInteger(amount)) throw new RangeError(`${what} must be whole cents, got ${amount}`);
}

/** k × the starter line's cost, in whole cents (D7). */
export function foundingCapitalCents(kPermille = STARTING_CASH_K_PERMILLE, starterCents = STARTER_LINE_CENTS): number {
  return Math.floor((starterCents * kPermille) / 1000);
}

/** A new company's ledger: one row, Founding capital, on day 1. */
export function foundLedger(capitalCents = foundingCapitalCents()): Ledger {
  assertCents(capitalCents, 'founding capital');
  return { rows: [{ day: 1, kind: 'founding', amountCents: capitalCents }], cashCents: capitalCents };
}

/** Appends a row; the only way cash changes. */
export function post(ledger: Ledger, row: LedgerRow): void {
  assertCents(row.amountCents, row.kind);
  if (row.kind === 'founding') throw new RangeError('founding capital is written once, at founding');
  ledger.rows.push(row);
  ledger.cashCents += row.amountCents;
}

export type SpendRefusal = 'insufficient_funds';

/**
 * A purchase the player chose: refused, with the shortfall, if it would take cash below
 * `floorCents` (0 until the credit line, D10). Writes one negative row when it goes through.
 */
export function spend(
  ledger: Ledger,
  costCents: number,
  day: number,
  floorCents = 0,
): Result<object, SpendRefusal, { shortCents: number }> {
  assertCents(costCents, 'cost');
  if (costCents < 0) throw new RangeError(`a cost is never negative, got ${costCents}`);
  const shortCents = floorCents - (ledger.cashCents - costCents);
  if (shortCents > 0) return refuse('insufficient_funds', { shortCents });
  post(ledger, { day, kind: 'purchase', amountCents: -costCents });
  return ok();
}

/** Gives back exactly what a purchase took (an undo while paused, I9). */
export function refund(ledger: Ledger, amountCents: number, day: number): void {
  assertCents(amountCents, 'refund');
  if (amountCents < 0) throw new RangeError(`a refund is never negative, got ${amountCents}`);
  post(ledger, { day, kind: 'refund', amountCents });
}

/** The rows of one day, which are its day card (I1). */
export function rowsOfDay(ledger: Ledger, day: number): LedgerRow[] {
  return ledger.rows.filter((r) => r.day === day);
}

/**
 * Whole cents earned between two readings of a cumulative counter, at a constant rate of
 * `numerator / denominator` cents per unit. Ported from V3's `bankFromCumulativeTotal`
 * (ledger.ts:148-157): flooring both totals instead of carrying a fraction makes a day's sum the
 * same however it is sliced into steps. Integer inputs keep it exact.
 */
export function bankedBetween(numerator: number, denominator: number, before: number, after: number): number {
  for (const n of [numerator, denominator, before, after]) {
    if (!Number.isSafeInteger(n)) throw new RangeError(`banking needs whole numbers, got ${n}`);
  }
  return Math.floor((numerator * after) / denominator) - Math.floor((numerator * before) / denominator);
}
