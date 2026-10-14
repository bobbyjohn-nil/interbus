// A stop placed on its own (D25: "options to place individual stops"): a Sign on the nearest street
// for one New stops row, standing with no line until one calls there, never where the line tool
// would join a stop already standing; and taken down for half its cost while no line calls there.
// Shown failing (TS-04) on the stop rule that joined the stop near the click instead of refusing,
// and with a lone stop flagged Quiet.
import { describe, expect, it } from 'vitest';
import { STOP_COST_CENTS } from '../config/economy';
import { STOP_JOIN_M } from '../config/lines';
import type { LngLat } from '../core/geo';
import type { StopId } from '../core/ids';
import { post } from '../economy/ledger';
import { stopDays } from '../economy/stops';
import { spendableCents } from '../rules/credit';
import { toSaveData } from '../save/save';
import { gameWithDepot } from '../testing';
import { before, newUndo, remember, undo } from '../undo';
import { createLine } from './createLine';
import { addDebugLine, DEBUG_STOPS } from './debugLine';
import { placeStop } from './placeStop';
import { takeDownStop } from './takeDownStop';

/** On Huntington Avenue between Symphony and the MFA, more than 250 m from each. */
const ON_HUNTINGTON: LngLat = [-71.0903, 42.33995];

describe('placing a stop on its own (D25)', () => {
  it('puts a Sign on the nearest street for a New stops row, with no line and no flag', () => {
    const world = gameWithDepot();
    const cash = world.state.ledger.cashCents;
    const placed = placeStop(world, ON_HUNTINGTON);
    expect(placed).toMatchObject({ ok: true, priceCents: STOP_COST_CENTS });
    const id = placed.ok ? placed.stopId : (0 as StopId);
    expect(world.state.stops.find((s) => s.id === id)).toMatchObject({ tier: 1 });
    expect(world.state.lines.some((l) => l.stopIds.includes(id))).toBe(false);
    expect(world.state.ledger.cashCents).toBe(cash - STOP_COST_CENTS);
    expect(world.state.ledger.rows.at(-1)).toMatchObject({ kind: 'stops', amountCents: -STOP_COST_CENTS });
    // Its day: nobody boards and it costs its upkeep, but it waits for a line rather than reading Quiet.
    expect(stopDays(world).find((d) => d.id === id)).toMatchObject({ boardings: 0, netCents: -400, quiet: false, loss: false });
  });

  it('refuses beside a stop already standing, off the streets, and short of cash', () => {
    const world = gameWithDepot();
    addDebugLine(world);
    const symphony = world.state.lines[0]!.stopIds[1]!;
    expect(placeStop(world, DEBUG_STOPS[1]!.at)).toEqual({ ok: false, reason: 'stop_near', limitM: STOP_JOIN_M, stopId: symphony });
    expect(placeStop(world, [-71.0, 42.0])).toMatchObject({ ok: false, reason: 'no_street_near' });
    post(world.state.ledger, { day: 1, kind: 'buses', amountCents: -(spendableCents(world.state.ledger.cashCents) - 1_000) });
    expect(placeStop(world, ON_HUNTINGTON)).toEqual({ ok: false, reason: 'insufficient_funds', shortCents: STOP_COST_CENTS - 1_000 });
  });

  it('is joined by the line tool, which buys no stop there', () => {
    const world = gameWithDepot();
    const placed = placeStop(world, ON_HUNTINGTON);
    const lone = placed.ok ? placed.stopId : (0 as StopId);
    const cash = world.state.ledger.cashCents;
    const created = createLine(world, [DEBUG_STOPS[0]!.at, ON_HUNTINGTON, DEBUG_STOPS[3]!.at]);
    expect(created.ok).toBe(true);
    expect(world.state.lines[0]!.stopIds[1]).toBe(lone);
    expect(world.state.ledger.rows.filter((r) => r.kind === 'stops').at(-1)!.amountCents).toBe(-2 * STOP_COST_CENTS);
    expect(world.state.ledger.cashCents).toBeLessThan(cash);
  });

  it('comes down for half its cost while no line calls there, and not while one does', () => {
    const world = gameWithDepot();
    const placed = placeStop(world, ON_HUNTINGTON);
    const lone = placed.ok ? placed.stopId : (0 as StopId);
    const cash = world.state.ledger.cashCents;
    expect(takeDownStop(world, lone)).toEqual({ ok: true, refundCents: STOP_COST_CENTS / 2 });
    expect(world.state.stops.some((s) => s.id === lone)).toBe(false);
    expect(world.state.ledger.cashCents).toBe(cash + STOP_COST_CENTS / 2);
    expect(world.state.ledger.rows.at(-1)).toMatchObject({ kind: 'stopSales', amountCents: STOP_COST_CENTS / 2 });
    expect(takeDownStop(world, lone)).toEqual({ ok: false, reason: 'no_such_stop' });
    addDebugLine(world);
    expect(takeDownStop(world, world.state.lines[0]!.stopIds[0]!)).toEqual({ ok: false, reason: 'stop_in_use', limit: 1 });
  });

  it('is taken back whole by an undo while paused (I9)', () => {
    const world = gameWithDepot();
    const stack = newUndo();
    const was = toSaveData(world.state);
    remember(stack, { command: 'place-stop', subject: 'Stop 1' }, before(world));
    placeStop(world, ON_HUNTINGTON);
    expect(undo(world, stack)).toMatchObject({ ok: true, undone: { command: 'place-stop' } });
    expect(toSaveData(world.state)).toEqual(was);
  });
});
