// The failure floor on the page (the M3 spec, item 10; exit check 4): the countdown chip while cash
// is below −$150k, and the card that ends the run with Restart this quarter.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../../sim/types';
import { TopBar } from '../shell/TopBar';
import { FailureCard } from './FailureCard';
import type { Sim } from './useSim';

function sim(floor: Snapshot['floor']): Sim {
  const snapshot = {
    elapsed: 0, day: 3, hour: 9, minute: 0, speed: 0, company: { name: 'Back Bay Transit', colour: '#2471a3' }, cashCents: -20_000_000,
    ridersPerDay: 0, profitableDays: 0, costsPerDayCents: 0, lines: [], depots: [], undo: null, floor, contracts: [], contractTaken: false,
  } as unknown as Snapshot;
  return { status: 'ready', snapshot, send: () => undefined } as unknown as Sim;
}

describe('the failure floor on the page', () => {
  it('counts down the day closes left in a chip', () => {
    expect(renderToStaticMarkup(createElement(TopBar, { onContracts: () => undefined, sim: sim({ closesLeft: 5, ended: false }) }))).toContain('5 days to get above -$150k');
    expect(renderToStaticMarkup(createElement(TopBar, { onContracts: () => undefined, sim: sim({ closesLeft: 1, ended: false }) }))).toContain('1 day to get above -$150k');
    expect(renderToStaticMarkup(createElement(TopBar, { onContracts: () => undefined, sim: sim(null) }))).not.toContain('to get above');
  });

  it('ends the run with Restart this quarter, and shows nothing before', () => {
    const html = renderToStaticMarkup(createElement(FailureCard, { sim: sim({ closesLeft: 0, ended: true }) }));
    expect(html).toContain('The lender has called in the loan');
    expect(html).toContain('5 days closed below -$150k');
    expect(html).toContain('Restart this quarter');
    expect(renderToStaticMarkup(createElement(FailureCard, { sim: sim({ closesLeft: 2, ended: false }) }))).toBe('');
  });
});
