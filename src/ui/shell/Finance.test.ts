// The Finance panel (the M3 spec, item 6): each kind's row for today, yesterday and the quarter,
// a dash where a capital row has no forecast, and each column's change in cash.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FinanceView, Snapshot } from '../../sim/types';
import type { Sim } from '../game/useSim';
import { Finance } from './Finance';

const row = (kind: string, todayCents: number, yesterdayCents: number, quarterCents: number, forecastCents: number | null) => ({ kind, todayCents, yesterdayCents, quarterCents, forecastCents });

function render(finance: FinanceView): string {
  const sim = { snapshot: { finance } as unknown as Snapshot } as unknown as Sim;
  return renderToStaticMarkup(createElement(Finance, { sim, onClose: () => undefined }));
}

describe('the Finance panel', () => {
  // D25: "better labeling with more information about where the money is going ... keep the labels in
  // finance more general, having the starting days be like day 0". Shown failing (TS-04) on the old
  // panel: one Purchases row, Deadhead and Founding capital in the columns.
  it('lists each kind with money in it under where the money goes, in plain words, and each column’s change in cash', () => {
    const html = render({
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
    });
    expect(html).toContain('<th scope="col">Year 1, Q1</th>');
    expect(html).toContain('Starting cash on Day 0: $427,200');
    expect(html).not.toContain('data-kind="founding"'); // on Day 0, before every column
    expect(html.match(/data-group="(\w+)"/g)).toEqual(['data-group="income"', 'data-group="running"', 'data-group="capital"']);
    for (const words of ['Money in', 'Running costs', 'Buying and building', 'Bus fuel and maintenance', 'To and from the depot', 'Stop upkeep', 'Depots', 'New stops', 'Buses bought']) expect(html).toContain(words);
    for (const jargon of ['Deadhead', 'Purchases', 'Founding capital', 'Stops sold back']) expect(html).not.toContain(jargon); // the last has nothing in it
    expect(html).toContain('title="Fuel, wear and maintenance for every kilometre a bus drives"');
    expect(html).toContain('≈$1,431'); // the modelled fares forecast
    expect(html).toContain('data-today="28500"');
    expect(html).toContain('data-quarter="-35515500"');
  });

  it('shows no yesterday on day 1', () => {
    const html = render({ day: 1, quarter: 1, quarterFirstDay: 1, openingCents: 42_720_000, rows: [row('fares', 10_000, 0, 10_000, 9_000)] });
    expect(html).toMatch(/<th scope="row"[^>]*>Fares<\/th><td>\$100<\/td><td>—<\/td>/);
  });
});
