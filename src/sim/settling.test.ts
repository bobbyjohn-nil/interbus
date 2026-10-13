// A line settling after a change made with its buses out (the M4 spec, item 4; I6, I1, I8): the rows
// it banks are the forecast made at the change, to the cent, each leg and drive at the version it ran
// on; a save mid-way loads to the same plan; and once it has settled it lets go of the earlier
// version, its own day plan holding alone.
import { describe, expect, it } from 'vitest';
import { addDebugLine } from './commands/debugLine';
import { extendLine } from './commands/extendLine';
import { removeStop } from './commands/removeStop';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from './config/time';
import type { LineId, StopId } from './core/ids';
import { forecastDay } from './economy/costs';
import type { RowKind } from './economy/ledger';
import { fromSaveData, toSaveData } from './save/save';
import { advance } from './step';
import { gameWithDepot } from './testing';
import { createWorld, type World } from './world';

const total = (world: World, day: number, kind: RowKind) => world.state.ledger.rows.filter((r) => r.day === day && r.kind === kind).reduce((s, r) => s + r.amountCents, 0);

/** The debug line, then on day 2 at `clock` (08:00 by default), with its buses out, Symphony taken off it or the line extended beyond Longwood. */
function changed(how: 'remove' | 'extend' = 'remove', clock = 8 * SECONDS_PER_HOUR): { world: World; line: LineId } {
  const world = gameWithDepot();
  if (!addDebugLine(world).ok) throw new Error('no line');
  const line = world.state.lines[0]!;
  advance(world, SECONDS_PER_DAY + clock - 5 * SECONDS_PER_HOUR); // founding was 05:00 on day 1
  const done = how === 'remove' ? removeStop(world, line.id, line.stopIds[1] as StopId) : extendLine(world, line.id, 'end', [[-71.1085, 42.3395]]);
  if (!done.ok) throw new Error(`not changed: ${done.reason}`);
  return { world, line: line.id };
}

describe('a line settling after a change (the M4 spec, item 4)', () => {
  it('keeps the version its trips under way began on, until it settles', () => {
    const { world, line } = changed();
    const s = world.services.get(line)!;
    expect(world.state.lines[0]!.earlier).toHaveLength(1);
    expect(s.settling?.frameDay).toBe(2);
    expect(s.effect.merged!.handover).toBeGreaterThan(8 * SECONDS_PER_HOUR);
  });

  it('banks from the change what it forecast at the change, to the cent, each leg at the length of the version it ran on (I1, I6)', () => {
    // At 07:45 the 07:40 trip is on its way out; its run back, after the change, is on the shorter route.
    const { world, line } = changed('extend', 7 * SECONDS_PER_HOUR + 45 * 60);
    const costs = world.services.get(line)!.costs;
    // Hour 7 banks at 08:00, its part before the change included.
    const forecast = forecastDay(costs, 7, 2);
    const kinds = ['running', 'wages', 'deadhead'] as const;
    const before = kinds.map((k) => total(world, 2, k));
    advance(world, 16 * SECONDS_PER_HOUR + 15 * 60);
    kinds.forEach((k, i) => expect(total(world, 2, k) - before[i]!, k).toBe(-forecast[k]));
    // Billed as the new version throughout, those hours would cost more.
    expect(forecast.running).toBeLessThan(forecastDay(costs, 7).running);
  });

  it('loads a save made while it settles to the same plan (I8)', () => {
    const { world, line } = changed();
    advance(world, 600);
    const loaded = createWorld(world.city, fromSaveData(toSaveData(world.state)));
    expect(JSON.stringify(loaded.services.get(line)!.effect)).toBe(JSON.stringify(world.services.get(line)!.effect));
  });

  it('lets go of the earlier version at the close after it has settled, its day plan holding alone', () => {
    const { world, line } = changed();
    const closes = advance(world, 16 * SECONDS_PER_HOUR);
    expect(closes.at(-1)!.retimed).toBe(true);
    expect(world.state.lines[0]!.earlier).toEqual([]);
    expect(world.services.get(line)!.effect.merged).toBeNull();
  });
});
