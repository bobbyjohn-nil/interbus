// The Finance panel (the M3 spec, item 6): each kind's row for today, yesterday and the quarter,
// a dash where a capital row has no forecast, and each column's change in cash.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FinanceView, LineView, Snapshot } from '../../sim/types';
import type { Sim } from '../game/useSim';
import { Breakdown, Finance, type FinanceViewName } from './Finance';

const row = (kind: string, todayCents: number, yesterdayCents: number, quarterCents: number, forecastCents: number | null) => ({ kind, todayCents, yesterdayCents, quarterCents, forecastCents });

type Money = Omit<FinanceView, 'days' | 'lines'> & Partial<Pick<FinanceView, 'days' | 'lines'>>;

function render(money: Money, view: FinanceViewName = 'breakdown', lines: readonly Partial<LineView>[] = []): string {
  const finance: FinanceView = { days: [], lines: [], ...money };
  const sim = { snapshot: { finance, lines, linesVersion: 0 } as unknown as Snapshot, fareBand: null, fareBandFor: () => undefined, send: () => undefined } as unknown as Sim;
  return renderToStaticMarkup(createElement(Finance, { sim, onClose: () => undefined, view }));
}

/** The chart's axis labels, left to right. */
const axis = (html: string) => [...html.matchAll(/<text x="[^"]*" y="[^"]*" text-anchor="middle">([^<]*)<\/text>/g)].map((m) => m[1]);

/** The Breakdown with every group open, as after a click on each folded heading. */
function renderOpen(money: Money): string {
  const finance: FinanceView = { days: [], lines: [], ...money };
  const total = (pick: (r: FinanceView['rows'][number]) => number) => finance.rows.reduce((s, r) => s + pick(r), 0);
  return renderToStaticMarkup(createElement(Breakdown, { finance, today: total((r) => r.todayCents), quarter: total((r) => r.quarterCents), fold: [] }));
}

describe('the Finance panel', () => {
  // D25: "better labeling with more information about where the money is going ... keep the labels in
  // finance more general, having the starting days be like day 0". Shown failing (TS-04) on the old
  // panel: one Purchases row, Deadhead and Founding capital in the columns.
  it('lists each kind with money in it under where the money goes, in plain words, and each column’s change in cash', () => {
    const money = {
      day: 2,
      quarter: 1,
      quarterFirstDay: 1,
      openingCents: 42_720_000,
      rows: [
        row('founding', 0, 0, 0, null),
        row('fares', 50_000, 120_000, 170_000, 143_100),
        row('running', -20_000, -61_000, -81_000, -63_630),
        row('deadhead', -1_000, -1_400, -2_400, -1_376),
        row('stopUpkeep', -500, -1_600, -2_100, -1_600),
        row('depots', 0, -15_000_000, -15_000_000, null),
        row('stops', 0, -1_600_000, -1_600_000, null),
        row('buses', 0, -19_000_000, -19_000_000, null),
        row('stopSales', 0, 0, 0, null),
      ],
    };
    const html = render(money);
    expect(html).toContain('<th scope="col">Year 1, Q1</th>');
    expect(html).not.toContain('data-kind="founding"'); // on Day 0, before every column
    expect(html.match(/data-group="(\w+)"/g)).toEqual(['data-group="income"', 'data-group="running"', 'data-group="capital"']);
    for (const words of ['Money in', 'Running costs', 'Buying and building', 'Bus fuel and maintenance', 'To and from the depot', 'Stop upkeep']) expect(html).toContain(words);
    // Buying and building starts folded, its subtotals on its heading, so a late game's table stays
    // inside I13's panel budget; a click opens it.
    expect(html).toContain('data-group="capital" data-open="no"><th scope="rowgroup"><button type="button" aria-expanded="false">Buying and building</button></th><td>$0</td><td>-$356,000</td><td>-$356,000</td><td>—</td>');
    expect(html).not.toContain('data-kind="depots"');
    const open = renderOpen(money);
    for (const words of ['Depots', 'New stops', 'Buses bought']) expect(open).toContain(words);
    for (const jargon of ['Deadhead', 'Purchases', 'Founding capital', 'Stops sold back']) expect(open).not.toContain(jargon); // the last has nothing in it
    expect(html).toContain('title="Fuel, wear and maintenance for every kilometer a bus drives"');
    expect(html).toContain('≈$1,431'); // the modelled fares forecast
    expect(html).toContain('data-today="28500"');
    expect(html).toContain('data-quarter="-35515500"');
  });

  it('shows no yesterday on day 1', () => {
    const html = render({ day: 1, quarter: 1, quarterFirstDay: 1, openingCents: 42_720_000, rows: [row('fares', 10_000, 0, 10_000, 9_000)] });
    expect(html).toMatch(/<th scope="row"[^>]*>Fares<\/th><td>\$100<\/td><td>—<\/td>/);
  });
});

// D25: "it would be better with some visuals"; "finances should be in the finances tab". Shown failing
// (TS-04) on the panel before the views, which had no chart and no line's money.
describe('Finance’s views', () => {
  const days = [1, 2, 3].map((day) => ({ day, inCents: 200_000 + day, outCents: -150_000, capitalCents: day === 1 ? -35_600_000 : 0, cashCents: 42_720_000 + day }));
  const base = { day: 3, quarter: 1, quarterFirstDay: 1, openingCents: 42_720_000, rows: [row('fares', 1, 2, 3, 4)], days };

  it('opens on the Overview: cash, a chart from Day 0, its days and what each bought', () => {
    const html = render(base, 'overview');
    expect(html).toContain('data-view="overview"');
    // Only the chosen view is in the Tab order, as Lines' chosen tab is (the systems audit's ninth round).
    expect(html).toContain('aria-selected="true" tabindex="0" data-testid="finance-overview"');
    expect(html).toContain('aria-selected="false" tabindex="-1" data-testid="finance-breakdown"');
    expect(html).toContain('data-testid="finance-chart" data-days="3"');
    expect(html).toContain('<title>Day 0: starting cash $427,200</title>');
    expect(html.match(/<g class="day[^"]*"/g)).toHaveLength(3);
    expect(html).toContain('<g class="day today" data-day="3"');
    expect(html.match(/class="capital"/g)).toHaveLength(1); // day 1's purchases
    expect(html).toContain('role="img" aria-label="Cash $427,200 on Year 1, Q1, Day 3, from $427,200 on Day 0"');
    expect(html).toContain('Day 0: starting cash $427,200</p>');
    expect(axis(html)).toEqual(['Day 0', 'Day 1', 'Day 3']);
  });

  // The systems audit (D26): the chart named a day by its count since founding ("Day 9", "Day 10")
  // while the top bar read "Year 1, Q2 Day 1" and the day card "Year 1, Q2, Day 1 closed". Shown failing
  // (TS-04) on the chart before: its axis read Day 0, Day 1, Day 9 and Day 10, and its titles and
  // accessible name "Day 9" and "Day 10".
  it('names its days as the calendar does across a quarter’s end, the quarter on the axis once two show', () => {
    const across = [...Array(10).keys()].map((k) => ({ day: k + 1, inCents: 110_100, outCents: -7_900, capitalCents: 0, cashCents: 47_000_000 + k }));
    const html = render({ ...base, day: 10, quarter: 2, quarterFirstDay: 9, openingCents: 47_454_800, days: across }, 'overview');
    expect(html).toContain('role="img" aria-label="Cash $470,000 on Year 1, Q2, Day 2, from $474,548 on Day 0"');
    expect(html).toContain('<title>Year 1, Q2, Day 1: $1,101 in, $79 running costs</title>');
    expect(html).toContain('<title>Year 1, Q2, Day 2 so far: $1,101 in, $79 running costs</title>');
    expect(html).toContain('<title>Year 1, Q1, Day 8: cash $470,000</title>');
    expect(html).toContain('<title>Day 0: starting cash $474,548</title>');
    // Today and Day 0. At 12 px Q1's first day, 36 units beside Day 0, would crowd it, as Q2's would crowd today.
    expect(axis(html)).toEqual(['Day 0', 'Q2 Day 2']);
    expect(html).not.toMatch(/Day (9|10)\b/);
  });

  it('names a late chart’s first day, each quarter’s first and today, a year’s end among them', () => {
    const late = (first: number) => [...Array(16).keys()].map((k) => ({ day: first + k, inCents: 1, outCents: -1, capitalCents: 0, cashCents: 1_000_000 + k }));
    const third = render({ ...base, day: 20, quarter: 3, quarterFirstDay: 17, days: late(5) }, 'overview');
    expect(third).toContain('aria-label="Cash $10,000 on Year 1, Q3, Day 4, from $10,000 on Year 1, Q1, Day 5"');
    expect(axis(third)).toEqual(['Q1 Day 5', 'Q2 Day 1', 'Q3 Day 1', 'Q3 Day 4']);
    const yearEnd = render({ ...base, day: 40, quarter: 1, quarterFirstDay: 33, days: late(25) }, 'overview');
    expect(yearEnd).toContain('from $10,000 on Year 1, Q4, Day 1"');
    expect(yearEnd).toContain('<title>Year 2, Q1, Day 8 so far:');
    expect(axis(yearEnd)).toEqual(['Q4 Day 1', 'Q1 Day 1', 'Q1 Day 8']);
  });

  it('lists each line’s money and its fare in Lines, the fare a custom dropdown', () => {
    const line = { id: 1, name: 'Line 1', colour: '#c0392b', ridersPerDay: 610, fareCents: 225 };
    const html = render({ ...base, lines: [{ id: 1, yesterdayInCents: 230_000, yesterdayOutCents: -130_000, incomeCents: 233_000, forecastCents: { running: 34_000, wages: 97_000, deadhead: 1_400 } }] }, 'lines', [line]);
    expect(html).toContain('data-testid="line-money-1" data-line="1" data-running="34000" data-net="100600"');
    expect(html).toContain('aria-label="Fare for Line 1"');
    expect(html).not.toContain('<select');
    expect(html).toContain('$1,000'); // yesterday: $2,300 in less $1,300 out
    expect(html).toContain('Bus fuel and maintenance'); // the first line opens, with its split
  });
});
