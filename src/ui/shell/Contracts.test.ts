// Contracts on the page (the M3 spec, items 11 and 12; exit check 2): the checklist's last step opens
// them, the Contracts chip takes its place once the checklist is done, and each card shows today's
// headway near its landmark against the ask.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ContractView, Snapshot } from '../../sim/types';
import type { Sim } from '../game/useSim';
import { Contracts } from './Contracts';
import { TopBar } from './TopBar';

const offer: ContractView = {
  id: 2, landmark: 'Longwood', at: [-71.1, 42.34], reachM: 650, kind: 'headway', ask: 900, rewardCents: 15_000_000, held: false,
  daysMet: 0, daysNeeded: 10, daysLeft: null, figure: 1_200, met: false, onTrack: true,
};

function sim(over: Partial<Snapshot>): Sim {
  const snapshot = {
    elapsed: 86_400, day: 2, hour: 9, minute: 0, speed: 0, company: { name: 'Back Bay Transit', colour: '#2471a3' }, cashCents: 7_120_000,
    ridersPerDay: 636, profitableDays: 1, costsPerDayCents: 0, lines: [{}], depots: [{}], undo: null, floor: null, contracts: [offer], contractTaken: false, ...over,
  } as unknown as Snapshot;
  return { status: 'ready', snapshot, send: () => undefined } as unknown as Sim;
}
const bar = (s: Sim) => renderToStaticMarkup(createElement(TopBar, { sim: s, onContracts: () => undefined }));

describe('contracts on the page', () => {
  it('makes the checklist’s last step a button, and puts the Contracts chip in its place once a contract is taken', () => {
    expect(bar(sim({}))).toContain('<button type="button" class="chip checklist" data-testid="checklist">5/5 Take a contract</button>');
    const taken = bar(sim({ contractTaken: true, contracts: [{ ...offer, held: true, daysMet: 3, daysLeft: 17 }] }));
    expect(taken).not.toContain('checklist');
    expect(taken).toContain('<span class="chip-label">Contracts</span> 1 held');
    expect(bar(sim({ profitableDays: 0 }))).toContain('<span class="chip checklist" data-testid="checklist">4/5 Close a day in profit</span>');
  });

  it('shows today’s headway against the ask, with Take it on an offer and the days on a held one', () => {
    const panel = (s: Sim) => renderToStaticMarkup(createElement(Contracts, { sim: s, onClose: () => undefined }));
    const offered = panel(sim({}));
    expect(offered).toContain('Every 15 min at Longwood');
    expect(offered).toContain('10 days in a row · $150,000');
    expect(offered).toContain('Today: every 20 min');
    expect(offered).toContain('Take it');
    const held = panel(sim({ contracts: [{ ...offer, held: true, daysMet: 3, daysLeft: 17, figure: 900, met: true, onTrack: false }] }));
    expect(held).toContain('Today: every 15 min');
    expect(held).toContain('3 of 10 days · 17 days left · missed today');
    expect(held).not.toContain('Take it');
    expect(panel(sim({ contracts: [{ ...offer, figure: null }] }))).toContain('Today: no bus within a walk');
    const riders = panel(sim({ contracts: [{ ...offer, landmark: 'Copley Square', kind: 'ridership', ask: 400, figure: 254.9, met: false }] }));
    expect(riders).toContain('400 boardings a day at Copley Square');
    expect(riders).toContain('Today: 254 boardings a day');
    expect(riders).toContain('data-kind="ridership"');
  });
});
