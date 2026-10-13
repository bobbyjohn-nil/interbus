// The medal ladder's bars (the M4 spec, item 3): each one exactly at its bar, and each held medal
// never awarded again.
import { describe, expect, it } from 'vitest';
import { GOLIATH, METRO_40, SPARROW } from '../config/fleet';
import { medalsEarned, modelLocked, NO_MEDALS, tripsToSilver } from './medal';

const card = { coverage: 75, reliability: 75, comfort: 75, money: 75, overall: 75 };
const close = { card, tripsCarried: 25_000, tripsToday: 5_000 };

describe('the medal ladder', () => {
  it('awards bronze at a quarter graded 55, not 54.99, and never on a day with no card', () => {
    const quiet = { tripsCarried: 0, tripsToday: 0 };
    expect(medalsEarned(NO_MEDALS, { ...quiet, card: { ...card, overall: 55 } })).toEqual(['bronze']);
    expect(medalsEarned(NO_MEDALS, { ...quiet, card: { ...card, overall: 54.99 } })).toEqual([]);
    expect(medalsEarned(NO_MEDALS, { ...quiet, card: null })).toEqual([]);
  });

  it('awards silver at 25,000 trips carried, card or none', () => {
    expect(medalsEarned(NO_MEDALS, { card: null, tripsCarried: 25_000, tripsToday: 0 })).toEqual(['silver']);
    expect(medalsEarned(NO_MEDALS, { card: null, tripsCarried: 24_999, tripsToday: 0 })).toEqual([]);
  });

  it('awards gold only with every bar met: overall 75, no grade under 60, 5,000 trips on the day', () => {
    expect(medalsEarned(NO_MEDALS, close)).toEqual(['bronze', 'silver', 'gold']);
    const held = { bronze: 10, silver: 12, gold: null };
    expect(medalsEarned(held, close)).toEqual(['gold']);
    expect(medalsEarned(held, { ...close, card: { ...card, overall: 74.9 } })).toEqual([]);
    expect(medalsEarned(held, { ...close, card: { ...card, money: 59.9, overall: 80 } })).toEqual([]);
    expect(medalsEarned(held, { ...close, tripsToday: 4_999 })).toEqual([]);
    expect(medalsEarned(held, { ...close, card: null })).toEqual([]);
  });

  it('never awards a medal already held', () => {
    expect(medalsEarned({ bronze: 10, silver: 41, gold: 60 }, close)).toEqual([]);
  });

  it('counts the trips left to silver, none once it is held', () => {
    expect(tripsToSilver(NO_MEDALS, 0)).toBe(25_000);
    expect(tripsToSilver(NO_MEDALS, 18_450)).toBe(6_550);
    expect(tripsToSilver(NO_MEDALS, 30_000)).toBe(0);
    expect(tripsToSilver({ ...NO_MEDALS, silver: 41 }, 25_010)).toBe(0);
  });

  it('keeps the Goliath locked until silver, bronze or not, and never the Sparrow or the Metro 40', () => {
    expect(modelLocked(GOLIATH, NO_MEDALS)).toBe(true);
    expect(modelLocked(GOLIATH, { ...NO_MEDALS, bronze: 10 })).toBe(true);
    expect(modelLocked(GOLIATH, { ...NO_MEDALS, silver: 41 })).toBe(false);
    expect(modelLocked(SPARROW, NO_MEDALS) || modelLocked(METRO_40, NO_MEDALS)).toBe(false);
  });
});
