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
    ridersPerDay: 0, profitableDays: 0, costsPerDayCents: 0, lines: [], depots: [], undo: null, floor, contracts: [], contractTaken: false, medals: { bronze: null, silver: null, gold: null }, tripsCarried: 0,
  } as unknown as Snapshot;
  return { status: 'ready', snapshot, send: () => undefined } as unknown as Sim;
}

describe('the failure floor on the page', () => {
  it('counts down the day closes left in a chip', () => {
    expect(renderToStaticMarkup(createElement(TopBar, { onContracts: () => undefined, playSpeed: 3, sim: sim({ closesLeft: 5, ended: false }) }))).toContain('5 days to get above -$150k');
    expect(renderToStaticMarkup(createElement(TopBar, { onContracts: () => undefined, playSpeed: 3, sim: sim({ closesLeft: 1, ended: false }) }))).toContain('1 day to get above -$150k');
    expect(renderToStaticMarkup(createElement(TopBar, { onContracts: () => undefined, playSpeed: 3, sim: sim(null) }))).not.toContain('to get above');
  });

  it('ends the run with Restart this quarter, and shows nothing before', () => {
    const html = renderToStaticMarkup(createElement(FailureCard, { sim: sim({ closesLeft: 0, ended: true }) }));
    expect(html).toContain('The lender has called in the loan');
    expect(html).toContain('5 days closed below -$150k');
    expect(html).toContain('Restart this quarter');
    expect(renderToStaticMarkup(createElement(FailureCard, { sim: sim({ closesLeft: 2, ended: false }) }))).toBe('');
  });

  // The close that ends the run posts its day card too, and the two cards took the same spot, the
  // failure card over the day card's rows. Shown failing (TS-04) with the failure card drawn while the
  // day card is open.
  it('waits for the closing day’s card to be read, and shows once Continue closes it', () => {
    const ended = sim({ closesLeft: 0, ended: true });
    const dayCard = { day: 1, rows: [], cashBeforeCents: 47_454_800, cashAfterCents: -20_012_000, report: null, contracts: [], events: [], medals: [] };
    expect(renderToStaticMarkup(createElement(FailureCard, { sim: { ...ended, dayCard } }))).toBe('');
    expect(renderToStaticMarkup(createElement(FailureCard, { sim: { ...ended, dayCard: null } }))).toContain('The lender has called in the loan');
  });
});
