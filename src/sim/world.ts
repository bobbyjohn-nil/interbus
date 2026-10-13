// The running game: the city it plays on, the sim state the save holds, and what is derived from
// both (routes, the commuter matrix, who rides which line). Owned by the worker (PLAN §6).
import { buildCommuters, type Commuters } from './demand/commuters';
import { assign, type Assignment, type LinePlan } from './demand/assign';
import { SpatialGrid, toXY, type XY } from './core/geo';
import type { City } from './city/simfile';
import { createRouter, type Router } from './city/route';
import type { Line, SimState } from './state';

export interface World {
  readonly city: City;
  readonly router: Router;
  readonly commuters: Commuters;
  readonly nodes: SpatialGrid<number>;
  state: SimState;
  /** Recomputed whenever the network changes (recompute()). */
  assignment: Assignment;
}

export function nearestNode(world: Pick<World, 'nodes' | 'city'>, p: XY): number | null {
  // Most of the fixture is within 50 m of a node; widen until something answers.
  for (const r of [100, 400, 1600]) {
    const hit = world.nodes.nearest(p, r);
    if (hit) return hit.item;
  }
  return null;
}

/** A line as the demand model sees it: stop positions and distances along its streets. */
export function planLine(world: Pick<World, 'city' | 'router' | 'nodes' | 'state'>, line: Line): LinePlan | null {
  const stops = line.stopIds.map((id) => world.state.stops.find((s) => s.id === id));
  if (stops.some((s) => !s) || stops.length < 2) return null;
  const xy = stops.map((s) => toXY(world.city.frame, [s!.lon, s!.lat]));
  const dist = [0];
  for (let k = 1; k < xy.length; k++) {
    const from = nearestNode(world, xy[k - 1]!);
    const to = nearestNode(world, xy[k]!);
    const path = from === null || to === null ? null : world.router.route(from, to);
    if (!path) return null;
    dist.push(dist[k - 1]! + path.dm / 10);
  }
  return { id: line.id, stops: xy, stopDistM: dist, headways: line.headways, fareCents: line.fareCents };
}

export function recompute(world: World): void {
  const plans = world.state.lines.map((l) => planLine(world, l)).filter((p): p is LinePlan => p !== null);
  world.assignment = assign(world.city, world.commuters, plans);
}

export function createWorld(city: City, state: SimState): World {
  const nodes = new SpatialGrid<number>(200);
  for (let n = 0; n < city.graph.nodeCount; n++) nodes.add([city.graph.x[n]!, city.graph.y[n]!], n);
  const world: World = {
    city,
    router: createRouter(city.graph),
    commuters: buildCommuters(city),
    nodes,
    state,
    assignment: { lines: new Map(), tripsPerDay: 0 },
  };
  recompute(world);
  return world;
}
