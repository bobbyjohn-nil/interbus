// The running game: the city it plays on, the sim state the save holds, and what is derived from
// both (routes, the commuter matrix, who rides which line). Owned by the worker (PLAN §6).
import { buildCommuters, type Commuters } from './demand/commuters';
import { assign, type Assignment, type LinePlan } from './demand/assign';
import { SpatialGrid, toLngLat, toXY, type XY } from './core/geo';
import type { City } from './city/simfile';
import { createRouter, type Router } from './city/route';
import { DEPOT_CAPACITY, DEPOT_STREET_REACH_M } from './config/depots';
import { BUS_MODELS, LAYOVER_SECONDS, type BusModelId } from './config/fleet';
import { STOP_TIERS } from './config/stops';
import { SECONDS_PER_DAY } from './config/time';
import { toCalendarTime } from './core/calendar';
import type { DepotId, LineId } from './core/ids';
import { driveSeconds, type LineCostInputs } from './economy/costs';
import { cycleSeconds, cyclesOf, slowedM } from './rules/cycle';
import type { DepotSiteContext } from './rules/depot';
import { worksOn } from './rules/event';
import type { FleetContext, Leg, LineDraftContext } from './rules/line';
import { dayPlan, type DayPlan } from './rules/schedule';
import { runningHeadwayIn, type Timing } from './rules/timetable';
import { busesOutAt, planInEffect, type Earlier, type PlanInEffect } from './rules/transition';
import type { EarlierRun, Line, SimState } from './state';
import { classRush } from './traffic/congestion';

/** What a line runs as, worked out from the state when the network changes (recompute()). */
export interface LineService {
  readonly plan: LinePlan;
  readonly timing: Timing;
  /** Every departure and every bus's stint: what the costs bill and the vehicles draw (I6). */
  readonly day: DayPlan;
  /** Its day plan, and while it settles after a change made with its buses out, the merged plan before the handover (rules/transition.ts). */
  readonly effect: PlanInEffect;
  /** Its earlier versions as the merged plan reads them, in the frame of the latest change's day; null once settled. */
  readonly settling: Settling | null;
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

/** A line's earlier versions in the frame of the day of its latest change (rules/transition.ts). */
export interface Settling {
  readonly frameDay: number;
  readonly earlier: readonly Earlier[];
}

/** The day and the second of that day of a game second. */
function frameOf(elapsed: number): { readonly day: number; readonly second: number } {
  const t = toCalendarTime(elapsed);
  return { day: t.day, second: t.secondOfDay };
}

/** A game second in a settling line's frame. */
export const frameSecond = (settling: Pick<Settling, 'frameDay'> | null, elapsed: number): number => {
  const f = frameOf(elapsed);
  return settling ? (f.day - settling.frameDay) * SECONDS_PER_DAY + f.second : f.second;
};

/**
 * A line's earlier versions as the merged plan reads them: each one's plan, the second of the frame it
 * stopped taking departures, and whether its buses are the next version's model from the same first
 * stop. `now` is the line as it runs now.
 */
export function settlingOf(earlier: readonly EarlierRun[], now: { readonly firstStop: { readonly lon: number; readonly lat: number }; readonly model: BusModelId }): Settling | null {
  const latest = earlier[earlier.length - 1];
  if (!latest) return null;
  const frameDay = frameOf(latest.until).day;
  return {
    frameDay,
    earlier: earlier.map((e, k) => {
      const next = earlier[k + 1];
      const start = next ? next.stops[0]! : now.firstStop;
      const { cycle, cycles, headways, buses, oneWayS, pullOutS, pullInS } = e.plan;
      return {
        inputs: { timing: { cycle, cycles, headways, buses }, oneWayS, pullOutS, pullInS },
        until: frameSecond({ frameDay }, e.until),
        sameModel: e.model === (next ? next.model : now.model),
        sameStart: e.stops[0]!.lon === start.lon && e.stops[0]!.lat === start.lat,
      };
    }),
  };
}

/** The street edges roadworks hold today (the M4 spec, item 2), or null when none are on. */
export function worksToday(state: Pick<SimState, 'event' | 'elapsed'>): ReadonlySet<number> | null {
  return worksOn(state.event, toCalendarTime(state.elapsed).day);
}

/**
 * The street a bus drives from one stop position to the next, or null if no street joins them: its
 * metres, its metres weighted by how much of the rush each street takes (traffic/congestion.ts), and
 * its metres through `works`, today's roadworks. The line tool, the plan and the costs all read this.
 */
export function legBetween(world: Pick<World, 'router' | 'nodes' | 'city'>, from: XY, to: XY, works: ReadonlySet<number> | null = null): Leg | null {
  const path = pathBetween(world, from, to);
  if (!path) return null;
  let rushDm = 0;
  let worksDm = 0;
  for (const e of path.edges) {
    rushDm += world.city.graph.edgeDm[e]! * classRush(world.city.streets[e]!.cls);
    if (works?.has(e)) worksDm += world.city.graph.edgeDm[e]!;
  }
  return { m: path.dm / 10, rushM: rushDm / 10, worksM: worksDm / 10 };
}

function pathBetween(world: Pick<World, 'router' | 'nodes' | 'city'>, from: XY, to: XY): { readonly dm: number; readonly edges: readonly number[]; readonly nodes: readonly number[] } | null {
  const a = nearestNode(world, from);
  const b = nearestNode(world, to);
  return a === null || b === null ? null : world.router.route(a, b);
}

/** The street edges a line drives from its first stop to its last, in order. */
export function lineEdges(world: Pick<World, 'city' | 'router' | 'nodes' | 'state'>, line: Line): number[] {
  const xy = line.stopIds.map((id) => world.state.stops.find((s) => s.id === id)).map((s) => (s ? toXY(world.city.frame, [s.lon, s.lat]) : null));
  const out: number[] = [];
  for (let k = 1; k < xy.length; k++) {
    const path = xy[k - 1] && xy[k] ? pathBetween(world, xy[k - 1]!, xy[k]!) : null;
    if (path) out.push(...path.edges);
  }
  return out;
}

/** A line as the demand model sees it: stop positions and distances along its streets. */
export function planLine(world: Pick<World, 'city' | 'router' | 'nodes' | 'state'>, line: Line): LinePlan | null {
  const stops = line.stopIds.map((id) => world.state.stops.find((s) => s.id === id));
  if (stops.some((s) => !s) || stops.length < 2) return null;
  const xy = stops.map((s) => toXY(world.city.frame, [s!.lon, s!.lat]));
  const works = worksToday(world.state);
  const dist = [0];
  let rushM = 0;
  let worksM = 0;
  for (let k = 1; k < xy.length; k++) {
    const leg = legBetween(world, xy[k - 1]!, xy[k]!, works);
    if (leg === null) return null;
    dist.push(dist[k - 1]! + leg.m);
    rushM += leg.rushM;
    worksM += leg.worksM;
  }
  const routeM = dist[dist.length - 1]!;
  return {
    id: line.id,
    stops: xy,
    stopDistM: dist,
    rush: routeM > 0 ? rushM / routeM : 0,
    worksM,
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
  const works = worksToday(world.state);
  return {
    ...fleetContext(world),
    nearestNode: (at, withinM) => {
      const hit = world.nodes.nearest(at, withinM);
      return hit ? { node: hit.item, at: hit.p, distM: hit.distM } : null;
    },
    stops: world.state.stops.map((s) => ({ id: s.id, at: toXY(world.city.frame, [s.lon, s.lat]) })),
    leg: (from, to) => legBetween(world, from, to, works),
    legPath: (from, to) => {
      // The streets in driving order, each street's points turned the way the bus drives it.
      const path = pathBetween(world, from, to);
      if (!path) return null;
      const points: XY[] = [];
      path.edges.forEach((e, i) => {
        const street = world.city.streets[e]!.points;
        const pts = world.city.graph.edgeA[e] === path.nodes[i] ? street : [...street].reverse();
        for (const p of points.length ? pts.slice(1) : pts) points.push([p[0], p[1]]);
      });
      return points;
    },
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
    const timing: Timing = {
      cycle: cycleSeconds(slowedM(routeM, plan.worksM ?? 0), plan.stops.length, model.kmh),
      cycles: cyclesOf(slowedM(routeM, plan.worksM ?? 0), plan.stops.length, model.kmh, plan.rush ?? 0),
      headways: line.headways,
      buses: line.buses,
    };
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
    const [lon, lat] = toLngLat(city.frame, plan.stops[0]!);
    const settling = settlingOf(line.earlier ?? [], { firstStop: { lon, lat }, model: line.model });
    const effect = planInEffect(day.inputs, settling?.earlier ?? []);
    const earlierCosts = (line.earlier ?? []).map((e) => ({ routeM: e.routeM, model: BUS_MODELS[e.model], pullOutM: e.pullOutM, pullInM: e.pullInM }));
    services.set(line.id, {
      plan: { ...plan, headways: runningHeadways(timing) ?? plan.headways, kmh: model.kmh, seats: model.seats },
      timing,
      day,
      effect,
      settling,
      costs: { plan: day, routeM, model, pullOutM, pullInM, ...(settling && effect.merged ? { settling: { merged: effect.merged, frameDay: settling.frameDay, earlier: earlierCosts } } : {}) },
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

/**
 * The network changed while it runs, by a command or roadworks starting or ending (the M4 spec,
 * item 4; I6): a line whose plan changed with any of its buses out keeps the version it ran on, so
 * every trip under way finishes on the route and the times it began with. Undo, a load and a
 * rebased save recompute plainly: they put a game back as it was.
 */
export function recomputeInService(world: World): void {
  const before = world.services;
  const after = lineServices(world);
  const at = world.state.elapsed;
  for (const line of world.state.lines) {
    const was = before.get(line.id);
    const now = after.get(line.id);
    if (!was || !now || sameRun(was, now)) continue;
    const second = frameSecond(was.settling, at);
    // Settled already, it needs nothing earlier; with no bus out now, nothing carries on at all.
    const settled = !was.effect.merged || second >= was.effect.merged.handover;
    line.earlier = busesOutAt(was.effect, second) > 0 ? [...(settled ? [] : (line.earlier ?? [])), runOf(world, was, at)] : [];
  }
  recompute(world);
}

/** Whether two services run the same: the same plan, the same stops, depot and model. */
function sameRun(a: LineService, b: LineService): boolean {
  return (
    a.costs.model.id === b.costs.model.id &&
    a.depotNode === b.depotNode &&
    JSON.stringify(a.day.inputs) === JSON.stringify(b.day.inputs) &&
    JSON.stringify(a.plan.stops) === JSON.stringify(b.plan.stops)
  );
}

/** The version a service ran on until game second `at`, as the line keeps it. */
function runOf(world: Pick<World, 'city' | 'state'>, s: LineService, at: number): EarlierRun {
  const depot = world.state.depots.find((d) => d.id === s.depotId);
  const { timing, oneWayS, pullOutS, pullInS } = s.day.inputs;
  return {
    until: at,
    stops: s.plan.stops.map((p) => {
      const [lon, lat] = toLngLat(world.city.frame, p);
      return { lon, lat };
    }),
    depot: depot ? { lon: depot.lon, lat: depot.lat } : null,
    model: s.costs.model.id,
    routeM: s.costs.routeM,
    pullOutM: s.costs.pullOutM,
    pullInM: s.costs.pullInM,
    plan: { cycle: timing.cycle, cycles: timing.cycles ?? { peak: timing.cycle, offpeak: timing.cycle, overnight: timing.cycle }, headways: { ...timing.headways }, buses: timing.buses, oneWayS, pullOutS, pullInS },
  };
}

/** Lets go of the earlier versions of every line past its handover, and says whether any did: from there its day plan holds alone. */
export function settle(world: World): boolean {
  let any = false;
  for (const line of world.state.lines) {
    const s = world.services.get(line.id);
    if (!line.earlier?.length || !s) continue;
    const m = s.effect.merged;
    if (m && frameSecond(s.settling, world.state.elapsed) < m.handover) continue;
    line.earlier = [];
    any = true;
  }
  if (any) world.services = lineServices(world);
  return any;
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
