// Route insert (the M4 spec, item 4): a click goes into the leg of the line nearest it, as a new stop,
// for one Purchases row; a detour over 15% of the leg warns but goes through; a click far from the
// line, or on one of its own stops, is refused and changes nothing.
import { describe, expect, it } from 'vitest';
import { STOP_COST_CENTS } from '../config/economy';
import { BUS_MODELS } from '../config/fleet';
import { toXY, type LngLat } from '../core/geo';
import { post } from '../economy/ledger';
import { checkInsert } from '../rules/route';
import { encode } from '../save/save';
import { gameWithDepot } from '../testing';
import { lineDraftContext, type World } from '../world';
import { addDebugLine, DEBUG_STOPS } from './debugLine';
import { insertStop } from './insertStop';
import { placeStop } from './placeStop';

const BUILD = { sha: 'test', version: '0.0.0' };
/** On Huntington Avenue between Symphony and the MFA: the debug line's second leg, no detour. */
const ON_HUNTINGTON: LngLat = [-71.0903, 42.33995];
/** Beside the third leg, off its streets: 351 m more on the leg, 32% (measured 2026-10-14; the old spot, [-71.0995, 42.3368], stopped detouring once buses drove one-way streets both ways). */
const DETOUR: LngLat = [-71.107, 42.338];
/** Over 300 m from any of its streets. */
const AWAY: LngLat = [-71.093, 42.344];

function running(): World {
  const world = gameWithDepot();
  if (!addDebugLine(world).ok) throw new Error('no line');
  return world;
}

describe('inserting a stop (the M4 spec, item 4)', () => {
  it('puts the click into the leg nearest it, as a new stop for a New stops row, and the line runs through it', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const [symphony, mfa] = [line.stopIds[1]!, line.stopIds[2]!];
    const cash = world.state.ledger.cashCents;
    const before = world.assignment.lines.get(line.id)!.perDay;
    const done = insertStop(world, line.id, ON_HUNTINGTON);
    expect(done).toMatchObject({ ok: true, priceCents: STOP_COST_CENTS, extraBuses: 0 });
    expect(line.stopIds).toHaveLength(5);
    expect(line.stopIds.slice(1, 4)).toEqual([symphony, done.ok && done.stopId, mfa]);
    expect(world.state.ledger.cashCents).toBe(cash - STOP_COST_CENTS);
    expect(world.state.ledger.rows.at(-1)).toMatchObject({ kind: 'stops', amountCents: -STOP_COST_CENTS });
    expect(world.assignment.lines.get(line.id)!.perDay).not.toBe(before);
  });

  it('warns of a detour over 15% of its leg, and still inserts it', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const stops = line.stopIds.map((id) => world.state.stops.find((s) => s.id === id)!).map((s) => toXY(world.city.frame, [s.lon, s.lat]));
    const shape = { stops, buses: line.buses, headways: line.headways, model: BUS_MODELS[line.model] };
    expect(checkInsert(lineDraftContext(world), shape, toXY(world.city.frame, ON_HUNTINGTON))).toMatchObject({ ok: true, leg: 1, warn: false });
    expect(checkInsert(lineDraftContext(world), shape, toXY(world.city.frame, ON_HUNTINGTON)).detourM).toBeCloseTo(0, 6);
    const card = checkInsert(lineDraftContext(world), shape, toXY(world.city.frame, DETOUR));
    expect(card).toMatchObject({ ok: true, leg: 2, warn: true });
    expect(card.detourShare).toBeGreaterThan(0.15);
    const done = insertStop(world, line.id, DETOUR);
    expect(done.ok).toBe(true);
    expect(world.state.lines[0]!.stopIds).toHaveLength(5);
  });

  // Below the floor (D10) a stop placed on its own goes into the line for nothing, so it is no purchase and goes through, as the
  // ledger's spendParts lets it. Shown failing (TS-04) with the price of nothing compared against the credit line.
  it('inserts a stop standing on its own below the floor, buying nothing', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const placed = placeStop(world, ON_HUNTINGTON);
    if (!placed.ok) throw new Error(placed.reason);
    post(world.state.ledger, { day: 1, kind: 'buses', amountCents: -(world.state.ledger.cashCents + 19_900_000) });
    expect(insertStop(world, line.id, ON_HUNTINGTON)).toEqual({ ok: true, priceCents: 0, extraBuses: 0, stopId: placed.stopId });
    expect(line.stopIds).toHaveLength(5);
    expect(world.state.ledger.cashCents).toBe(-19_900_000);
  });

  it('refuses a click far from the line, or on one of its own stops, and changes nothing', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const before = encode(world.state, BUILD);
    expect(insertStop(world, line.id, AWAY)).toMatchObject({ ok: false, reason: 'no_leg_near', limitM: 300 });
    expect(insertStop(world, line.id, DEBUG_STOPS[1]!.at)).toMatchObject({ ok: false, reason: 'stop_twice' });
    expect(encode(world.state, BUILD)).toBe(before);
  });
});
