// The line card names when a line's buses fill (K27; the M3 spec, item 3), the fares that net the
// most (item 4) and its round trip with what roadworks add (the M4 spec, item 2). The fixture's lines
// never fill, so the e2e tests cannot reach the first; the card is rendered here from a snapshot that
// says so.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BUS_MODELS } from '../../sim/rules/line';
import { cyclesOf } from '../../sim/rules/cycle';
import { NO_MEDALS } from '../../sim/rules/medal';
import type { EventView, FareBandView, HeadwaysData, LineView, Snapshot } from '../../sim/types';
import { headwayChange, heldModel, heldPick, LineCard, LineHeading, pickHeadway } from './LineCard';
import type { Sim } from './useSim';

/** Line 1 as the snapshot shows it, with `change`. */
function lineView(change: Partial<LineView>): LineView {
  return {
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
    headways: { peak: 600, offpeak: 900, overnight: null },
    cycle: 1_539,
    cycles: { peak: 1_539, offpeak: 1_539, overnight: 1_539 },
    rush: 0,
    worksM: 0,
    settling: null,
    buses: 3,
    model: 'sparrow',
    ...change,
  };
}

function render(change: Partial<LineView>, band: FareBandView | null = null, event: Partial<EventView> | null = null): string {
  const line = lineView(change);
  const snapshot = { depots: [], lines: [line], cashCents: 0, event, medals: { bronze: null, silver: null, gold: null }, finance: { lines: [] } } as unknown as Snapshot;
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

  // Snow and roadworks lengthen a round trip and buy no bus: Line 1's 2 Sparrows, set to every 15 min, ran every 16.1 in the
  // snow (1,934 s over 2), as Contracts said, while the card said only "Every 15 min" (the systems audit's fourteenth round).
  // Shown failing (TS-04) without the line's running headway on the card.
  it('says when snow or roadworks leave the line a bus short, and the headway it runs then, as Contracts reads it', () => {
    const snowy = { headways: { peak: 900, offpeak: 900, overnight: null }, buses: 2, cycle: 1_934, cycles: { peak: 1_934, offpeak: 1_690, overnight: 1_690 } };
    expect(render(snowy, null, { kind: 'snow', street: '', phase: 'on' })).toContain('>A bus short in the snow: runs every 16.1 min at peak and off-peak<');
    const works = render({ ...snowy, worksM: 400 }, null, { kind: 'roadworks', street: 'Albany Street', phase: 'on' });
    expect(works).toContain('>A bus short for the roadworks: runs every 16.1 min at peak and off-peak<');
    // Every 10 min at peak needs 4 in the snow, 2 more than it has; off-peak, every 30, runs as set.
    const two = render({ ...snowy, headways: { peak: 600, offpeak: 1_800, overnight: null } }, null, { kind: 'snow', street: '', phase: 'on' });
    expect(two).toContain('>2 buses short in the snow: runs every 16.1 min at peak<');
    // On a clear day the 2 run every 15 min as set, and the card says nothing more.
    expect(render({ ...snowy, cycle: 1_549, cycles: { peak: 1_549, offpeak: 1_400, overnight: 1_400 } })).not.toContain('short');
  });

  it('says Express beside the name of a line of 5 km or more with its stops 1.2 km apart, and nothing beside a local one', () => {
    // The heading the Lines panel draws above its tabs (Inspector.tsx).
    const heading = (change: Partial<LineView>) => renderToStaticMarkup(createElement(LineHeading, { line: lineView(change) }));
    expect(heading({ stops: [[0, 0], [0, 0], [0, 0], [0, 0]], stopDistM: [0, 1_800, 3_600, 5_300] })).toContain('data-testid="express"');
    expect(heading({ stops: [[0, 0], [0, 0], [0, 0], [0, 0]], stopDistM: [0, 1_339, 2_425, 3_535] })).not.toContain('Express');
  });
});

// The headway menus show and send only what the player picked since the line last changed, against the line as it stands then.
// Shown failing (TS-04) with 2a00661's pick restored in heldPick and headwayChange (a pick kept through any change, and every pick
// a change): after the undo the card still offered Peak 15 with Off-peak 10 and Buy and run sent both; a slot's line got the
// replaced game's Peak 15; and Peak 20 picked back offered Run it.
describe('the line card’s headway pick', () => {
  const TWENTY: HeadwaysData = { peak: 1_200, offpeak: 1_200, overnight: null };
  const line = (headways: HeadwaysData) => ({ cycle: 1_539, cycles: { peak: 1_539, offpeak: 1_539, overnight: 1_539 }, buses: 2, model: 'sparrow' as const, headways });
  const fleet = { depots: 1, busesOwned: 2, cashCents: 10_000_000, medals: NO_MEDALS };

  it('drops a pick made before an undo put the line’s headways back, so the next is against the line as it stands', () => {
    const ran = line({ ...TWENTY, peak: 900 }); // Peak 15, run
    const offpeak = pickHeadway(null, ran, null, 'offpeak', 600); // then Off-peak 10, not run
    expect(offpeak.headways).toEqual({ peak: 900, offpeak: 600, overnight: null });
    expect(heldPick(offpeak, ran, null)).toBe(offpeak);
    expect(headwayChange(fleet, ran, offpeak)).toEqual({ ok: true, needed: 3, extra: 1, priceCents: 9_500_000 });
    const undone = line(TWENTY);
    expect(heldPick(offpeak, undone, null)).toBeNull();
    expect(headwayChange(fleet, undone, heldPick(offpeak, undone, null))).toBeNull();
    expect(pickHeadway(heldPick(offpeak, undone, null), undone, null, 'offpeak', 600).headways).toEqual({ peak: 1_200, offpeak: 600, overnight: null });
  });

  it('drops a pick made in a game a load replaced, though the loaded line runs the same headways', () => {
    const twenty = line(TWENTY);
    const before = pickHeadway(null, twenty, null, 'peak', 900); // no game loaded yet this session
    const loaded = pickHeadway(null, twenty, 1_000, 'peak', 900);
    expect(heldPick(loaded, twenty, 1_000)).toBe(loaded);
    expect(heldPick(before, twenty, 1_000)).toBeNull();
    expect(heldPick(loaded, twenty, 2_000)).toBeNull();
  });

  it('keeps every pick since the line last changed, each on the last', () => {
    const twenty = line(TWENTY);
    const peak = pickHeadway(null, twenty, null, 'peak', 900);
    const both = pickHeadway(heldPick(peak, twenty, null), twenty, null, 'overnight', 3_600);
    expect(both.headways).toEqual({ peak: 900, offpeak: 1_200, overnight: 3_600 });
    expect(heldPick(both, twenty, null)).toBe(both);
  });

  it('offers no change for the line’s own headways picked back, as the rule refuses them', () => {
    const twenty = line(TWENTY);
    const fifteen = pickHeadway(null, twenty, null, 'peak', 900);
    expect(headwayChange(fleet, twenty, fifteen)).toEqual({ ok: true, needed: 2, extra: 0, priceCents: 0 });
    expect(headwayChange(fleet, twenty, pickHeadway(fifteen, twenty, null, 'peak', 1_200))).toBeNull();
    expect(headwayChange(fleet, twenty, null)).toBeNull();
  });

  // The model menu's pick likewise. Shown failing (TS-04) with the pick kept through any change: Buy and swap sent a Metro 40
  // picked in the replaced game to the loaded one's line.
  it('drops a model pick made before the line’s model changed, or in a game a load replaced', () => {
    const pick = { model: 'metro40' as const, base: 'sparrow' as const, game: 1_000 };
    expect(heldModel(pick, { model: 'sparrow' }, 1_000)).toBe(pick);
    expect(heldModel(pick, { model: 'sparrow' }, 2_000)).toBeNull();
    expect(heldModel(pick, { model: 'metro40' }, 1_000)).toBeNull();
    expect(heldModel(null, { model: 'sparrow' }, 1_000)).toBeNull();
  });
});

// A line run less often parks the buses it no longer needs in their depot places; the card counts them and sells them at half
// price, on the rule the command checks (the late game at the bus ceiling, DECISIONS, Open, its recommended (a); GD-05).
describe('a line’s spare buses on its card', () => {
  it('counts the buses its headways no longer need, and offers them at half price', () => {
    const spare = render({ headways: { peak: 1_800, offpeak: 1_800, overnight: null } });
    expect(spare).toContain('2 of its 3 Sparrows are spare: it needs 1');
    expect(spare).toContain('Sell them · $95k back');
    const one = render({ headways: { peak: 1_200, offpeak: 1_200, overnight: null } });
    expect(one).toContain('1 of its 3 Sparrows is spare: it needs 2');
    expect(one).toContain('Sell it · $47.5k back');
    expect(render({})).not.toContain('spare');
  });
});
