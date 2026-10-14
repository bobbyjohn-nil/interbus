// A line's whole route set at once (D25: "reorder, add, and remove stops"): one command buys what the
// new route adds, keeps its buses, takes down a stop it leaves that no other line calls at for half
// its cost, and runs the line through the new stops; it refuses no change, a stop twice and a line of
// one stop, and an undo puts it all back. Shown failing (TS-04) with the stops it leaves kept standing
// and with the refund left out of the cash.
import { describe, expect, it } from 'vitest';
import { STOP_COST_CENTS } from '../config/economy';
import type { LngLat } from '../core/geo';
import { mint, type LineId, type StopId } from '../core/ids';
import { toSaveData } from '../save/save';
import { gameWithDepot } from '../testing';
import { before, newUndo, remember, undo } from '../undo';
import { recompute, type World } from '../world';
import { addDebugLine, DEBUG_STOPS } from './debugLine';
import { placeStop } from './placeStop';
import { setRoute } from './setRoute';

/** On Huntington Avenue between Symphony and the MFA, more than 250 m from each. */
const ON_HUNTINGTON: LngLat = [-71.0903, 42.33995];
const [COPLEY, SYMPHONY, MFA, LONGWOOD] = DEBUG_STOPS.map((s) => s.at) as [LngLat, LngLat, LngLat, LngLat];

function running(): World {
  const world = gameWithDepot();
  if (!addDebugLine(world).ok) throw new Error('no line');
  return world;
}

describe('setting a line’s route (D25)', () => {
  it('drops Symphony and adds a stop on Huntington in one go: a New stops row, Symphony down for $2k back', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const [copley, symphony, mfa, longwood] = line.stopIds as [StopId, StopId, StopId, StopId];
    const cash = world.state.ledger.cashCents;
    const buses = line.buses;
    const done = setRoute(world, line.id, [COPLEY, ON_HUNTINGTON, MFA, LONGWOOD]);
    expect(done).toMatchObject({ ok: true, priceCents: STOP_COST_CENTS, extraBuses: 0, refundCents: STOP_COST_CENTS / 2 });
    expect(line.stopIds).toHaveLength(4);
    expect([line.stopIds[0], line.stopIds[2], line.stopIds[3]]).toEqual([copley, mfa, longwood]);
    expect(line.stopIds[1]).not.toBe(symphony);
    expect(world.state.stops.some((s) => s.id === symphony)).toBe(false);
    expect(line.buses).toBe(buses);
    expect(world.state.ledger.cashCents).toBe(cash - STOP_COST_CENTS + STOP_COST_CENTS / 2);
    expect(world.state.ledger.rows.slice(-2).map((r) => [r.kind, r.amountCents])).toEqual([
      ['stops', -STOP_COST_CENTS],
      ['stopSales', STOP_COST_CENTS / 2],
    ]);
    expect(world.services.get(line.id)!.plan.stops).toHaveLength(4);
  });

  it('reorders the line, buying nothing and taking nothing down', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const ids = [...line.stopIds];
    const cash = world.state.ledger.cashCents;
    expect(setRoute(world, line.id, [LONGWOOD, MFA, SYMPHONY, COPLEY])).toMatchObject({ ok: true, priceCents: 0, refundCents: 0 });
    expect(line.stopIds).toEqual([...ids].reverse());
    expect(world.state.ledger.cashCents).toBe(cash);
  });

  it('takes in a stop placed on its own without buying it, and keeps a stop another line calls at', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const placed = placeStop(world, ON_HUNTINGTON);
    const lone = placed.ok ? placed.stopId : (0 as StopId);
    const [id, next] = mint(world.state.nextIds, 'line');
    world.state.nextIds = next;
    world.state.lines.push({ ...line, id, name: 'Second', stopIds: line.stopIds.slice(0, 2), boardedMilli: 0 });
    recompute(world);
    const symphony = line.stopIds[1]!;
    const cash = world.state.ledger.cashCents;
    expect(setRoute(world, line.id, [COPLEY, ON_HUNTINGTON, MFA, LONGWOOD])).toMatchObject({ ok: true, priceCents: 0, refundCents: 0 });
    expect(line.stopIds[1]).toBe(lone);
    expect(world.state.stops.some((s) => s.id === symphony)).toBe(true);
    expect(world.state.ledger.cashCents).toBe(cash);
  });

  it('refuses no change, a stop twice, one stop, and a line that is not there', () => {
    const world = running();
    const line = world.state.lines[0]!;
    expect(setRoute(world, line.id, [COPLEY, SYMPHONY, MFA, LONGWOOD])).toEqual({ ok: false, reason: 'no_change' });
    expect(setRoute(world, line.id, [COPLEY, SYMPHONY, MFA, SYMPHONY])).toEqual({ ok: false, reason: 'stop_twice', at: 3 });
    expect(setRoute(world, line.id, [COPLEY])).toEqual({ ok: false, reason: 'too_few_stops' });
    expect(setRoute(world, 99 as LineId, [COPLEY, MFA])).toEqual({ ok: false, reason: 'no_such_line' });
  });

  it('is taken back whole by an undo while paused (I9): stops, route and cash to the cent', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const stack = newUndo();
    const was = toSaveData(world.state);
    remember(stack, { command: 'set-route', subject: line.name }, before(world));
    setRoute(world, line.id, [COPLEY, ON_HUNTINGTON, MFA, LONGWOOD]);
    expect(undo(world, stack)).toMatchObject({ ok: true, undone: { command: 'set-route' } });
    expect(toSaveData(world.state)).toEqual(was);
  });
});
