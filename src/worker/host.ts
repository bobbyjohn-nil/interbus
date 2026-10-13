// The sim's host inside its worker (PLAN §6): it owns the World, runs simStep on a fixed step at
// the chosen speed, applies commands between steps, and posts snapshots about 10 times a second
// while time runs, none while paused (I14). The page never computes a game number (AR-04).
// It starts from the page's save when there is a readable one, and hands the page a fresh save after
// every command, at every change of speed and every game hour, for src/platform's store to keep
// (a worker has no localStorage). Plain logic with an injected clock, so tests drive it without a
// real Worker.
import { createLine } from '../sim/commands/createLine';
import { found } from '../sim/commands/found';
import { placeDepot } from '../sim/commands/placeDepot';
import { setHeadways } from '../sim/commands/setHeadways';
import { setFare } from '../sim/commands/setFare';
import { setModel } from '../sim/commands/setModel';
import { BUS_MODELS, type BusModelId } from '../sim/config/fleet';
import { loadCity, type City } from '../sim/city/simfile';
import { MAX_WALK_M } from '../sim/config/demand';
import { DEPOT_UPKEEP_CENTS } from '../sim/config/depots';
import { FOUNDING_HEADWAYS } from '../sim/config/lines';
import { SECONDS_PER_DAY, START_SECOND_OF_DAY, STEP_SECONDS } from '../sim/config/time';
import { toCalendarTime } from '../sim/core/calendar';
import { toLngLat, toXY, type XY } from '../sim/core/geo';
import { forecastDay } from '../sim/economy/costs';
import { fareBand } from '../sim/economy/fareBand';
import { stopDays } from '../sim/economy/stops';
import { profitableDays } from '../sim/economy/ledger';
import type { LineId } from '../sim/core/ids';
import { peopleNearStops, peopleWithinWalk } from '../sim/rules/catchment';
import { COMPANY_COLOURS } from '../sim/rules/company';
import { checkDepotSite } from '../sim/rules/depot';
import { subsidyCents } from '../sim/rules/fare';
import { checkLineDraft } from '../sim/rules/line';
import { decode, encode, fromSaveData, saveKey } from '../sim/save/save';
import { newGame, type CityRef } from '../sim/state';
import { simStep } from '../sim/step';
import type { DepotSiteView, Dots, FromWorker, HeadwaysData, LineDraftView, LineView, LngLatPair, RefusalView, Snapshot, Speed, StopView, ToWorker } from '../sim/types';
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

/** Appends the streets from node `from` to node `to` to `route` as [lon, lat] points. */
function appendPath(world: World, from: number | null, to: number | null, route: LngLatPair[]): void {
  const { city } = world;
  const path = from === null || to === null ? null : world.router.route(from, to);
  path?.edges.forEach((e, i) => {
    const street = city.streets[e]!;
    // Edge i of a path leaves path.nodes[i]; the street's points run from edgeA to edgeB.
    const pts = city.graph.edgeA[e] === path.nodes[i] ? street.points : [...street.points].reverse();
    for (const p of route.length ? pts.slice(1) : pts) route.push([...toLngLat(city.frame, p as XY)] as LngLatPair);
  });
}

/** The streets a bus drives through `stops` (frame metres), as [lon, lat] points, and where each stop falls in them. */
function routeOf(world: World, stops: readonly XY[]): { route: LngLatPair[]; stopAt: number[] } {
  const route: LngLatPair[] = [];
  const stopAt = [0];
  for (let k = 1; k < stops.length; k++) {
    appendPath(world, nearestNode(world, stops[k - 1]!), nearestNode(world, stops[k]!), route);
    stopAt.push(Math.max(0, route.length - 1));
  }
  return { route, stopAt };
}

/** The drive between a depot's node and a stop, as [lon, lat] points; empty when there is none. */
function driveOf(world: World, from: number | null, to: number | null): LngLatPair[] {
  const out: LngLatPair[] = [];
  appendPath(world, from, to, out);
  return out.length > 1 ? out : [];
}

function lineViews(world: World): LineView[] {
  const { city, state } = world;
  return state.lines.map((line) => {
    const stops = line.stopIds.map((id) => state.stops.find((s) => s.id === id)!).map((s) => [s.lon, s.lat] as [number, number]);
    const service = world.services.get(line.id);
    const xy = stops.map((p) => toXY(city.frame, p));
    const { route, stopAt } = routeOf(world, xy);
    const first = xy.length ? nearestNode(world, xy[0]!) : null;
    const depotNode = service?.depotNode ?? null;
    const demand = world.assignment.lines.get(line.id);
    return {
      id: line.id,
      name: line.name,
      colour: line.colour,
      stops,
      stopIds: [...line.stopIds],
      route,
      stopAt,
      stopDistM: service?.plan.stopDistM ?? [],
      pullOut: driveOf(world, depotNode, first),
      pullIn: driveOf(world, first, depotNode),
      plan: service ? service.day.inputs : { timing: { cycle: 0, headways: line.headways, buses: 0 }, oneWayS: 0, pullOutS: 0, pullInS: 0 },
      ridersPerDay: demand?.perDay ?? 0,
      fareCents: line.fareCents,
      turnedAwayPerDay: demand?.shedPerDay ?? 0,
      // Each slot is a half-hour.
      fullAtMinute: demand && demand.fullSlot !== null ? demand.fullSlot * 30 : null,
      incomeCents: Math.floor(demand?.perDay ?? 0) * (line.fareCents + subsidyCents(line.fareCents)),
      headways: line.headways,
      cycle: service?.timing.cycle ?? 0,
      buses: line.buses,
      model: line.model,
      forecastCents: service ? forecastDay(service.costs) : { running: 0, wages: 0, deadhead: 0 },
    };
  });
}

/** Every stop standing and its day (the M3 spec, item 5). */
function stopViews(world: World): StopView[] {
  const days = new Map(stopDays(world).map((d) => [d.id, d]));
  return world.state.stops.map((s) => {
    const day = days.get(s.id)!;
    return {
      id: s.id,
      at: [s.lon, s.lat],
      lineIds: world.state.lines.filter((l) => l.stopIds.includes(s.id)).map((l) => l.id),
      boardings: day.boardings,
      alightings: day.alightings,
      netCents: day.netCents,
      quiet: day.quiet,
      loss: day.loss,
    };
  });
}

/** The draft card for a list of clicks: the line rule's verdict and what it resolved. */
function draftView(world: World, clicks: readonly LngLatPair[], headways: HeadwaysData, model: BusModelId): LineDraftView {
  const verdict = checkLineDraft(lineDraftContext(world), clicks.map((c) => toXY(world.city.frame, c)), headways, BUS_MODELS[model]);
  const { draft } = verdict;
  const stops = draft.stops.map((s) => s.at);
  return {
    stops: draft.stops.map((s) => ({ at: [...toLngLat(world.city.frame, s.at)] as LngLatPair, joins: s.kind === 'join' ? s.stopId : null })),
    route: routeOf(world, stops).route,
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
function refusalView(r: { reason: string; at?: number; limit?: number; limitM?: number; nearestM?: number; limitSeconds?: number; room?: number; shortCents?: number }): RefusalView {
  const view: { -readonly [K in keyof RefusalView]: RefusalView[K] } = { reason: r.reason };
  for (const key of ['at', 'limit', 'limitM', 'nearestM', 'limitSeconds', 'room', 'shortCents'] as const) if (r[key] !== undefined) view[key] = Math.round(r[key]);
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
  // The city loaded, waiting for the page's save.
  let pending: { city: City; ref: CityRef; seed: number } | null = null;
  let build = { sha: '', version: '' };
  let key = '';
  let savedHour = 0;
  const save = () => {
    savedHour = Math.floor(world!.state.elapsed / 3_600);
    post({ type: 'store', effects: [{ op: 'write', key, value: encode(world!.state, build) }] });
  };
  let speed: Speed = 0;
  let lastMs: number | null = null;
  let carrySeconds = 0;
  let lastSnapshotMs = -Infinity;
  // Routes change only when the network does, not ten times a second.
  let lines: LineView[] = [];
  let stops: StopView[] = [];
  let linesVersion = 0;
  const refreshLines = () => {
    lines = lineViews(world!);
    stops = stopViews(world!);
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
      company: { ...w.state.company },
      secondOfDay: (START_SECOND_OF_DAY + w.state.elapsed) % SECONDS_PER_DAY,
      rate: SPEEDS[speed],
      cashCents: w.state.ledger.cashCents,
      ridersPerDay: w.assignment.tripsPerDay,
      profitableDays: profitableDays(w.state.ledger, t.day),
      costsPerDayCents: lines.reduce((sum, l) => sum + l.forecastCents.running + l.forecastCents.wages + l.forecastCents.deadhead, 0) + w.state.depots.length * DEPOT_UPKEEP_CENTS,
      lines,
      stops,
      linesVersion,
      depots: w.state.depots.map((d) => ({ id: d.id, at: [d.lon, d.lat] })),
    };
  };

  return {
    handle(message) {
      if (message.type === 'init') {
        const loaded = loadCity(message.simText);
        if (!loaded.ok) return post({ type: 'failed', problem: loaded.problem });
        world = null;
        pending = { city: loaded.city, ref: message.city, seed: message.seed };
        build = { sha: message.build.sha, version: message.build.version };
        key = saveKey(message.city.id);
        post({ type: 'read-save', key });
        return;
      }
      if (message.type === 'save-text') {
        if (!pending) return;
        const { city, ref, seed } = pending;
        pending = null;
        // A readable save carries on; anything else is set aside first and a new game starts, unnamed
        // until the founding card names it (D12).
        const { result, effects } = decode(message.text, ref);
        world = createWorld(city, result.outcome === 'ok' ? fromSaveData(result.envelope.data) : newGame(ref, { name: '', colour: COMPANY_COLOURS[0]! }, seed));
        speed = 0;
        savedHour = Math.floor(world.state.elapsed / 3_600);
        refreshLines();
        if (effects.length) post({ type: 'store', effects });
        post({ type: 'ready', dots: dotsOf(city), depotLand: depotLandOf(city), snapshot: snapshot(), load: result.outcome });
        return;
      }
      if (!world) return post({ type: 'refused', command: message.type, reason: 'not_started' });
      if (message.type === 'speed') {
        speed = message.speed;
        lastMs = null;
        // A part-step of game time is dropped, as a save drops it, so a reload carries on in step.
        carrySeconds = 0;
        save(); // a pause keeps the game exactly where it stopped
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
        else {
          refreshLines(); // a line's deadhead now runs from the depot
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'found') {
        const result = found(world, message.name, message.colour);
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else save();
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'line-draft') {
        post({ type: 'line-draft', id: message.id, draft: draftView(world, message.clicks, message.headways ?? FOUNDING_HEADWAYS, message.model ?? 'sparrow') });
      } else if (message.type === 'create-line') {
        const result = createLine(world, message.clicks, message.headways ?? FOUNDING_HEADWAYS, message.model ?? 'sparrow');
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'set-model') {
        const result = setModel(world, message.lineId as LineId, message.model);
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'set-fare') {
        const result = setFare(world, message.lineId as LineId, message.fareCents);
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
        post({ type: 'snapshot', snapshot: snapshot() });
      } else if (message.type === 'fare-band') {
        post({ type: 'fare-band', id: message.id, lineId: message.lineId, band: fareBand(world, message.lineId as LineId) });
      } else if (message.type === 'set-headways') {
        const result = setHeadways(world, message.lineId as LineId, message.headways);
        if (!result.ok) post({ type: 'refused', command: message.type, ...refusalView(result) });
        else {
          refreshLines();
          save();
        }
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
      if (Math.floor(world.state.elapsed / 3_600) !== savedHour) save();
      if (nowMs - lastSnapshotMs >= SNAPSHOT_EVERY_MS) {
        lastSnapshotMs = nowMs;
        post({ type: 'snapshot', snapshot: snapshot() });
      }
    },
  };
}
