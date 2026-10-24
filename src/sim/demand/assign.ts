// Who rides which line, rewritten from V1's demand worker (`Intralines@7af45b1:src/game/sim/
// demand.worker.ts:290-520`, R01) for M1: commuters only, with one change of line since step 11.
// Changed on the way in:
// - no cap on how many stops a home sees or how many lines a stop offers (V1 kept 4 stops and 3
//   lines, K04, K23): every stop within 650 m counts;
// - catchments sum each cell's sub-points instead of measuring from one centroid (EC-15);
// - per period (D7): a line's wait comes from that period's headway, and nobody boards in a period
//   it does not run, so an overnight-off line loses its night riders (EC-03);
// - the fare is felt as minutes beyond $2.25 (K05), weighed against the ride's length (V2's
//   elasticity, EC-09), and felt and paid once a trip, on the first line (EC-04: V1 charged and felt
//   every boarding, so splitting a line paid +8% to +62%);
// - no silent floors: V1 dropped pairs under half a commuter and shares under 1%; this keeps them;
// - V1 timed trips between cell centroids; this times them per group of sub-points that reach the
//   same stops, with the group's average walk (I14's budget rules out every sub-point pair);
// - buses fill (K27): riders past the busiest leg's seats in a half-hour are turned away in that
//   half-hour only, where V1 shed the whole day from its peak hour (demand.worker.ts:575-590);
// - riders scan every line at a stop (I5, K23; step 11): of the lines serving a trip they take the
//   first bus among those worth waiting for (commonLines), where V1 kept the 3 best and M1–M3 the
//   quickest alone;
// - one change of line (EC-10, step 11): between stops of two lines within 250 m, for the walk, the
//   boarding stop's tier's penalty and the second line's wait. A change on the same first bus as a
//   one-seat ride is the same bus, so each first line offers riders its quicker.
// Waits carry no traffic delay until congestion lands in week 7 (K06: one rule for both).
import {
  BUS_KMH,
  BUS_SEATS,
  CAPTIVE_SHARE,
  CAR_KMH,
  CAR_PARK_PENALTY_MIN,
  CAR_TIME_FACTOR,
  CENTS_PER_MINUTE,
  DWELL_SEC,
  FARE_SENS_MAX,
  FARE_SENS_MIN,
  FARE_SENS_RIDE_EXPONENT,
  FARE_SENS_RIDE_FLOOR_KM,
  FARE_SENS_RIDE_REF_KM,
  HOURLY_PROFILE,
  LOGIT_SCALE,
  MAX_SHARE,
  MAX_TRANSIT_MIN,
  MAX_WALK_M,
  MODE_TAU_MIN,
  REFERENCE_FARE_CENTS,
  SCHEDULE_AWARE_FLOOR,
  SCHEDULE_AWARE_REF_MIN,
  TIMED_RIDER_SHARE,
  TIMED_WAIT_MIN,
  TRANSFER_REACH_M,
  WAIT_CEILING_MIN,
  WAIT_PAIN_EXPONENT,
  WAIT_PAIN_REF_MIN,
  WALK_MIN_PER_KM,
} from '../config/demand';
import { MIN_WALK_MIN, STOP_TIERS } from '../config/stops';
import { distXY, SpatialGrid, type XY } from '../core/geo';
import type { LineId } from '../core/ids';
import type { City, SubPoint } from '../city/simfile';
import { EXPRESS_FARE_WEIGHT, EXPRESS_RIDE_WEIGHT } from '../config/express';
import { planIsExpress } from '../rules/express';
import { PERIODS, periodAt, runsIn, type Headways, type Period } from '../rules/periods';
import { periodCongestion } from '../traffic/congestion';
import type { Commuters } from './commuters';

/** Half-hour slots, so the 06:30 and 09:30 period edges fall on slot boundaries. */
export const SLOTS = 48;
const SLOT_PERIOD: readonly Period[] = Array.from({ length: SLOTS }, (_, s) => periodAt(s * 1800 + 900));
const SLOT_PERIOD_INDEX: readonly number[] = SLOT_PERIOD.map((p) => PERIODS.indexOf(p));
const SLOT_SHARE: readonly number[] = Array.from({ length: SLOTS }, (_, s) => HOURLY_PROFILE[Math.floor(s / 2)]! / 2);
/** Each period's share of a day's trips, in PERIODS order. */
const PERIOD_SHARE: readonly number[] = PERIODS.map((_, k) => SLOT_SHARE.reduce((sum, v, s) => sum + (SLOT_PERIOD_INDEX[s] === k ? v : 0), 0));

export interface LinePlan {
  readonly id: LineId;
  /** Stop positions in the city frame's metres, in line order. */
  readonly stops: readonly XY[];
  /** Metres along the line's route from its first stop to each stop. */
  readonly stopDistM: readonly number[];
  readonly headways: Headways;
  readonly fareCents: number;
  /** The line's model's speed and seats (BUS_KMH and BUS_SEATS, the Sparrow's, when absent). */
  readonly kmh?: number;
  readonly seats?: number;
  /** Minutes off the walk to each stop, by its tier (config/stops.ts); none when absent. */
  readonly walkBonusMin?: readonly number[];
  /** Minutes a transfer onto this line at each stop costs, by its tier (config/stops.ts); a Sign's 6 when absent. */
  readonly transferPenaltyMin?: readonly number[];
  /** How much of the rush its route's streets take, their metres-weighted class weight (traffic/congestion.ts); none when absent. */
  readonly rush?: number;
  /** Metres of its route through roadworks today (the M4 spec, item 2): its round trip's, not its riders', who ride at the street's speed; none when absent. */
  readonly worksM?: number;
}

export interface LineDemand {
  /** Boardings in each half-hour of a day, 00:00 first, after crowding. */
  readonly bySlot: Float64Array;
  readonly perDay: number;
  /** The boardings that pay: every boarding but a change onto this line, whose fare the first line took (EC-04). */
  readonly paidBySlot: Float64Array;
  readonly paidPerDay: number;
  /** Riders a day turned away by full buses (K27), and the half-hour that turns away the most, or null. */
  readonly shedPerDay: number;
  readonly fullSlot: number | null;
  /** Riders on the busiest leg in each period, in PERIODS order, as if the whole day's trips fell in that period. */
  readonly busiestLeg: readonly number[];
  /** Riders a day who board and who alight at each of its stops, in line order, after crowding. */
  readonly boardingsByStop: Float64Array;
  readonly alightingsByStop: Float64Array;
  /** Of each stop's boardings, those changing from another line, who pay nothing here. */
  readonly transfersByStop: Float64Array;
}

export interface Assignment {
  readonly lines: ReadonlyMap<LineId, LineDemand>;
  /** Trips by bus in a day, each counted once however many lines it rides: the paid boardings. */
  readonly tripsPerDay: number;
}

/** The share of riders who time their arrival, for a headway in minutes (V2's scheduleAwareShare). */
export function scheduleAwareShare(headwayMin: number): number {
  const decay = SCHEDULE_AWARE_REF_MIN / Math.max(headwayMin, SCHEDULE_AWARE_REF_MIN);
  return SCHEDULE_AWARE_FLOOR + (TIMED_RIDER_SHARE - SCHEDULE_AWARE_FLOOR) * decay;
}

/** Minutes the average rider waits on the clock, for a headway in seconds (V2's waitMinutes, no lateness until congestion). */
export function waitMin(headwaySeconds: number): number {
  const headwayMin = headwaySeconds / 60;
  const share = scheduleAwareShare(headwayMin);
  const timed = Math.min(TIMED_WAIT_MIN, headwayMin / 2);
  return Math.min(share * timed + (1 - share) * (headwayMin / 2), WAIT_CEILING_MIN);
}

/** What a wait is worth against a minute of riding: itself up to 10 minutes, convex past it (V2's perceivedWaitMin). */
export function perceivedWaitMin(wait: number): number {
  return wait <= WAIT_PAIN_REF_MIN ? wait : WAIT_PAIN_REF_MIN * (wait / WAIT_PAIN_REF_MIN) ** WAIT_PAIN_EXPONENT;
}

/**
 * Riders scanning every line at a stop (I5, K23; V2): which of the lines serving a trip are worth
 * waiting for, and how the trip's riders split among them. Lines join in order of their minutes
 * before waiting (`base`), each only while it makes the set's expected trip quicker: the wait for
 * the set's combined headway, 1 ÷ Σ 1/h, plus the ride, weighted by how often each line comes. A
 * rider takes the first bus of the set, so each line carries its share of the set's frequency.
 * Writes each line's share to `share` (0 outside the set; `order` is scratch) and returns the
 * trip's minutes, or Infinity when no line runs. One line gives its own base and wait, as before.
 */
export function commonLines(base: ArrayLike<number>, headwaySec: ArrayLike<number>, count: number, share: Float64Array, order: Int32Array): number {
  let n = 0;
  for (let q = 0; q < count; q++) {
    share[q] = 0;
    if (!(headwaySec[q]! < Infinity) || !(base[q]! < Infinity)) continue;
    let at = n++;
    while (at > 0 && base[order[at - 1]!]! > base[q]!) {
      order[at] = order[at - 1]!;
      at--;
    }
    order[at] = q;
  }
  let perSecond = 0;
  let weighted = 0;
  let minutes = Infinity;
  let taken = 0;
  for (let k = 0; k < n; k++) {
    const q = order[k]!;
    const f = 1 / headwaySec[q]!;
    const t = perceivedWaitMin(waitMin(1 / (perSecond + f))) + (weighted + f * base[q]!) / (perSecond + f);
    if (t >= minutes) break;
    perSecond += f;
    weighted += f * base[q]!;
    minutes = t;
    taken = k + 1;
  }
  for (let k = 0; k < taken; k++) share[order[k]!] = 1 / headwaySec[order[k]!]! / perSecond;
  return minutes;
}

/** The minutes a walk of `distM` to a stop feels like: less its tier's bonus, never below 0.2 nor above the walk itself (V1). */
export function walkMinutes(distM: number, bonusMin = 0): number {
  const walk = (distM / 1000) * WALK_MIN_PER_KM;
  return bonusMin > 0 ? Math.max(Math.min(walk, MIN_WALK_MIN), walk - bonusMin) : walk;
}

/** How hard a fare bites on a ride of this many km along the line: 1 at 3 km, more on a shorter ride (V2's fareSensOf). */
export function fareSensitivity(rideKm: number): number {
  const k = (FARE_SENS_RIDE_REF_KM / Math.max(rideKm, FARE_SENS_RIDE_FLOOR_KM)) ** FARE_SENS_RIDE_EXPONENT;
  return Math.min(FARE_SENS_MAX, Math.max(FARE_SENS_MIN, k));
}

/** The bus's share of a trip, given its door-to-door bus minutes and straight-line km (V1 demand.worker.ts:481-491). */
export function busShare(busMin: number, km: number): number {
  return shareFor(busMin, carMin(km), km * WALK_MIN_PER_KM);
}

function carMin(km: number): number {
  return (km / CAR_KMH) * 60 * CAR_TIME_FACTOR + CAR_PARK_PENALTY_MIN;
}

/** busShare with the trip's car and walking minutes worked out once for all three periods. */
function shareFor(busMin: number, car: number, walkMin: number): number {
  return shareGiven(busMin, Math.exp((busMin - car) / MODE_TAU_MIN), walkMin);
}

/** busShare given exp((busMin − carMin) / τ), which the fast loop builds as a product of exps it works out once (Access.expWalk). */
function shareGiven(busMin: number, expLead: number, walkMin: number): number {
  if (busMin > MAX_TRANSIT_MIN) return 0;
  // When walking beats the bus, most of those trips walk.
  const walkFactor = walkMin < busMin * 0.75 ? 0.15 : walkMin < busMin ? 0.45 : 1;
  const byLogit = LOGIT_SCALE / (1 + expLead);
  return Math.min(MAX_SHARE, (CAPTIVE_SHARE + (1 - CAPTIVE_SHARE) * byLogit) * walkFactor);
}

/**
 * The sub-points of one cell (homes or jobs) that reach exactly the same stops of one line: who they
 * are (a bitmask, at most 8 sub-points) and their average walk to each of those stops, weighted by
 * the people at each sub-point.
 */
interface Access {
  readonly mask: number;
  readonly pos: Int32Array;
  readonly walkMin: Float64Array;
  /** exp(walkMin / τ), so an option's exp((minutes − car) / τ) is a product rather than an exp. */
  readonly expWalk: Float64Array;
}

/** A cell's homes or jobs: each sub-point's share of the cell and every subset's share. */
interface Side {
  readonly share: Float64Array;
  /** shareOf[mask]: the cell's share at the sub-points in `mask`. */
  readonly shareOf: Float64Array;
}

/** Each cell's homes and jobs as shares, which depend only on the city, so they are worked out once per city. */
const SIDES = new WeakMap<City, { homes: Side[]; work: Side[] }>();
function sidesOf(city: City): { homes: Side[]; work: Side[] } {
  let sides = SIDES.get(city);
  if (!sides) {
    const sideOf = (points: readonly SubPoint[], total: number): Side => {
      const share = Float64Array.from(points, (p) => (total > 0 ? p.w / total : 0));
      const shareOf = new Float64Array(1 << points.length);
      for (let m = 1; m < shareOf.length; m++) shareOf[m] = shareOf[m & (m - 1)]! + share[31 - Math.clz32(m & -m)]!;
      return { share, shareOf };
    };
    sides = { homes: city.cells.map((c) => sideOf(c.homes, c.residents)), work: city.cells.map((c) => sideOf(c.work, c.jobs)) };
    SIDES.set(city, sides);
  }
  return sides;
}

/**
 * Who can walk to which stops: each line's groups of sub-points in every cell (Access), by home cell
 * and by line for work cells. They depend only on where the stops stand, so assignments that change
 * only headways or fares can share them.
 */
export interface Catchments {
  readonly homeLines: readonly (readonly { readonly line: number; readonly groups: readonly Access[] }[])[];
  readonly workAccess: readonly (readonly { readonly cell: number; readonly groups: readonly Access[] }[])[];
  /** Each line's changes onto other lines, by line. */
  readonly transfers: readonly (readonly Transfer[])[];
  /** By line, each cell's work sub-points that reach it, as a bitmask (0 for none). */
  readonly workReach: readonly Int32Array[];
}

/**
 * The changes from one line onto `line` (the M3 spec, item 13): from stop `from[k]` of the first to
 * stop `to[k]` of `line`, within TRANSFER_REACH_M (a stop both call at is 0 m), in `minutes[k]`: the
 * walk and the penalty of the tier of the stop boarded.
 */
export interface Transfer {
  readonly line: number;
  readonly from: Int32Array;
  readonly to: Int32Array;
  readonly minutes: Float64Array;
}

/** Every line's catchments (Catchments) for these plans. */
export function catchments(city: City, plans: readonly LinePlan[]): Catchments {
  const stopsGrid = new SpatialGrid<{ line: number; pos: number; bonus: number }>(MAX_WALK_M);
  plans.forEach((plan, line) => plan.stops.forEach((p, pos) => stopsGrid.add(p, { line, pos, bonus: plan.walkBonusMin?.[pos] ?? 0 })));

  /** Each line's access groups in every cell, by line: [cell, groups][]. */
  const accessOf = (sides: readonly (readonly SubPoint[])[]) => {
    const byLine = plans.map(() => [] as { cell: number; groups: Access[] }[]);
    // Per sub-point, the stops it reaches, by line; per cell, groups being gathered.
    const reach = plans.map(() => ({ pos: [] as number[], walk: [] as number[] }));
    const reached: number[] = [];
    // Sums weighted by people, and plain sums for a group of empty sub-points (it carries no riders).
    const gathering: { line: number; mask: number; pos: number[]; w: number; sum: number[]; n: number; plain: number[] }[] = [];
    sides.forEach((points, cell) => {
      gathering.length = 0;
      points.forEach((p, k) => {
        reached.length = 0;
        stopsGrid.forEachWithin([p.x, p.y], MAX_WALK_M, (s, distM) => {
          const r = reach[s.line]!;
          if (r.pos.length === 0) reached.push(s.line);
          // Kept in stop order, so equal sets compare equal.
          let at = r.pos.length;
          r.pos.push(s.pos);
          r.walk.push(0);
          while (at > 0 && r.pos[at - 1]! > s.pos) {
            r.pos[at] = r.pos[at - 1]!;
            r.walk[at] = r.walk[at - 1]!;
            at--;
          }
          r.pos[at] = s.pos;
          r.walk[at] = walkMinutes(distM, s.bonus);
        });
        for (const line of reached) {
          const r = reach[line]!;
          let g = gathering.find((c) => c.line === line && c.pos.length === r.pos.length && c.pos.every((v, q) => v === r.pos[q]));
          if (!g) gathering.push((g = { line, mask: 0, pos: [...r.pos], w: 0, sum: r.pos.map(() => 0), n: 0, plain: r.pos.map(() => 0) }));
          g.mask |= 1 << k;
          g.w += p.w;
          g.n++;
          for (let q = 0; q < r.walk.length; q++) {
            g.sum[q]! += p.w * r.walk[q]!;
            g.plain[q]! += r.walk[q]!;
          }
          r.pos.length = 0;
          r.walk.length = 0;
        }
      });
      for (const g of gathering) {
        const mean = g.w > 0 ? g.sum.map((v) => v / g.w) : g.plain.map((v) => v / g.n);
        const lineGroups = byLine[g.line]!;
        let entry = lineGroups[lineGroups.length - 1];
        if (entry?.cell !== cell) lineGroups.push((entry = { cell, groups: [] }));
        entry.groups.push({ mask: g.mask, pos: Int32Array.from(g.pos), walkMin: Float64Array.from(mean), expWalk: Float64Array.from(mean, (m) => Math.exp(m / MODE_TAU_MIN)) });
      }
    });
    return byLine;
  };
  const homeLines = city.cells.map(() => [] as { line: number; groups: Access[] }[]);
  accessOf(city.cells.map((c) => c.homes)).forEach((cells, line) => cells.forEach(({ cell, groups }) => homeLines[cell]!.push({ line, groups })));
  const workAccess = accessOf(city.cells.map((c) => c.work));
  const workReach = workAccess.map((cells) => {
    const masks = new Int32Array(city.cells.length);
    for (const { cell, groups } of cells) for (const g of groups) masks[cell]! |= g.mask;
    return masks;
  });
  return { homeLines, workAccess, transfers: transfersOf(plans), workReach };
}

/** Every line's changes onto the others (Transfer), in line order. */
export function transfersOf(plans: readonly LinePlan[]): Transfer[][] {
  const near = new SpatialGrid<{ line: number; pos: number }>(TRANSFER_REACH_M);
  plans.forEach((plan, line) => plan.stops.forEach((p, pos) => near.add(p, { line, pos })));
  return plans.map((plan, line) => {
    const found = new Map<number, { from: number[]; to: number[]; minutes: number[] }>();
    plan.stops.forEach((p, from) => {
      for (const { item: s, distM } of near.within(p, TRANSFER_REACH_M)) {
        if (s.line === line) continue;
        let t = found.get(s.line);
        if (!t) found.set(s.line, (t = { from: [], to: [], minutes: [] }));
        t.from.push(from);
        t.to.push(s.pos);
        t.minutes.push((distM / 1000) * WALK_MIN_PER_KM + (plans[s.line]!.transferPenaltyMin?.[s.pos] ?? STOP_TIERS[1].transferPenaltyMin));
      }
    });
    return [...found]
      .sort((a, b) => a[0] - b[0])
      .map(([to, t]) => ({ line: to, from: Int32Array.from(t.from), to: Int32Array.from(t.to), minutes: Float64Array.from(t.minutes) }));
  });
}

export interface AssignOptions {
  /** Visit only the cell pairs this line serves: its riders come out whole, the other lines' in part. */
  readonly only?: LinePlan['id'];
  /** The catchments of these plans' stops, worked out once for several assignments of the same stops. */
  readonly reach?: Catchments;
  /** What the last assignment of these commuters kept (AssignMemo), read and replaced; not with `only`. */
  readonly memo?: AssignMemo | undefined;
}

/**
 * What an assignment keeps for the next one of the same world (I14 on the late game; DECISIONS, Open): each cell pair's rides,
 * in the order it carried them, and what they were worked out from. A cell pair's riders depend only on the lines of its routes
 * (a line, or a line and the one it changes onto), so the next assignment carries again the rides of every pair whose routes'
 * lines are as they were, in the same order, and works out afresh only the pairs a changed line has a route in, then or now. The
 * sums come out as a whole assignment's, to the last bit, since every ride is added in the same order (memo.test.ts): a reload,
 * which assigns from nothing, finds the same riders (I8).
 */
export interface AssignMemo {
  last: AssignKept | null;
  /**
   * The two arenas the rides are kept in, the last assignment's and the one the next writes over, so that once both have grown to
   * a network's size an assignment allocates no rides of its own: allocated afresh for each assignment, a late game's took a whole
   * one 8–14% longer than keeping none, and pooled 2–7% (DECISIONS, Measured).
   */
  arenas?: RideArena[];
}

/**
 * Rides as assignments keep them, in the order they were carried. A ride is 3 words of where it goes, each two numbers below
 * 2^15 (PACK): its line's id and 1 + the id of the line it changes onto (0 for none), the stops it boards and alights at, and
 * the stops it changes between; and 3 of its riders, in PERIODS order. Pair p's work cell is pairWork[p], and its rides are
 * pairRide[p] to pairRide[p + 1].
 */
interface RideArena {
  stops: Int32Array;
  riders: Float64Array;
  pairWork: Int32Array;
  pairRide: Int32Array;
}

/** Two numbers below 2^15 in one word, and the bound: line ids and a line's stops stay far below it. */
const PACK = 32_768;

interface AssignKept {
  readonly commuters: Commuters;
  readonly rushy: boolean;
  /** Each line's signature (lineSignature), by id. */
  readonly signatures: ReadonlyMap<LineId, string>;
  /** The lines by the places it numbered them, with its catchments and changes. */
  readonly ids: readonly LineId[];
  readonly homeLines: Catchments['homeLines'];
  readonly workAccess: Catchments['workAccess'];
  readonly transfers: Catchments['transfers'];
  readonly arena: RideArena;
  /** Home cell i's pairs are cellPairs[i] to cellPairs[i + 1] of the arena's. */
  readonly cellPairs: Int32Array;
  /** The home cells it worked out afresh, the rest carried again whole: all of them from nothing. */
  readonly freshCells: number;
}

/**
 * Everything of a line's plan its rides depend on, as text: two lines with the same signature carry the same rides. Its seats
 * are read only after the rides, as the buses fill (spread), and its metres through roadworks not at all.
 */
function lineSignature(plan: LinePlan): string {
  const { stops, stopDistM, headways, fareCents, kmh, walkBonusMin, transferPenaltyMin, rush } = plan;
  return JSON.stringify([stops, stopDistM, headways, fareCents, kmh ?? null, walkBonusMin ?? null, transferPenaltyMin ?? null, rush ?? null]);
}

/**
 * Whether the lines of both lists come in the same order in each. A pair's options come in the order of its lines, and its rides
 * are carried again in the order they were found, so a whole assignment adds them in that order only while it holds.
 */
function sameOrder(was: readonly LineId[], now: readonly LineId[]): boolean {
  const inNow = new Set(now);
  const inWas = new Set(was);
  const before = was.filter((id) => inNow.has(id));
  const after = now.filter((id) => inWas.has(id));
  return before.length === after.length && before.every((id, k) => id === after[k]);
}

/**
 * Riders per line for the whole network. Who can walk to which stop is decided per sub-point, so
 * catchments sum sub-points (EC-15), and nobody is credited with a stop they cannot walk to. Within
 * a cell, sub-points that reach the same stops of a line ride as one group, with the group's
 * average walk to each stop. The straight-line km is the cell pair's, as the commuters were
 * counted, so placing a stop never moves it (I2). Where groups at both ends share several lines,
 * each pair of sub-points scans the lines that serve both (commonLines), so nobody is counted twice.
 * A trip may change line once (Transfer): home on one line, work on a line it changes onto.
 *
 * Only cell pairs that share a line, or a line and one it changes onto, are visited (on T03's grid,
 * 91 thousand of 659 thousand before changes). The first version compared every sub-point pair with
 * every stop pair: 13 s on the 812-cell bench against I14's 150 ms. reference/assignNaive.ts keeps
 * it as the yardstick; assign.test.ts holds this one to its riders on the fixture.
 *
 * `only` (AssignOptions) visits just the cell pairs one line serves, which is all the fare band asks
 * of the network for each fare it tries, and `reach` reuses the catchments across those tries.
 */
export function assign(city: City, commuters: Commuters, plans: readonly LinePlan[], options: AssignOptions = {}): Assignment {
  const onlyLine = options.only === undefined ? -1 : plans.findIndex((p) => p.id === options.only);
  const lineCount = plans.length;
  const { homes, work } = sidesOf(city);
  const { homeLines, workAccess, transfers, workReach } = options.reach ?? catchments(city, plans);
  // The current home cell's sub-points that reach each line, as a bitmask.
  const homeReach = new Int32Array(lineCount);
  // For each of the current home cell's routes, each home group's quickest minutes to every stop of
  // the line it rides to work, walk included, at [reach + group * stops + stop], and the place in
  // the group's stops it boards at for that. Worked out once per home cell, so an option between a
  // home group and a work group scans only the work group's stops.
  let reachRoom = 4096;
  let reachMin = new Float64Array(reachRoom);
  let reachBoard = new Int32Array(reachRoom);
  let reachUsed = 0;
  // Lines `only` rides on from home: itself, and each line that changes onto it.
  const feedsOnly = transfers.map((list, line) => line === onlyLine || list.some((t) => t.line === onlyLine));

  // Each line's wait in each period (Infinity where it does not run), at [line * 3 + period] in
  // PERIODS order.
  const wait = new Float64Array(lineCount * 3);
  // And its headway in seconds, the same way.
  const headway = new Float64Array(lineCount * 3);
  plans.forEach((plan, line) =>
    PERIODS.forEach((period, k) => {
      const h = period === 'overnight' ? plan.headways.overnight : plan.headways[period];
      const runs = runsIn(plan.headways, period) && h !== null;
      wait[line * 3 + k] = runs ? perceivedWaitMin(waitMin(h)) : Infinity;
      headway[line * 3 + k] = runs ? h : Infinity;
    }),
  );
  const stopCount = Int32Array.from(plans, (plan) => plan.stops.length);
  // Each line's fare in minutes beyond the reference, an express line's minded half as much.
  const express = plans.map(planIsExpress);
  const fareExtra = plans.map((plan, line) => ((plan.fareCents - REFERENCE_FARE_CENTS) / CENTS_PER_MINUTE) * (express[line] ? EXPRESS_FARE_WEIGHT : 1));
  // Minutes along each line to each stop, and exp(wait / τ) for each line and period.
  const stopMin = plans.map((plan) => Float64Array.from(plan.stopDistM, (m) => (m / 1000 / (plan.kmh ?? BUS_KMH)) * 60));
  const expWait = wait.map((w) => Math.exp(w / MODE_TAU_MIN));
  // Rush hour (the M3 spec, item 15): a ride's drive in each period takes the line's congestion
  // there, (factor − 1) × the drive more than the day's average (rushExtra, in PERIODS order).
  const rushExtra = plans.map((plan) => {
    const factor = periodCongestion(plan.rush ?? 0);
    return PERIODS.map((p) => factor[p] - 1);
  });
  const rushy = rushExtra.some((extra) => extra.some((v) => v !== 0));
  // A ride's minutes at period k's traffic, or the day's average at k = -1, as riders feel them: an
  // express ride's at EXPRESS_RIDE_WEIGHT.
  const rideMin = (line: number, a: number, b: number, k = -1) =>
    (Math.abs(stopMin[line]![b]! - stopMin[line]![a]!) * (k < 0 ? 1 : 1 + rushExtra[line]![k]!) + Math.max(0, Math.abs(b - a) - 1) * (DWELL_SEC / 60)) * (express[line] ? EXPRESS_RIDE_WEIGHT : 1);
  // Each line's ride between two of its stops with its fare felt (weighed against the ride's km), at
  // [from * stops + to]: a bargain fare makes the ride feel shorter, never free (V1
  // demand.worker.ts:342-344). Infinity from a stop to itself.
  const rideFareAt = (line: number, k: number) => {
    const plan = plans[line]!;
    const extra = fareExtra[line]!;
    const stops = plan.stops.length;
    const at = new Float64Array(stops * stops);
    for (let a = 0; a < stops; a++) {
      for (let b = 0; b < stops; b++) {
        const fare = extra === 0 ? 0 : extra * fareSensitivity(Math.abs(plan.stopDistM[b]! - plan.stopDistM[a]!) / 1000);
        at[a * stops + b] = a === b ? Infinity : Math.max(0.5, rideMin(line, a, b, k) + fare);
      }
    }
    return at;
  };
  const rideFare = plans.map((_, line) => rideFareAt(line, -1));
  // Each change's quickest minutes from a stop of its first line to a stop of its second, riding
  // both: the rides, the first line's fare felt once over both rides' km, and the change's walk and
  // penalty, before the second line's wait, at [a * stops + b] (the second line's stops), with the
  // change taken at the same place in `via`. None ends within TRANSFER_REACH_M of where it began:
  // that rider would walk, and the captive share would otherwise send some round a loop. Fares
  // differ between assignments, so these are made here.
  const changeAt = (first: number, t: Transfer, period: number) => {
    const stopsA = plans[first]!.stops.length;
    const stops = plans[t.line]!.stops.length;
    const distA = plans[first]!.stopDistM;
    const distB = plans[t.line]!.stopDistM;
    const best = new Float64Array(stopsA * stops).fill(Infinity);
    const via = new Int32Array(stopsA * stops);
    for (let a = 0; a < stopsA; a++) {
      for (let b = 0; b < stops; b++) {
        if (distXY(plans[first]!.stops[a]!, plans[t.line]!.stops[b]!) <= TRANSFER_REACH_M) continue;
        for (let k = 0; k < t.from.length; k++) {
          const ta = t.from[k]!;
          const tb = t.to[k]!;
          if (ta === a || tb === b) continue;
          const km = (Math.abs(distA[ta]! - distA[a]!) + Math.abs(distB[b]! - distB[tb]!)) / 1000;
          const fare = fareExtra[first] === 0 ? 0 : fareExtra[first]! * fareSensitivity(km);
          const m = Math.max(0.5, rideMin(first, a, ta, period) + rideMin(t.line, tb, b, period) + fare) + t.minutes[k]!;
          if (m < best[a * stops + b]!) {
            best[a * stops + b] = m;
            via[a * stops + b] = k;
          }
        }
      }
    }
    return { best, via, stops };
  };
  const changeMin = transfers.map((list, first) => list.map((t) => changeAt(first, t, -1)));
  // Each route's quickest minutes, before waiting, from any stop of the line boarded to any stop of
  // the line ridden to work, at [a * stops + b] (that line's stops): a line's own rideFare, or a
  // change's changeMin; and exp(minutes / τ) of each, the same way.
  const expRideFare = rideFare.map((table) => table.map((m) => Math.exp(m / MODE_TAU_MIN)));
  const expChangeMin = changeMin.map((list) => list.map((c) => c.best.map((m) => Math.exp(m / MODE_TAU_MIN))));
  // Each route's tables again at each period's traffic, less the day's average's: a route is a line
  // and its change x (-1 for the one-seat ride) as `changeMin`, numbered from routeOf[line] + x + 1,
  // and its table holds, at 6 × [a * stops + b], the minutes each period adds then exp(that / τ) for
  // each, in PERIODS order. An option keeps the stops the day's average picks (the reference does
  // the same; assign.test holds the two together) and adds these, so a fare's floor and a change's
  // choice of where to change come out as the reference's for those stops.
  const routeOf = new Int32Array(lineCount);
  const rushTable: Float64Array[] = [];
  if (rushy) {
    plans.forEach((_, line) => {
      routeOf[line] = rushTable.length;
      for (let x = -1; x < transfers[line]!.length; x++) {
        const day = x < 0 ? rideFare[line]! : changeMin[line]![x]!.best;
        const table = new Float64Array(6 * day.length);
        for (let k = 0; k < 3; k++) {
          const period = x < 0 ? rideFareAt(line, k) : changeAt(line, transfers[line]![x]!, k).best;
          for (let i = 0; i < day.length; i++) {
            const d = day[i] === Infinity || period[i] === Infinity ? 0 : period[i]! - day[i]!;
            table[6 * i + k] = d;
            table[6 * i + 3 + k] = Math.exp(d / MODE_TAU_MIN);
          }
        }
        rushTable.push(table);
      }
    });
  }

  const n = commuters.n;
  const scale = city.tripScalePermille / 1000;
  // The memo (AssignMemo): the last assignment's rides, reused for the pairs no changed line has a route in. A pair's route is
  // a line from a home cell and, for a change, the line it changes onto to the work cell, so the pairs a changed line has a route
  // in are found from the catchments, the last assignment's and this one's: a route gone or come is in one of them.
  // Nor with a line id or a line's stops past what a ride's words hold (PACK), which no game comes near.
  const memo = onlyLine >= 0 || plans.some((plan) => plan.id >= PACK || plan.stops.length >= PACK) ? undefined : options.memo;
  const ids = plans.map((plan) => plan.id);
  const signatures = memo ? new Map(plans.map((plan) => [plan.id, lineSignature(plan)] as const)) : null;
  const last = memo?.last;
  const kept = last && last.commuters === commuters && last.rushy === rushy && last.homeLines.length === n && sameOrder(last.ids, ids) ? last : null;
  let freshPair: Uint8Array | null = null;
  let freshCell: Uint8Array | null = null;
  if (kept && signatures) {
    const changed = new Set<LineId>();
    for (const [id, signature] of signatures) if (kept.signatures.get(id) !== signature) changed.add(id);
    for (const id of kept.signatures.keys()) if (!signatures.has(id)) changed.add(id);
    const pairsFresh = new Uint8Array(n * n);
    const cellsFresh = new Uint8Array(n);
    freshPair = pairsFresh;
    freshCell = cellsFresh;
    const mark = (lineIds: readonly LineId[], cells: Catchments['homeLines'], reach: Catchments['workAccess'], changes: Catchments['transfers']) => {
      const touched = lineIds.map((id) => changed.has(id));
      for (let i = 0; i < n; i++) {
        for (const { line } of cells[i]!) {
          const list = changes[line]!;
          for (let x = -1; x < list.length; x++) {
            const second = x < 0 ? line : list[x]!.line;
            if (!touched[line] && !touched[second]) continue;
            for (const { cell: j } of reach[second]!) {
              pairsFresh[i * n + j] = 1;
              cellsFresh[i] = 1;
            }
          }
        }
      }
    };
    if (changed.size) {
      mark(kept.ids, kept.homeLines, kept.workAccess, kept.transfers);
      mark(ids, homeLines, workAccess, transfers);
    }
  }
  // This assignment's rides, kept for the next (AssignKept), in an arena of the memo's that the last assignment is not in: the
  // spare, or the stale last's when it is of other commuters. And the places of the lines by id, for the rides carried again.
  const reading = kept ? kept.arena : null;
  let arena: RideArena = { stops: new Int32Array(0), riders: new Float64Array(0), pairWork: new Int32Array(0), pairRide: new Int32Array(1) };
  if (memo) {
    // A last assignment this one cannot carry from is let go before its arena is written over, so that one stopped halfway
    // leaves nothing to carry from.
    if (!kept) memo.last = null;
    const pool = (memo.arenas ??= []);
    const free = pool.find((a) => a !== reading);
    if (free) arena = free;
    else {
      arena = { stops: new Int32Array(3 * 4_096), riders: new Float64Array(3 * 4_096), pairWork: new Int32Array(1_024), pairRide: new Int32Array(1_025) };
      pool.push(arena);
    }
  }
  let rides = 0;
  let pairs = 0;
  let freshCells = 0;
  const cellPairs = new Int32Array(memo ? n + 1 : 0);
  let maxId = 0;
  for (const id of ids) maxId = Math.max(maxId, id);
  if (kept) for (const id of kept.ids) maxId = Math.max(maxId, id);
  const placeById = new Int32Array(maxId + 1).fill(-1);
  ids.forEach((id, line) => (placeById[id] = line));
  /** Room in the arena for `more` rides past those kept so far. */
  const roomFor = (more: number) => {
    if (3 * (rides + more) <= arena.stops.length) return;
    let size = arena.stops.length / 3 || 4_096;
    while (size < rides + more) size *= 2;
    const stops = new Int32Array(3 * size);
    stops.set(arena.stops.subarray(0, 3 * rides));
    const riders = new Float64Array(3 * size);
    riders.set(arena.riders.subarray(0, 3 * rides));
    arena.stops = stops;
    arena.riders = riders;
  };
  /** A pair's rides begin: those carried from here until the next pair's are its own. */
  const beginPair = (j: number) => {
    if (pairs + 1 >= arena.pairWork.length) {
      const size = 2 * Math.max(arena.pairWork.length, 512);
      const work = new Int32Array(size);
      work.set(arena.pairWork.subarray(0, pairs));
      const ride = new Int32Array(size + 1);
      ride.set(arena.pairRide.subarray(0, pairs));
      arena.pairWork = work;
      arena.pairRide = ride;
    }
    arena.pairWork[pairs] = j;
    arena.pairRide[pairs++] = rides;
  };
  /** The last assignment's rides `from` to `to` carried again in their order, as ride3 carried them, and kept in this one's arena. */
  const carryKept = (from: number, to: number) => {
    const at = reading!.stops;
    const by = reading!.riders;
    roomFor(to - from);
    arena.stops.set(at.subarray(3 * from, 3 * to), 3 * rides);
    arena.riders.set(by.subarray(3 * from, 3 * to), 3 * rides);
    rides += to - from;
    for (let r = from; r < to; r++) {
      const lines = at[3 * r]!;
      const ends = at[3 * r + 1]!;
      const change = at[3 * r + 2]!;
      const second = (lines >>> 15) - 1;
      carry(placeById[lines & (PACK - 1)]!, second < 0 ? -1 : placeById[second]!, ends & (PACK - 1), ends >>> 15, change & (PACK - 1), change >>> 15, by[3 * r]!, by[3 * r + 1]!, by[3 * r + 2]!);
    }
  };
  // For a home cell worked out afresh, where each of its pairs is among the last assignment's (1 + its place; 0 for none).
  const keptPair = new Int32Array(kept ? n : 0);
  // Riders per line per period at [line * 3 + period], as if the whole day's trips fell in that
  // period; spread over the period's half-hours by the commute profile at the end, since a choice
  // depends only on the wait. And those who pay there: all but the riders changing onto it.
  const riders = new Float64Array(lineCount * 3);
  const paid = new Float64Array(lineCount * 3);
  // Each line's riders per period and direction, at [(period * 2 + direction) * stops + stop]:
  // +riders at the lower-numbered stop of a ride and −riders at the other, so a running sum along
  // the line is the load on each leg. Home to work is the direction the morning travels; the
  // evening travels it back, so the busier direction is the same all day.
  const legs = plans.map((plan) => new Float64Array(6 * plan.stops.length));
  // And who boards, alights and boards changing from another line at each stop, at [period * stops + stop].
  const ends = plans.map((plan) => ({ board: new Float64Array(3 * plan.stops.length), alight: new Float64Array(3 * plan.stops.length), change: new Float64Array(3 * plan.stops.length) }));
  // Work cells reached from the current home cell, each with a list of the routes both share (a
  // line, or a line and the change `entryChange` off it; -1 for none), and whether `only` is among them.
  const head = new Int32Array(n).fill(-1);
  const hasOnly = new Uint8Array(n);
  // Kept across home cells and overwritten, never emptied: emptying an array frees its storage, and
  // regrowing it for every home cell was a recompute's main garbage.
  const touched = new Int32Array(n);
  let touchedCount = 0;
  let entryRoom = 1024;
  let entries = 0;
  let next = new Int32Array(entryRoom);
  let entryLine = new Int32Array(entryRoom);
  let entryChange = new Int32Array(entryRoom);
  // And where its home groups' reach starts in reachMin, as below.
  let entryReach = new Int32Array(entryRoom);
  const entryFrom: (readonly Access[])[] = [];
  const entryTo: (readonly Access[])[] = [];
  // Every way the current cell pair can ride: a line (and the line it changes onto, or -1), a home
  // group and a work group.
  let room = 64;
  let optLine = new Int32Array(room);
  let optSecond = new Int32Array(room);
  let optFrom = new Int32Array(room);
  let optTo = new Int32Array(room);
  let optBase = new Float64Array(room);
  // exp((optBase − car) / τ), built as a product (Access.expWalk).
  let optLead = new Float64Array(room);
  // The riders each option of a scanned pair carries in each period, at [option * 3 + period],
  // summed over the pair's sets and carried once (rideScanning).
  let optRide = new Float64Array(room * 3);
  let optBoard = new Int32Array(room);
  let optAlight = new Int32Array(room);
  let optChangeFrom = new Int32Array(room);
  let optChangeTo = new Int32Array(room);
  // Each option's minutes period k's traffic adds to its rides at [option * 6 + k], and exp(that / τ) at [option * 6 + 3 + k],
  // read from its route's rush table (rushTable) as the option is found: 0 and 1 without rush.
  let optRush = new Float64Array(room * 6);
  const grow = () => {
    room *= 2;
    const more = <A extends Int32Array | Float64Array>(old: A, make: (size: number) => A): A => {
      const fresh = make(room);
      fresh.set(old);
      return fresh;
    };
    optLine = more(optLine, (k) => new Int32Array(k));
    optSecond = more(optSecond, (k) => new Int32Array(k));
    optFrom = more(optFrom, (k) => new Int32Array(k));
    optTo = more(optTo, (k) => new Int32Array(k));
    optBase = more(optBase, (k) => new Float64Array(k));
    optLead = more(optLead, (k) => new Float64Array(k));
    const ride = new Float64Array(room * 3);
    ride.set(optRide);
    optRide = ride;
    optBoard = more(optBoard, (k) => new Int32Array(k));
    optAlight = more(optAlight, (k) => new Int32Array(k));
    optChangeFrom = more(optChangeFrom, (k) => new Int32Array(k));
    optChangeTo = more(optChangeTo, (k) => new Int32Array(k));
    const rushes = new Float64Array(room * 6);
    rushes.set(optRush);
    optRush = rushes;
  };
  /**
   * Carries riders on `line` from stop `board` to stop `alight`, `r0` to `r2` in PERIODS order: who
   * boards and alights where, and +riders at the lower-numbered stop of the ride and −riders at the
   * other in the direction travelled, so a running sum along the line is the load on each leg.
   */
  const carry3 = (line: number, board: number, alight: number, r0: number, r1: number, r2: number) => {
    const stops = stopCount[line]!;
    const e = ends[line]!;
    const d = legs[line]!;
    e.board[board]! += r0;
    e.board[stops + board]! += r1;
    e.board[2 * stops + board]! += r2;
    e.alight[alight]! += r0;
    e.alight[stops + alight]! += r1;
    e.alight[2 * stops + alight]! += r2;
    const lo = board < alight ? board : alight;
    const hi = board < alight ? alight : board;
    const dir = board < alight ? 0 : stops;
    d[dir + lo]! += r0;
    d[dir + hi]! -= r0;
    d[2 * stops + dir + lo]! += r1;
    d[2 * stops + dir + hi]! -= r1;
    d[4 * stops + dir + lo]! += r2;
    d[4 * stops + dir + hi]! -= r2;
  };
  /** Carries an option's riders in each period, keeping the ride for the next assignment where there is a memo (AssignMemo). */
  const ride3 = (line: number, second: number, board: number, alight: number, changeFrom: number, changeTo: number, r0: number, r1: number, r2: number) => {
    if (memo) {
      if (3 * rides === arena.stops.length) roomFor(1);
      const at = 3 * rides++;
      arena.stops[at] = ids[line]! | (second < 0 ? 0 : (ids[second]! + 1) << 15);
      arena.stops[at + 1] = board | (alight << 15);
      arena.stops[at + 2] = changeFrom | (changeTo << 15);
      arena.riders[at] = r0;
      arena.riders[at + 1] = r1;
      arena.riders[at + 2] = r2;
    }
    carry(line, second, board, alight, changeFrom, changeTo, r0, r1, r2);
  };
  /** Carries riders in each period: on their line, and on the one they change onto, as a change there. */
  const carry = (line: number, second: number, board: number, alight: number, changeFrom: number, changeTo: number, r0: number, r1: number, r2: number) => {
    const at = line * 3;
    riders[at]! += r0;
    riders[at + 1]! += r1;
    riders[at + 2]! += r2;
    paid[at]! += r0;
    paid[at + 1]! += r1;
    paid[at + 2]! += r2;
    if (second < 0) {
      carry3(line, board, alight, r0, r1, r2);
      return;
    }
    carry3(line, board, changeFrom, r0, r1, r2);
    const bt = second * 3;
    riders[bt]! += r0;
    riders[bt + 1]! += r1;
    riders[bt + 2]! += r2;
    carry3(second, changeTo, alight, r0, r1, r2);
    const change = ends[second]!.change;
    const stops = stopCount[second]!;
    change[changeTo]! += r0;
    change[stops + changeTo]! += r1;
    change[2 * stops + changeTo]! += r2;
  };
  /** ride3() for a stored option. */
  const rideOption = (q: number, r0: number, r1: number, r2: number) =>
    ride3(optLine[q]!, optSecond[q]!, optBoard[q]!, optAlight[q]!, optChangeFrom[q]!, optChangeTo[q]!, r0, r1, r2);
  /**
   * A way's share of its trips in period `k` with no other way to ride: its own waits and the
   * period's traffic on its rides (`rush`, and `expRush` its exp(rush / τ)), 0 where a line does not
   * run. `base` is its minutes before waiting at the day's average traffic and `lead` exp((base − car) / τ).
   */
  const shareAlone = (line: number, second: number, base: number, lead: number, k: number, walkMin: number, rush: number, expRush: number) => {
    const at = line * 3 + k;
    const w = second < 0 ? wait[at]! : wait[at]! + wait[second * 3 + k]!;
    if (w === Infinity) return 0;
    return shareGiven(base + w + rush, (second < 0 ? lead * expWait[at]! : lead * expWait[at]! * expWait[second * 3 + k]!) * expRush, walkMin);
  };
  /** shareAlone() for a stored option. */
  const optionAlone = (q: number, k: number, walkMin: number) =>
    shareAlone(optLine[q]!, optSecond[q]!, optBase[q]!, optLead[q]!, k, walkMin, optRush[q * 6 + k]!, optRush[q * 6 + 3 + k]!);
  // Scratch for several routes: each sub-point's options as a bitmask, the sets of options pairs of
  // sub-points share (at most 64 pairs) and their shares of the cell pair, and one set's options
  // (a pair has at most one per route), and the quickest of them on each first line, with how many
  // tie it exactly.
  const homeWord = new Int32Array(8);
  const workWord = new Int32Array(8);
  let homeMask = new Int32Array(16);
  let workMask = new Int32Array(16);
  let pairMask = new Int32Array(2);
  let setKey = new Int32Array(128);
  const setWeight = new Float64Array(64);
  // A pair's sets on single words found by their key in an open-addressed table of 128 slots, each slot stamped with the pair
  // it was filled for, so nothing is cleared between pairs: the sets come out in the order the scan meets them, as a search of
  // the list found them.
  const slotKey = new Int32Array(128);
  const slotSet = new Int32Array(128);
  const slotPair = new Int32Array(128).fill(-1);
  let pairStamp = 0;
  let members = new Int32Array(Math.max(lineCount, 32));
  let picked = new Int32Array(members.length);
  let tied = new Int32Array(members.length);
  let memberBase = new Float64Array(members.length);
  let memberHeadway = new Float64Array(members.length);
  let memberShare = new Float64Array(members.length);
  let memberOrder = new Int32Array(members.length);
  // The current cell pair's trips, car and walking minutes, for rideScanning.
  let pairTrips = 0;
  let pairCar = 0;
  let pairWalk = 0;
  /** Riders of a set of `n` options (`members`) with `weight` of the cell pair's trips, in each period, into optRide. */
  const rideScanning = (set: Int32Array, n: number, weight: number) => {
    if (n === 1) {
      // One route: its own waits, and the exponent built as the single-route branch builds it.
      const q = set[0]!;
      const trips = pairTrips * weight;
      optRide[q * 3]! += trips * optionAlone(q, 0, pairWalk);
      optRide[q * 3 + 1]! += trips * optionAlone(q, 1, pairWalk);
      optRide[q * 3 + 2]! += trips * optionAlone(q, 2, pairWalk);
      return;
    }
    for (let k = 0; k < 3; k++) {
      // A change and a one-seat ride starting on the same line take the same first bus, so each
      // first line running this period offers its quickest, with the second line's wait; ways that
      // tie exactly (a change onto either of twin lines) are counted in `tied` and split evenly
      // below, so no order the lines were drawn in picks one (EC-02; the reference does the same).
      let lines = 0;
      for (let m = 0; m < n; m++) {
        const q = set[m]!;
        const line = optLine[q]!;
        if (headway[line * 3 + k] === Infinity) continue;
        const second = optSecond[q]!;
        const base = (second < 0 ? optBase[q]! : optBase[q]! + wait[second * 3 + k]!) + optRush[q * 6 + k]!;
        if (base === Infinity) continue;
        let at = 0;
        while (at < lines && optLine[picked[at]!] !== line) at++;
        if (at === lines) {
          picked[lines] = q;
          tied[lines] = 1;
          memberBase[lines] = base;
          memberHeadway[lines++] = headway[line * 3 + k]!;
        } else if (base < memberBase[at]!) {
          picked[at] = q;
          tied[at] = 1;
          memberBase[at] = base;
        } else if (base === memberBase[at]) tied[at]!++;
      }
      if (lines === 0) continue;
      // One first line is its own wait (commonLines would give the same, a few ulps apart).
      if (lines === 1) memberShare[0] = 1;
      const minutes = lines === 1 ? memberBase[0]! + wait[optLine[picked[0]!]! * 3 + k]! : commonLines(memberBase, memberHeadway, lines, memberShare, memberOrder);
      if (minutes === Infinity) continue;
      const r = pairTrips * weight * shareGiven(minutes, Math.exp((minutes - pairCar) / MODE_TAU_MIN), pairWalk);
      if (r === 0) continue;
      for (let m = 0; m < lines; m++) {
        if (tied[m] === 1) {
          optRide[picked[m]! * 3 + k]! += r * memberShare[m]!;
          continue;
        }
        // The ways that tie it, found again as above.
        const line = optLine[picked[m]!]!;
        const each = (r * memberShare[m]!) / tied[m]!;
        for (let p = 0; p < n; p++) {
          const q = set[p]!;
          if (optLine[q] !== line) continue;
          const second = optSecond[q]!;
          if ((second < 0 ? optBase[q]! : optBase[q]! + wait[second * 3 + k]!) + optRush[q * 6 + k]! === memberBase[m]) optRide[q * 3 + k]! += each;
        }
      }
    }
  };
  /** Carries what rideScanning() put on each of the pair's `count` options, once each, and clears it. */
  const rideScanned = (count: number) => {
    for (let q = 0; q < count; q++) {
      const r0 = optRide[q * 3]!;
      const r1 = optRide[q * 3 + 1]!;
      const r2 = optRide[q * 3 + 2]!;
      if (r0 === 0 && r1 === 0 && r2 === 0) continue;
      rideOption(q, r0, r1, r2);
      optRide[q * 3] = 0;
      optRide[q * 3 + 1] = 0;
      optRide[q * 3 + 2] = 0;
    }
  };

  for (let i = 0; i < n; i++) {
    const from = homes[i]!;
    touchedCount = 0;
    entries = 0;
    if (memo) cellPairs[i] = pairs;
    // A home cell no changed line has a route from: its pairs as the last assignment carried them, in its order.
    const wasFrom = kept ? kept.cellPairs[i]! : 0;
    const wasTo = kept ? kept.cellPairs[i + 1]! : 0;
    if (kept && freshCell && !freshCell[i]) {
      for (let p = wasFrom; p < wasTo; p++) {
        beginPair(reading!.pairWork[p]!);
        carryKept(reading!.pairRide[p]!, reading!.pairRide[p + 1]!);
      }
      continue;
    }
    freshCells++;
    for (let p = wasFrom; p < wasTo; p++) keptPair[reading!.pairWork[p]!] = p + 1;
    if (onlyLine >= 0 && !homeLines[i]!.some((h) => feedsOnly[h.line])) continue;
    homeReach.fill(0);
    reachUsed = 0;
    for (const { line, groups } of homeLines[i]!) for (const g of groups) homeReach[line]! |= g.mask;
    for (const { line, groups } of homeLines[i]!) {
      const changes = transfers[line]!;
      for (let x = -1; x < changes.length; x++) {
        const second = x < 0 ? line : changes[x]!.line;
        // A change nobody here would make (below) is not visited at all.
        if (x >= 0 && (homeReach[line]! & ~homeReach[second]!) === 0) continue;
        const stops = stopCount[second]!;
        const table = x < 0 ? rideFare[line]! : changeMin[line]![x]!.best;
        const reach = reachUsed;
        reachUsed += groups.length * stops;
        if (reachUsed > reachRoom) {
          while (reachUsed > reachRoom) reachRoom *= 2;
          const min = new Float64Array(reachRoom);
          min.set(reachMin);
          reachMin = min;
          const board = new Int32Array(reachRoom);
          board.set(reachBoard);
          reachBoard = board;
        }
        for (let g = 0; g < groups.length; g++) {
          const a = groups[g]!;
          const row = reach + g * stops;
          for (let b = 0; b < stops; b++) {
            let best = Infinity;
            let at = 0;
            for (let p = 0; p < a.pos.length; p++) {
              const t = a.walkMin[p]! + table[a.pos[p]! * stops + b]!;
              if (t < best) {
                best = t;
                at = p;
              }
            }
            reachMin[row + b] = best;
            reachBoard[row + b] = at;
          }
        }
        const offWork = workReach[line]!;
        const onWork = workReach[second]!;
        for (const { cell: j, groups: to } of workAccess[second]!) {
          if (x >= 0 && (onWork[j]! & ~offWork[j]!) === 0) continue;
          if (head[j] === -1) touched[touchedCount++] = j;
          if (line === onlyLine || second === onlyLine) hasOnly[j] = 1;
          if (entries === entryRoom) {
            entryRoom *= 2;
            const wider = (old: Int32Array) => {
              const fresh = new Int32Array(entryRoom);
              fresh.set(old);
              return fresh;
            };
            next = wider(next);
            entryLine = wider(entryLine);
            entryChange = wider(entryChange);
            entryReach = wider(entryReach);
          }
          next[entries] = head[j]!;
          head[j] = entries;
          entryLine[entries] = line;
          entryChange[entries] = x;
          entryReach[entries] = reach;
          entryFrom[entries] = groups;
          entryTo[entries] = to;
          entries++;
        }
      }
    }
    for (let t = 0; t < touchedCount; t++) {
      const j = touched[t]!;
      const first = head[j]!;
      head[j] = -1;
      const skip = onlyLine >= 0 && !hasOnly[j];
      hasOnly[j] = 0;
      const flow = commuters.flow[i * n + j]!;
      if (flow <= 0 || skip) continue;
      if (memo) beginPair(j);
      // A pair no changed line has a route in, then or now: its rides as the last assignment carried them.
      if (kept && !freshPair![i * n + j] && keptPair[j]) {
        const p = keptPair[j]! - 1;
        carryKept(reading!.pairRide[p]!, reading!.pairRide[p + 1]!);
        continue;
      }
      // Straight-line km between the cells' centres, which no stop can move (I2), and the car and
      // walking minutes it gives.
      const km = commuters.km[i * n + j]!;
      const car = carMin(km);
      const walk = km * WALK_MIN_PER_KM;
      const expCar = Math.exp(-car / MODE_TAU_MIN);
      const to = work[j]!;
      const trips = 2 * flow * scale; // both ways (V1 counted the round trip)
      // One route: its groups split each end's sub-points, so every option has its own riders,
      // carried as it is found.
      const alone = next[first] === -1;
      let count = 0;
      let routes = 0;
      for (let e = first; e !== -1; e = next[e]!) {
        const line = entryLine[e]!;
        const x = entryChange[e]!;
        const second = x < 0 ? -1 : transfers[line]![x]!.line;
        const rideOn = x < 0 ? line : second;
        const stops = stopCount[rideOn]!;
        const expTable = x < 0 ? expRideFare[line]! : expChangeMin[line]![x]!;
        const via = x < 0 ? null : changeMin[line]![x]!.via;
        const change = x < 0 ? null : transfers[line]![x]!;
        const reach = entryReach[e]!;
        // This route's rush table, read once for all its options.
        const route = rushy ? routeOf[line]! + x + 1 : 0;
        const rush = rushy ? rushTable[route]! : null;
        const homeGroups = entryFrom[e]!;
        const workGroups = entryTo[e]!;
        // Nobody changes onto a line they could walk to from home, or off one that reaches work.
        const keepFrom = x < 0 ? -1 : ~homeReach[second]!;
        const keepTo = x < 0 ? -1 : ~workReach[line]![j]!;
        const before = count;
        for (let g = 0; g < homeGroups.length; g++) {
          const a = homeGroups[g]!;
          const fromMask = a.mask & keepFrom;
          if (fromMask === 0) continue;
          const row = reach + g * stops;
          for (let w = 0; w < workGroups.length; w++) {
            const b = workGroups[w]!;
            const toMask = b.mask & keepTo;
            if (toMask === 0) continue;
            const share = alone ? trips * from.shareOf[fromMask]! * to.shareOf[toMask]! : 1;
            if (share === 0) continue;
            // The quickest door to door before waiting: the home group's reach to each of the work
            // group's stops, and the walk from it.
            let base = Infinity;
            let y = 0;
            for (let q = 0; q < b.pos.length; q++) {
              const t = reachMin[row + b.pos[q]!]! + b.walkMin[q]!;
              if (t < base) {
                base = t;
                y = q;
              }
            }
            if (base === Infinity) continue;
            const alight = b.pos[y]!;
            const at = reachBoard[row + alight]!;
            const board = a.pos[at]!;
            const lead = a.expWalk[at]! * expTable[board * stops + alight]! * b.expWalk[y]! * expCar;
            const k = via ? via[board * stops + alight]! : 0;
            const changeFrom = change ? change.from[k]! : 0;
            const changeTo = change ? change.to[k]! : 0;
            if (alone) {
              let r0: number;
              let r1: number;
              let r2: number;
              if (rush) {
                const at = 6 * (board * stops + alight);
                r0 = share * shareAlone(line, second, base, lead, 0, walk, rush[at]!, rush[at + 3]!);
                r1 = share * shareAlone(line, second, base, lead, 1, walk, rush[at + 1]!, rush[at + 4]!);
                r2 = share * shareAlone(line, second, base, lead, 2, walk, rush[at + 2]!, rush[at + 5]!);
              } else {
                r0 = share * shareAlone(line, second, base, lead, 0, walk, 0, 1);
                r1 = share * shareAlone(line, second, base, lead, 1, walk, 0, 1);
                r2 = share * shareAlone(line, second, base, lead, 2, walk, 0, 1);
              }
              ride3(line, second, board, alight, changeFrom, changeTo, r0, r1, r2);
              continue;
            }
            if (count === room) grow();
            optLine[count] = line;
            optSecond[count] = second;
            optFrom[count] = fromMask;
            optTo[count] = toMask;
            optBase[count] = base;
            optLead[count] = lead;
            optBoard[count] = board;
            optAlight[count] = alight;
            optChangeFrom[count] = changeFrom;
            optChangeTo[count] = changeTo;
            if (rush) {
              const at = 6 * (board * stops + alight);
              for (let r = 0; r < 6; r++) optRush[count * 6 + r] = rush[at + r]!;
            } else {
              optRush[count * 6] = 0;
              optRush[count * 6 + 1] = 0;
              optRush[count * 6 + 2] = 0;
              optRush[count * 6 + 3] = 1;
              optRush[count * 6 + 4] = 1;
              optRush[count * 6 + 5] = 1;
            }
            count++;
          }
        }
        if (count > before) routes++;
      }
      if (alone || count === 0) continue;
      pairTrips = trips;
      pairCar = car;
      pairWalk = walk;
      // One route after all, or several whose options share no pair of sub-points (a one-seat ride
      // and a change off the same line, by the rule above, never do): as above, every option has
      // its own riders, so nobody scans.
      let disjoint = true;
      for (let q = 0; q < count && disjoint && routes > 1; q++) {
        for (let r = q + 1; r < count; r++) {
          if ((optFrom[q]! & optFrom[r]!) !== 0 && (optTo[q]! & optTo[r]!) !== 0) {
            disjoint = false;
            break;
          }
        }
      }
      if (disjoint) {
        for (let q = 0; q < count; q++) {
          const pairTrips = trips * from.shareOf[optFrom[q]!]! * to.shareOf[optTo[q]!]!;
          if (pairTrips === 0) continue;
          rideOption(q, pairTrips * optionAlone(q, 0, walk), pairTrips * optionAlone(q, 1, walk), pairTrips * optionAlone(q, 2, walk));
        }
        continue;
      }
      // Several routes: each pair of sub-points scans every line serving both its ends (I5) and
      // takes the first bus of those worth waiting for (commonLines). Within a route its groups
      // split each end's sub-points, so a pair has at most one option per route. Each sub-point's
      // options are a bitmask, a pair's are the two ANDed, and pairs with the same options (at
      // most 64 sets) are worked out once.
      if (members.length < routes) {
        members = new Int32Array(2 * routes);
        picked = new Int32Array(2 * routes);
        tied = new Int32Array(2 * routes);
        memberBase = new Float64Array(2 * routes);
        memberHeadway = new Float64Array(2 * routes);
        memberShare = new Float64Array(2 * routes);
        memberOrder = new Int32Array(2 * routes);
      }
      if (count <= 32) {
        // Up to 32 options, as nearly every pair has: the same on single words.
        homeWord.fill(0);
        workWord.fill(0);
        for (let q = 0; q < count; q++) {
          for (let bits = optFrom[q]!; bits; bits &= bits - 1) homeWord[31 - Math.clz32(bits & -bits)]! |= 1 << q;
          for (let bits = optTo[q]!; bits; bits &= bits - 1) workWord[31 - Math.clz32(bits & -bits)]! |= 1 << q;
        }
        let sets = 0;
        const stamp = pairStamp++;
        for (let h = 0; h < from.share.length; h++) {
          const hs = from.share[h]!;
          if (hs === 0) continue;
          for (let w = 0; w < to.share.length; w++) {
            const ws = to.share[w]!;
            const key = homeWord[h]! & workWord[w]!;
            if (ws === 0 || key === 0) continue;
            let slot = Math.imul(key, 0x9e3779b1) >>> 25;
            while (slotPair[slot] === stamp && slotKey[slot] !== key) slot = (slot + 1) & 127;
            let at: number;
            if (slotPair[slot] === stamp) at = slotSet[slot]!;
            else {
              slotPair[slot] = stamp;
              slotKey[slot] = key;
              slotSet[slot] = at = sets;
              setKey[sets] = key;
              setWeight[sets++] = 0;
            }
            setWeight[at]! += hs * ws;
          }
        }
        for (let at = 0; at < sets; at++) {
          let n = 0;
          for (let bits = setKey[at]!; bits; bits &= bits - 1) members[n++] = 31 - Math.clz32(bits & -bits);
          rideScanning(members, n, setWeight[at]!);
        }
        rideScanned(count);
        continue;
      }
      // Each sub-point's options as a bitmask of `words` 32-bit words, for any number of options.
      const words = (count + 31) >>> 5;
      if (homeMask.length < 8 * words) {
        homeMask = new Int32Array(16 * words);
        workMask = new Int32Array(16 * words);
        pairMask = new Int32Array(2 * words);
      }
      homeMask.fill(0, 0, 8 * words);
      workMask.fill(0, 0, 8 * words);
      for (let q = 0; q < count; q++) {
        const word = q >>> 5;
        const bit = 1 << (q & 31);
        for (let bits = optFrom[q]!; bits; bits &= bits - 1) homeMask[(31 - Math.clz32(bits & -bits)) * words + word]! |= bit;
        for (let bits = optTo[q]!; bits; bits &= bits - 1) workMask[(31 - Math.clz32(bits & -bits)) * words + word]! |= bit;
      }
      if (setKey.length < 64 * words) setKey = new Int32Array(64 * words);
      let sets = 0;
      for (let h = 0; h < from.share.length; h++) {
        const hs = from.share[h]!;
        if (hs === 0) continue;
        for (let w = 0; w < to.share.length; w++) {
          const ws = to.share[w]!;
          if (ws === 0) continue;
          let any = 0;
          for (let x = 0; x < words; x++) any |= pairMask[x] = homeMask[h * words + x]! & workMask[w * words + x]!;
          if (any === 0) continue;
          let at = 0;
          for (; at < sets; at++) {
            let same = true;
            for (let x = 0; x < words && same; x++) same = setKey[at * words + x] === pairMask[x];
            if (same) break;
          }
          if (at === sets) {
            for (let x = 0; x < words; x++) setKey[sets * words + x] = pairMask[x]!;
            setWeight[sets++] = 0;
          }
          setWeight[at]! += hs * ws;
        }
      }
      for (let at = 0; at < sets; at++) {
        let n = 0;
        for (let x = 0; x < words; x++) for (let bits = setKey[at * words + x]!; bits; bits &= bits - 1) members[n++] = x * 32 + 31 - Math.clz32(bits & -bits);
        rideScanning(members, n, setWeight[at]!);
      }
      rideScanned(count);
    }
    for (let p = wasFrom; p < wasTo; p++) keptPair[reading!.pairWork[p]!] = 0;
  }
  if (memo) {
    cellPairs[n] = pairs;
    arena.pairRide[pairs] = rides;
    // Grown by doubling as it fills, an arena trimmed to a tenth over what it holds once it is a quarter over, so the two hold
    // about 31 MB of a late game's rides rather than 40 (DECISIONS, Measured); the next that needs more grows it again.
    if (arena.stops.length > 3 * (1.25 * rides + 4_096)) {
      const size = Math.ceil(1.1 * rides) + 4_096;
      arena.stops = arena.stops.slice(0, 3 * size);
      arena.riders = arena.riders.slice(0, 3 * size);
    }
    if (arena.pairWork.length > 1.25 * pairs + 1_024) {
      const size = Math.ceil(1.1 * pairs) + 1_024;
      arena.pairWork = arena.pairWork.slice(0, size);
      arena.pairRide = arena.pairRide.slice(0, size + 1);
    }
    memo.last = {
      commuters,
      rushy,
      signatures: signatures!,
      ids,
      homeLines,
      workAccess,
      transfers,
      arena,
      cellPairs,
      freshCells,
    };
  }
  const perLine = (by: Float64Array) => plans.map((_, line) => [by[line * 3]!, by[line * 3 + 1]!, by[line * 3 + 2]!]);
  return spread(
    plans,
    perLine(riders),
    legs.map((d, line) => busiestLegs(d, plans[line]!.stops.length)),
    ends,
    perLine(paid),
  );
}

/**
 * The busiest leg's riders in each period, in PERIODS order, from boardings and alightings laid out
 * as assign() lays them out: whichever direction and leg carries the most.
 */
export function busiestLegs(d: Float64Array, stops: number): number[] {
  return PERIODS.map((_, k) => {
    let most = 0;
    for (let dir = 0; dir < 2; dir++) {
      let load = 0;
      for (let s = 0; s < stops; s++) {
        load += d[(k * 2 + dir) * stops + s]!;
        if (load > most) most = load;
      }
    }
    return most;
  });
}

/** Seats a line offers each way in a half-hour of a period: departures in the half-hour × seats (0 where it does not run). */
export function seatsPerSlot(plan: LinePlan, period: Period): number {
  const h = period === 'overnight' ? plan.headways.overnight : plan.headways[period];
  return runsIn(plan.headways, period) && h !== null ? (1800 / h) * (plan.seats ?? BUS_SEATS) : 0;
}

/**
 * Turns each line's riders per period (in PERIODS order, as if the whole day's trips fell in that
 * period) into boardings per half-hour, by the commute profile, and turns away the riders a full
 * bus cannot take (K27). A half-hour's riders all travel the way the commute does then, so its
 * busiest leg carries that half-hour's share of the period's busiest leg; past the seats the line
 * offers each way in that half-hour, the rest are turned away, in that half-hour only. Each stop's
 * boardings, alightings and changes (`ends`, at [period * stops + stop]) and the riders who pay
 * (`paidByPeriod`, all of them when absent) lose the same share as their period's riders.
 */
export function spread(
  plans: readonly LinePlan[],
  byPeriod: readonly (readonly number[])[],
  busiest: readonly (readonly number[])[],
  ends: readonly { readonly board: Float64Array; readonly alight: Float64Array; readonly change?: Float64Array }[],
  paidByPeriod: readonly (readonly number[])[] = byPeriod,
): Assignment {
  const lines = new Map<LinePlan['id'], LineDemand>();
  let tripsPerDay = 0;
  plans.forEach((plan, line) => {
    const seats = PERIODS.map((p) => seatsPerSlot(plan, p));
    const bySlot = new Float64Array(SLOTS);
    const paidBySlot = new Float64Array(SLOTS);
    let perDay = 0;
    let paidPerDay = 0;
    let shedPerDay = 0;
    let fullSlot: number | null = null;
    let most = 0;
    const kept = [0, 0, 0];
    for (let s = 0; s < SLOTS; s++) {
      const k = SLOT_PERIOD_INDEX[s]!;
      const shed = Math.max(0, busiest[line]![k]! * SLOT_SHARE[s]! - seats[k]!);
      bySlot[s] = byPeriod[line]![k]! * SLOT_SHARE[s]! - shed;
      kept[k]! += bySlot[s]!;
      perDay += bySlot[s]!;
      // Who pays: the same share of those kept as of those offered.
      const offered = byPeriod[line]![k]!;
      paidBySlot[s] = offered > 0 ? bySlot[s]! * (paidByPeriod[line]![k]! / offered) : 0;
      paidPerDay += paidBySlot[s]!;
      shedPerDay += shed;
      if (shed > most) {
        most = shed;
        fullSlot = s;
      }
    }
    // Riders a day per stop: each period's share of the day, less what crowding turned away then.
    const stops = plan.stops.length;
    const boardingsByStop = new Float64Array(stops);
    const alightingsByStop = new Float64Array(stops);
    const transfersByStop = new Float64Array(stops);
    const change = ends[line]!.change;
    PERIODS.forEach((_, k) => {
      const offered = byPeriod[line]![k]! * PERIOD_SHARE[k]!;
      if (offered <= 0) return;
      const scale = (PERIOD_SHARE[k]! * kept[k]!) / offered;
      for (let q = 0; q < stops; q++) {
        boardingsByStop[q]! += ends[line]!.board[k * stops + q]! * scale;
        alightingsByStop[q]! += ends[line]!.alight[k * stops + q]! * scale;
        if (change) transfersByStop[q]! += change[k * stops + q]! * scale;
      }
    });
    lines.set(plan.id, { bySlot, perDay, paidBySlot, paidPerDay, shedPerDay, fullSlot, busiestLeg: busiest[line]!, boardingsByStop, alightingsByStop, transfersByStop });
    // A trip pays once, on its first line, so its paid boardings count each trip once.
    tripsPerDay += paidPerDay;
  });
  return { lines, tripsPerDay };
}
