// The sim's host inside its worker (PLAN §6): it owns the World, runs simStep on a fixed step at
// the chosen speed, applies commands between steps, and posts snapshots about 10 times a second
// while time runs, none while paused (I14). The page never computes a game number (AR-04).
// Plain logic with an injected clock, so tests drive it without a real Worker.
import { createLine } from '../sim/commands/createLine';
import { placeDepot } from '../sim/commands/placeDepot';
import { setHeadways } from '../sim/commands/setHeadways';
import { loadCity, type City } from '../sim/city/simfile';
import { MAX_WALK_M } from '../sim/config/demand';
import { DEPOT_UPKEEP_CENTS } from '../sim/config/depots';
import { FOUNDING_HEADWAYS } from '../sim/config/lines';
import { STEP_SECONDS } from '../sim/config/time';
import { toCalendarTime } from '../sim/core/calendar';
import { toLngLat, toXY, type XY } from '../sim/core/geo';
import { forecastDay } from '../sim/economy/costs';
import type { LineId } from '../sim/core/ids';
import { peopleNearStops, peopleWithinWalk } from '../sim/rules/catchment';
import { checkDepotSite } from '../sim/rules/depot';
import { checkLineDraft } from '../sim/rules/line';
import { newGame } from '../sim/state';
import { simStep } from '../sim/step';
import type { DepotSiteView, Dots, FromWorker, HeadwaysData, LineDraftView, LineView, LngLatPair, RefusalView, Snapshot, Speed, ToWorker } from '../sim/types';
import { createWorld, depotSiteContext, lineDraftContext, nearestNode, type World } from '../sim/world';

/**
 * Game-seconds per real second at each speed. Speed 1 is about 10 game-minutes a second, so the
 * service day (05:00–24:00) passes in two minutes as PLAN §3's first ten minutes have it; the
 * ladder is re-derived from the pacing targets in week 9 (GD-10).
 */
export const SPEEDS: Readonly<Record<Speed, number>> = { 0: 0, 1: 600, 2: 1800, 3: 5400 };
/** A slice of real time longer than this (a tab in the background) runs as this long, so the game never leaps days. */
export const MAX_SLICE_MS = 250;
export const SNAPSHOT_EVERY_MS = 100;

export interface Host {
  handle(message: ToWorker): void;
  /** Called on a timer with the real clock in milliseconds. */
  tick(nowMs: number): void;
}

/** The streets a bus drives through `stops` (frame metres), as [lon, lat] points. */
function routeOf(world: World, stops: readonly XY[]): LngLatPair[] {
  const { city } = world;
  const route: LngLatPair[] = [];
  for (let k = 1; k < stops.length; k++) {
    const from = nearestNode(world, stops[k - 1]!);
    const to = nearestNode(world, stops[k]!);
    const path = from === null || to === null ? null : world.router.route(from, to);
    path?.edges.forEach((e, i) => {
      const street = city.streets[e]!;
      // Edge i of a path leaves path.nodes[i]; the street's points run from edgeA to edgeB.
      const pts = city.graph.edgeA[e] === path.nodes[i] ? street.points : [...street.points].reverse();
      for (const p of route.length ? pts.slice(1) : pts) route.push([...toLngLat(city.frame, p as XY)] as LngLatPair);
    });
  }
  return route;
}

function lineViews(world: World): LineView[] {
  const { city, state } = world;
  return state.lines.map((line) => {
    const stops = line.stopIds.map((id) => state.stops.find((s) => s.id === id)!).map((s) => [s.lon, s.lat] as [number, number]);
    const service = world.services.get(line.id);
    return {
      id: line.id,
      name: line.name,
      colour: line.colour,
      stops,
      route: routeOf(world, stops.map((p) => toXY(city.frame, p))),
      ridersPerDay: world.assignment.lines.get(line.id)?.perDay ?? 0,
      headways: line.headways,
      cycle: service?.timing.cycle ?? 0,
      buses: line.buses,
      forecastCents: service ? forecastDay(service.costs) : { running: 0, wages: 0, deadhead: 0 },
    };
  });
}

/** The draft card for a list of clicks: the line rule's verdict and what it resolved. */
function draftView(world: World, clicks: readonly LngLatPair[], headways: HeadwaysData): LineDraftView {
  const verdict = checkLineDraft(lineDraftContext(world), clicks.map((c) => toXY(world.city.frame, c)), headways);
  const { draft } = verdict;
  const stops = draft.stops.map((s) => s.at);
  return {
    stops: draft.stops.map((s) => ({ at: [...toLngLat(world.city.frame, s.at)] as LngLatPair, joins: s.kind === 'join' ? s.stopId : null })),
    route: routeOf(world, stops),
    routeM: Math.round(draft.routeM),
    people: peopleNearStops(world.city, stops),
    walkM: MAX_WALK_M,
    buses: draft.buses,
    newStops: draft.newStops,
    stopsCents: draft.stopsCents,
    busesCents: draft.busesCents,
    priceCents: draft.priceCents,
    refusal: verdict.ok ? null : refusalView(verdict),
  };
}

/** A refusal's code and numbers, without anything else the verdict carried. */
function refusalView(r: { reason: string; at?: number; limitM?: number; nearestM?: number; limitSeconds?: number; room?: number; shortCents?: number }): RefusalView {
  const view: { -readonly [K in keyof RefusalView]: RefusalView[K] } = { reason: r.reason };
  for (const key of ['at', 'limitM', 'nearestM', 'limitSeconds', 'room', 'shortCents'] as const) if (r[key] !== undefined) view[key] = Math.round(r[key]);
  return view;
}

function dotsOf(city: City): Dots {
  const at = (x: number, y: number) => toLngLat(city.frame, [x, y]);
  return {
    homes: city.cells.flatMap((c) => c.homes.map((p) => [...at(p.x, p.y), p.w] as [number, number, number])),
    jobs: city.cells.flatMap((c) => c.work.map((p) => [...at(p.x, p.y), p.w] as [number, number, number])),
  };
}

function depotLandOf(city: City): LngLatPair[][] {
  return city.depotLand.map((ring) => ring.map((p) => [...toLngLat(city.frame, p)] as LngLatPair));
}

export function createHost(post: (message: FromWorker) => void): Host {
  let world: World | null = null;
  let speed: Speed = 0;
  let lastMs: number | null = null;
  let carrySeconds = 0;
  let lastSnapshotMs = -Infinity;
  // Routes change only when the network does, not ten times a second.
  let lines: LineView[] = [];
  let linesVersion = 0;
  const refreshLines = () => {
    lines = lineViews(world!);
    linesVersion++;
  };

  const snapshot = (): Snapshot => {
    const w = world!;
    const t = toCalendarTime(w.state.elapsed);
    return {
      elapsed: w.state.elapsed,
      day: t.day,
      hour: t.hour,
      minute: t.minute,
      speed,
      cashCents: w.state.ledger.cashCents,
      ridersPerDay: w.assignment.tripsPerDay,
      costsPerDayCents: lines.reduce((sum, l) => sum + l.forecastCents.running + l.forecastCents.wages + l.forecastCents.deadhead, 0) + w.state.depots.length * DEPOT_UPKEEP_CENTS,
      lines,
      linesVersion,
      depots: w.state.depots.map((d) => ({ id: d.id, at: [d.lon, d.lat] })),
    };
  };

  return {
    handle(message) {
      if (message.type === 'init') {
        const loaded = loadCity(message.simText);
        if (!loaded.ok) return post({ type: 'failed', problem: loaded.problem });
        world = createWorld(loaded.city, newGame(message.city, { name: 'Your company', colour: '#c0392b' }, message.seed));
        speed = 0;
        refreshLines();
        post({ type: 'ready', dots: dotsOf(loaded.city), depotLand: depotLandOf(loaded.city), snapshot: snapshot() });
        return;
      }
      if (!world) return post({ type: 'refused', command: message.type, reason: 'not_started' });
      if (message.type === 'speed') {
        speed = message.speed;
        lastMs = null;
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'probe') {
        post({ type: 'probe', id: message.id, people: peopleWithinWalk(world.city, toXY(world.city.frame, message.at)) });
      } else if (message.type === 'depot-site') {
        const verdict = checkDepotSite(depotSiteContext(world), toXY(world.city.frame, message.at));
        const site: DepotSiteView = verdict.ok
          ? { ok: true, streetM: Math.round(verdict.streetM), priceCents: verdict.priceCents }
          : { ok: false, reason: verdict.reason, ...(verdict.limitM === undefined ? {} : { limitM: verdict.limitM }), ...(verdict.nearestM === undefined ? {} : { nearestM: Math.round(verdict.nearestM) }) };
        post({ type: 'depot-site', id: message.id, site });
      } else if (message.type === 'place-depot') {
        const result = placeDepot(world, message.at);
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else refreshLines(); // a line's deadhead now runs from the depot
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'line-draft') {
        post({ type: 'line-draft', id: message.id, draft: draftView(world, message.clicks, message.headways ?? FOUNDING_HEADWAYS) });
      } else if (message.type === 'create-line') {
        const result = createLine(world, message.clicks, message.headways ?? FOUNDING_HEADWAYS);
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else refreshLines();
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'set-headways') {
        const result = setHeadways(world, message.lineId as LineId, message.headways);
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else refreshLines();
        post({ type: 'snapshot', snapshot: snapshot() });
      }
    },
    tick(nowMs) {
      if (!world || speed === 0) {
        lastMs = null;
        return;
      }
      const sliceMs = lastMs === null ? 0 : Math.min(Math.max(nowMs - lastMs, 0), MAX_SLICE_MS);
      lastMs = nowMs;
      carrySeconds += (sliceMs / 1000) * SPEEDS[speed];
      while (carrySeconds >= STEP_SECONDS) {
        carrySeconds -= STEP_SECONDS;
        for (const event of simStep(world)) {
          post({
            type: 'day-card',
            card: {
              day: event.day,
              rows: event.rows.map((r) => ({ kind: r.kind, amountCents: r.amountCents, lineId: r.lineId ?? null })),
              cashBeforeCents: event.cashBeforeCents,
              cashAfterCents: event.cashAfterCents,
            },
          });
        }
      }
      if (nowMs - lastSnapshotMs >= SNAPSHOT_EVERY_MS) {
        lastSnapshotMs = nowMs;
        post({ type: 'snapshot', snapshot: snapshot() });
      }
    },
  };
}
