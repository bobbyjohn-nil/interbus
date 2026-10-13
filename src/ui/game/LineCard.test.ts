// The line card names when a line's buses fill (K27; the M3 spec, item 3) and the fares that net the
// most (item 4). The fixture's lines never fill, so the e2e tests cannot reach the first; the card is
// rendered here from a snapshot that says so.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { FareBandView, LineView, Snapshot } from '../../sim/types';
import { LineCard } from './LineCard';
import type { Sim } from './useSim';

function render(change: Partial<LineView>, band: FareBandView | null = null): string {
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
    fareCents: 225,
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
  const sim = { snapshot, fareBand: band ? { lineId: 1, band } : null, fareBandFor: () => undefined } as unknown as Sim;
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

  it('offers every fare from $1.00 to $5.00 and names the band that nets the most', () => {
    const html = render({ fareCents: 250 }, { netCents: [], bestCents: 175, fromCents: 175, toCents: 200 });
    expect(html.match(/<option value="\d+"[^>]*>\$\d\.\d\d<\/option>/g)).toHaveLength(17);
    expect(html).toContain('<option value="250" selected="">$2.50</option>');
    expect(html).toContain('Best net at $1.75–$2.00');
    expect(render({}, { netCents: [], bestCents: 200, fromCents: 200, toCents: 200 })).toContain('Best net at $2.00<');
  });
});
