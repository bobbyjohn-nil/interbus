// A stop's tier as a command (the M3 spec, item 5): one Purchases row up, one Sales row down at half,
// and riders who feel the stop nearer. Shown failing (TS-04) with the world not passing the stops'
// walk bonus to the assignment: a Shelter at Symphony then carries no more riders.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { loadCity } from '../city/simfile';
import { newGame } from '../state';
import { createWorld } from '../world';
import { addDebugLine } from './debugLine';
import { setStopTier } from './setStopTier';

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;

function game() {
  const world = createWorld(city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  addDebugLine(world);
  const line = world.state.lines[0]!;
  return { world, line, symphony: line.stopIds[1]!, riders: () => world.assignment.lines.get(line.id)!.perDay };
}

describe('setting a stop’s tier', () => {
  it('buys a Shelter at Symphony for $12k as one Purchases row, and the line carries 32.0 more riders a day (measured)', () => {
    const { world, symphony, riders } = game();
    const cash = world.state.ledger.cashCents;
    const before = riders();
    expect(setStopTier(world, symphony, 2)).toEqual({ ok: true, priceCents: 1_200_000, saleCents: 0 });
    expect(world.state.ledger.cashCents).toBe(cash - 1_200_000);
    expect(world.state.ledger.rows.at(-1)).toMatchObject({ kind: 'purchase', amountCents: -1_200_000 });
    expect(world.state.stops.find((s) => s.id === symphony)!.tier).toBe(2);
    expect(riders() - before).toBeCloseTo(32.0, 1);
  });

  it('sells a Station back down to a Shelter for half its step, $17.5k, as one Sales row, and riders return to the Shelter’s', () => {
    const { world, symphony, riders } = game();
    setStopTier(world, symphony, 2);
    const shelter = riders();
    setStopTier(world, symphony, 3);
    const cash = world.state.ledger.cashCents;
    expect(setStopTier(world, symphony, 2)).toEqual({ ok: true, priceCents: 0, saleCents: 1_750_000 });
    expect(world.state.ledger.cashCents).toBe(cash + 1_750_000);
    expect(world.state.ledger.rows.at(-1)).toMatchObject({ kind: 'sale', amountCents: 1_750_000 });
    expect(riders()).toBe(shelter);
  });

  it('refuses an Interchange where one line calls, and a stop that is not there', () => {
    const { world, symphony } = game();
    expect(setStopTier(world, symphony, 4)).toMatchObject({ ok: false, reason: 'needs_lines', limit: 3 });
    expect(setStopTier(world, 999 as typeof symphony, 2)).toMatchObject({ ok: false, reason: 'no_such_stop' });
  });
});
