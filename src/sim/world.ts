// The running game: the city it plays on, the sim state the save holds, and what is derived from
// both (routes, the commuter matrix, who rides which line). Owned by the worker (PLAN §6).
import { buildCommuters, type Commuters } from './demand/commuters';
import { assign, type Assignment, type LinePlan } from './demand/assign';
import { SpatialGrid, toXY, type XY } from './core/geo';
import type { City } from './city/simfile';
import { createRouter, type Router } from './city/route';
import { DEPOT_CAPACITY, DEPOT_STREET_REACH_M } from './config/depots';
import { BUS_MODELS, LAYOVER_SECONDS } from './config/fleet';
import { STOP_TIERS } from './config/stops';
import type { DepotId, LineId } from './core/ids';
import { driveSeconds, type LineCostInputs } from './economy/costs';
import { cycleSeconds } from './rules/cycle';
import type { DepotSiteContext } from './rules/depot';
import type { FleetContext, LineDraftContext } from './rules/line';
import { dayPlan, type DayPlan } from './rules/schedule';
import { runningHeadwayIn, type Timing } from './rules/timetable';
import type { Line, SimState } from './state';

/** What a line runs as, worked out from the state when the network changes (recompute()). */
export interface LineService {
  readonly plan: LinePlan;
  readonly timing: Timing;
  /** Every departure and every bus's stint: what the costs bill and the vehicles draw (I6). */
  readonly day: DayPlan;
  readonly costs: LineCostInputs;
  /** The depot its buses park at: the nearest by driving time with room (V3), or null with none. */
  readonly depotId: DepotId | null;
  /** The street node its buses leave that depot from, or null. */
  readonly depotNode: number | null;
}

export interface World {
  readonly city: City;
  readonly router: Router;
  readonly commuters: Commuters;
  readonly nodes: SpatialGrid<number>;
  state: SimState;
  /** Recomputed whenever the network changes (recompute()). */
  assignment: Assignment;
  services: Map<LineId, LineService>;
}

export function nearestNode(world: Pick<World, 'nodes' | 'city'>, p: XY): number | null {
  // Most of the fixture is within 50 m of a node; widen until something answers.
  for (const r of [100, 400, 1600]) {
    const hit = world.nodes.nearest(p, r);
    if (hit) return hit.item;
  }
  return null;
}

/** Street metres a bus drives from one stop position to the next, or null if no street joins them: the line tool, the plan and the costs all read this. */
export function legMetres(world: Pick<World, 'router' | 'nodes' | 'city'>, from: XY, to: XY): number | null {
  const a = nearestNode(world, from);
  const b = nearestNode(world, to);
  const path = a === null || b === null ? null : world.router.route(a, b);
  return path ? path.dm / 10 : null;
}

/** A line as the demand model sees it: stop positions and distances along its streets. */
export function planLine(world: Pick<World, 'city' | 'router' | 'nodes' | 'state'>, line: Line): LinePlan | null {
  const stops = line.stopIds.map((id) => world.state.stops.find((s) => s.id === id));
  if (stops.some((s) => !s) || stops.length < 2) return null;
  const xy = stops.map((s) => toXY(world.city.frame, [s!.lon, s!.lat]));
  const dist = [0];
  for (let k = 1; k < xy.length; k++) {
    const leg = legMetres(world, xy[k - 1]!, xy[k]!);
    if (leg === null) return null;
    dist.push(dist[k - 1]! + leg);
  }
  return {
    id: line.id,
    stops: xy,
    stopDistM: dist,
    headways: line.headways,
    fareCents: line.fareCents,
    walkBonusMin: stops.map((s) => STOP_TIERS[s!.tier].walkBonusMin),
    transferPenaltyMin: stops.map((s) => STOP_TIERS[s!.tier].transferPenaltyMin),
  };
}

/** What the fleet rules read for this world (sim/rules/line.ts). */
export function fleetContext(world: Pick<World, 'state'>): FleetContext {
  return { depots: world.state.depots.length, busesOwned: world.state.lines.reduce((n, l) => n + l.buses, 0), cashCents: world.state.ledger.cashCents };
}

/** What the line tool's rules read for this world: street nodes, the stops standing, the streets between them and the fleet (GD-05). */
export function lineDraftContext(world: Pick<World, 'city' | 'router' | 'nodes' | 'state'>): LineDraftContext {
  return {
    ...fleetContext(world),
    nearestNode: (at, withinM) => {
      const hit = world.nodes.nearest(at, withinM);
      return hit ? { node: hit.item, at: hit.p, distM: hit.distM } : null;
    },
    stops: world.state.stops.map((s) => ({ id: s.id, at: toXY(world.city.frame, [s.lon, s.lat]) })),
    legM: (from, to) => legMetres(world, from, to),
  };
}

/** What the depot rule reads for this world: its depot land, street nodes and the depots built (GD-05). */
export function depotSiteContext(world: Pick<World, 'nodes' | 'city' | 'state'>): DepotSiteContext {
  return {
    land: world.city.depotLand,
    nearestNode: (at, withinM) => {
      const hit = world.nodes.nearest(at, withinM);
      return hit ? { node: hit.item, distM: hit.distM } : null;
    },
    depots: world.state.depots.map((d) => toXY(world.city.frame, [d.lon, d.lat])),
  };
}

/** Each line's timetable, depot and costs, in line order; buses fill the nearest depot with room first. */
export function lineServices(world: Pick<World, 'city' | 'router' | 'nodes' | 'state'>): Map<LineId, LineService> {
  const { city, state } = world;
  const depots = state.depots.map((d) => {
    const at = toXY(city.frame, [d.lon, d.lat]);
    return { id: d.id, node: world.nodes.nearest(at, DEPOT_STREET_REACH_M)?.item ?? nearestNode(world, at), room: DEPOT_CAPACITY };
  });
  const services = new Map<LineId, LineService>();
  for (const line of state.lines) {
    const plan = planLine(world, line);
    if (!plan) continue;
    const routeM = plan.stopDistM[plan.stopDistM.length - 1]!;
    const model = BUS_MODELS[line.model];
    const timing: Timing = { cycle: cycleSeconds(routeM, plan.stops.length, model.kmh), headways: line.headways, buses: line.buses };
    const first = nearestNode(world, plan.stops[0]!);
    let depot: { id: DepotId; node: number | null; room: number } | null = null;
    let pullOutM = 0;
    let pullInM = 0;
    if (first !== null && line.buses > 0) {
      const options = depots
        .map((d) => ({ d, out: d.node === null ? null : world.router.route(d.node, first) }))
        .filter((o) => o.out !== null)
        .sort((a, b) => Number(b.d.room >= line.buses) - Number(a.d.room >= line.buses) || a.out!.cs - b.out!.cs || a.d.id - b.d.id);
      const pick = options[0];
      if (pick) {
        depot = pick.d;
        depot.room -= line.buses;
        pullOutM = pick.out!.dm / 10;
        // Every round trip ends back at the first stop, so a bus goes home from there.
        pullInM = (world.router.route(first, pick.d.node!)?.dm ?? pick.out!.dm) / 10;
      }
    }
    const day = dayPlan({
      timing,
      oneWayS: timing.cycle / 2 - LAYOVER_SECONDS,
      pullOutS: driveSeconds(pullOutM, model),
      pullInS: driveSeconds(pullInM, model),
    });
    services.set(line.id, {
      plan: { ...plan, headways: runningHeadways(timing) ?? plan.headways, kmh: model.kmh, seats: model.seats },
      timing,
      day,
      costs: { plan: day, routeM, model, pullOutM, pullInM },
      depotId: depot?.id ?? null,
      depotNode: depot?.node ?? null,
    });
  }
  return services;
}

/** The headways a line actually runs, or null if it runs at no time (no buses). */
function runningHeadways(t: Timing): Line['headways'] | null {
  const peak = runningHeadwayIn(t, 'peak');
  const offpeak = runningHeadwayIn(t, 'offpeak');
  if (peak === null || offpeak === null) return null;
  return { peak, offpeak, overnight: runningHeadwayIn(t, 'overnight') };
}

/** The plans of the lines that run: a line with no buses runs at no time, so nobody can ride it. */
export function runningPlans(world: Pick<World, 'services'>): LinePlan[] {
  return [...world.services.values()].filter((s) => s.timing.buses > 0).map((s) => s.plan);
}

export function recompute(world: World): void {
  world.services = lineServices(world);
  world.assignment = assign(world.city, world.commuters, runningPlans(world));
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
    services: new Map(),
  };
  recompute(world);
  return world;
}
