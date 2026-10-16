// A line's whole route set at once (D25: "reorder, add, and remove stops"): one command buys what the
// new route adds, keeps its buses, takes down a stop it leaves that no other line calls at for half
// its cost, and runs the line through the new stops; it refuses no change, a stop twice and a line of
// one stop, and an undo puts it all back. Shown failing (TS-04) with the stops it leaves kept standing
// and with the refund left out of the cash.
import { describe, expect, it } from 'vitest';
import { STOP_COST_CENTS } from '../config/economy';
import type { LngLat } from '../core/geo';
import { mint, type LineId, type StopId } from '../core/ids';
import { post } from '../economy/ledger';
import { toSaveData } from '../save/save';
import { busesNeeded } from '../rules/cycle';
import { depotRoom } from '../rules/line';
import { gameWithDepot, KENMORE } from '../testing';
import { before, newUndo, remember, undo } from '../undo';
import { fleetContext, recompute, type World } from '../world';
import { createLine } from './createLine';
import { addDebugLine, DEBUG_STOPS } from './debugLine';
import { extendLine } from './extendLine';
import { insertStop } from './insertStop';
import { placeStop } from './placeStop';
import { routeVerdict, setRoute } from './setRoute';
import { setHeadways } from './setHeadways';

/** On Huntington Avenue between Symphony and the MFA, more than 250 m from each. */
const ON_HUNTINGTON: LngLat = [-71.0903, 42.33995];
/** In the Charles River basin, no street within reach. */
const RIVER: LngLat = [-71.0905, 42.3555];
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

  // Below the floor (D10) the countdown runs, and a route that spends nothing or gives money back is no purchase: it goes through,
  // as Remove on the stop card does, and a route that buys a stop is still refused. Shown failing (TS-04) with the net, nothing or
  // $2k back, compared against the credit line: at -$199,000 the reorder read "$49,000 short", and the route that drops a stop
  // "Total $2k back" beside "$47,000 short".
  it('reorders a line and drops a stop below the floor, and still refuses a route that buys a stop there', () => {
    const world = running();
    const line = world.state.lines[0]!;
    post(world.state.ledger, { day: 1, kind: 'buses', amountCents: -(world.state.ledger.cashCents + 19_900_000) });
    expect(setRoute(world, line.id, [COPLEY, ON_HUNTINGTON, MFA, LONGWOOD])).toEqual({ ok: false, reason: 'insufficient_funds', shortCents: STOP_COST_CENTS / 2 + 4_900_000 });
    expect(setRoute(world, line.id, [LONGWOOD, MFA, SYMPHONY, COPLEY])).toMatchObject({ ok: true, priceCents: 0, refundCents: 0 });
    expect(setRoute(world, line.id, [LONGWOOD, MFA, SYMPHONY])).toMatchObject({ ok: true, priceCents: 0, refundCents: STOP_COST_CENTS / 2 });
    expect(line.stopIds).toHaveLength(3);
    expect(world.state.ledger.cashCents).toBe(-19_900_000 + STOP_COST_CENTS / 2);
  });

  it('takes in a stop placed on its own below the floor, buying nothing', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const placed = placeStop(world, ON_HUNTINGTON);
    if (!placed.ok) throw new Error(placed.reason);
    post(world.state.ledger, { day: 1, kind: 'buses', amountCents: -(world.state.ledger.cashCents + 19_900_000) });
    expect(setRoute(world, line.id, [COPLEY, SYMPHONY, ON_HUNTINGTON, MFA, LONGWOOD])).toMatchObject({ ok: true, priceCents: 0, refundCents: 0 });
    expect(line.stopIds[2]).toBe(placed.stopId);
    expect(world.state.ledger.cashCents).toBe(-19_900_000);
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

  // The rule resolves the points in order and stops at the first it refuses, so every line stop after
  // that point counted as left out: the editor's card said a route led by a point in the river took
  // all four stops down for $8k back. Shown failing (TS-04) with the stops left out read from the draft
  // as far as it resolved.
  it('names as coming down only the stops a refused route leaves out, not every stop after the refused point', () => {
    const world = running();
    const line = world.state.lines[0]!;
    const symphony = line.stopIds[1]!;
    expect(routeVerdict(world, line.id, [RIVER, COPLEY, SYMPHONY, MFA, LONGWOOD])).toMatchObject({ ok: false, reason: 'no_street_near', at: 0, removed: [], refundCents: 0 });
    expect(routeVerdict(world, line.id, [COPLEY, SYMPHONY, COPLEY, MFA, LONGWOOD])).toMatchObject({ ok: false, reason: 'stop_twice', at: 2, removed: [], refundCents: 0 });
    // Symphony left out as well: it, and only it, comes down.
    expect(routeVerdict(world, line.id, [RIVER, COPLEY, MFA, LONGWOOD])).toMatchObject({ ok: false, reason: 'no_street_near', removed: [{ stopId: symphony, refundCents: STOP_COST_CENTS / 2 }], refundCents: STOP_COST_CENTS / 2 });
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

// The room a route edit names is the depots' own (the systems audit's fourth round): the line rule runs
// with the line's own buses set aside, so it counted them free, and with every depot full the editor
// asked for "2 more Sparrows" beside "Depots have room for 2 more" while the headway card said "Your
// depots are full" (GD-05). Shown failing (TS-04) with the line's own two buses in the room named.
describe('a route edit that needs more buses than the depots hold', () => {
  /** Beyond Longwood, and on towards Kenmore and back to Copley: three stops that need three more buses every 15 minutes. */
  const BEYOND: LngLat[] = [
    [-71.11123, 42.33412],
    [-71.10529, 42.35502],
    [-71.07479, 42.35481],
  ];
  /** By the leg from the MFA to Longwood. */
  const BESIDE: LngLat = [-71.098, 42.334];

  /** The debug line every 15 minutes on its two Sparrows, and a line from Copley to Kenmore every `kenmore` minutes, with the one depot's six places. */
  function company(kenmore: number): World {
    const world = running();
    const line = world.state.lines[0]!;
    line.headways = { peak: 900, offpeak: 900, overnight: null };
    recompute(world);
    line.buses = busesNeeded(world.services.get(line.id)!.timing.cycles!, line.headways);
    recompute(world);
    expect(line.buses).toBe(2);
    expect(createLine(world, [COPLEY, KENMORE], { peak: kenmore * 60, offpeak: kenmore * 60, overnight: null }).ok).toBe(true);
    return world;
  }

  /** Each edit of the debug line: its verdict as the editor's card reads it, and the buses it needs beyond the line's own. */
  function edits(world: World) {
    const line = world.state.lines[0]!;
    const route = (points: readonly LngLat[]) => routeVerdict(world, line.id, points)!;
    return {
      'add a stop': route([COPLEY, SYMPHONY, MFA, LONGWOOD, BEYOND[0]!]),
      'add three stops': route([COPLEY, SYMPHONY, MFA, LONGWOOD, ...BEYOND]),
      'remove a stop': route([COPLEY, MFA, LONGWOOD]),
      'reverse it': route([LONGWOOD, MFA, SYMPHONY, COPLEY]),
      'reorder it': route([COPLEY, MFA, SYMPHONY, LONGWOOD]),
      'insert a stop': route([COPLEY, SYMPHONY, MFA, BESIDE, LONGWOOD]),
    };
  }

  it('names no room with every depot full, as the headway card does, and lets an edit that needs no bus through', () => {
    const world = company(5);
    const line = world.state.lines[0]!;
    expect(depotRoom(fleetContext(world))).toBe(0);
    expect(setHeadways(world, line.id, { peak: 600, offpeak: 600, overnight: null })).toEqual({ ok: false, reason: 'depot_full', room: 0 });
    const v = edits(world);
    for (const name of ['add a stop', 'add three stops', 'reorder it', 'insert a stop'] as const) {
      expect(v[name], name).toMatchObject({ ok: false, reason: 'depot_full', room: 0 });
      expect(v[name].extraBuses, name).toBeGreaterThan(0);
    }
    expect(v['add three stops'].extraBuses).toBe(3);
    for (const name of ['remove a stop', 'reverse it'] as const) expect(v[name], name).toMatchObject({ ok: true, extraBuses: 0 });
    // The commands refuse as the card does, extensions and an insertion included.
    expect(setRoute(world, line.id, [COPLEY, SYMPHONY, MFA, LONGWOOD, ...BEYOND])).toEqual({ ok: false, reason: 'depot_full', room: 0 });
    expect(extendLine(world, line.id, 'end', [BEYOND[0]!])).toEqual({ ok: false, reason: 'depot_full', room: 0 });
    expect(extendLine(world, line.id, 'start', [BEYOND[2]!])).toEqual({ ok: false, reason: 'depot_full', room: 0 });
    expect(insertStop(world, line.id, BESIDE)).toEqual({ ok: false, reason: 'depot_full', room: 0 });
  });

  it('names the room there is when an edit needs more, and lets an edit that fits through', () => {
    const world = company(10);
    const line = world.state.lines[0]!;
    const room = depotRoom(fleetContext(world));
    expect(room).toBe(2);
    const v = edits(world);
    expect(v['add three stops']).toMatchObject({ ok: false, reason: 'depot_full', room, extraBuses: 3 });
    expect(extendLine(world, line.id, 'end', BEYOND)).toEqual({ ok: false, reason: 'depot_full', room });
    for (const name of ['add a stop', 'reorder it', 'insert a stop', 'remove a stop', 'reverse it'] as const) expect(v[name], name).toMatchObject({ ok: true });
    expect(insertStop(world, line.id, BESIDE)).toMatchObject({ ok: true, extraBuses: 1 });
  });
});
