// A long game keeps saving (the systems audit's third round, D26). The ledger kept a row per kind and line
// for every closed day (economy/ledger.ts closeDay) and every save carries every row, so a save grew
// about 1,050 characters a game day with three lines and 2,240 with seven, without end: five copies (the
// autosave, the quarter's save and three slots) outgrew the 5,242,880 characters Chromium gives an
// origin's localStorage (e2e/storage.spec.ts) near day 990 with three lines and day 455 with seven.
// Closed days no reader reads now fold into totals (economy/ledger.ts foldDays). Here seven lines play
// 48 days, six quarters, past the first fold at day 16's close: at 23:00, when a day's save is at its
// largest (testing.ts LARGEST_SAVE_SECOND), and at 05:00 each day, every reader of the ledger reads what
// it would with every closed day kept, and the save stops growing under GROWN_SAVE_MOST_CHARS.
// `npm run bench savesize` plays 1,000 days nightly: seven lines' largest save went from 2,265,852
// characters (23:00 on day 1,000) to 73,177 (23:00 on day 522), and at 05:00 from 2,235,980 to 41,597.
// Shown failing (TS-04) with 001fc4a's close, which kept every day: at most 2,318 rows against 1,681,
// and 138,387 characters, 67,996 more at day 48's 23:00 than at day 17's; here 1,138, 71,171 and 505.
import { describe, expect, it } from 'vitest';
import { DAYS_PER_QUARTER, SECONDS_PER_HOUR } from '../config/time';
import { toCalendarTime } from '../core/calendar';
import { finance } from '../economy/finance';
import { DAYS_KEPT, profitableDays, type LedgerRow } from '../economy/ledger';
import { moneyGrade } from '../economy/reportCard';
import { ROW_KINDS } from '../rules/money';
import { GROWN_SAVE_MOST_CHARS, grownCompany, LARGEST_SAVE_SECOND, playDay } from '../testing';
import type { World } from '../world';
import { aboutSave, decode, encode, fromSaveData, stateHash } from './save';

const BUILD = { sha: 'size', version: '0.0.0' };
const DAYS = 48;

/** `world` with every closed day's rows, as 001fc4a kept them: what each reader read before the fold. */
function unfolded(world: World, closed: readonly LedgerRow[]): World {
  const today = toCalendarTime(world.state.elapsed).day;
  const rows = [...closed, ...world.state.ledger.rows.filter((r) => r.day === today)];
  return { ...world, state: { ...world.state, ledger: { rows, cashCents: rows.reduce((s, r) => s + r.amountCents, 0) } } };
}

/** Each kind's total over the whole game: what the benches' and tests' sums since founding read. */
const totals = (rows: readonly LedgerRow[]) => Object.fromEntries(ROW_KINDS.map((k) => [k, rows.filter((r) => r.kind === k).reduce((s, r) => s + r.amountCents, 0)]));

/**
 * The most rows the ledger keeps, at 23:00 when they are most: the starting cash; at most two days of
 * folded rows, a row a kind; the DAYS_KEPT - 1 closed days Finance's two quarters hold in full, each at
 * most five rows a line (fares, subsidy, running, wages, deadhead) and one of every other kind (this
 * company buys nothing after founding); and today's 23 hours unmerged, each at most five rows a line and
 * the two upkeeps, with one of every other kind.
 */
const mostRows = (lines: number) =>
  1 + 2 * (ROW_KINDS.length - 1) + (DAYS_KEPT - 1) * (5 * lines + ROW_KINDS.length) + (LARGEST_SAVE_SECOND / SECONDS_PER_HOUR) * (5 * lines + 2) + ROW_KINDS.length;

/** Every reader of the ledger against `closed` kept whole, and the save's characters, which the reader takes back. */
function readsAsUnfolded(world: World, closed: readonly LedgerRow[], when: string): number {
  const was = unfolded(world, closed);
  const { ledger } = world.state;
  const today = toCalendarTime(world.state.elapsed).day;
  // Finance: today, yesterday, the quarter so far, each line's yesterday, the chart's two quarters and Day 0's starting cash.
  expect(finance(world), when).toEqual(finance(was));
  // The checklist's "a day in profit", and its "a contract taken".
  expect(profitableDays(ledger, today) > 0, when).toBe(profitableDays(was.state.ledger, today) > 0);
  expect(ledger.rows.some((r) => r.kind === 'contract'), when).toBe(was.state.ledger.rows.some((r) => r.kind === 'contract'));
  // Cash, the host's sum of the rows (I1), and every kind's total since founding.
  expect(ledger.cashCents, when).toBe(was.state.ledger.cashCents);
  expect(ledger.rows.reduce((s, r) => s + r.amountCents, 0), when).toBe(ledger.cashCents);
  expect(totals(ledger.rows), when).toEqual(totals(was.state.ledger.rows));
  // The save reader takes it (#61's day order included) as the same game, and Saves names its cash.
  const text = encode(world.state, BUILD);
  const { result } = decode(text, world.state.city);
  if (result.outcome !== 'ok') throw new Error(`${when}: the save was refused (${result.outcome === 'unreadable' ? result.problem : result.outcome})`);
  expect(stateHash(fromSaveData(result.envelope.data)), when).toBe(stateHash(world.state));
  expect(aboutSave(result.envelope).cashCents, when).toBe(ledger.cashCents);
  return text.length;
}

describe('a long game’s save', () => {
  it(`reads as it would unfolded, at 23:00 and 05:00 for ${DAYS} days of seven lines, and stops growing under GROWN_SAVE_MOST_CHARS`, () => {
    const world = grownCompany(7, 500_000_000);
    const closed: LedgerRow[] = [world.state.ledger.rows[0]!];
    const atLargest: number[] = [];
    let most = { rows: 0, chars: 0 };
    const measure = (when: string) => {
      const chars = readsAsUnfolded(world, closed, when);
      most = { rows: Math.max(most.rows, world.state.ledger.rows.length), chars: Math.max(most.chars, chars) };
      return chars;
    };
    for (let day = 1; day <= DAYS; day++) {
      for (const e of playDay(world, () => atLargest.push(measure(`day ${day} at 23:00`)))) {
        if (e.kind !== 'day-closed') continue;
        closed.push(...e.rows);
        // The report card graded its quarter's rows, all there at its close, the close's interest included (step.ts).
        if (e.card) expect(e.card.money, `quarter ending day ${e.day}`).toBe(moneyGrade(unfolded(world, closed), e.day - DAYS_PER_QUARTER + 1, e.day));
      }
      measure(`day ${day + 1} at 05:00`);
    }
    expect(most.rows).toBeLessThanOrEqual(mostRows(7));
    expect(most.chars).toBeLessThan(GROWN_SAVE_MOST_CHARS);
    // Held: from the first fold on, a day adds no day's rows (2,240 characters unfolded), only longer numbers.
    expect(atLargest[DAYS - 1]! - atLargest[16]!).toBeLessThan(2_048);
  }, 60_000);
});
