// Where each bus is (the M2 spec, item 6): a pure function of the line's day plan, its geometry and
// the clock, so a save, a reload or a speed change never moves a bus. Ported from V3's
// busPositionAt (`Intralines_City@dc63602:src/game/buses/position.ts:99-157`) with its three bugs
// fixed: a bus pulls out of its depot before its first departure instead of appearing mid-route;
// each period runs its own headway (the plan's departures, not round trip ÷ buses); and a bus
// finishes its last trip and drives home instead of vanishing. Buses run at a steady speed that
// covers each leg in the plan's time, dwelling 20 s at each stop between the ends, so a bus is
// where the plan, and so the costs, say it is (I6). Writes into a caller's array: no allocation
// per frame.
import { DWELL_SEC } from '../config/demand';
import type { LngLatPair } from '../types';
import { SECONDS_PER_DAY } from '../config/time';
import { busesOut, tripTimes, type DayPlan, type Stint } from './schedule';
import { inputsAt, versionAt, type PlanInEffect } from './transition';

/** A line as the vehicle layer draws it: the route through its stops and the drives to and from its depot. */
export interface LineGeometry {
  readonly route: readonly LngLatPair[];
  /** Index in `route` of each stop, first to last. */
  readonly stopAt: readonly number[];
  /** Street metres from the first stop to each stop, as the sim measures them. */
  readonly stopDistM: readonly number[];
  /** Depot to first stop, and first stop to depot; empty with no depot. */
  readonly pullOut: readonly LngLatPair[];
  readonly pullIn: readonly LngLatPair[];
}

interface Path {
  readonly pts: readonly LngLatPair[];
  /** Metres along the path to each point. */
  readonly cum: Float64Array;
}

/** A geometry with its lengths measured once, for every frame after. */
export interface PreparedGeometry {
  readonly geometry: LineGeometry;
  readonly route: Path;
  readonly pullOut: Path;
  readonly pullIn: Path;
}

const METRES_PER_DEG = 111_320;

function path(pts: readonly LngLatPair[]): Path {
  const cum = new Float64Array(pts.length);
  for (let i = 1; i < pts.length; i++) {
    const [a, b] = [pts[i - 1]!, pts[i]!];
    const k = Math.cos((a[1] * Math.PI) / 180);
    cum[i] = cum[i - 1]! + Math.sqrt(((b[0] - a[0]) * k * METRES_PER_DEG) ** 2 + ((b[1] - a[1]) * METRES_PER_DEG) ** 2);
  }
  return { pts, cum };
}

export function prepareGeometry(geometry: LineGeometry): PreparedGeometry {
  return { geometry, route: path(geometry.route), pullOut: path(geometry.pullOut), pullIn: path(geometry.pullIn) };
}

/** Writes the point `m` metres along `p` into out[at..at+2] as lon, lat and bearing (degrees clockwise from north); `back` faces the other way. */
function placeAt(p: Path, m: number, back: boolean, out: Float64Array, at: number): void {
  const { pts, cum } = p;
  if (pts.length === 1) {
    out[at] = pts[0]![0];
    out[at + 1] = pts[0]![1];
    out[at + 2] = 0;
    return;
  }
  const total = cum[cum.length - 1]!;
  const d = Math.max(0, Math.min(total, m));
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid]! <= d) lo = mid;
    else hi = mid;
  }
  const [a, b] = [pts[lo]!, pts[hi]!];
  const span = cum[hi]! - cum[lo]!;
  const f = span > 0 ? (d - cum[lo]!) / span : 0;
  out[at] = a[0] + (b[0] - a[0]) * f;
  out[at + 1] = a[1] + (b[1] - a[1]) * f;
  const k = Math.cos((a[1] * Math.PI) / 180);
  const bearing = (Math.atan2((b[0] - a[0]) * k, b[1] - a[1]) * 180) / Math.PI;
  out[at + 2] = (bearing + (back ? 540 : 360)) % 360;
}

/** Metres along the route `u` seconds into a run out from the first stop. */
function routeMetresAt(g: PreparedGeometry, oneWayS: number, u: number): number {
  const { stopAt, stopDistM } = g.geometry;
  const stops = stopAt.length;
  const routeM = stopDistM[stops - 1]!;
  const driveS = oneWayS - Math.max(0, stops - 2) * DWELL_SEC;
  let left = u;
  for (let i = 0; i < stops - 1; i++) {
    const legS = routeM > 0 ? (driveS * (stopDistM[i + 1]! - stopDistM[i]!)) / routeM : 0;
    const [from, to] = [g.route.cum[stopAt[i]!]!, g.route.cum[stopAt[i + 1]!]!];
    if (left < legS) return from + ((to - from) * left) / legS;
    left -= legS;
    if (i < stops - 2) {
      if (left < DWELL_SEC) return to;
      left -= DWELL_SEC;
    }
  }
  return g.route.cum[stopAt[stops - 1]!]!;
}

/** How the placing reads a plan: its stints, and for each departure and each bus's drives, the times and the geometry they ran on. */
interface Reading {
  readonly stints: readonly Stint[];
  timesOf(trip: number): { readonly cycle: number; readonly oneWayS: number };
  tripGeometry(trip: number): PreparedGeometry;
  pullOutS(s: Stint): number;
  pullOutGeometry(s: Stint): PreparedGeometry;
  pullInGeometry(s: Stint): PreparedGeometry;
}

const firstStopOf = (g: PreparedGeometry) => g.route.cum[g.geometry.stopAt[0]!]!;

function place(r: Reading, second: number, out: Float64Array): number {
  let n = 0;
  for (const s of r.stints) {
    if (second < s.leaveDepot || second >= s.arriveDepot) continue;
    const at = 3 * n++;
    const pullOutS = r.pullOutS(s);
    if (second < s.leaveDepot + pullOutS) {
      const g = r.pullOutGeometry(s);
      if (g.pullOut.pts.length) placeAt(g.pullOut, ((second - s.leaveDepot) / pullOutS) * g.pullOut.cum[g.pullOut.cum.length - 1]!, false, out, at);
      else placeAt(g.route, firstStopOf(g), false, out, at);
      continue;
    }
    if (second >= s.lastArrival) {
      const g = r.pullInGeometry(s);
      const length = g.pullIn.cum[g.pullIn.cum.length - 1] ?? 0;
      if (g.pullIn.pts.length) placeAt(g.pullIn, ((second - s.lastArrival) / (s.arriveDepot - s.lastArrival)) * length, false, out, at);
      else placeAt(g.route, firstStopOf(g), false, out, at);
      continue;
    }
    // The trip under way: the last departure at or before now; before its first, it waits at the first stop.
    let trip: number | undefined;
    for (const t of s.trips) if (t <= second) trip = t;
    if (trip === undefined) {
      const g = r.pullOutGeometry(s);
      placeAt(g.route, firstStopOf(g), false, out, at);
      continue;
    }
    // Its own period's round trip: a peak run takes longer than a midday one (tripTimes).
    const g = r.tripGeometry(trip);
    const { cycle, oneWayS } = r.timesOf(trip);
    const half = cycle / 2;
    const u = second - trip;
    if (u >= half + oneWayS) placeAt(g.route, firstStopOf(g), false, out, at); // waiting at the first stop
    else if (u < oneWayS) placeAt(g.route, routeMetresAt(g, oneWayS, u), false, out, at);
    else if (u < half) placeAt(g.route, routeMetresAt(g, oneWayS, oneWayS), true, out, at); // layover at the far end
    else placeAt(g.route, routeMetresAt(g, oneWayS, oneWayS - (u - half)), true, out, at);
  }
  return n;
}

/**
 * Every bus out at `second` (seconds from midnight of the plan's middle day; fractions allowed),
 * written into `out` as lon, lat, bearing triples. Returns how many buses it wrote; `out` must hold
 * three numbers for each bus the plan can have out (busesOut).
 */
export function busPositionsAt(plan: DayPlan, g: PreparedGeometry, second: number, out: Float64Array): number {
  const { inputs } = plan;
  return place({ stints: plan.stints, timesOf: (t) => tripTimes(inputs, t), tripGeometry: () => g, pullOutS: () => inputs.pullOutS, pullOutGeometry: () => g, pullInGeometry: () => g }, second, out);
}

/**
 * Every bus out at `second` of the frame on a line's plan in effect (rules/transition.ts): before its
 * handover the merged plan, each trip and drive on the geometry of the version it ran on (`geos`,
 * oldest first, the line's own last), and from then on its own day plan.
 */
export function positionsInEffect(p: PlanInEffect, geos: readonly PreparedGeometry[], second: number, out: Float64Array): number {
  const m = p.merged;
  if (!m || second >= m.handover) return busPositionsAt(p.periodic, geos[geos.length - 1]!, ((second % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY, out);
  const geoAt = (t: number) => geos[versionAt(m, t)]!;
  const lastOf = (s: Stint) => s.trips[s.trips.length - 1] ?? s.leaveDepot;
  return place(
    {
      stints: m.stints,
      timesOf: (t) => tripTimes(inputsAt(m, t), t),
      tripGeometry: geoAt,
      pullOutS: (s) => inputsAt(m, s.leaveDepot).pullOutS,
      pullOutGeometry: (s) => geoAt(s.leaveDepot),
      pullInGeometry: (s) => geoAt(lastOf(s)),
    },
    second,
    out,
  );
}

/** At most how many buses a plan in effect has out at once, for the caller's buffer: the merged plan's stints bound it. */
export function mostOut(p: PlanInEffect): number {
  return Math.max(busesOut(p.periodic), p.merged?.stints.length ?? 0);
}
