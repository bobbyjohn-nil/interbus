// Route insert (the M4 spec, item 4): a click goes into the leg of the line nearest it, as a new stop,
// for one Purchases row; a detour over 15% of the leg warns but goes through; a click far from the
// line, or on one of its own stops, is refused and changes nothing.
import { describe, expect, it } from 'vitest';
import { STOP_COST_CENTS } from '../config/economy';
import { BUS_MODELS } from '../config/fleet';
import { toXY, type LngLat } from '../core/geo';
import { checkInsert } from '../rules/route';
import { encode } from '../save/save';
import { gameWithDepot } from '../testing';
import { lineDraftContext, type World } from '../world';
import { addDebugLine, DEBUG_STOPS } from './debugLine';
import { insertStop } from './insertStop';

const BUILD = { sha: 'test', version: '0.0.0' };
/** On Huntington Avenue between Symphony and the MFA: the debug line's second leg, no detour. */
const ON_HUNTINGTON: LngLat = [-71.0903, 42.33995];
/** Beside the third leg, off its streets: 435 m more on the leg, 39%. */
const DETOUR: LngLat = [-71.0995, 42.3368];
/** Over 300 m from any of its streets. */
const AWAY: LngLat = [-71.093, 42.344];

function running(): World {
  const world = gameWithDepot();
  if (!addDebugLine(world).ok) throw new Error('no line');
  return world;
}

describe('inserting a stop (the M4 spec, item 4)', () => {
  it('puts the click into the leg nearest it, as a new stop for one Purchases row, and the line runs through it', () => {
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
    expect(world.state.ledger.rows.at(-1)).toMatchObject({ kind: 'purchase', amountCents: -STOP_COST_CENTS });
    expect(world.assignment.lines.get(line.id)!.perDay).not.toBe(before);
  });

  it('warns of a detour over 15% of its leg, and still inserts it', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const stops = line.stopIds.map((id) => world.state.stops.find((s) => s.id === id)!).map((s) => toXY(world.city.frame, [s.lon, s.lat]));
    const shape = { stops, buses: line.buses, headways: line.headways, model: BUS_MODELS[line.model] };
    expect(checkInsert(lineDraftContext(world), shape, toXY(world.city.frame, ON_HUNTINGTON))).toMatchObject({ ok: true, leg: 1, detourM: 0, warn: false });
    const card = checkInsert(lineDraftContext(world), shape, toXY(world.city.frame, DETOUR));
    expect(card).toMatchObject({ ok: true, leg: 2, warn: true });
    expect(card.detourShare).toBeGreaterThan(0.15);
    const done = insertStop(world, line.id, DETOUR);
    expect(done.ok).toBe(true);
    expect(world.state.lines[0]!.stopIds).toHaveLength(5);
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
