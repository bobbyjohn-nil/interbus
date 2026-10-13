// The fare rule and the subsidy taper (the M3 spec, item 4). Shown failing (TS-04): with the flat
// subsidy restored, $3.75 earns the full $1.60 a boarding.
import { describe, expect, it } from 'vitest';
import { checkFare, FARES_CENTS, subsidyCents } from './fare';

describe('a line’s fare', () => {
  it('runs from $1.00 to $5.00 in 25¢ steps', () => {
    expect(FARES_CENTS).toHaveLength(17);
    expect([FARES_CENTS[0], FARES_CENTS[4], FARES_CENTS.at(-1)]).toEqual([100, 200, 500]);
    expect(checkFare(225, 300)).toEqual({ ok: true });
    expect(checkFare(225, 75)).toMatchObject({ ok: false, reason: 'fare_out_of_range' });
    expect(checkFare(225, 525)).toMatchObject({ ok: false, reason: 'fare_out_of_range' });
    expect(checkFare(225, 230)).toMatchObject({ ok: false, reason: 'fare_not_a_step', limit: 25 });
    expect(checkFare(225, 225)).toMatchObject({ ok: false, reason: 'same_fare' });
    expect(checkFare(225, 2.5)).toMatchObject({ ok: false, reason: 'fare_out_of_range' });
  });

  it('keeps the whole subsidy at $2.25 or less, and tapers it to nothing at $5.00 by the square of the gap', () => {
    expect(subsidyCents(100)).toBe(160);
    expect(subsidyCents(225)).toBe(160);
    expect(subsidyCents(300)).toBe(148); // 160 × (1 − (75 ÷ 275)²) = 148.1
    expect(subsidyCents(375)).toBe(112); // 160 × (1 − (150 ÷ 275)²) = 112.4
    expect(subsidyCents(500)).toBe(0);
  });
});
