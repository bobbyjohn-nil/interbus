// The Lines panel is dragged by its heading (D25), so the heading comes first, above the line tabs, however
// many lines there are. Shown failing (TS-04) on 5f4bce3, which drew the tabs first and the line card's
// heading under them: ten lines' four rows of tabs put it 138 px down, and a panel dragged low had it
// below the window, with nothing left to drag it back by (the systems audit's third round).
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LineView, Snapshot } from '../../sim/types';
import type { Sim } from '../game/useSim';
import { Inspector } from './Inspector';

/** Line `id`, a short local line. */
const lineView = (id: number): LineView =>
  ({
    id,
    name: `Line ${id}`,
    colour: '#c0392b',
    stops: [],
    stopIds: [],
    route: [],
    stopAt: [],
    stopDistM: [0, 3_535],
    pullOut: [],
    pullIn: [],
    plan: { timing: { cycle: 1_539, headways: { peak: 600, offpeak: 900, overnight: null }, buses: 3 }, oneWayS: 529.5, pullOutS: 0, pullInS: 0 },
    ridersPerDay: 5_130.3,
    fareCents: 225,
    turnedAwayPerDay: 0,
    fullAtMinute: null,
    headways: { peak: 600, offpeak: 900, overnight: null },
    cycle: 1_539,
    cycles: { peak: 1_539, offpeak: 1_539, overnight: 1_539 },
    rush: 0,
    worksM: 0,
    settling: null,
    buses: 3,
    model: 'sparrow',
  }) as LineView;

function render(lines: number, lineId: number): string {
  const all = Array.from({ length: lines }, (_, k) => lineView(k + 1));
  const snapshot = { depots: [], lines: all, cashCents: 0, event: null, medals: { bronze: null, silver: null, gold: null }, finance: { lines: [] } } as unknown as Snapshot;
  const sim = { snapshot, fareBand: null, fareBandFor: () => undefined } as unknown as Sim;
  const none = () => undefined;
  return renderToStaticMarkup(createElement(Inspector, { sim, lineId, onLine: none, onEditRoute: none, onFinance: none, onClose: none, closeHandBack: none, onStop: none }));
}

describe('the Lines panel', () => {
  it('puts the line’s heading first, above the tabs of ten lines, as the one heading it is dragged by', () => {
    const html = render(10, 7);
    expect(html.match(/<h2[ >]/g)).toHaveLength(1);
    expect(html.indexOf('<h2')).toBeLessThan(html.indexOf('role="tablist"'));
    expect(html.slice(html.indexOf('<h2'), html.indexOf('</h2>'))).toContain('Line 7');
  });

  it('with one line, draws its heading and no tabs', () => {
    const html = render(1, 1);
    expect(html.match(/<h2[ >]/g)).toHaveLength(1);
    expect(html).not.toContain('role="tablist"');
  });
});
