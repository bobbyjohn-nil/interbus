// The company's money as ledger rows in whole cents. Ported from V3's cent treasury
// (`Intralines_City@dc63602:src/game/economy/ledger.ts`, S01) with three changes on the way in:
// - every movement is a row, and cash is the sum of the rows, the first being the starting cash on
//   Day 0 (I1, AR-12; D25); V3 changed a bare cashCents and kept no rows, so the day card could not add up;
// - founding capital is derived, k × the starter line (D7), not a fixed $500,000;
// - amounts are integer cents end to end, and a caller bug (a negative or fractional amount) throws
//   instead of V3's console.error and a misleading 'insufficient_funds'.
// Income rows (K40: V3's income was always zero) are posted by the demand step from M1; cost rows
// (running, wages, deadhead, depot and stop upkeep) from M2, by the hour. A purchase posts one row
// per thing bought (buses, stops, stop upgrades, depots), so Finance can say where the money went
// (D25); the kinds and their groups are sim/rules/money.ts.
import { CREDIT_LIMIT_CENTS, STARTING_CASH_K_PERMILLE } from '../config/economy';
import { DAYS_PER_QUARTER } from '../config/time';
import { starterLineCents } from './starter';
import type { LineId } from '../core/ids';
import { ok, refuse, type Result } from '../core/result';
import { isOperating, ROW_KINDS, type RowKind } from '../rules/money';

export { ROW_KINDS, type RowKind };

/** The day the starting cash is posted: Day 0, before the clock's first day (D25: "having the starting days be like day 0"). The clock still opens on Day 1 at 05:00. */
export const OPENING_DAY = 0;

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

/** A new company's ledger: one row, the starting cash, on Day 0. */
export function foundLedger(capitalCents = foundingCapitalCents()): Ledger {
  assertCents(capitalCents, 'founding capital');
  return { rows: [{ day: OPENING_DAY, kind: 'founding', amountCents: capitalCents }], cashCents: capitalCents };
}

/** Appends a row; the only way cash changes. */
export function post(ledger: Ledger, row: LedgerRow): void {
  assertCents(row.amountCents, row.kind);
  if (row.kind === 'founding') throw new RangeError('founding capital is written once, at founding');
  ledger.rows.push(row);
  ledger.cashCents += row.amountCents;
}

export type SpendRefusal = 'insufficient_funds';

/** Buying and building, and what selling back fetches. */
export type CapitalKind = 'buses' | 'busSales' | 'stops' | 'stopUpgrades' | 'stopSales' | 'depots';

/** One part of a purchase: what it is, its signed amount (negative for money out, positive for a sale), and the line it is for, if any. */
export interface SpendPart {
  readonly kind: CapitalKind;
  readonly amountCents: number;
  readonly lineId?: LineId;
}

/**
 * A purchase the player chose, in parts (a line's stops and its buses; a model's new buses and the old
 * ones sold): refused whole, with the shortfall, if together they would take cash below `floorCents`
 * (the credit line's −$150k, D10). When it goes through, each part with money in it is a row of its own.
 */
export function spendParts(
  ledger: Ledger,
  parts: readonly SpendPart[],
  day: number,
  floorCents = -CREDIT_LIMIT_CENTS,
): Result<object, SpendRefusal, { shortCents: number }> {
  for (const p of parts) {
    assertCents(p.amountCents, p.kind);
    const sale = p.kind === 'busSales' || p.kind === 'stopSales';
    if (sale ? p.amountCents < 0 : p.amountCents > 0) throw new RangeError(`${p.kind} has the wrong sign: ${p.amountCents}`);
  }
  const total = parts.reduce((s, p) => s + p.amountCents, 0);
  const shortCents = floorCents - (ledger.cashCents + total);
  if (total < 0 && shortCents > 0) return refuse('insufficient_funds', { shortCents });
  for (const p of parts) if (p.amountCents !== 0) post(ledger, { day, kind: p.kind, amountCents: p.amountCents, ...(p.lineId === undefined ? {} : { lineId: p.lineId }) });
  return ok();
}

/**
 * The days the ledger keeps in full, today among them: Finance's two quarters (finance.ts CHART_DAYS;
 * ledger.test.ts holds this no shorter), which hold its chart, its quarter so far, yesterday and
 * today, and the report card's quarter and the day card's day with them. No reader reads a closed day
 * further back, so those fold (foldDays).
 */
export const DAYS_KEPT = 2 * DAYS_PER_QUARTER;

/**
 * Closes a day: its rows merge into one per kind and line, in ROW_KINDS order then by line, so a save
 * grows by a day card a day rather than by every hour's rows; and the day that falls out of Finance's
 * two quarters folds, so a save stops growing once they are full. Cash and the day card's totals are
 * unchanged (I1). A day's rows sit together at the end of the ledger when it closes.
 */
export function closeDay(ledger: Ledger, day: number): void {
  const first = ledger.rows.findIndex((r) => r.day === day);
  if (first >= 0) {
    const merged = new Map<string, LedgerRow>();
    for (const r of ledger.rows.slice(first)) {
      if (r.day !== day) throw new RangeError(`day ${day} closes with a row of day ${r.day} after it`);
      const key = `${r.kind} ${r.lineId ?? ''}`;
      const had = merged.get(key);
      merged.set(key, had ? { ...had, amountCents: had.amountCents + r.amountCents } : r);
    }
    ledger.rows.length = first;
    for (const r of [...merged.values()].sort((a, b) => kindOrder(a) - kindOrder(b) || (a.lineId ?? 0) - (b.lineId ?? 0))) ledger.rows.push(r);
  }
  foldDays(ledger, day + 1 - DAYS_KEPT);
}

const kindOrder = (r: LedgerRow) => ROW_KINDS.indexOf(r.kind);

/**
 * Folds the closed days up to `last` into totals (the systems audit's third round: a long game's save
 * had outgrown the browser's storage): one row a kind, with no line, on at most two days, the days in
 * profit on the last of them and the rest on the last of theirs. Every kind's total and cash stay as
 * they were, and so does the checklist's "a day in profit" (profitableDays), which reads every closed
 * day. Folded rows are ordinary rows in day order, so any build's save reader takes them, and a fold
 * folds again to itself: a save from before, folded at its next close, keeps what this one would have.
 */
export function foldDays(ledger: Ledger, last: number): void {
  // The starting cash stays first, on Day 0; the days up to `last` follow it.
  const from = ledger.rows[0]?.kind === 'founding' ? 1 : 0;
  let to = from;
  while (to < ledger.rows.length && ledger.rows[to]!.day <= last) to++;
  if (to === from) return;
  const blocks = { profit: { day: 0, sums: new Map<RowKind, number>() }, rest: { day: 0, sums: new Map<RowKind, number>() } };
  for (let k = from; k < to; ) {
    const day = ledger.rows[k]!.day;
    let end = k;
    let net = 0;
    for (; end < to && ledger.rows[end]!.day === day; end++) if (isOperating(ledger.rows[end]!.kind)) net += ledger.rows[end]!.amountCents;
    const block = net > 0 ? blocks.profit : blocks.rest;
    block.day = day;
    for (; k < end; k++) block.sums.set(ledger.rows[k]!.kind, (block.sums.get(ledger.rows[k]!.kind) ?? 0) + ledger.rows[k]!.amountCents);
  }
  const folded = [blocks.profit, blocks.rest]
    .filter((b) => b.sums.size > 0)
    .sort((a, b) => a.day - b.day)
    .flatMap((b) => ROW_KINDS.filter((kind) => b.sums.has(kind)).map((kind): LedgerRow => ({ day: b.day, kind, amountCents: b.sums.get(kind)! })));
  ledger.rows.splice(from, to - from, ...folded);
}

/**
 * Closed days (before `today`) whose operating rows, income and running costs (sim/rules/money.ts), sum
 * above zero: the checklist's "a day in profit", which reads only whether there is one. Days folded
 * (foldDays) count once at most, their days in profit together.
 */
export function profitableDays(ledger: Ledger, today: number): number {
  const byDay = new Map<number, number>();
  for (const r of ledger.rows) {
    if (r.day >= today || !isOperating(r.kind)) continue;
    byDay.set(r.day, (byDay.get(r.day) ?? 0) + r.amountCents);
  }
  let n = 0;
  for (const total of byDay.values()) if (total > 0) n++;
  return n;
}

/** The rows of one day, which are its day card (I1), for the last DAYS_KEPT days only: older days are folded into totals (foldDays), so they read as nothing, or as many days' totals on the day a block was dated. */
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
