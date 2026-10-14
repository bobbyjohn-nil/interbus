// The line card names when a line's buses fill (K27; the M3 spec, item 3), the fares that net the
// most (item 4) and its round trip with what roadworks add (the M4 spec, item 2). The fixture's lines
// never fill, so the e2e tests cannot reach the first; the card is rendered here from a snapshot that
// says so.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUS_MODELS } from '../../sim/rules/line';
import { cyclesOf } from '../../sim/rules/cycle';
import type { EventView, FareBandView, LineView, Snapshot } from '../../sim/types';
import { LineCard } from './LineCard';
import type { Sim } from './useSim';

function render(change: Partial<LineView>, band: FareBandView | null = null, event: Partial<EventView> | null = null): string {
  const line: LineView = {
    id: 1,
    name: 'Line 1',
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
    incomeCents: 0,
    headways: { peak: 600, offpeak: 900, overnight: null },
    cycle: 1_539,
    cycles: { peak: 1_539, offpeak: 1_539, overnight: 1_539 },
    rush: 0,
    worksM: 0,
    settling: null,
    buses: 3,
    model: 'sparrow',
    forecastCents: { running: 0, wages: 0, deadhead: 0 },
    ...change,
  };
  const snapshot = { depots: [], lines: [line], cashCents: 0, event, medals: { bronze: null, silver: null, gold: null } } as unknown as Snapshot;
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

  // D25: "the menu where you see lines should only have information about the line, no finances".
  // Shown failing (TS-04) on the old card, which held the fare picker and its band.
  it('reads its fare, set in Finance, with no picker and no band of its own', () => {
    const html = render({ fareCents: 250 }, { netCents: [], bestCents: 175, fromCents: 175, toCents: 200 });
    expect(html).toContain('data-testid="line-fare" data-fare="250">Fare $2.50');
    expect(html).not.toMatch(/<option value="\d+"[^>]*>\$\d\.\d\d<\/option>/);
    expect(html).not.toContain('Most profit at');
  });

  it('reads its round trip, and what roadworks on its streets add to it today', () => {
    expect(render({ cycles: { peak: 1_641, offpeak: 1_442, overnight: 1_400 } })).toContain('Round trip 27 min at peak, 24 min off-peak<');
    const clear = cyclesOf(3_535, 0, BUS_MODELS.sparrow.kmh, 0.4);
    const slowed = { peak: clear.peak + 52, offpeak: clear.offpeak + 43, overnight: clear.overnight + 40 };
    const html = render({ rush: 0.4, worksM: 300, cycles: slowed }, null, { street: 'Huntington Avenue', phase: 'on' });
    expect(html).toContain(`Round trip ${Math.round(slowed.peak / 60)} min at peak, ${Math.round(slowed.offpeak / 60)} min off-peak · roadworks on Huntington Avenue add 52 s`);
  });

  it('says what snow adds to its round trip while it falls, and nothing the evening before (the M4 spec, item 2)', () => {
    const clear = cyclesOf(3_535, 0, BUS_MODELS.sparrow.kmh, 0.4);
    const snowy = { peak: clear.peak + 420, offpeak: clear.offpeak + 343, overnight: clear.overnight + 330 };
    expect(render({ rush: 0.4, cycles: snowy }, null, { kind: 'snow', street: '', phase: 'on' })).toContain(' · snow adds 7 min<');
    expect(render({ rush: 0.4, cycles: clear }, null, { kind: 'snow', street: '', phase: 'pending' })).not.toContain('snow adds');
  });

  it('says Express beside the name of a line of 5 km or more with its stops 1.2 km apart, and nothing beside a local one', () => {
    expect(render({ stops: [[0, 0], [0, 0], [0, 0], [0, 0]], stopDistM: [0, 1_800, 3_600, 5_300] })).toContain('data-testid="express"');
    expect(render({ stops: [[0, 0], [0, 0], [0, 0], [0, 0]], stopDistM: [0, 1_339, 2_425, 3_535] })).not.toContain('Express');
  });
});
