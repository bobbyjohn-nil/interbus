// The day card on a quarter's last day carries the report card (the M3 spec, item 9; exit check 3),
// and any day's card a contract paid or lapsed (item 11). A quarter takes ten game days, too long for
// the e2e tests, so the card is rendered here.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DayCard as DayCardData } from '../../sim/types';
import { DayCard } from './DayCard';
import type { Sim } from './useSim';

const render = (card: DayCardData) => renderToStaticMarkup(createElement(DayCard, { sim: { dayCard: card, closeDayCard: () => undefined } as unknown as Sim }));
const report = { quarter: 1, coverage: 50.6, reliability: 100, comfort: 80, money: 66.5, overall: 74.3, payoutCents: 3_081_300 };
const rows = [
  { kind: 'fares', amountCents: 143_100, lineId: 1 },
  { kind: 'card', amountCents: 3_081_300, lineId: null },
];

describe('the day card at a quarter’s close', () => {
  it('grades the quarter and says what the city pays, as one of the day’s rows', () => {
    const html = render({ day: 8, rows, cashBeforeCents: 0, cashAfterCents: 3_224_400, report, contracts: [], events: [], medals: [] });
    expect(html).toContain('<h2>Year 1, Q1, Day 8 closed</h2>');
    expect(html).toContain('Year 1, Q1 report card');
    for (const text of ['<th scope="row">Coverage</th><td>51</td>', '<th scope="row">Reliability</th><td>100</td>', '<th scope="row">Comfort</th><td>80</td>', '<th scope="row">Money</th><td>67</td>', '<th scope="row">Overall</th><td>74</td>']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('The city pays $30,813');
    expect(html).toContain('<th scope="row">Report card</th><td>$30,813.00</td>');
  });

  it('says so when the city fines, and shows no card on other days', () => {
    expect(render({ day: 8, rows: [], cashBeforeCents: 0, cashAfterCents: -640_000, report: { ...report, overall: 0, payoutCents: -640_000 }, contracts: [], events: [], medals: [] })).toContain('The city fines $6,400');
    expect(render({ day: 9, rows, cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [], medals: [] })).not.toContain('report card');
  });
});

describe('the day card when a contract closes', () => {
  it('names a contract paid, beside its Contracts row, and one lapsed', () => {
    const paid = { landmark: 'Longwood', kind: 'headway' as const, ask: 900, rewardCents: 15_000_000, outcome: 'paid' as const };
    const html = render({ day: 12, rows: [{ kind: 'contract', amountCents: 15_000_000, lineId: null }], cashBeforeCents: 0, cashAfterCents: 15_000_000, report: null, contracts: [paid], events: [], medals: [] });
    expect(html).toContain('Contract met: every 15 min at Longwood, $150,000');
    expect(html).toContain('<th scope="row">Contracts</th><td>$150,000.00</td>');
    expect(render({ day: 12, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [{ ...paid, outcome: 'lapsed' }], events: [], medals: [] })).toContain('Contract lapsed: every 15 min at Longwood');
    const riders = { landmark: 'Copley Square', kind: 'ridership' as const, ask: 400, rewardCents: 15_000_000, outcome: 'paid' as const };
    expect(render({ day: 12, rows: [], cashBeforeCents: 0, cashAfterCents: 15_000_000, report: null, contracts: [riders], events: [], medals: [] })).toContain('Contract met: 400 boardings a day at Copley Square, $150,000');
  });
});

describe('the day card when a city event is rolled or over', () => {
  it('names roadworks rolled for tomorrow, for how long, and roadworks just over (the M4 spec, item 2)', () => {
    const html = render({ day: 6, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [{ kind: 'roadworks', street: 'Huntington Avenue', days: 4, news: 'tomorrow' }], medals: [] });
    expect(html).toContain('Roadworks on Huntington Avenue tomorrow, for 4 days');
    expect(render({ day: 9, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [{ kind: 'roadworks', street: 'Huntington Avenue', days: 4, news: 'over' }], medals: [] })).toContain('Roadworks on Huntington Avenue are over');
  });

  it('names snow and a festival the evening before, and when they are over', () => {
    const card = (kind: 'festival' | 'snow', street: string, days: number, news: 'tomorrow' | 'over') => render({ day: 6, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [{ kind, street, days, news }], medals: [] });
    expect(card('snow', '', 1, 'tomorrow')).toContain('Snow tomorrow, for 1 day: every bus drives slower');
    expect(card('snow', '', 2, 'over')).toContain('The snow is over');
    expect(card('festival', 'Copley Square', 2, 'tomorrow')).toContain('A festival near Copley Square tomorrow, for 2 days: more riders to and from there');
    expect(card('festival', 'Copley Square', 2, 'over')).toContain('The festival near Copley Square is over');
  });
});

describe('the day card when a medal is awarded', () => {
  it('names each medal and what earned it, and says the Goliath is for sale at silver (the M4 spec, item 3)', () => {
    const html = render({ day: 10, rows, cashBeforeCents: 0, cashAfterCents: 3_224_400, report, contracts: [], events: [], medals: ['bronze', 'silver'] });
    expect(html).toContain('Bronze medal: a quarter graded 55 or better');
    expect(html).toContain('Silver medal: 25,000 trips carried. The Goliath is for sale');
    expect(render({ day: 30, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report, contracts: [], events: [], medals: ['gold'] })).toContain('Gold medal: a quarter graded 75 or better, no grade under 60, on a day of 5,000 trips');
    expect(render({ day: 9, rows, cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [], medals: [] })).not.toContain('medal');
  });
});
