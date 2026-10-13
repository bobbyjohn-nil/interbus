// The sim's host inside its worker (PLAN §6): it owns the World, runs simStep on a fixed step at
// the chosen speed, applies commands between steps, and posts snapshots about 10 times a second
// while time runs, none while paused (I14). The page never computes a game number (AR-04).
// Plain logic with an injected clock, so tests drive it without a real Worker.
import { addDebugLine } from '../sim/commands/debugLine';
import { placeDepot } from '../sim/commands/placeDepot';
import { loadCity, type City } from '../sim/city/simfile';
import { STEP_SECONDS } from '../sim/config/time';
import { toCalendarTime } from '../sim/core/calendar';
import { toLngLat, toXY, type XY } from '../sim/core/geo';
import { peopleWithinWalk } from '../sim/rules/catchment';
import { checkDepotSite } from '../sim/rules/depot';
import { newGame } from '../sim/state';
import { simStep } from '../sim/step';
import type { DepotSiteView, Dots, FromWorker, LineView, LngLatPair, Snapshot, Speed, ToWorker } from '../sim/types';
import { createWorld, depotSiteContext, nearestNode, type World } from '../sim/world';

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

function lineViews(world: World): LineView[] {
  const { city, state } = world;
  return state.lines.map((line) => {
    const stops = line.stopIds.map((id) => state.stops.find((s) => s.id === id)!).map((s) => [s.lon, s.lat] as [number, number]);
    const route: [number, number][] = [];
    for (let k = 1; k < stops.length; k++) {
      const from = nearestNode(world, toXY(city.frame, stops[k - 1]!));
      const to = nearestNode(world, toXY(city.frame, stops[k]!));
      const path = from === null || to === null ? null : world.router.route(from, to);
      path?.edges.forEach((e, i) => {
        const street = city.streets[e]!;
        // Edge i of a path leaves path.nodes[i]; the street's points run from edgeA to edgeB.
        const pts = city.graph.edgeA[e] === path.nodes[i] ? street.points : [...street.points].reverse();
        for (const p of route.length ? pts.slice(1) : pts) route.push([...toLngLat(city.frame, p as XY)] as [number, number]);
      });
    }
    return { id: line.id, name: line.name, colour: line.colour, stops, route, ridersPerDay: world.assignment.lines.get(line.id)?.perDay ?? 0 };
  });
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
      } else if (message.type === 'add-debug-line') {
        const result = addDebugLine(world);
        if (!result.ok) post({ type: 'refused', command: message.type, reason: result.reason });
        else refreshLines();
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
        if (!result.ok) post({ type: 'refused', command: message.type, reason: result.reason, ...(result.shortCents === undefined ? {} : { shortCents: result.shortCents }) });
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
