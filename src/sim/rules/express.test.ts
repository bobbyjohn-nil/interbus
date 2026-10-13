// The express rule (the M4 spec, below the cut): V1's thresholds, each at its edge. The founding
// recipe and the debug line are not express (K16: a starter that was paid +$3,167 a day for it).
import { describe, expect, it } from 'vitest';
import { STARTER_ROUTE_M, STARTER_STOPS } from '../config/economy';
import { isExpress } from './express';

describe('an express line', () => {
  it('is at least 5 km with its stops at least 1,200 m apart on average, and at least three of them', () => {
    expect(isExpress(5_000, 5)).toBe(true); // 1,250 m apart
    expect(isExpress(4_999, 5)).toBe(false);
    expect(isExpress(6_000, 6)).toBe(true); // 1,200 m apart
    expect(isExpress(6_000, 7)).toBe(false); // 1,000 m apart
    expect(isExpress(9_000, 2)).toBe(false); // two stops are a shuttle, not a line with stops skipped
  });

  it('leaves the founding recipe and the debug line (3,535 m, four stops) local', () => {
    expect(isExpress(STARTER_ROUTE_M, STARTER_STOPS)).toBe(false);
    expect(isExpress(3_535, 4)).toBe(false);
  });
});
