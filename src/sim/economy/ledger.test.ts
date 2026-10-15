import { describe, expect, it } from 'vitest';
import { CREDIT_LIMIT_CENTS } from '../config/economy';
import { DAYS_PER_QUARTER } from '../config/time';
import { createRng } from '../core/rng';
import type { LineId } from '../core/ids';
import { CHART_DAYS } from './finance';
import { bankedBetween, closeDay, DAYS_KEPT, foundingCapitalCents, foundLedger, OPENING_DAY, post, profitableDays, rowsOfDay, spendParts, type Ledger, type LedgerRow } from './ledger';
import { starterBuses, starterLineCents } from './starter';

const sum = (l: Ledger) => l.rows.reduce((s, r) => s + r.amountCents, 0);
/** One purchase of buses, as the commands spend; a stop sold back, as they refund. */
const spend = (l: Ledger, cents: number, day: number) => spendParts(l, [{ kind: 'buses', amountCents: -cents }], day);
const refund = (l: Ledger, cents: number, day: number) => spendParts(l, [{ kind: 'stopSales', amountCents: cents }], day);

describe('I1: cash is the sum of the ledger rows', () => {
  it('founds with one row, the starting cash = k × the starter line (D7), on Day 0 (D25)', () => {
    // A depot, four stops and the two Sparrows every 20 minutes needs on a 3.5 km line (D7, K07).
    expect(starterBuses()).toBe(2);
    expect(starterLineCents()).toBe(35_600_000);
    expect(foundingCapitalCents()).toBe(47_454_800);
    const ledger = foundLedger();
    expect(OPENING_DAY).toBe(0);
    expect(ledger.rows).toEqual([{ day: 0, kind: 'founding', amountCents: 47_454_800 }]);
    expect(ledger.cashCents).toBe(47_454_800);
  });

  it('holds through thousands of random income rows, purchases, refusals and refunds', () => {
    const rng = createRng(11);
    const ledger = foundLedger();
    for (let day = 1; day <= 40; day++) {
      for (let i = 0; i < 60; i++) {
        const roll = rng.next();
        if (roll < 0.6) post(ledger, { day, kind: rng.pick(['fares', 'subsidy'] as const), amountCents: rng.int(0, 50_000) });
        else if (roll < 0.9) {
          const cost = rng.int(1, 30_000_000);
          const before = ledger.cashCents;
          const result = spend(ledger, cost, day);
          if (result.ok) expect(ledger.cashCents).toBe(before - cost);
          else expect(result.shortCents).toBe(cost - before - CREDIT_LIMIT_CENTS);
          expect(ledger.cashCents).toBeGreaterThanOrEqual(-CREDIT_LIMIT_CENTS);
        } else refund(ledger, rng.int(0, 400_000), day);
        expect(ledger.cashCents).toBe(sum(ledger));
      }
    }
    expect(ledger.rows[0]?.kind).toBe('founding');
    expect(ledger.rows.filter((r) => r.kind === 'founding')).toHaveLength(1);
  });

  it("is each day's card: a day's rows add up to that day's change in cash", () => {
    const ledger = foundLedger();
    post(ledger, { day: 1, kind: 'fares', amountCents: 12_345 });
    const startOfDay2 = ledger.cashCents;
    post(ledger, { day: 2, kind: 'fares', amountCents: 225 });
    post(ledger, { day: 2, kind: 'subsidy', amountCents: 160 });
    spend(ledger, 400_000, 2);
    const card = rowsOfDay(ledger, 2);
    expect(card.map((r) => r.kind)).toEqual(['fares', 'subsidy', 'buses']);
    expect(card.reduce((s, r) => s + r.amountCents, 0)).toBe(ledger.cashCents - startOfDay2);
  });

  it('writes founding capital once: a later k cannot touch an existing company', () => {
    const ledger = foundLedger(foundingCapitalCents(1_200));
    expect(foundingCapitalCents(1_800)).not.toBe(ledger.cashCents);
    expect(() => post(ledger, { day: 3, kind: 'founding', amountCents: 1 })).toThrow(RangeError);
    expect(ledger.cashCents).toBe(42_720_000);
  });
});

describe('purchases', () => {
  it('spends into the credit line to −$150k, and refuses a purchase one cent past it, saying by how much and leaving no row (D10)', () => {
    const ledger = foundLedger(1_000_000);
    expect(spend(ledger, 16_000_001, 1)).toEqual({ ok: false, reason: 'insufficient_funds', shortCents: 1 });
    expect(ledger.rows).toHaveLength(1);
    expect(spend(ledger, 16_000_000, 1).ok).toBe(true);
    expect(ledger.cashCents).toBe(-15_000_000);
  });

  it('gives back exactly what an undone purchase took (I9)', () => {
    const ledger = foundLedger();
    const before = ledger.cashCents;
    for (const cost of [400_000, 9_500_000, 1, 15_000_000]) spend(ledger, cost, 1);
    for (const cost of [15_000_000, 1, 9_500_000, 400_000]) refund(ledger, cost, 1);
    expect(ledger.cashCents).toBe(before);
  });

  it('treats a negative or fractional amount as a bug, not a refusal', () => {
    // V3 refused a negative spend as 'insufficient_funds' and rounded dollars to cents.
    const ledger = foundLedger();
    expect(() => spend(ledger, -1, 1)).toThrow(RangeError);
    expect(() => spend(ledger, 99.5, 1)).toThrow(RangeError);
    expect(() => refund(ledger, -1, 1)).toThrow(RangeError);
    expect(() => spendParts(ledger, [{ kind: 'stops', amountCents: 400_000 }], 1)).toThrow(RangeError);
    expect(() => post(ledger, { day: 1, kind: 'fares', amountCents: 0.1 })).toThrow(RangeError);
  });
});

describe('banking a constant rate (ported from V3)', () => {
  // V3's tick-size cases (ledger.test.ts:79-132) in whole seconds: $26 per bus-hour and $250 a day.
  it('banks the same whole cents however the time is sliced', () => {
    for (const step of [1, 7, 30, 61, 300, 3600]) {
      let banked = 0;
      for (let t = 0; t < 3600; t += step) banked += bankedBetween(2_600, 3_600, t, Math.min(t + step, 3600));
      expect(banked, `step ${step}`).toBe(2_600);
    }
    for (const step of [1, 30, 7, 86_400]) {
      let banked = 0;
      for (let t = 0; t < 86_400; t += step) banked += bankedBetween(25_000, 86_400, t, Math.min(t + step, 86_400));
      expect(banked, `step ${step}`).toBe(25_000);
    }
  });

  it('refuses fractional counters, the one way it stops being exact', () => {
    expect(() => bankedBetween(2_600, 3_600, 0, 0.5)).toThrow(RangeError);
  });
});

describe('profitable days (the checklist)', () => {
  it('counts closed days whose running rows beat their costs, leaving out capital and today', () => {
    const ledger = foundLedger();
    spend(ledger, 20_600_000, 1); // a line bought on day 1 does not make day 1 a loss
    post(ledger, { day: 1, kind: 'fares', amountCents: 50_000 });
    post(ledger, { day: 1, kind: 'wages', amountCents: -40_000 });
    post(ledger, { day: 2, kind: 'fares', amountCents: 10_000 });
    post(ledger, { day: 2, kind: 'wages', amountCents: -40_000 });
    post(ledger, { day: 3, kind: 'fares', amountCents: 90_000 });
    expect(profitableDays(ledger, 3)).toBe(1); // day 1 only: the starting cash is not profit, and day 3 is still open
    expect(profitableDays(ledger, 4)).toBe(2);
  });
});

// The systems audit's third round (D26): closeDay kept every closed day's rows forever and every save
// carries them, so a save grew by a day card a day without end, and a long game's copies outgrew the
// browser's storage. Shown failing (TS-04) on 001fc4a, which kept all forty days: 164 rows, not 68.
describe('closed days no reader reads (a save that stays bounded)', () => {
  // Two lines; days 1 and 2 in profit, every later day at a loss, so the days folded lose money
  // together though two of them made some; buses bought on day 3, a contract paid on day 5, a grant on day 8.
  const postDay = (ledger: Ledger, day: number) => {
    for (const lineId of [1, 2] as LineId[]) {
      post(ledger, { day, kind: 'fares', amountCents: day <= 2 ? 50_000 : 10_000, lineId });
      post(ledger, { day, kind: 'wages', amountCents: -30_000, lineId });
    }
    if (day === 3) spendParts(ledger, [{ kind: 'buses', amountCents: -1_000_000, lineId: 1 as LineId }], day);
    if (day === 5) post(ledger, { day, kind: 'contract', amountCents: 600_000 });
    if (day === 8) post(ledger, { day, kind: 'card', amountCents: 200_000 });
  };
  const capital = foundingCapitalCents();
  const cash = capital + 2 * (2 * 20_000) + 38 * 2 * -20_000 - 1_000_000 + 600_000 + 200_000;
  // Days 1 to 25 at day 40's close, Finance's two quarters (sixteen days to day 41) being 26 to 41:
  // the days in profit on the last of them, the rest on theirs, a row a kind, in the day card's order, no line.
  const folded: LedgerRow[] = [
    { day: 2, kind: 'fares', amountCents: 200_000 },
    { day: 2, kind: 'wages', amountCents: -120_000 },
    { day: 25, kind: 'fares', amountCents: 23 * 20_000 },
    { day: 25, kind: 'contract', amountCents: 600_000 },
    { day: 25, kind: 'card', amountCents: 200_000 },
    { day: 25, kind: 'wages', amountCents: 23 * -60_000 },
    { day: 25, kind: 'buses', amountCents: -1_000_000 },
  ];

  it('folds the days before Finance’s two quarters as they pass, leaving cash, the days kept and a day in profit as they were', () => {
    const ledger = foundLedger();
    for (let day = 1; day <= 40; day++) {
      postDay(ledger, day);
      closeDay(ledger, day);
    }
    expect(ledger.rows.slice(0, 8)).toEqual([{ day: 0, kind: 'founding', amountCents: capital }, ...folded]);
    expect(ledger.rows).toHaveLength(1 + folded.length + 15 * 4);
    for (let day = 26; day <= 40; day++) {
      expect(rowsOfDay(ledger, day), `day ${day}`).toEqual([
        { day, kind: 'fares', amountCents: 10_000, lineId: 1 },
        { day, kind: 'fares', amountCents: 10_000, lineId: 2 },
        { day, kind: 'wages', amountCents: -30_000, lineId: 1 },
        { day, kind: 'wages', amountCents: -30_000, lineId: 2 },
      ]);
    }
    expect(ledger.cashCents).toBe(cash);
    expect(sum(ledger)).toBe(cash);
    // The checklist's "a day in profit" still holds, though the days folded lost money together.
    expect(profitableDays(ledger, 41)).toBeGreaterThan(0);
  });

  it('folds a save from before at its next close to what it would have kept', () => {
    const ledger = foundLedger();
    for (let day = 1; day <= 40; day++) postDay(ledger, day);
    closeDay(ledger, 40);
    expect(ledger.rows.slice(0, 8)).toEqual([{ day: 0, kind: 'founding', amountCents: capital }, ...folded]);
    expect(ledger.rows.slice(8).every((r) => r.day >= 26)).toBe(true);
    expect(ledger.cashCents).toBe(cash);
    expect(sum(ledger)).toBe(cash);
  });

  it('keeps day 1 whole while Finance’s two quarters reach back to it, and folds it at day 16’s close', () => {
    const ledger = foundLedger();
    for (let day = 1; day <= 15; day++) {
      postDay(ledger, day);
      closeDay(ledger, day);
    }
    expect(rowsOfDay(ledger, 1)).toHaveLength(4);
    postDay(ledger, 16);
    closeDay(ledger, 16);
    expect(rowsOfDay(ledger, 1)).toEqual([
      { day: 1, kind: 'fares', amountCents: 100_000 },
      { day: 1, kind: 'wages', amountCents: -60_000 },
    ]);
    expect(rowsOfDay(ledger, 2)).toHaveLength(4);
  });

  // Finance's chart reads its last CHART_DAYS days and the report card its quarter's: a day folded
  // within them would show on the chart and grade as a day of nothing. Shown failing (TS-04) on
  // 001fc4a, which had no DAYS_KEPT, and with DAYS_KEPT a day short of the chart: 15 against 16.
  it('keeps whole every day Finance’s chart and the report card read', () => {
    expect(DAYS_KEPT).toBeGreaterThanOrEqual(CHART_DAYS);
    expect(DAYS_KEPT).toBeGreaterThanOrEqual(DAYS_PER_QUARTER);
  });
});

// D25: Finance says where the money went, so a purchase posts a row per thing bought. Shown failing
// (TS-04) on the old ledger, whose one Purchases row could not tell a line's stops from its buses.
describe('a purchase in parts', () => {
  it('posts a row for each part with money in it, each with its line', () => {
    const ledger = foundLedger();
    const r = spendParts(
      ledger,
      [
        { kind: 'stops', amountCents: -1_600_000 },
        { kind: 'buses', amountCents: -19_000_000, lineId: 1 as never },
        { kind: 'busSales', amountCents: 0 },
      ],
      1,
    );
    expect(r.ok).toBe(true);
    expect(ledger.rows.slice(1)).toEqual([
      { day: 1, kind: 'stops', amountCents: -1_600_000 },
      { day: 1, kind: 'buses', amountCents: -19_000_000, lineId: 1 },
    ]);
    expect(ledger.cashCents).toBe(47_454_800 - 20_600_000);
  });

  it('is refused whole when the parts together go past the credit line, posting none', () => {
    const ledger = foundLedger(1_000_000);
    const r = spendParts(
      ledger,
      [
        { kind: 'stops', amountCents: -1_000_000 },
        { kind: 'buses', amountCents: -15_000_001 },
      ],
      1,
    );
    expect(r).toEqual({ ok: false, reason: 'insufficient_funds', shortCents: 1 });
    expect(ledger.rows).toHaveLength(1);
  });

  it('nets a sale against a purchase, as a new model sells the old buses', () => {
    const ledger = foundLedger(0);
    expect(spendParts(ledger, [{ kind: 'busSales', amountCents: 9_500_000 }, { kind: 'buses', amountCents: -24_500_000 }], 1).ok).toBe(true);
    expect(ledger.cashCents).toBe(-15_000_000);
    expect(ledger.rows.map((r) => r.kind)).toEqual(['founding', 'busSales', 'buses']);
  });
});
