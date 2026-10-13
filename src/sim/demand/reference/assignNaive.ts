// The straightforward assignment loop as it stood before the week-3 speed-up (every cell pair, every
// sub-point pair, every stop pair, each with its own walk and distance), kept as the yardstick that
// assign.test.ts and `npm run bench compare` hold the fast loop to. Nothing in the game uses it.
import { CENTS_PER_MINUTE, DWELL_SEC, BUS_KMH, MAX_WALK_M, REFERENCE_FARE_CENTS, WALK_MIN_PER_KM } from '../../config/demand';
import { distXY, SpatialGrid } from '../../core/geo';
import type { City, SubPoint } from '../../city/simfile';
import { PERIODS, runsIn, type Period } from '../../rules/periods';
import type { Commuters } from '../commuters';
import { busShare, perceivedWaitMin, waitMin, type LinePlan } from '../assign';

interface Reach {
  readonly line: number;
  readonly pos: number;
  readonly walkMin: number;
}

/** Riders per line per period, in PERIODS order, as the old loop counted them. */
export function assignNaive(city: City, commuters: Commuters, plans: readonly LinePlan[], tripScalePermille = city.tripScalePermille): number[][] {
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
      return [period, runsIn(plan.headways, period) && h !== null ? perceivedWaitMin(waitMin(h)) : Infinity];
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
  return byPeriod.map((r) => PERIODS.map((p) => r[p]));
}
