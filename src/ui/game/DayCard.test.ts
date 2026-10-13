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
    const html = render({ day: 10, rows, cashBeforeCents: 0, cashAfterCents: 3_224_400, report, contracts: [], events: [] });
    expect(html).toContain('Quarter 1 report card');
    for (const text of ['<th scope="row">Coverage</th><td>51</td>', '<th scope="row">Reliability</th><td>100</td>', '<th scope="row">Comfort</th><td>80</td>', '<th scope="row">Money</th><td>67</td>', '<th scope="row">Overall</th><td>74</td>']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('The city pays $30,813');
    expect(html).toContain('<th scope="row">Report card</th><td>$30,813.00</td>');
  });

  it('says so when the city fines, and shows no card on other days', () => {
    expect(render({ day: 10, rows: [], cashBeforeCents: 0, cashAfterCents: -800_000, report: { ...report, overall: 0, payoutCents: -800_000 }, contracts: [], events: [] })).toContain('The city fines $8,000');
    expect(render({ day: 9, rows, cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [] })).not.toContain('report card');
  });
});

describe('the day card when a contract closes', () => {
  it('names a contract paid, beside its Contracts row, and one lapsed', () => {
    const paid = { landmark: 'Longwood', kind: 'headway' as const, ask: 900, rewardCents: 15_000_000, outcome: 'paid' as const };
    const html = render({ day: 12, rows: [{ kind: 'contract', amountCents: 15_000_000, lineId: null }], cashBeforeCents: 0, cashAfterCents: 15_000_000, report: null, contracts: [paid], events: [] });
    expect(html).toContain('Contract met: every 15 min at Longwood, $150,000');
    expect(html).toContain('<th scope="row">Contracts</th><td>$150,000.00</td>');
    expect(render({ day: 12, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [{ ...paid, outcome: 'lapsed' }], events: [] })).toContain('Contract lapsed: every 15 min at Longwood');
    const riders = { landmark: 'Copley Square', kind: 'ridership' as const, ask: 400, rewardCents: 15_000_000, outcome: 'paid' as const };
    expect(render({ day: 12, rows: [], cashBeforeCents: 0, cashAfterCents: 15_000_000, report: null, contracts: [riders], events: [] })).toContain('Contract met: 400 boardings a day at Copley Square, $150,000');
  });
});

describe('the day card when a city event is rolled or over', () => {
  it('names roadworks rolled for tomorrow, for how long, and roadworks just over (the M4 spec, item 2)', () => {
    const html = render({ day: 6, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [{ kind: 'roadworks', street: 'Huntington Avenue', days: 4, news: 'tomorrow' }] });
    expect(html).toContain('Roadworks on Huntington Avenue tomorrow, for 4 days');
    expect(render({ day: 9, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [{ kind: 'roadworks', street: 'Huntington Avenue', days: 4, news: 'over' }] })).toContain('Roadworks on Huntington Avenue are over');
  });
});
