// The straightforward assignment loop as it stood before the week-3 speed-up (every cell pair, every
// sub-point pair, every stop pair, each with its own walk and distance), kept as the yardstick that
// assign.test.ts and `npm run bench compare` hold the fast loop to. Nothing in the game uses it.
// Since step 11 each sub-point pair scans every line serving it (commonLines, I5), as the fast loop
// does, where both once took the quickest line alone.
import { CENTS_PER_MINUTE, DWELL_SEC, BUS_KMH, MAX_WALK_M, REFERENCE_FARE_CENTS } from '../../config/demand';
import { distXY, SpatialGrid } from '../../core/geo';
import type { City, SubPoint } from '../../city/simfile';
import { PERIODS, runsIn, type Period } from '../../rules/periods';
import type { Commuters } from '../commuters';
import { busShare, commonLines, fareSensitivity, walkMinutes, type LinePlan } from '../assign';

interface Reach {
  readonly line: number;
  readonly pos: number;
  readonly walkMin: number;
}

/**
 * Riders per line per period, in PERIODS order, as the old loop counted them, and each line's
 * busiest leg per period, counted rider by rider (assign() counts it from its groups' stops).
 */
export function assignNaive(
  city: City,
  commuters: Commuters,
  plans: readonly LinePlan[],
  tripScalePermille = city.tripScalePermille,
): { riders: number[][]; busiest: number[][]; ends: { board: Float64Array; alight: Float64Array }[] } {
  // Riders per line per period, as if the whole day's trips fell in that period; spread over the
  // period's half-hours by the commute profile at the end, since a pair's choice depends only on
  // the period's wait.
  const byPeriod = plans.map(() => ({ peak: 0, offpeak: 0, overnight: 0 }) as Record<Period, number>);
  // Each line's load on every leg, per period and direction, at [(period * 2 + direction) * stops + leg].
  const load = plans.map((plan) => new Float64Array(6 * plan.stops.length));
  // Who boards and alights at each stop, at [period * stops + stop].
  const stopEnds = plans.map((plan) => ({ board: new Float64Array(3 * plan.stops.length), alight: new Float64Array(3 * plan.stops.length) }));
  const stopsGrid = new SpatialGrid<{ line: number; pos: number }>(MAX_WALK_M);
  plans.forEach((plan, line) => plan.stops.forEach((p, pos) => stopsGrid.add(p, { line, pos })));
  const reach = (p: SubPoint): Reach[] =>
    stopsGrid.within([p.x, p.y], MAX_WALK_M).map((s) => ({ line: s.item.line, pos: s.item.pos, walkMin: walkMinutes(s.distM, plans[s.item.line]!.walkBonusMin?.[s.item.pos] ?? 0) }));
  const homes = city.cells.map((c) => c.homes.map((p) => ({ p, reach: reach(p) })).filter((h) => h.reach.length > 0));
  const work = city.cells.map((c) => c.work.map((p) => ({ p, reach: reach(p) })).filter((w) => w.reach.length > 0));
  const totals = city.cells.map((c) => [c.residents, c.jobs] as const);

  // Each line's headway in each period (Infinity where it does not run), ride minutes and fare minutes.
  const headway = plans.map((plan) =>
    Object.fromEntries(PERIODS.map((period) => {
      const h = period === 'overnight' ? plan.headways.overnight : plan.headways[period];
      return [period, runsIn(plan.headways, period) && h !== null ? h : Infinity];
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
  // Each line's quickest way between the pair's sub-points, before waiting: minutes and stops.
  const lineBase = new Float64Array(plans.length);
  const lineFrom = new Int32Array(plans.length);
  const lineTo = new Int32Array(plans.length);
  const lineHeadway = new Float64Array(plans.length);
  const share = new Float64Array(plans.length);
  const order = new Int32Array(plans.length);
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
          lineBase.fill(Infinity);
          for (const a of o.reach) {
            for (const b of d.reach) {
              if (a.line !== b.line || a.pos === b.pos) continue;
              // A bargain fare makes the ride feel shorter, never free (V1 demand.worker.ts:342-344).
              const rideKm = Math.abs(plans[a.line]!.stopDistM[b.pos]! - plans[a.line]!.stopDistM[a.pos]!) / 1000;
              const base = a.walkMin + Math.max(0.5, rideMin(a.line, a.pos, b.pos) + fareMin[a.line]! * fareSensitivity(rideKm)) + b.walkMin;
              if (base < lineBase[a.line]!) {
                lineBase[a.line] = base;
                lineFrom[a.line] = a.pos;
                lineTo[a.line] = b.pos;
              }
            }
          }
          const km = distXY([o.p.x, o.p.y], [d.p.x, d.p.y]) / 1000;
          PERIODS.forEach((period, k) => {
            plans.forEach((_, line) => (lineHeadway[line] = headway[line]![period]));
            const minutes = commonLines(lineBase, lineHeadway, plans.length, share, order);
            if (minutes === Infinity) return;
            const riders = pairTrips * busShare(minutes, km);
            plans.forEach((plan, line) => {
              const r = riders * share[line]!;
              if (r === 0) return;
              byPeriod[line]![period] += r;
              // Every leg between the two stops, in the direction travelled, carries these riders.
              const stops = plan.stops.length;
              const from = lineFrom[line]!;
              const to = lineTo[line]!;
              stopEnds[line]!.board[k * stops + from]! += r;
              stopEnds[line]!.alight[k * stops + to]! += r;
              const at = (from < to ? k * 2 : k * 2 + 1) * stops;
              for (let leg = Math.min(from, to); leg < Math.max(from, to); leg++) load[line]![at + leg]! += r;
            });
          });
        }
      }
    }
  }
  return {
    riders: byPeriod.map((r) => PERIODS.map((p) => r[p])),
    busiest: load.map((d, line) =>
      PERIODS.map((_, k) => {
        const stops = plans[line]!.stops.length;
        return Math.max(...d.subarray(k * 2 * stops, (k * 2 + 2) * stops));
      }),
    ),
    ends: stopEnds,
  };
}
