// Removing a stop from a line (the M3 spec, item 14): the line runs without it, and a stop left with
// no line comes down for half its price as a Refunds row, never standing as V2's orphans did. Shown
// failing (TS-04) with the stop left standing: it is still in the game, and no Refunds row comes.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from './debugLine';
import { removeStop } from './removeStop';
import { mint, type LineId, type StopId } from '../core/ids';
import { before, newUndo, remember, undo } from '../undo';
import { fixtureGame } from '../testing';
import { toSaveData } from '../save/save';
import { recompute } from '../world';

function game() {
  const world = fixtureGame();
  addDebugLine(world);
  const line = world.state.lines[0]!;
  return { world, line, symphony: line.stopIds[1]! };
}

describe('removing a stop from a line', () => {
  it('runs the line without Symphony, takes the stop down and refunds $2k as one Refunds row', () => {
    const { world, line, symphony } = game();
    const cash = world.state.ledger.cashCents;
    const riders = world.assignment.lines.get(line.id)!.perDay;
    expect(removeStop(world, line.id, symphony)).toEqual({ ok: true, orphaned: true, refundCents: 200_000 });
    expect(line.stopIds).toHaveLength(3);
    expect(world.state.stops.some((s) => s.id === symphony)).toBe(false);
    expect(world.state.ledger.cashCents).toBe(cash + 200_000);
    expect(world.state.ledger.rows.at(-1)).toMatchObject({ kind: 'refund', amountCents: 200_000 });
    expect(world.services.get(line.id)!.plan.stops).toHaveLength(3);
    expect(world.assignment.lines.get(line.id)!.perDay).not.toBe(riders);
  });

  it('keeps a stop another line calls at, with no refund', () => {
    const { world, line, symphony } = game();
    const [id, next] = mint(world.state.nextIds, 'line');
    world.state.nextIds = next;
    world.state.lines.push({ ...line, id, name: 'Second', stopIds: line.stopIds.slice(0, 2), boardedMilli: 0 });
    recompute(world);
    const cash = world.state.ledger.cashCents;
    expect(removeStop(world, line.id, symphony)).toEqual({ ok: true, orphaned: false, refundCents: 0 });
    expect(world.state.stops.some((s) => s.id === symphony)).toBe(true);
    expect(world.state.ledger.cashCents).toBe(cash);
  });

  it('refuses to leave a line with one stop, and a line or stop that is not there', () => {
    const { world, line } = game();
    removeStop(world, line.id, line.stopIds[1]!);
    removeStop(world, line.id, line.stopIds[1]!);
    expect(removeStop(world, line.id, line.stopIds[0]!)).toEqual({ ok: false, reason: 'line_keeps_two', limit: 2 });
    expect(removeStop(world, 99 as LineId, line.stopIds[0]!)).toEqual({ ok: false, reason: 'no_such_line' });
    expect(removeStop(world, line.id, 99 as StopId)).toEqual({ ok: false, reason: 'no_such_stop' });
  });

  it('is taken back whole by an undo while paused (I9): the stop, the route and the cash to the cent', () => {
    const { world, line, symphony } = game();
    const stack = newUndo();
    const was = toSaveData(world.state);
    remember(stack, { command: 'remove-stop', subject: `Stop ${symphony} from ${line.name}` }, before(world));
    removeStop(world, line.id, symphony);
    expect(undo(world, stack)).toMatchObject({ ok: true, undone: { command: 'remove-stop' } });
    expect(toSaveData(world.state)).toEqual(was);
  });
});
