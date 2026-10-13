// The company's money as ledger rows in whole cents. Ported from V3's cent treasury
// (`Intralines_City@dc63602:src/game/economy/ledger.ts`, S01) with three changes on the way in:
// - every movement is a row, and cash is the sum of the rows, the first being "Founding capital"
//   (I1, AR-12); V3 changed a bare cashCents and kept no rows, so the day card could not add up;
// - founding capital is derived, k × the starter line (D7), not a fixed $500,000;
// - amounts are integer cents end to end, and a caller bug (a negative or fractional amount) throws
//   instead of V3's console.error and a misleading 'insufficient_funds'.
// Income rows (K40: V3's income was always zero) are posted by the demand step from M1; cost rows
// (running, wages, deadhead, depot upkeep) from M2, by the hour.
import { STARTING_CASH_K_PERMILLE } from '../config/economy';
import { starterLineCents } from './starter';
import type { LineId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';

export const ROW_KINDS = ['founding', 'fares', 'subsidy', 'purchase', 'refund', 'running', 'wages', 'deadhead', 'upkeep'] as const;
export type RowKind = (typeof ROW_KINDS)[number];

export interface LedgerRow {
  /** The game day the row belongs to; the day closes at 24:00 (docs/specs/m1-first-dollar.md). */
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
export function foundingCapitalCents(kPermille = STARTING_CASH_K_PERMILLE, starterCents = starterLineCents()): number {
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

/**
 * Closes a day: its rows merge into one per kind and line, in ROW_KINDS order then by line, so a save
 * grows by a day card a day rather than by every hour's rows. Cash and the day card's totals are
 * unchanged (I1). A day's rows sit together at the end of the ledger when it closes.
 */
export function closeDay(ledger: Ledger, day: number): void {
  const first = ledger.rows.findIndex((r) => r.day === day);
  if (first < 0) return;
  const merged = new Map<string, LedgerRow>();
  for (const r of ledger.rows.slice(first)) {
    if (r.day !== day) throw new RangeError(`day ${day} closes with a row of day ${r.day} after it`);
    const key = `${r.kind} ${r.lineId ?? ''}`;
    const had = merged.get(key);
    merged.set(key, had ? { ...had, amountCents: had.amountCents + r.amountCents } : r);
  }
  const order = (r: LedgerRow) => ROW_KINDS.indexOf(r.kind);
  ledger.rows.length = first;
  for (const r of [...merged.values()].sort((a, b) => order(a) - order(b) || (a.lineId ?? 0) - (b.lineId ?? 0))) ledger.rows.push(r);
}

/** Rows that are capital, not the business's running: founding, purchases and their refunds. */
const CAPITAL_KINDS: ReadonlySet<RowKind> = new Set(['founding', 'purchase', 'refund']);

/** Closed days (before `today`) whose operating rows, everything but capital, sum above zero: the checklist's "a day in profit". */
export function profitableDays(ledger: Ledger, today: number): number {
  const byDay = new Map<number, number>();
  for (const r of ledger.rows) {
    if (r.day >= today || CAPITAL_KINDS.has(r.kind)) continue;
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.amountCents);
  }
  let n = 0;
  for (const total of byDay.values()) if (total > 0) n++;
  return n;
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
