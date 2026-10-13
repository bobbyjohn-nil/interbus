// I2's stop clause (PLAN §6): adding a stop never cuts linked trips by more than 0.1%, with the dwell
// held at zero, so what is measured is the assignment alone. V1 kept each home's 4 nearest stops, so a
// new stop could push a useful one out of reach (EC-02, K04); that is the bug this holds off. The dwell
// is the stop's real price, paid by every rider who rides through it; invariants.test.ts bounds it.
import { describe, expect, it, vi } from 'vitest';
import { bakeSim } from '../../../tools/bake/sim.mjs';
import { addDebugLine } from '../commands/debugLine';
import { loadCity } from '../city/simfile';
import { toLngLat, toXY } from '../core/geo';
import { mint } from '../core/ids';
import { newGame } from '../state';
import { createWorld, nearestNode, recompute, type World } from '../world';
import type * as Demand from '../config/demand';

vi.mock('../config/demand', async (original) => ({ ...(await original<typeof Demand>()), DWELL_SEC: 0 }));

const loaded = loadCity(bakeSim('boston', 'mini-boston').text);
if (!loaded.ok) throw new Error(loaded.problem);
const city = loaded.city;

function game(): World {
  const world = createWorld(city, newGame({ id: 'boston', revision: 'mini-boston', hash: '-' }, { name: 'x', colour: '#000000' }, 1));
  addDebugLine(world);
  return world;
}

describe('I2: a stop inserted on the line’s own streets never cuts linked trips by more than 0.1%, dwell aside', () => {
  it('holds between any two of the debug line’s stops', () => {
    const world = game();
    const before = world.assignment.tripsPerDay;
    const stops = world.state.lines[0]!.stopIds.map((id) => world.state.stops.find((s) => s.id === id)!);
    for (let k = 1; k < stops.length; k++) {
      const from = nearestNode(world, toXY(city.frame, [stops[k - 1]!.lon, stops[k - 1]!.lat]))!;
      const to = nearestNode(world, toXY(city.frame, [stops[k]!.lon, stops[k]!.lat]))!;
      const middle = world.router.route(from, to)!.nodes;
      const node = middle[Math.floor(middle.length / 2)]!;
      const trial = game();
      const [id, next] = mint(trial.state.nextIds, 'stop');
      trial.state.nextIds = next;
      const [lon, lat] = toLngLat(city.frame, [city.graph.x[node]!, city.graph.y[node]!]);
      trial.state.stops.push({ id, lon, lat });
      trial.state.lines[0]!.stopIds.splice(k, 0, id);
      recompute(trial);
      expect(trial.assignment.tripsPerDay, `a stop between stops ${k} and ${k + 1}`).toBeGreaterThanOrEqual(before * 0.999);
    }
  });
});
