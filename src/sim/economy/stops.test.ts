// Each stop's day (the M3 spec, item 5): boardings, alightings and net, flagged QUIET or LOSS. Shown
// failing (TS-04) with the line's costs left out of its stops, as V1 and V2 left fixed costs out of
// "profit": the nets no longer add up to the line's, and no stop of a starved line reads LOSS.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { loadCity } from '../city/simfile';
import { addDebugLine } from '../commands/debugLine';
import { stopUpkeepCents } from '../config/stops';
import { subsidyCents } from '../rules/fare';
import { newGame } from '../state';
import { createWorld, recompute } from '../world';
import { forecastDay } from './costs';
import { stopDays } from './stops';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
addDebugLine(world);
const line = world.state.lines[0]!;

/** The line's day, unrounded: its riders at the fare and subsidy, less its costs and its stops' upkeep (D25). */
function lineNet(): number {
  const c = forecastDay(world.services.get(line.id)!.costs);
  const upkeep = line.stopIds.reduce((s, id) => s + stopUpkeepCents(world.state.stops.find((x) => x.id === id)!.tier), 0);
  return world.assignment.lines.get(line.id)!.perDay * (line.fareCents + subsidyCents(line.fareCents)) - c.running - c.wages - c.deadhead - upkeep;
}

describe('each stop’s day', () => {
  it('shares the line’s day out among its stops: boardings and alightings add up to its riders, nets to its net', () => {
    const days = stopDays(world);
    const riders = world.assignment.lines.get(line.id)!.perDay;
    expect(days.reduce((s, d) => s + d.boardings, 0)).toBeCloseTo(riders, 9);
    expect(days.reduce((s, d) => s + d.alightings, 0)).toBeCloseTo(riders, 9);
    expect(Math.abs(days.reduce((s, d) => s + d.netCents, 0) - lineNet())).toBeLessThanOrEqual(2);
    expect(days.some((d) => d.quiet || d.loss)).toBe(false); // the starter's stops all pay (measured: $54.54 to $714.74)
  });

  it('flags a starved line’s stops: Longwood QUIET at 1.7 boardings, Symphony LOSS at −$26.65 a day (measured; −$22.65 before its Sign’s $4 upkeep, D25; −$33.51 before buses drove one-way streets both ways, −$35.92 before item 15’s congestion)', () => {
    line.headways = { peak: 3_600, offpeak: 3_600, overnight: null };
    line.buses = 1;
    recompute(world);
    const days = stopDays(world);
    const [, symphony, , longwood] = line.stopIds.map((id) => days.find((d) => d.id === id)!);
    expect(longwood).toMatchObject({ quiet: true, loss: false });
    expect(longwood!.boardings).toBeLessThan(5);
    expect(symphony).toMatchObject({ quiet: false, loss: true, netCents: -2_665 });
    expect(Math.abs(days.reduce((s, d) => s + d.netCents, 0) - lineNet())).toBeLessThanOrEqual(2);
  });
});
