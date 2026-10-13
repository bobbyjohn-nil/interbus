// Who rides which line, rewritten from V1's demand worker (`Intralines@7af45b1:src/game/sim/
// demand.worker.ts:290-520`, R01) for M1: commuters only, one-seat rides (transfers land in week 7).
// Changed on the way in:
// - no cap on how many stops a home sees or how many lines a stop offers (V1 kept 4 stops and 3
//   lines, K04, K23): every stop within 650 m counts;
// - catchments sum each cell's sub-points instead of measuring from one centroid (EC-15);
// - per period (D7): a line's wait comes from that period's headway, and nobody boards in a period
//   it does not run, so an overnight-off line loses its night riders (EC-03);
// - the fare is paid per boarding and felt as minutes beyond $2.25 (K05);
// - no silent floors: V1 dropped pairs under half a commuter and shares under 1%; this keeps them.
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
import { distXY, SpatialGrid, type XY } from '../core/geo';
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
  if (busMin > MAX_TRANSIT_MIN) return 0;
  const carMin = (km / CAR_KMH) * 60 * CAR_TIME_FACTOR + CAR_PARK_PENALTY_MIN;
  const walkMin = km * WALK_MIN_PER_KM;
  // When walking beats the bus, most of those trips walk.
  const walkFactor = walkMin < busMin * 0.75 ? 0.15 : walkMin < busMin ? 0.45 : 1;
  const byLogit = LOGIT_SCALE / (1 + Math.exp((busMin - carMin) / MODE_TAU_MIN));
  return Math.min(MAX_SHARE, (CAPTIVE_SHARE + (1 - CAPTIVE_SHARE) * byLogit) * walkFactor);
}

interface Reach {
  readonly line: number;
  readonly pos: number;
  readonly walkMin: number;
}

export function assign(city: City, commuters: Commuters, plans: readonly LinePlan[], tripScalePermille = city.tripScalePermille): Assignment {
  // Riders per line per period, as if the whole day's trips fell in that period; spread over the
  // period's half-hours by the commute profile at the end, since a pair's choice depends only on
  // the period's wait.
  const byPeriod = plans.map(() => ({ peak: 0, offpeak: 0, overnight: 0 }) as Record<Period, number>);
  const stopsGrid = new SpatialGrid<{ line: number; pos: number }>(MAX_WALK_M);
  plans.forEach((plan, line) => plan.stops.forEach((p, pos) => stopsGrid.add(p, { line, pos })));
  const reach = (p: SubPoint): Reach[] =>
    stopsGrid.within([p.x, p.y], MAX_WALK_M).map((s) => ({ line: s.item.line, pos: s.item.pos, walkMin: (s.distM / 1000) * WALK_MIN_PER_KM }));
  const homes = city.cells.map((c) => c.homes.map((p) => ({ p, reach: reach(p) })).filter((h) => h.reach.length > 0));
  const work = city.cells.map((c) => c.work.map((p) => ({ p, reach: reach(p) })).filter((w) => w.reach.length > 0));
  const totals = city.cells.map((c) => [c.residents, c.jobs] as const);

  // Each line's wait in each period (Infinity where it does not run), ride minutes and fare minutes.
  const wait = plans.map((plan) =>
    Object.fromEntries(PERIODS.map((period) => {
      const h = period === 'overnight' ? plan.headways.overnight : plan.headways[period];
      return [period, runsIn(plan.headways, period) && h !== null ? waitMin(h) : Infinity];
    })) as Record<Period, number>,
  );
  const fareMin = plans.map((plan) => (plan.fareCents - REFERENCE_FARE_CENTS) / CENTS_PER_MINUTE);
  const rideMin = (line: number, a: number, b: number) => {
    const plan = plans[line]!;
    const metres = Math.abs(plan.stopDistM[b]! - plan.stopDistM[a]!);
    return (metres / 1000 / BUS_KMH) * 60 + Math.max(0, Math.abs(b - a) - 1) * (DWELL_SEC / 60);
  };

  const n = commuters.n;
  const scale = tripScalePermille / 1000;
  const best: Record<Period, { min: number; line: number }> = { peak: { min: 0, line: -1 }, offpeak: { min: 0, line: -1 }, overnight: { min: 0, line: -1 } };
  for (let i = 0; i < n; i++) {
    const origins = homes[i]!;
    if (origins.length === 0) continue;
    for (let j = 0; j < n; j++) {
      const flow = commuters.flow[i * n + j]!;
      const ends = work[j]!;
      if (flow <= 0 || ends.length === 0) continue;
      for (const o of origins) {
        for (const d of ends) {
          // This sub-point pair's share of the cell pair's commuters, both ways (V1 counted the round trip).
          const pairTrips = 2 * flow * (o.p.w / totals[i]![0]) * (d.p.w / totals[j]![1]) * scale;
          for (const period of PERIODS) best[period] = { min: Infinity, line: -1 };
          for (const a of o.reach) {
            for (const b of d.reach) {
              if (a.line !== b.line || a.pos === b.pos) continue;
              // A bargain fare makes the ride feel shorter, never free (V1 demand.worker.ts:342-344).
              const base = a.walkMin + Math.max(0.5, rideMin(a.line, a.pos, b.pos) + fareMin[a.line]!) + b.walkMin;
              for (const period of PERIODS) {
                const t = base + wait[a.line]![period];
                if (t < best[period].min) best[period] = { min: t, line: a.line };
              }
            }
          }
          const km = distXY([o.p.x, o.p.y], [d.p.x, d.p.y]) / 1000;
          for (const period of PERIODS) {
            const choice = best[period];
            if (choice.line >= 0) byPeriod[choice.line]![period] += pairTrips * busShare(choice.min, km);
          }
        }
      }
    }
  }
  const bySlot = byPeriod.map((totals) => Float64Array.from({ length: SLOTS }, (_, s) => totals[SLOT_PERIOD[s]!] * SLOT_SHARE[s]!));
  const perDay = bySlot.map((slots) => slots.reduce((sum, v) => sum + v, 0));
  return {
    lines: new Map(plans.map((plan, line) => [plan.id, { bySlot: bySlot[line]!, perDay: perDay[line]! }])),
    // One-seat rides only until transfers (week 7), so trips equal boardings.
    tripsPerDay: perDay.reduce((sum, v) => sum + v, 0),
  };
}
