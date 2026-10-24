// The day card on a quarter's last day carries the report card (the M3 spec, item 9; exit check 3),
// and any day's card a contract paid or lapsed (item 11). A quarter takes ten game days, too long for
// the e2e tests, so the card is rendered here.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DayCard as DayCardData } from '../../sim/types';
import { copyProblem } from '../copyRules';
import { DayCard, stampOf } from './DayCard';
import type { Sim } from './useSim';

const render = (card: DayCardData) => renderToStaticMarkup(createElement(DayCard, { sim: { dayCard: card, closeDayCard: () => undefined } as unknown as Sim, handBack: () => undefined, byKey: () => false, panelBack: () => null }));
const report = { quarter: 1, coverage: 50.6, reliability: 100, comfort: 80, money: 66.5, overall: 74.3, payoutCents: 3_081_300 };
const rows = [
  { kind: 'fares', amountCents: 143_100, lineId: 1 },
  { kind: 'card', amountCents: 3_081_300, lineId: null },
];

describe('the day card at a quarter’s close', () => {
  it('grades the quarter and says what the city pays, as one of the day’s rows', () => {
    const html = render({ day: 8, rows, cashBeforeCents: 0, cashAfterCents: 3_224_400, report, contracts: [], events: [], medals: [] });
    expect(html).toMatch(/<h2 [^>]*>Year 1, Q1, Day 8 closed<\/h2>/);
    expect(html).toContain('Year 1, Q1 report card');
    for (const text of ['<th scope="row">Coverage</th><td>50</td>', '<th scope="row">Reliability</th><td>100</td>', '<th scope="row">Comfort</th><td>80</td>', '<th scope="row">Money</th><td>66</td>', '<th scope="row">Overall</th><td>74</td>']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('The city pays $30,813');
    expect(html).toContain('<th scope="row">City grant or fine</th><td>$30,813.00</td>');
  });

  // The grant, the fine and the medals compare each grade unrounded against whole-number bars
  // (economy/reportCard.ts, rules/medal.ts), so a grade shows its whole points, never rounded up past a
  // bar: an overall of 54.7 read "Overall 55" beside "The city neither pays nor fines" and no bronze.
  // Shown failing (TS-04) with the grades rounded to the nearest point.
  it('shows each grade as the bars judge it: 54.7 is not a grant’s 55, 34.7 is fined, 59.6 is under gold’s 60', () => {
    const html = render({ day: 8, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: { quarter: 1, coverage: 38.82, reliability: 77.22, comfort: 80, money: 59.6, overall: 54.69999, payoutCents: 0 }, contracts: [], events: [], medals: [] });
    expect(html).toContain('<th scope="row">Overall</th><td>54</td>');
    expect(html).toContain('The city neither pays nor fines');
    expect(html).toContain('<th scope="row">Money</th><td>59</td>');
    // The tests' hook too, which the medals spec reads against bronze's 55: 54.96 is 54.9, not 55.0.
    expect(render({ day: 8, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: { ...report, overall: 54.96, payoutCents: 0 }, contracts: [], events: [], medals: [] })).toContain('data-overall="54.9"');
    expect(render({ day: 8, rows: [], cashBeforeCents: 0, cashAfterCents: -640_000, report: { ...report, overall: 34.7, payoutCents: -640_000 }, contracts: [], events: [], medals: [] })).toContain('<th scope="row">Overall</th><td>34</td>');
    expect(render({ day: 8, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: { ...report, overall: 55, payoutCents: 0 }, contracts: [], events: [], medals: [] })).toContain('<th scope="row">Overall</th><td>55</td>');
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
    expect(html).toContain('<th scope="row">Contract rewards</th><td>$150,000.00</td>');
    expect(render({ day: 12, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [{ ...paid, outcome: 'lapsed' }], events: [], medals: [] })).toContain('Contract lapsed: every 15 min at Longwood');
    const riders = { landmark: 'Copley Square', kind: 'ridership' as const, ask: 400, rewardCents: 15_000_000, outcome: 'paid' as const };
    expect(render({ day: 12, rows: [], cashBeforeCents: 0, cashAfterCents: 15_000_000, report: null, contracts: [riders], events: [], medals: [] })).toContain('Contract met: 400 boardings a day at Copley Square, $150,000');
  });
});

// The first day in profit read "Day total -$355,257.78", its buses and stops counted in, and its running net of $742.22 showed
// in Finance alone, though the checklist's "Close a day in profit" counts that (the systems audit's seventeenth round). Shown
// failing (TS-04) with the card's rows as they were.
describe('the day card’s running', () => {
  it('says the day’s running apart from its total on a day that bought, and nothing more on a day that only ran', () => {
    const day1 = render({
      day: 1,
      rows: [
        { kind: 'fares', amountCents: 120_000, lineId: 1 },
        { kind: 'subsidy', amountCents: 85_000, lineId: 1 },
        { kind: 'wages', amountCents: -95_000, lineId: 1 },
        { kind: 'running', amountCents: -35_777, lineId: 1 },
        { kind: 'buses', amountCents: -19_000_000, lineId: 1 },
        { kind: 'stops', amountCents: -1_600_000, lineId: null },
      ],
      cashBeforeCents: 47_454_800,
      cashAfterCents: 26_929_023,
      report: null,
      contracts: [],
      events: [],
      medals: [],
    });
    expect(day1).toContain('<th scope="row">Day total</th><td>-$205,257.77</td>');
    expect(day1).toMatch(/<tr data-testid="day-running" data-cents="74223" title="Fares and subsidy less running costs"><th scope="row">Day’s running<\/th><td>\$742\.23<\/td><\/tr>/);
    const day2 = render({ day: 2, rows: [{ kind: 'fares', amountCents: 135_225, lineId: 1 }, { kind: 'wages', amountCents: -60_000, lineId: 1 }], cashBeforeCents: 0, cashAfterCents: 75_225, report: null, contracts: [], events: [], medals: [] });
    expect(day2).not.toContain('Day’s running');
  });
});

describe('the day card when a city event is rolled or over', () => {
  // Rolled at a close, an event starts the day after the next, and the closed day's card said "tomorrow", read as the next day,
  // all of which the works were still to come (the systems audit's seventeenth round). It names the day they start. Shown failing
  // (TS-04) with "tomorrow" in its place.
  it('names roadworks rolled at the close by the day they start, for how long, and roadworks just over (the M4 spec, item 2)', () => {
    const html = render({ day: 6, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [{ kind: 'roadworks', street: 'Huntington Avenue', startDay: 8, days: 4, news: 'tomorrow' }], medals: [] });
    expect(html).toContain('Roadworks on Huntington Avenue from Q1 Day 8, for 4 days');
    expect(render({ day: 7, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [{ kind: 'roadworks', street: 'Huntington Avenue', startDay: 9, days: 2, news: 'tomorrow' }], medals: [] })).toContain('Roadworks on Huntington Avenue from Q2 Day 1, for 2 days');
    expect(render({ day: 9, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [{ kind: 'roadworks', street: 'Huntington Avenue', startDay: 6, days: 4, news: 'over' }], medals: [] })).toContain('Roadworks on Huntington Avenue are over');
  });

  it('names snow and a festival by the day they start, and when they are over', () => {
    const card = (kind: 'festival' | 'snow', street: string, days: number, news: 'tomorrow' | 'over') => render({ day: 6, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [{ kind, street, startDay: news === 'tomorrow' ? 8 : 5, days, news }], medals: [] });
    expect(card('snow', '', 1, 'tomorrow')).toContain('Snow from Q1 Day 8, for 1 day: every bus drives slower');
    expect(card('snow', '', 2, 'over')).toContain('The snow is over');
    expect(card('festival', 'Copley Square', 2, 'tomorrow')).toContain('A festival near Copley Square from Q1 Day 8, for 2 days: more riders to and from there');
    expect(card('festival', 'Copley Square', 2, 'over')).toContain('The festival near Copley Square is over');
  });
});

describe('the day card when a medal is awarded', () => {
  it('names each medal and what earned it, and says the Goliath is for sale at silver (the M4 spec, item 3)', () => {
    const html = render({ day: 10, rows, cashBeforeCents: 0, cashAfterCents: 3_224_400, report, contracts: [], events: [], medals: ['bronze', 'silver'] });
    expect(html).toContain('Bronze medal: a quarter graded 55 or better');
    expect(html).toContain('Silver medal: 25,000 trips carried · the Goliath is for sale');
    expect(render({ day: 30, rows: [], cashBeforeCents: 0, cashAfterCents: 0, report, contracts: [], events: [], medals: ['gold'] })).toContain('Gold medal: a quarter graded 75 or better, no grade under 60, on a day of 5,000 trips');
    expect(render({ day: 9, rows, cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [], medals: [] })).not.toContain('medal');
  });
});

describe('the report card’s stamp', () => {
  // The city's word on the quarter (PLAN §4's charm moments), from the payout as the line under the grades reads it: one
  // predicate for both (stampOf). A screen reader hears the line, so the stamp is hidden from it.
  it('says what the city does, as the line under the grades does, in the copy convention', () => {
    expect([3_081_300, 0, -1_200_000].map(stampOf)).toEqual(['Approved', 'Noted', 'Fined']);
    for (const word of ['Approved', 'Noted', 'Fined']) expect(copyProblem(word), word).toBeNull();
    const card = (payoutCents: number) => render({ day: 8, rows, cashBeforeCents: 0, cashAfterCents: 0, report: { ...report, payoutCents }, contracts: [], events: [], medals: [] });
    const stamp = (word: string) => `<span class="stamp" data-testid="report-stamp" data-stamp="${word}" aria-hidden="true">${word}</span>`;
    expect(card(3_081_300)).toContain(stamp('Approved'));
    expect(card(3_081_300)).toContain('The city pays $30,813');
    expect(card(0)).toContain(stamp('Noted'));
    expect(card(0)).toContain('The city neither pays nor fines');
    expect(card(-1_200_000)).toContain(stamp('Fined'));
    expect(card(-1_200_000)).toContain('The city fines $12,000');
    expect(render({ day: 9, rows, cashBeforeCents: 0, cashAfterCents: 0, report: null, contracts: [], events: [], medals: [] })).not.toContain('stamp');
  });

  it('reads a payout or a fine under a dollar in cents, never Approved over "$0"', () => {
    // An overall a hair over the grant's bar pays cents: whole dollars read $0 under the city's Approved (round 10).
    const card = (payoutCents: number) => render({ day: 8, rows, cashBeforeCents: 0, cashAfterCents: 0, report: { ...report, payoutCents }, contracts: [], events: [], medals: [] });
    expect(card(64)).toContain('data-stamp="Approved"');
    expect(card(64)).toContain('The city pays $0.64<');
    expect(card(-37)).toContain('data-stamp="Fined"');
    expect(card(-37)).toContain('The city fines $0.37<');
    expect(card(100)).toContain('The city pays $1<');
  });
});
