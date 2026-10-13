// The line card's fare band (the M3 spec, item 4): the day's net at every fare, worked out by
// assignments that visit only the line's own cell pairs. Shown failing (TS-04): with `only` visiting
// the other lines' pairs instead of its own, the band's net at today's fare leaves the line's forecast.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { loadCity } from '../city/simfile';
import { addDebugLine } from '../commands/debugLine';
import type { LineId } from '../core/ids';
import { FARES_CENTS, subsidyCents } from '../rules/fare';
import { newGame } from '../state';
import { createWorld, recompute } from '../world';
import { forecastDay } from './costs';
import { fareBand } from './fareBand';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const world = createWorld(loaded.city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
addDebugLine(world);
const line = world.state.lines[0]!;

/** The line's day as the inspector forecasts it, at its fare and the full network's riders. */
function forecastNet(id: LineId): number {
  const l = world.state.lines.find((x) => x.id === id)!;
  const c = forecastDay(world.services.get(id)!.costs);
  return Math.floor(world.assignment.lines.get(id)!.perDay) * (l.fareCents + subsidyCents(l.fareCents)) - c.running - c.wages - c.deadhead;
}

describe('the fare band', () => {
  it('names the fares within 5% of the best day: $1.75–$2.00 on the starter, every 20 minutes (measured)', () => {
    const band = fareBand(world, line.id)!;
    expect(band.netCents).toHaveLength(FARES_CENTS.length);
    expect(band).toMatchObject({ bestCents: 175, fromCents: 175, toCents: 200 });
    const best = Math.max(...band.netCents);
    FARES_CENTS.forEach((fare, k) => {
      const inBand = fare >= band.fromCents && fare <= band.toCents;
      expect(band.netCents[k]! >= best - 0.05 * Math.abs(best), `$${fare / 100}`).toBe(inBand);
    });
  });

  it('nets at today’s fare what the inspector forecasts, with a second line sharing the streets', () => {
    // A second line on the debug line's streets, two stops of it, competing for the same riders.
    const [a, b] = [world.state.stops[1]!, world.state.stops[2]!];
    world.state.lines.push({ ...line, id: (line.id + 1) as LineId, name: 'Line 2', stopIds: [a.id, b.id], headways: { peak: 600, offpeak: 900, overnight: null }, buses: 2, boardedMilli: 0 });
    recompute(world);
    for (const l of world.state.lines) {
      const band = fareBand(world, l.id)!;
      expect(band.netCents[FARES_CENTS.indexOf(l.fareCents)], l.name).toBe(forecastNet(l.id));
    }
    world.state.lines.pop();
    recompute(world);
  });

  it('has no band for a line with no buses', () => {
    line.buses = 0;
    recompute(world);
    expect(fareBand(world, line.id)).toBeNull();
  });
});
