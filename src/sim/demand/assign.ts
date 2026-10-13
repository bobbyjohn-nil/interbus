// Who rides which line, rewritten from V1's demand worker (`Intralines@7af45b1:src/game/sim/
// demand.worker.ts:290-520`, R01) for M1: commuters only, one-seat rides (transfers land in week 7).
// Changed on the way in:
// - no cap on how many stops a home sees or how many lines a stop offers (V1 kept 4 stops and 3
//   lines, K04, K23): every stop within 650 m counts;
// - catchments sum each cell's sub-points instead of measuring from one centroid (EC-15);
// - per period (D7): a line's wait comes from that period's headway, and nobody boards in a period
//   it does not run, so an overnight-off line loses its night riders (EC-03);
// - the fare is paid per boarding and felt as minutes beyond $2.25 (K05);
// - no silent floors: V1 dropped pairs under half a commuter and shares under 1%; this keeps them;
// - V1 timed trips between cell centroids; this times them per group of sub-points that reach the
//   same stops, with the group's average walk (I14's budget rules out every sub-point pair).
// Waits carry no traffic delay until congestion lands in week 7 (K06: one rule for both).
import {
  BUS_KMH,
  CAPTIVE_SHARE,
  CAR_KMH,
  CAR_PARK_PENALTY_MIN,
  CAR_TIME_FACTOR,
  CENTS_PER_MINUTE,
  DWELL_SEC,
  HOURLY_PROFILE,
  LOGIT_SCALE,
  MAX_SHARE,
  MAX_TRANSIT_MIN,
  MAX_WAIT_MIN,
  MAX_WALK_M,
  MODE_TAU_MIN,
  REFERENCE_FARE_CENTS,
  TIMED_RIDER_SHARE,
  TIMED_WAIT_MIN,
  WALK_MIN_PER_KM,
} from '../config/demand';
import { SpatialGrid, type XY } from '../core/geo';
import type { LineId } from '../core/ids';
import type { City, SubPoint } from '../city/simfile';
import { PERIODS, periodAt, runsIn, type Headways, type Period } from '../rules/periods';
import type { Commuters } from './commuters';

/** Half-hour slots, so the 06:30 and 09:30 period edges fall on slot boundaries. */
export const SLOTS = 48;
const SLOT_PERIOD: readonly Period[] = Array.from({ length: SLOTS }, (_, s) => periodAt(s * 1800 + 900));
const SLOT_SHARE: readonly number[] = Array.from({ length: SLOTS }, (_, s) => HOURLY_PROFILE[Math.floor(s / 2)]! / 2);

export interface LinePlan {
  readonly id: LineId;
  /** Stop positions in the city frame's metres, in line order. */
  readonly stops: readonly XY[];
  /** Metres along the line's route from its first stop to each stop. */
  readonly stopDistM: readonly number[];
  readonly headways: Headways;
  readonly fareCents: number;
}

export interface LineDemand {
  /** Boardings in each half-hour of a day, 00:00 first. */
  readonly bySlot: Float64Array;
  readonly perDay: number;
}

export interface Assignment {
  readonly lines: ReadonlyMap<LineId, LineDemand>;
  /** Trips by bus in a day, each counted once however many lines it rides. */
  readonly tripsPerDay: number;
}

/** Minutes the average rider waits, for a headway in seconds (V1 demand.worker.ts:258-260, no delay). */
export function waitMin(headwaySeconds: number): number {
  return TIMED_RIDER_SHARE * Math.min(TIMED_WAIT_MIN, MAX_WAIT_MIN) + (1 - TIMED_RIDER_SHARE) * Math.min(headwaySeconds / 60 / 2, MAX_WAIT_MIN);
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

/** busShare given exp((busMin − carMin) / τ), which the fast loop builds from one exp per option and one per wait. */
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
 * Riders per line for the whole network. Who can walk to which stop is decided per sub-point, so
 * catchments sum sub-points (EC-15), and nobody is credited with a stop they cannot walk to. Within
 * a cell, sub-points that reach the same stops of a line ride as one group, with the group's
 * average walk to each stop. The straight-line km is the cell pair's, as the commuters were
 * counted, so placing a stop never moves it (I2). Where groups at both ends share several lines,
 * each pair of sub-points rides the quickest line that serves both, so nobody is counted twice.
 *
 * Only cell pairs that share a line are visited (on T03's grid, 91 thousand of 659 thousand). The
 * first version compared every sub-point pair with every stop pair: 13 s on the 812-cell bench
 * against I14's 150 ms. reference/assignNaive.ts keeps it as the yardstick; assign.test.ts holds
 * this one to its riders on the fixture.
 */
export function assign(city: City, commuters: Commuters, plans: readonly LinePlan[], tripScalePermille = city.tripScalePermille): Assignment {
  const lineCount = plans.length;
  const stopsGrid = new SpatialGrid<{ line: number; pos: number }>(MAX_WALK_M);
  plans.forEach((plan, line) => plan.stops.forEach((p, pos) => stopsGrid.add(p, { line, pos })));

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
          r.walk[at] = (distM / 1000) * WALK_MIN_PER_KM;
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
        entry.groups.push({ mask: g.mask, pos: Int32Array.from(g.pos), walkMin: Float64Array.from(mean) });
      }
    });
    return byLine;
  };
  const { homes, work } = sidesOf(city);
  const homeLines = city.cells.map(() => [] as { line: number; groups: Access[] }[]);
  accessOf(city.cells.map((c) => c.homes)).forEach((cells, line) => cells.forEach(({ cell, groups }) => homeLines[cell]!.push({ line, groups })));
  const workAccess = accessOf(city.cells.map((c) => c.work));

  // Each line's wait in each period (Infinity where it does not run), at [line * 3 + period] in
  // PERIODS order, and its fare in minutes.
  const wait = new Float64Array(lineCount * 3);
  plans.forEach((plan, line) =>
    PERIODS.forEach((period, k) => {
      const h = period === 'overnight' ? plan.headways.overnight : plan.headways[period];
      wait[line * 3 + k] = runsIn(plan.headways, period) && h !== null ? waitMin(h) : Infinity;
    }),
  );
  const fareMin = plans.map((plan) => (plan.fareCents - REFERENCE_FARE_CENTS) / CENTS_PER_MINUTE);
  // Minutes along each line to each stop, and exp(wait / τ) for each line and period.
  const stopMin = plans.map((plan) => Float64Array.from(plan.stopDistM, (m) => (m / 1000 / BUS_KMH) * 60));
  const expWait = wait.map((w) => Math.exp(w / MODE_TAU_MIN));
  /** The quickest door-to-door minutes, before waiting, between two groups on one line. */
  const baseMin = (line: number, a: Access, b: Access) => {
    const along = stopMin[line]!;
    const fare = fareMin[line]!;
    let best = Infinity;
    for (let x = 0; x < a.pos.length; x++) {
      const pa = a.pos[x]!;
      for (let y = 0; y < b.pos.length; y++) {
        const pb = b.pos[y]!;
        if (pa === pb) continue;
        const ride = Math.abs(along[pb]! - along[pa]!) + Math.max(0, Math.abs(pb - pa) - 1) * (DWELL_SEC / 60);
        // A bargain fare makes the ride feel shorter, never free (V1 demand.worker.ts:342-344).
        const t = a.walkMin[x]! + Math.max(0.5, ride + fare) + b.walkMin[y]!;
        if (t < best) best = t;
      }
    }
    return best;
  };

  const n = commuters.n;
  const scale = tripScalePermille / 1000;
  // Riders per line per period at [line * 3 + period], as if the whole day's trips fell in that
  // period; spread over the period's half-hours by the commute profile at the end, since a choice
  // depends only on the wait.
  const riders = new Float64Array(lineCount * 3);
  // Work cells reached from the current home cell, each with a list of the lines both share.
  const head = new Int32Array(n).fill(-1);
  const touched: number[] = [];
  const next: number[] = [];
  const entryLine: number[] = [];
  const entryFrom: Access[][] = [];
  const entryTo: Access[][] = [];
  // Every way the current cell pair can ride: a line, a home group and a work group.
  let room = 64;
  let optLine = new Int32Array(room);
  let optFrom = new Int32Array(room);
  let optTo = new Int32Array(room);
  let optBase = new Float64Array(room);
  let optLead = new Float64Array(room);
  const grow = () => {
    room *= 2;
    const more = <A extends Int32Array | Float64Array>(old: A, make: (size: number) => A): A => {
      const fresh = make(room);
      fresh.set(old);
      return fresh;
    };
    optLine = more(optLine, (k) => new Int32Array(k));
    optFrom = more(optFrom, (k) => new Int32Array(k));
    optTo = more(optTo, (k) => new Int32Array(k));
    optBase = more(optBase, (k) => new Float64Array(k));
    optLead = more(optLead, (k) => new Float64Array(k));
  };
  const order: number[] = [];
  const time: number[] = [];
  const covered = new Int32Array(8);

  for (let i = 0; i < n; i++) {
    const from = homes[i]!;
    touched.length = 0;
    next.length = 0;
    entryLine.length = 0;
    entryFrom.length = 0;
    entryTo.length = 0;
    for (const { line, groups } of homeLines[i]!) {
      for (const { cell: j, groups: to } of workAccess[line]!) {
        if (head[j] === -1) touched.push(j);
        next.push(head[j]!);
        head[j] = entryLine.length;
        entryLine.push(line);
        entryFrom.push(groups);
        entryTo.push(to);
      }
    }
    for (const j of touched) {
      const first = head[j]!;
      head[j] = -1;
      const flow = commuters.flow[i * n + j]!;
      if (flow <= 0) continue;
      // Straight-line km between the cells' centres, which no stop can move (I2), and the car and
      // walking minutes it gives.
      const km = commuters.km[i * n + j]!;
      const car = carMin(km);
      const walk = km * WALK_MIN_PER_KM;
      let count = 0;
      let lines = 0;
      for (let e = first; e !== -1; e = next[e]!) {
        const line = entryLine[e]!;
        const before = count;
        for (const a of entryFrom[e]!) {
          for (const b of entryTo[e]!) {
            const base = baseMin(line, a, b);
            if (base === Infinity) continue;
            if (count === room) grow();
            optLine[count] = line;
            optFrom[count] = a.mask;
            optTo[count] = b.mask;
            optBase[count] = base;
            optLead[count] = Math.exp((base - car) / MODE_TAU_MIN);
            count++;
          }
        }
        if (count > before) lines++;
      }
      if (count === 0) continue;
      const to = work[j]!;
      const trips = 2 * flow * scale; // both ways (V1 counted the round trip)
      if (lines === 1) {
        // One line: its groups split each end's sub-points, so every option has its own riders.
        for (let q = 0; q < count; q++) {
          const pairTrips = trips * from.shareOf[optFrom[q]!]! * to.shareOf[optTo[q]!]!;
          if (pairTrips === 0) continue;
          const at = optLine[q]! * 3;
          for (let k = 0; k < 3; k++) {
            const w = wait[at + k]!;
            if (w < Infinity) riders[at + k]! += pairTrips * shareGiven(optBase[q]! + w, optLead[q]! * expWait[at + k]!, walk);
          }
        }
        continue;
      }
      for (let k = 0; k < 3; k++) {
        // Quickest first (ties in the order found); each sub-point pair rides the first option that serves both its ends.
        order.length = 0;
        for (let q = 0; q < count; q++) {
          const t = optBase[q]! + wait[optLine[q]! * 3 + k]!;
          time[q] = t;
          if (t === Infinity) continue;
          let at = order.length;
          order.push(q);
          while (at > 0 && time[order[at - 1]!]! > t) {
            order[at] = order[at - 1]!;
            at--;
          }
          order[at] = q;
        }
        for (let h = 0; h < 8; h++) covered[h] = 0;
        for (const q of order) {
          const toMask = optTo[q]!;
          let share = 0;
          for (let bits = optFrom[q]!; bits; bits &= bits - 1) {
            const h = 31 - Math.clz32(bits & -bits);
            const fresh = toMask & ~covered[h]!;
            if (fresh) {
              share += from.share[h]! * to.shareOf[fresh]!;
              covered[h]! |= toMask;
            }
          }
          if (share > 0) riders[optLine[q]! * 3 + k]! += trips * share * shareGiven(time[q]!, optLead[q]! * expWait[optLine[q]! * 3 + k]!, walk);
        }
      }
    }
  }
  return spread(
    plans,
    plans.map((_, line) => [riders[line * 3]!, riders[line * 3 + 1]!, riders[line * 3 + 2]!]),
  );
}

/**
 * Turns each line's riders per period (in PERIODS order, as if the whole day's trips fell in that
 * period) into boardings per half-hour, by the commute profile.
 */
export function spread(plans: readonly LinePlan[], byPeriod: readonly (readonly number[])[]): Assignment {
  const bySlot = byPeriod.map((totals) => Float64Array.from({ length: SLOTS }, (_, s) => totals[PERIODS.indexOf(SLOT_PERIOD[s]!)]! * SLOT_SHARE[s]!));
  const perDay = bySlot.map((slots) => slots.reduce((sum, v) => sum + v, 0));
  return {
    lines: new Map(plans.map((plan, line) => [plan.id, { bySlot: bySlot[line]!, perDay: perDay[line]! }])),
    // One-seat rides only until transfers (week 7), so trips equal boardings.
    tripsPerDay: perDay.reduce((sum, v) => sum + v, 0),
  };
}
