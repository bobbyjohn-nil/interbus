// Extending a line from either end (the M3 spec, item 14): one Purchases row for the new stops and
// the buses the longer cycle needs, the line running on its new stops, and the line rule's refusals.
import { describe, expect, it } from 'vitest';
import { STOP_COST_CENTS } from '../config/economy';
import { SPARROW } from '../config/fleet';
import type { LngLat } from '../core/geo';
import type { LineId } from '../core/ids';
import { post } from '../economy/ledger';
import { toSaveData } from '../save/save';
import { gameWithDepot } from '../testing';
import { before, newUndo, remember, undo } from '../undo';
import { addDebugLine } from './debugLine';
import { extendLine } from './extendLine';
import { placeStop } from './placeStop';

const BEYOND_LONGWOOD: LngLat = [-71.1085, 42.3395];
const BEYOND_COPLEY: LngLat = [-71.0725, 42.3515];

function game() {
  const world = gameWithDepot();
  addDebugLine(world);
  const line = world.state.lines[0]!;
  return { world, line };
}

describe('extending a line', () => {
  it('adds a stop beyond Longwood, paying for it as a New stops row and any bus the longer cycle needs as a Buses bought row', () => {
    const { world, line } = game();
    const [first, last] = [line.stopIds[0], line.stopIds.at(-1)];
    const cash = world.state.ledger.cashCents;
    const buses = line.buses;
    const result = extendLine(world, line.id, 'end', [BEYOND_LONGWOOD]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(line.stopIds).toHaveLength(5);
    expect(line.stopIds[0]).toBe(first);
    expect(line.stopIds[3]).toBe(last);
    expect(result.priceCents).toBe(STOP_COST_CENTS + result.extraBuses * SPARROW.priceCents);
    expect(line.buses).toBe(buses + result.extraBuses);
    expect(world.state.ledger.cashCents).toBe(cash - result.priceCents);
    const paid = world.state.ledger.rows.filter((r) => r.kind === 'stops' || r.kind === 'buses').slice(result.extraBuses > 0 ? -2 : -1);
    expect(paid.reduce((s, r) => s + r.amountCents, 0)).toBe(-result.priceCents);
    expect(world.state.ledger.rows.at(result.extraBuses > 0 ? -2 : -1)).toMatchObject({ kind: 'stops', amountCents: -STOP_COST_CENTS });
    expect(world.services.get(line.id)!.plan.stops).toHaveLength(5);
  });

  it('adds a stop before Copley, the new stop first', () => {
    const { world, line } = game();
    const first = line.stopIds[0];
    expect(extendLine(world, line.id, 'start', [BEYOND_COPLEY]).ok).toBe(true);
    expect(line.stopIds).toHaveLength(5);
    expect(line.stopIds[1]).toBe(first);
    expect(line.stopIds[0]).toBe(world.state.stops.at(-1)!.id);
  });

  it('refuses a stop the line already calls at, no stops at all, a line that is not there, and more than the cash and credit', () => {
    const { world, line } = game();
    const copley = world.state.stops.find((s) => s.id === line.stopIds[0])!;
    expect(extendLine(world, line.id, 'end', [[copley.lon, copley.lat]])).toMatchObject({ ok: false, reason: 'stop_twice' });
    expect(extendLine(world, line.id, 'end', [])).toEqual({ ok: false, reason: 'no_new_stops' });
    expect(extendLine(world, 99 as LineId, 'end', [BEYOND_LONGWOOD])).toEqual({ ok: false, reason: 'no_such_line' });
    world.state.ledger.cashCents = -14_900_000; // $1k of the $150k credit line left
    expect(extendLine(world, line.id, 'end', [BEYOND_LONGWOOD])).toMatchObject({ ok: false, reason: 'insufficient_funds' });
  });

  // Below the floor (D10) an extension to a stop placed on its own buys nothing, so it is no purchase and goes through, as the
  // ledger's spendParts lets it. Shown failing (TS-04) with the price of nothing compared against the credit line.
  it('extends to a stop standing on its own below the floor, buying nothing', () => {
    const { world, line } = game();
    const placed = placeStop(world, BEYOND_LONGWOOD);
    if (!placed.ok) throw new Error(placed.reason);
    post(world.state.ledger, { day: 1, kind: 'buses', amountCents: -(world.state.ledger.cashCents + 19_900_000) });
    expect(extendLine(world, line.id, 'end', [BEYOND_LONGWOOD])).toEqual({ ok: true, priceCents: 0, extraBuses: 0 });
    expect(line.stopIds.at(-1)).toBe(placed.stopId);
    expect(world.state.ledger.cashCents).toBe(-19_900_000);
  });

  it('is taken back whole by an undo while paused (I9)', () => {
    const { world, line } = game();
    const stack = newUndo();
    const was = toSaveData(world.state);
    remember(stack, { command: 'extend-line', subject: line.name }, before(world));
    extendLine(world, line.id, 'end', [BEYOND_LONGWOOD]);
    undo(world, stack);
    expect(toSaveData(world.state)).toEqual(was);
  });
});
