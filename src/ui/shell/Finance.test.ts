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
  it('lists each kind with money in it, a dash for capital’s forecast, and each column’s change in cash', () => {
    const html = render({
      day: 2,
      quarter: 1,
      quarterFirstDay: 1,
      rows: [
        row('founding', 0, 42_720_000, 42_720_000, null),
        row('fares', 50_000, 120_000, 170_000, 143_100),
        row('purchase', 0, -35_600_000, -35_600_000, null),
        row('running', -20_000, -61_000, -81_000, -63_630),
        row('refund', 0, 0, 0, null),
      ],
    });
    expect(html).toContain('Q1 from day 1');
    expect(html).toContain('Founding capital');
    expect(html).not.toContain('Refunds'); // nothing in it
    expect(html).toMatch(/data-kind="founding"[^>]*>.*?<td>—<\/td><\/tr>/);
    expect(html).toContain('≈$1,431'); // the modelled fares forecast
    expect(html).toContain('data-today="30000"');
    expect(html).toContain('data-quarter="7209000"');
  });

  it('shows no yesterday on day 1', () => {
    const html = render({ day: 1, quarter: 1, quarterFirstDay: 1, rows: [row('founding', 42_720_000, 0, 42_720_000, null)] });
    expect(html).toMatch(/<th scope="row">Founding capital<\/th><td>\$427,200<\/td><td>—<\/td>/);
  });
});
