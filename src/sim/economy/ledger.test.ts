import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { bankedBetween, foundingCapitalCents, foundLedger, post, profitableDays, refund, rowsOfDay, spend, type Ledger } from './ledger';
import { starterBuses, starterLineCents } from './starter';

const sum = (l: Ledger) => l.rows.reduce((s, r) => s + r.amountCents, 0);

describe('I1: cash is the sum of the ledger rows', () => {
  it('founds with one row, Founding capital = k × the starter line (D7)', () => {
    // A depot, four stops and the two Sparrows every 20 minutes needs on a 3.5 km line (D7, K07).
    expect(starterBuses()).toBe(2);
    expect(starterLineCents()).toBe(35_600_000);
    expect(foundingCapitalCents()).toBe(42_720_000);
    const ledger = foundLedger();
    expect(ledger.rows).toEqual([{ day: 1, kind: 'founding', amountCents: 42_720_000 }]);
    expect(ledger.cashCents).toBe(42_720_000);
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
          else expect(result.shortCents).toBe(cost - before);
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
    expect(card.map((r) => r.kind)).toEqual(['fares', 'subsidy', 'purchase']);
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
  it('refuses a purchase one cent short and says by how much, leaving no row', () => {
    const ledger = foundLedger(1_000_000);
    expect(spend(ledger, 1_000_001, 1)).toEqual({ ok: false, reason: 'insufficient_funds', shortCents: 1 });
    expect(ledger.rows).toHaveLength(1);
    expect(spend(ledger, 1_000_000, 1).ok).toBe(true);
    expect(ledger.cashCents).toBe(0);
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
    expect(profitableDays(ledger, 3)).toBe(1); // day 1 only: founding capital is not profit, and day 3 is still open
    expect(profitableDays(ledger, 4)).toBe(2);
  });
});
