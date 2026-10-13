// The line tool's commands on mini-Boston (the M2 spec, items 3 and 4): the rule decides, the ledger
// pays, and what the card said is what runs (GD-05, I6).
import { describe, expect, it } from 'vitest';
import { toXY, type LngLat } from '../core/geo';
import type { LineId } from '../core/ids';
import { checkLineDraft } from '../rules/line';
import { fixtureCity, fixtureGame, gameWithDepot } from '../testing';
import { lineDraftContext } from '../world';
import { createLine } from './createLine';
import { DEBUG_STOPS } from './debugLine';
import { setHeadways } from './setHeadways';

const CLICKS: LngLat[] = DEBUG_STOPS.map((s) => s.at);
const THIRTY = { peak: 1_800, offpeak: 1_800, overnight: null };

describe('Create on mini-Boston', () => {
  it('asks for a depot first and spends nothing', () => {
    const world = fixtureGame();
    expect(createLine(world, CLICKS)).toMatchObject({ ok: false, reason: 'needs_depot' });
    expect(world.state.ledger.rows).toHaveLength(1);
    expect(world.state.lines).toEqual([]);
  });

  it('buys four stops and two Sparrows, $206k in one Purchases row, and runs what the card said (I6)', () => {
    const world = gameWithDepot();
    const card = checkLineDraft(lineDraftContext(world), CLICKS.map((c) => toXY(fixtureCity().frame, c)), { peak: 1_200, offpeak: 1_200, overnight: null });
    const before = world.state.ledger.cashCents;
    const created = createLine(world, CLICKS);
    expect(created).toMatchObject({ ok: true, priceCents: 20_600_000 });
    expect(world.state.ledger.cashCents).toBe(before - 20_600_000);
    expect(world.state.ledger.rows.at(-1)).toEqual({ day: 1, kind: 'purchase', amountCents: -20_600_000 });
    const line = world.state.lines[0]!;
    expect(line).toMatchObject({ name: 'Line 1', buses: 2, headways: { peak: 1_200, offpeak: 1_200, overnight: null } });
    expect(world.state.stops).toHaveLength(4);
    const service = world.services.get(line.id)!;
    expect(service.timing.cycle).toBe(card.draft.cycle);
    expect(service.plan.stopDistM).toEqual(card.draft.stopDistM);
    expect(service.depotId).toBe(world.state.depots[0]!.id);
    expect(world.assignment.lines.get(line.id)!.perDay).toBeGreaterThan(100);
  });

  it('joins a stop already standing within 250 m, and charges nothing for it', () => {
    const world = gameWithDepot();
    // Every 30 minutes, one Sparrow: $111k, leaving $166,200 for a second line.
    if (!createLine(world, CLICKS, THIRTY).ok) throw new Error('first line');
    const symphony = world.state.stops[1]!;
    // From about 80 m off Symphony to a new stop by the Fens: one new stop and one Sparrow.
    const created = createLine(world, [[-71.0866, 42.3427], [-71.0985, 42.3452]]);
    expect(created).toMatchObject({ ok: true, priceCents: 400_000 + 9_500_000 });
    expect(world.state.lines[1]!.stopIds[0]).toBe(symphony.id);
    expect(world.state.stops).toHaveLength(5);
  });

  it('refuses in words the card can show: a stop twice, too few stops, no room, too little cash', () => {
    const world = gameWithDepot();
    expect(createLine(world, [CLICKS[0]!])).toMatchObject({ ok: false, reason: 'too_few_stops' });
    expect(createLine(world, [CLICKS[0]!, CLICKS[2]!, [-71.0775, 42.35]])).toMatchObject({ ok: false, reason: 'stop_twice', at: 2 });
    expect(createLine(world, CLICKS, { peak: 240, offpeak: 240, overnight: null })).toMatchObject({ ok: false, reason: 'depot_full', room: 6 });
    world.state.ledger.cashCents = 0; // not a real state; the rule reads cash and nothing else
    expect(createLine(world, CLICKS)).toMatchObject({ ok: false, reason: 'insufficient_funds', shortCents: 20_600_000 });
    expect(world.state.lines).toEqual([]);
  });
});

describe('a headway change on mini-Boston (GD-09)', () => {
  it('buys the second Sparrow every 20 minutes needs, nothing for every 30, and refuses the third in money', () => {
    const world = gameWithDepot();
    const created = createLine(world, CLICKS, THIRTY);
    if (!created.ok) throw new Error(created.reason);
    const id: LineId = created.lineId;
    expect(world.state.lines[0]!.buses).toBe(1);
    const before = world.state.ledger.cashCents;
    expect(setHeadways(world, id, { peak: 1_200, offpeak: 1_200, overnight: null })).toEqual({ ok: true, bought: 1, priceCents: 9_500_000 });
    expect(world.state.ledger.cashCents).toBe(before - 9_500_000);
    expect(world.state.lines[0]!.buses).toBe(2);
    expect(world.services.get(id)!.timing.headways.peak).toBe(1_200);
    expect(setHeadways(world, id, THIRTY)).toEqual({ ok: true, bought: 0, priceCents: 0 });
    expect(world.state.lines[0]!.buses).toBe(2);
    // $71,200 left after a depot and the starter: every 10 minutes at peak needs a third Sparrow, $23,800 short.
    expect(setHeadways(world, id, { peak: 600, offpeak: 1_200, overnight: null })).toEqual({ ok: false, reason: 'insufficient_funds', shortCents: 2_380_000 });
    expect(setHeadways(world, id, { peak: 1_800, offpeak: 600, overnight: 300 })).toMatchObject({ ok: false, reason: 'overnight_more_often_than_offpeak' });
    expect(setHeadways(world, 99 as LineId, { peak: 600, offpeak: 600, overnight: null })).toEqual({ ok: false, reason: 'no_such_line' });
  });
});
