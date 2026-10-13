import { describe, expect, it } from 'vitest';
import { about, clock, usd } from './format';

describe('number copy', () => {
  it('formats cents exactly, negatives included', () => {
    expect(usd(31_320_000)).toBe('$313,200');
    expect(usd(123_456, { cents: true })).toBe('$1,234.56');
    expect(usd(-150, { cents: true })).toBe('-$1.50');
    expect(usd(-150)).toBe('-$1');
    expect(usd(5, { cents: true })).toBe('$0.05');
  });
  it('rounds modelled counts to two significant figures', () => {
    expect(about(9_137)).toBe('≈9,100');
    expect(about(53_454)).toBe('≈53,000');
    expect(about(87)).toBe('≈87');
    expect(about(0)).toBe('0');
  });
  it('pads the clock', () => expect(clock(5, 0)).toBe('05:00'));
});
