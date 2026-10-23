import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { about, clock, eventNewsText, every, figureText, km, streetName, usd, usdK } from './format';
import { copyProblem } from './copyRules';
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

// The systems audit's twelfth round: the city's street names are OpenStreetMap's, and 25 of Inner Boston's 3,535 broke the copy
// convention in the game's own sentences (D25): "Roadworks on Monsignor O'Brien Highway tomorrow, for 4 days" on the day card, and
// "roadworks on Monsignor O'Brien Highway add 1 min 1 s" on the line card. 19 had a straight apostrophe, 6 were a route's number
// in capitals (MA 2A, US 1), and one a street's initials (RC Kelley Street).
describe('a street’s name in the game’s sentences', () => {
  // The day card's notices take the event's street as the sim names it; the line card's words typeset it as LineCard.tsx does.
  const sentences = (street: string) => [
    eventNewsText({ kind: 'roadworks', street, days: 4, news: 'tomorrow' }),
    eventNewsText({ kind: 'roadworks', street, days: 1, news: 'over' }),
    eventNewsText({ kind: 'festival', street, days: 2, news: 'tomorrow' }),
    `Round trip 15 min at peak, 13 min off-peak · roadworks on ${streetName(street)} add 1 min 1 s`,
  ];

  it('takes a curly apostrophe, and a route’s number as Boston says it', () => {
    expect(streetName("Monsignor O'Brien Highway")).toBe('Monsignor O’Brien Highway');
    expect(streetName("Saint John's Road Extension")).toBe('Saint John’s Road Extension');
    expect(streetName('MA 2A')).toBe('Route 2A');
    expect(streetName('US 1')).toBe('Route 1');
    expect(streetName('Massachusetts Avenue')).toBe('Massachusetts Avenue');
    for (const street of ["Monsignor O'Brien Highway", 'MA 2A', 'US 1', 'RC Kelley Street']) {
      for (const text of sentences(street)) expect(copyProblem(text), text).toBeNull();
    }
  });

  const index = JSON.parse(readFileSync('cities/index.json', 'utf8')) as { cities: { sim: { file: string } }[] };
  const innerFile = `public/cities/${index.cities[0]!.sim.file}`;
  it.skipIf(!existsSync(innerFile))('keeps the convention for every street of Inner Boston', () => {
    const names = (JSON.parse(readFileSync(innerFile, 'utf8')) as { names: string[] }).names.filter(Boolean);
    expect(names.length).toBeGreaterThan(3_000);
    const broken = names.flatMap((street) => sentences(street).flatMap((text) => (copyProblem(text) ? [`${copyProblem(text)}: ${text}`] : [])));
    expect(broken).toEqual([]);
  });
});
