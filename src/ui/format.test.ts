import { describe, expect, it } from 'vitest';
import { about, clock, every, figureText, km, usd, usdK } from './format';
import { contractMet } from '../sim/rules/contract';

describe('number copy', () => {
  it('formats cents exactly, negatives included', () => {
    expect(usd(31_320_000)).toBe('$313,200');
    expect(usd(123_456, { cents: true })).toBe('$1,234.56');
    expect(usd(-150, { cents: true })).toBe('-$1.50');
    expect(usd(-150)).toBe('-$1');
    expect(usd(5, { cents: true })).toBe('$0.05');
    // Never "-$0": Finance's today column read -$0 for a few cents of wages.
    expect([usd(-20), usd(-99), usd(-100), usd(-0.4, { cents: true }), usd(-1, { cents: true })]).toEqual(['$0', '$0', '-$1', '$0.00', '-$0.01']);
  });
  it('rounds modelled counts to two significant figures', () => {
    expect(about(9_137)).toBe('≈9,100');
    expect(about(53_454)).toBe('≈53,000');
    expect(about(87)).toBe('≈87');
    expect(about(0)).toBe('0');
  });
  it('pads the clock', () => expect(clock(5, 0)).toBe('05:00'));
  it('prices cards in thousands when that is exact', () => {
    expect(usdK(19_000_000)).toBe('$190k');
    expect(usdK(20_600_000)).toBe('$206k');
    expect(usdK(2_380_000)).toBe('$23.8k');
    expect(usdK(2_385_000)).toBe('$23,850');
    expect(usdK(90_000)).toBe('$900');
    expect(usdK(-9_500_000)).toBe('-$95k');
  });
  it('reads distances and headways', () => {
    expect(km(3_535)).toBe('3.5 km');
    expect(every(1_200)).toBe('every 20 min');
    expect(every(450)).toBe('every 7.5 min');
  });
  it('rounds a HEADWAY figure toward the verdict it is coloured by, so one over the ask never reads as it', () => {
    // The systems audit's fifth round (D26): two 20-minute lines at Copley, one of them a second slower in snow, run every
    // 600.2499 s against the 10-minute ask, short by contractMet, and read "every 10 min" in red; a
    // line a second over a 20-minute ask read "every 20.0 min". Shown failing (TS-04) on Math.round.
    const cases: [figure: number, ask: number, text: string][] = [
      [600.2499, 600, 'every 10 min 1 s'],
      [1_201, 1_200, 'every 20 min 1 s'],
      [600.0000001, 600, 'every 10 min'],
      [599.6, 600, 'every 10 min'],
      [599.4, 600, 'every 9 min 59 s'],
      [1_200, 900, 'every 20 min'],
      [1_201, 600, 'every 20 min 1 s'],
      [514.2857, 600, 'every 8.6 min'],
      [1_235, 900, 'every 20.6 min'],
      // Float noise on whole seconds, as lines every 34 and 51 minutes give: never a second more.
      [1 / (1 / 2_040 + 1 / 3_060), 1_200, 'every 20 min 24 s'],
      [1_200.0000000000002, 900, 'every 20 min'],
    ];
    for (const [figure, ask, text] of cases) expect.soft(figureText('headway', figure, ask), `${figure} s against ${ask} s`).toBe(text);
    // Every figure within a minute and a half of each ask, a twentieth of a second apart: what it reads
    // as is at or under the ask exactly when the rule (contractMet) says it meets it.
    const shown = (text: string) => {
      const m = /^every (?:(\d+(?:\.\d)?) min)? ?(?:(\d+) s)?$/.exec(text);
      if (!m) throw new Error(text);
      return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
    };
    for (const ask of [600, 900, 1_200]) {
      for (let k = -1_800; k <= 1_800; k++) {
        const figure = ask + k / 20;
        expect(shown(figureText('headway', figure, ask)) <= ask, `${figure} s against ${ask} s`).toBe(contractMet('headway', figure, ask));
      }
    }
  });
});
