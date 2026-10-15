// A line settling after a change made with its buses out (the M4 spec, item 4; I6, I1, I8): the rows
// it banks are the forecast made at the change, to the cent, each leg and drive at the version it ran
// on; a save mid-way loads to the same plan; and once it has settled it lets go of the earlier
// version, its own day plan holding alone. A line drawn mid-day starts the same way, from its depot.
import { describe, expect, it } from 'vitest';
import { createLine } from './commands/createLine';
import { addDebugLine, DEBUG_STOPS } from './commands/debugLine';
import { extendLine } from './commands/extendLine';
import { removeStop } from './commands/removeStop';
import { setHeadways } from './commands/setHeadways';
import { WAGE_CENTS_PER_HOUR } from './config/fleet';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from './config/time';
import type { LineId, StopId } from './core/ids';
import { forecastDay, lineCostsInHour } from './economy/costs';
import type { RowKind } from './economy/ledger';
import { hourOfPlan } from './rules/schedule';
import { busesOutAt } from './rules/transition';
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

// Shown failing (TS-04) on 5f4bce3: the line drawn at 10:20 had 3 buses out at that instant, placed
// on its streets by its day plan, with no drive out billed.
describe('a line whose service starts with none of its buses out (I6, I1)', () => {
  it('starts a line drawn at 10:20 from its depot: each bus pulls out in time for its first departure, billed for the drive, and nothing billed before the line was drawn', () => {
    const world = gameWithDepot();
    advance(world, 5 * SECONDS_PER_HOUR + 20 * 60); // 10:20 on day 1
    const at = 10 * SECONDS_PER_HOUR + 20 * 60;
    const made = createLine(world, DEBUG_STOPS.map((s) => s.at), { peak: 600, offpeak: 600, overnight: null });
    if (!made.ok) throw new Error(made.reason);
    const service = world.services.get(made.lineId)!;
    const { effect } = service;
    const plan = effect.merged ?? effect.periodic;
    const { pullOutS } = service.day.inputs;
    // No bus out as it is drawn, no departure before one could reach it from the depot, and one pulling out for each.
    expect(busesOutAt(effect, at)).toBe(0);
    expect(plan.trips.filter((t) => t >= at && t < at + pullOutS)).toEqual([]);
    const outs = plan.stints.filter((s) => s.leaveDepot >= at && s.leaveDepot < 11 * SECONDS_PER_HOUR).length;
    expect(outs).toBe(world.state.lines[0]!.buses);
    // Hour 10 banks at 11:00 what was forecast when the line was drawn: a drive out for each bus, as the
    // morning's first is billed, and drivers paid only from their drives out.
    const forecast = (h: number) => forecastDay(service.costs, h, 1);
    const kinds = ['running', 'wages', 'deadhead'] as const;
    const before = kinds.map((k) => total(world, 1, k));
    advance(world, 40 * 60);
    const hour = kinds.map((k, i) => total(world, 1, k) - before[i]!);
    expect(hour).toEqual(kinds.map((k) => forecast(11)[k] - forecast(10)[k]));
    // One drive out, as the day plan bills the morning's first (without a day, its hour on the day plan).
    const driveOut = lineCostsInHour(service.costs, 4).deadhead / hourOfPlan(service.day, 4 * SECONDS_PER_HOUR, 5 * SECONDS_PER_HOUR).pullOuts;
    expect(hour[2]).toBe(-outs * driveOut);
    expect(-hour[1]!).toBeLessThanOrEqual(Math.ceil((outs * (11 * SECONDS_PER_HOUR - at) * WAGE_CENTS_PER_HOUR) / SECONDS_PER_HOUR));
  });

  // Changed again within the hour it was drawn, once it has handed over to its own day plan, it keeps
  // the version before the draw, which ran no bus (world.ts), so that hour still bills only from the
  // drives out. Shown failing (TS-04) with recomputeInService letting go of a drawn line's earlier
  // versions once it has handed over, as of any settled line, and with merge() starting again from the
  // day plan past a handover: hour 15 billed the 15:00 departure no bus ran, three drivers from 15:00
  // ($78.00 of wages, where from their drives out it is $52.00) and no drive out ($0, where three cost
  // $10.32).
  it('bills the hour a line was drawn from its drives out after a second change in that hour', () => {
    const world = gameWithDepot();
    advance(world, 10 * SECONDS_PER_HOUR + 60); // 15:01 on day 1
    const at = 15 * SECONDS_PER_HOUR + 60;
    const made = createLine(world, DEBUG_STOPS.map((s) => s.at), { peak: 600, offpeak: 600, overnight: null });
    if (!made.ok) throw new Error(made.reason);
    const drawn = world.services.get(made.lineId)!;
    const { handover } = drawn.effect.merged!;
    expect(handover).toBeLessThan(15.75 * SECONDS_PER_HOUR);
    advance(world, handover + 60 - at);
    if (!setHeadways(world, made.lineId, { peak: 900, offpeak: 900, overnight: null }).ok) throw new Error('no change');
    const plan = world.services.get(made.lineId)!.effect.merged!;
    const { pullOutS } = drawn.day.inputs;
    // Still no departure before a bus could reach it from the depot, and one pulling out for each bus.
    expect(plan.trips.filter((t) => t >= 15 * SECONDS_PER_HOUR && t < at + pullOutS)).toEqual([]);
    const outs = plan.stints.filter((s) => s.leaveDepot >= at && s.leaveDepot < 16 * SECONDS_PER_HOUR).length;
    expect(outs).toBe(world.state.lines[0]!.buses);
    const kinds = ['running', 'wages', 'deadhead'] as const;
    const before = kinds.map((k) => total(world, 1, k));
    advance(world, 16 * SECONDS_PER_HOUR - (handover + 60));
    const hour = kinds.map((k, i) => total(world, 1, k) - before[i]!);
    const driveOut = lineCostsInHour(drawn.costs, 4).deadhead / hourOfPlan(drawn.day, 4 * SECONDS_PER_HOUR, 5 * SECONDS_PER_HOUR).pullOuts;
    expect(hour[2]).toBe(-outs * driveOut);
    expect(-hour[1]!).toBeLessThanOrEqual(Math.ceil((outs * (16 * SECONDS_PER_HOUR - at) * WAGE_CENTS_PER_HOUR) / SECONDS_PER_HOUR));
  });
});
