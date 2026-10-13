// The line card names when a line's buses fill (K27; the M3 spec, item 3). The fixture's lines never
// fill, so the e2e tests cannot reach this; the card is rendered here from a snapshot that says so.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LineView, Snapshot } from '../../sim/types';
import { LineCard } from './LineCard';
import type { Sim } from './useSim';

function render(change: Partial<LineView>): string {
  const line: LineView = {
    id: 1,
    name: 'Line 1',
    colour: '#c0392b',
    stops: [],
    route: [],
    stopAt: [],
    stopDistM: [0, 3_535],
    pullOut: [],
    pullIn: [],
    plan: { timing: { cycle: 1_539, headways: { peak: 600, offpeak: 900, overnight: null }, buses: 3 }, oneWayS: 529.5, pullOutS: 0, pullInS: 0 },
    ridersPerDay: 5_130.3,
    turnedAwayPerDay: 0,
    fullAtMinute: null,
    incomeCents: 0,
    headways: { peak: 600, offpeak: 900, overnight: null },
    cycle: 1_539,
    buses: 3,
    model: 'sparrow',
    forecastCents: { running: 0, wages: 0, deadhead: 0 },
    ...change,
  };
  const snapshot = { depots: [], lines: [line], cashCents: 0 } as unknown as Snapshot;
  const sim = { snapshot } as unknown as Sim;
  return renderToStaticMarkup(createElement(LineCard, { sim, line }));
}

describe('the line card', () => {
  it('says when the buses fill and how many riders they turn away', () => {
    const html = render({ turnedAwayPerDay: 2_377.8, fullAtMinute: 17 * 60 });
    expect(html).toContain('Full at 17:00 · ≈2,400 riders a day turned away');
  });

  it('says nothing about filling when no rider is turned away', () => {
    expect(render({})).not.toContain('Full at');
  });
});
