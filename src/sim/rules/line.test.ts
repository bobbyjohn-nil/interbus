import { describe, expect, it } from 'vitest';
import type { XY } from '../core/geo';
import { DEPOT_CAPACITY } from '../config/depots';
import { GOLIATH, METRO_40, SPARROW } from '../config/fleet';
import { checkHeadwayChange, checkLineDraft, checkModelChange, type LineDraftContext } from './line';
import { NO_MEDALS } from './medal';
import { checkStopSite } from './stop';

// A street every 100 m along y = 0, from x = 0 to 5,000: every click snaps to the node below it.
const nodes = Array.from({ length: 51 }, (_, i) => [i * 100, 0] as XY);
function context(over: Partial<LineDraftContext> = {}): LineDraftContext {
  return {
    nearestNode: (at, withinM) => {
      let best: { node: number; at: XY; distM: number } | null = null;
      nodes.forEach((p, node) => {
        const d = Math.hypot(p[0] - at[0], p[1] - at[1]);
        if (d <= withinM && (!best || d < best.distM)) best = { node, at: p, distM: d };
      });
      return best;
    },
    stops: [],
    leg: (a, b) => ({ m: Math.abs(b[0] - a[0]), rushM: 0, worksM: 0 }),
    depots: 1,
    busesOwned: 0,
    cashCents: 42_720_000,
    medals: NO_MEDALS,
    ...over,
  };
}
const TWENTY = { peak: 1_200, offpeak: 1_200, overnight: null };
// Copley to Longwood's spacing: 0, 1,339, 2,425 and 3,535 m along the street.
const DEBUG_LIKE: XY[] = [[0, 20], [1_339, -30], [2_425, 10], [3_535, 0]];

describe('a stop click (EC-10)', () => {
  it('snaps to the nearest street node, or joins a stop within 250 m as a transfer', () => {
    expect(checkStopSite(context(), [1_339, 30])).toMatchObject({ ok: true, kind: 'new', node: 13, at: [1_300, 0] });
    expect(checkStopSite(context({ stops: [{ id: 7, at: [1_500, 0] }] }), [1_339, 30])).toMatchObject({ ok: true, kind: 'join', stopId: 7 });
    expect(checkStopSite(context({ stops: [{ id: 7, at: [1_700, 0] }] }), [1_339, 30])).toMatchObject({ kind: 'new' });
    expect(checkStopSite(context(), [1_339, 400])).toEqual({ ok: false, reason: 'no_street_near', limitM: 150 });
  });
});

describe('a line draft (the M2 spec, items 2–4)', () => {
  it('prices the debug line as four stops and the two Sparrows every 20 minutes needs: $16k + $190k', () => {
    const verdict = checkLineDraft(context(), DEBUG_LIKE, TWENTY);
    expect(verdict.ok).toBe(true);
    // Snapped to 0, 1,300, 2,400 and 3,500 m: a 1,539 s cycle on 3.5 km.
    expect(verdict.draft).toMatchObject({ routeM: 3_500, buses: 2, newStops: 4, stopsCents: 1_600_000, busesCents: 19_000_000, priceCents: 20_600_000 });
    expect(verdict.draft.stopDistM).toEqual([0, 1_300, 2_400, 3_500]);
  });

  it('asks for a depot first, and still shows the draft', () => {
    const verdict = checkLineDraft(context({ depots: 0 }), DEBUG_LIKE, TWENTY);
    expect(verdict).toMatchObject({ ok: false, reason: 'needs_depot' });
    expect(verdict.draft.stops).toHaveLength(4);
  });

  it('needs two stops, each once, on streets that join', () => {
    expect(checkLineDraft(context(), [[0, 0]], TWENTY)).toMatchObject({ ok: false, reason: 'too_few_stops' });
    // A second click within 250 m of the draft's own first stop is that stop again.
    expect(checkLineDraft(context(), [[0, 0], [2_000, 0], [100, 0]], TWENTY)).toMatchObject({ ok: false, reason: 'stop_twice', at: 2 });
    expect(checkLineDraft(context(), [[0, 0], [3_000, 900]], TWENTY)).toMatchObject({ ok: false, reason: 'no_street_near', at: 1, limitM: 150 });
    expect(checkLineDraft(context({ leg: (a, b) => (b[0] > 2_000 ? null : { m: Math.abs(b[0] - a[0]), rushM: 0, worksM: 0 }) }), DEBUG_LIKE, TWENTY)).toMatchObject({ ok: false, reason: 'no_route', at: 2 });
  });

  it('charges nothing for a stop it joins', () => {
    const verdict = checkLineDraft(context({ stops: [{ id: 3, at: [1_300, 0] }] }), DEBUG_LIKE, TWENTY);
    expect(verdict.draft).toMatchObject({ newStops: 3, stopsCents: 1_200_000 });
    expect(verdict.draft.stops[1]).toMatchObject({ kind: 'join', stopId: 3 });
  });

  it('refuses buses the depots have no room for, and a price above the cash, in money', () => {
    // Every 4 minutes needs ⌈1,539 ÷ 240⌉ = 7 Sparrows; one depot parks 6.
    expect(checkLineDraft(context(), DEBUG_LIKE, { peak: 240, offpeak: 240, overnight: null })).toMatchObject({ ok: false, reason: 'depot_full', room: 6 });
    expect(checkLineDraft(context({ busesOwned: 5 }), DEBUG_LIKE, TWENTY)).toMatchObject({ ok: false, reason: 'depot_full', room: 1 });
    // $1,000 in cash and the $150k credit line (D10): $55k short.
    expect(checkLineDraft(context({ cashCents: 100_000 }), DEBUG_LIKE, TWENTY)).toMatchObject({ ok: false, reason: 'insufficient_funds', shortCents: 5_500_000 });
  });

  it('refuses headways outside D7 with the limit', () => {
    expect(checkLineDraft(context(), DEBUG_LIKE, { peak: 1_200, offpeak: 4_000, overnight: null })).toMatchObject({ ok: false, reason: 'daytime_headway_too_long', limitSeconds: 3_600 });
  });
});

describe('a headway change (GD-09)', () => {
  const fleet = { depots: 1, busesOwned: 2, cashCents: 10_000_000, medals: NO_MEDALS };
  const line = { cycle: 1_539, buses: 2, model: SPARROW, headways: TWENTY };
  it('buys the buses a shorter headway needs: every 10 min needs 3, one more at $95k', () => {
    expect(checkHeadwayChange(fleet, line, { peak: 600, offpeak: 1_200, overnight: null })).toEqual({ ok: true, needed: 3, extra: 1, priceCents: 9_500_000 });
  });
  it('buys nothing for a longer one, and keeps the buses', () => {
    expect(checkHeadwayChange(fleet, line, { peak: 1_800, offpeak: 1_800, overnight: null })).toEqual({ ok: true, needed: 1, extra: 0, priceCents: 0 });
  });
  // The line's own headways are no change, as the same fare or model is none: one rule, so the card offers nothing for them and
  // the command keeps nothing to undo. Shown failing (TS-04) on 2a00661, which priced them as a change buying no bus (ok: true).
  it('refuses the headways the line already runs, as no change', () => {
    expect(checkHeadwayChange(fleet, line, { ...TWENTY })).toEqual({ ok: false, reason: 'same_headways' });
    expect(checkHeadwayChange(fleet, line, { ...TWENTY, overnight: 3_600 })).toEqual({ ok: true, needed: 2, extra: 0, priceCents: 0 });
  });
  it('refuses in money, or for want of depot room', () => {
    expect(checkHeadwayChange({ ...fleet, cashCents: -10_000_000 }, line, { peak: 600, offpeak: 1_200, overnight: null })).toEqual({ ok: false, reason: 'insufficient_funds', shortCents: 4_500_000 });
    expect(checkHeadwayChange({ ...fleet, busesOwned: 6 }, line, { peak: 600, offpeak: 1_200, overnight: null })).toEqual({ ok: false, reason: 'depot_full', room: 0 });
  });
  // Below the floor (D10) a change that buys no bus is no purchase: it goes through, as the ledger's spendParts lets it, and a
  // bus is still refused. Shown failing (TS-04) with the price of nothing compared against the credit line: "$49,000 short".
  it('runs a line less often below the floor, buying nothing, and still refuses a bus there', () => {
    const below = { ...fleet, cashCents: -19_900_000 };
    expect(checkHeadwayChange(below, line, { peak: 1_800, offpeak: 1_800, overnight: null })).toEqual({ ok: true, needed: 1, extra: 0, priceCents: 0 });
    expect(checkHeadwayChange(below, line, { peak: 600, offpeak: 1_200, overnight: null })).toEqual({ ok: false, reason: 'insufficient_funds', shortCents: 9_500_000 + 4_900_000 });
  });
});

describe('a model change (the M3 spec, item 2)', () => {
  const fleet = { depots: 1, busesOwned: 2, cashCents: 50_000_000, medals: NO_MEDALS };
  // The debug line: 3,535 m, four stops, every 20 minutes by day, two Sparrows.
  const line = { routeM: 3_535, stops: 4, buses: 2, model: SPARROW, headways: { peak: 1_200, offpeak: 1_200, overnight: null } };
  it('sells the Sparrows at half price and buys the Metro 40s its headways need on its slower cycle', () => {
    // At 25 km/h the round trip is 1,579 s, so every 20 minutes still needs 2: $520k less $95k back.
    expect(checkModelChange(fleet, line, METRO_40)).toEqual({ ok: true, needed: 2, buyCents: 52_000_000, saleCents: 9_500_000 });
  });
  it('refuses the same model, a locked one, too little cash on the net, and too little depot room', () => {
    expect(checkModelChange(fleet, line, SPARROW)).toEqual({ ok: false, reason: 'same_model' });
    expect(checkModelChange(fleet, line, GOLIATH)).toEqual({ ok: false, reason: 'model_locked' });
    expect(checkModelChange({ ...fleet, cashCents: 25_000_000 }, line, METRO_40)).toEqual({ ok: false, reason: 'insufficient_funds', shortCents: 2_500_000 });
    const tenMinutes = { ...line, headways: { peak: 600, offpeak: 1_200, overnight: null } };
    // The room named is the depots' own, which the buses beyond the line's must fit: it counted the line's two as free, and the
    // card said "Depots have room for 2 more" with every depot full, where room 0 says "Your depots are full" (copy.test.ts; the
    // systems audit's fifteenth round). Shown failing (TS-04) with the line's own buses in the room named.
    expect(checkModelChange({ ...fleet, busesOwned: DEPOT_CAPACITY }, tenMinutes, METRO_40)).toEqual({ ok: false, reason: 'depot_full', room: 0 });
    const one = checkModelChange({ ...fleet, busesOwned: DEPOT_CAPACITY - 1 }, { ...tenMinutes, headways: { peak: 300, offpeak: 1_200, overnight: null } }, METRO_40);
    expect(one).toEqual({ ok: false, reason: 'depot_full', room: 1 });
  });
  // A swap that sells more than it buys gives money back, so it goes through below the floor (D10), as the ledger's spendParts
  // lets it. Shown failing (TS-04) with the net, $70k back, compared against the credit line: "$30,000 short".
  it('swaps Metro 40s for Sparrows below the floor, $70k back, and still refuses a swap that costs money there', () => {
    const below = { ...fleet, cashCents: -25_000_000 };
    expect(checkModelChange(below, { ...line, model: METRO_40 }, SPARROW)).toEqual({ ok: true, needed: 2, buyCents: 19_000_000, saleCents: 26_000_000 });
    expect(checkModelChange(below, line, METRO_40)).toEqual({ ok: false, reason: 'insufficient_funds', shortCents: 52_000_000 - 9_500_000 + 10_000_000 });
  });
  it('sells Goliaths once the company holds silver, and not on bronze alone (the M4 spec, item 3)', () => {
    const rich = { ...fleet, cashCents: 200_000_000 };
    expect(checkModelChange({ ...rich, medals: { ...NO_MEDALS, bronze: 90 } }, line, GOLIATH)).toEqual({ ok: false, reason: 'model_locked' });
    expect(checkModelChange({ ...rich, medals: { ...NO_MEDALS, silver: 40 } }, line, GOLIATH)).toMatchObject({ ok: true, needed: 2, buyCents: 88_000_000 });
    expect(checkLineDraft(context({ cashCents: 200_000_000 }), DEBUG_LIKE, TWENTY, GOLIATH)).toMatchObject({ ok: false, reason: 'model_locked' });
    expect(checkLineDraft(context({ cashCents: 200_000_000, medals: { ...NO_MEDALS, silver: 40 } }), DEBUG_LIKE, TWENTY, GOLIATH).ok).toBe(true);
  });
});
