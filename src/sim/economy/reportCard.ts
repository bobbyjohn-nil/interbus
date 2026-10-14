// The quarter's report card (the M3 spec, item 9): Coverage, Reliability, Comfort and Money, graded
// at the close of a quarter's last day, and the payout or fine it brings as one ledger row.
// - Coverage: residents within a walk of a stop that is called at, weighted by its calls (V2's fix:
//   a pole nothing calls at covers nobody, EC-07).
// - Reliability: each line's running headway against its own timetable, so a line short of buses
//   scores below 100 and a company that runs nothing scores 0 (V1 read a stale 15 minutes; V2 scored
//   100 when nothing ran).
// - Comfort: the share of riders not turned away by full buses, and the stops' tiers.
// - Money: the quarter's operating net against its revenue, 50 at break-even; capital and earlier
//   cards left out.
import { MAX_WALK_M } from '../config/demand';
import {
  COMFORT_TIER_SHARE,
  COVERAGE_EXPONENT,
  COVERAGE_FULL_CALLS,
  REPORT_FINE_PER_DAY_CENTS,
  REPORT_FINE_THRESHOLD,
  REPORT_GRANT_PER_POINT_PER_DAY_CENTS,
  REPORT_GRANT_THRESHOLD,
  REPORT_WEIGHTS,
} from '../config/report';
import { DAYS_PER_QUARTER } from '../config/time';
import { SpatialGrid, toXY } from '../core/geo';
import { PERIODS } from '../rules/periods';
import { runningHeadwayIn } from '../rules/timetable';
import type { World } from '../world';
import type { RowKind } from './ledger';
import { stopDays } from './stops';

export interface ReportCard {
  readonly quarter: number;
  /** The quarter's last day, whose close graded it. */
  readonly day: number;
  readonly coverage: number;
  readonly reliability: number;
  readonly comfort: number;
  readonly money: number;
  readonly overall: number;
  /** What the card pays (positive) or fines (negative), in whole cents; 0 between the bars. */
  readonly payoutCents: number;
}

/** Rows that are not the company's running: capital, the cards themselves and contracts' rewards. */
const NOT_RUNNING: ReadonlySet<RowKind> = new Set(['founding', 'purchase', 'refund', 'sale', 'card', 'contract']);
const clamp100 = (v: number) => Math.min(100, Math.max(0, v));

export function coverageGrade(world: World): number {
  const calls = new Map<number, number>();
  for (const line of world.state.lines) {
    const trips = world.services.get(line.id)?.day.trips.length ?? 0;
    if (line.buses > 0) for (const id of line.stopIds) calls.set(id, (calls.get(id) ?? 0) + trips);
  }
  const grid = new SpatialGrid<number>(MAX_WALK_M);
  for (const stop of world.state.stops) {
    const q = Math.min(1, (calls.get(stop.id) ?? 0) / COVERAGE_FULL_CALLS) ** COVERAGE_EXPONENT;
    if (q > 0) grid.add(toXY(world.city.frame, [stop.lon, stop.lat]), q);
  }
  let covered = 0;
  let residents = 0;
  for (const cell of world.city.cells) {
    for (const p of cell.homes) {
      residents += p.w;
      let best = 0;
      grid.forEachWithin([p.x, p.y], MAX_WALK_M, (q) => {
        if (q > best) best = q;
      });
      covered += p.w * best;
    }
  }
  return residents > 0 ? clamp100((100 * covered) / residents) : 0;
}

export function reliabilityGrade(world: World): number {
  const scores = world.state.lines.map((line) => {
    const service = world.services.get(line.id);
    const timed = PERIODS.filter((p) => (p === 'overnight' ? line.headways.overnight !== null : true));
    if (!service) return 0;
    const kept = timed.map((p) => {
      const planned = p === 'overnight' ? line.headways.overnight! : line.headways[p];
      const running = runningHeadwayIn(service.timing, p);
      return running === null ? 0 : Math.min(1, planned / running);
    });
    return (100 * kept.reduce((s, v) => s + v, 0)) / kept.length;
  });
  return scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
}

export function comfortGrade(world: World): number {
  let kept = 0;
  let offered = 0;
  for (const demand of world.assignment.lines.values()) {
    kept += demand.perDay;
    offered += demand.perDay + demand.shedPerDay;
  }
  if (offered <= 0) return 0;
  const tiers = new Map(world.state.stops.map((s) => [s.id, s.tier]));
  let boardings = 0;
  let tierSum = 0;
  for (const day of stopDays(world)) {
    boardings += day.boardings;
    tierSum += day.boardings * (((tiers.get(day.id) ?? 1) - 1) / 4);
  }
  const tierShare = boardings > 0 ? tierSum / boardings : 0;
  return clamp100(100 * ((1 - COMFORT_TIER_SHARE) * (kept / offered) + COMFORT_TIER_SHARE * tierShare));
}

export function moneyGrade(world: World, firstDay: number, lastDay: number): number {
  let revenue = 0;
  let net = 0;
  for (const r of world.state.ledger.rows) {
    if (r.day < firstDay || r.day > lastDay || NOT_RUNNING.has(r.kind)) continue;
    net += r.amountCents;
    if (r.kind === 'fares' || r.kind === 'subsidy') revenue += r.amountCents;
  }
  return revenue > 0 ? clamp100(50 + (50 * net) / revenue) : 0;
}

/** The card for the quarter whose last day is `day`. */
export function gradeQuarter(world: World, quarter: number, day: number): ReportCard {
  const coverage = coverageGrade(world);
  const reliability = reliabilityGrade(world);
  const comfort = comfortGrade(world);
  const money = moneyGrade(world, day - DAYS_PER_QUARTER + 1, day);
  const overall = REPORT_WEIGHTS.coverage * coverage + REPORT_WEIGHTS.reliability * reliability + REPORT_WEIGHTS.comfort * comfort + REPORT_WEIGHTS.money * money;
  const payoutCents =
    overall >= REPORT_GRANT_THRESHOLD
      ? Math.round((overall - REPORT_GRANT_THRESHOLD) * REPORT_GRANT_PER_POINT_PER_DAY_CENTS * DAYS_PER_QUARTER)
      : overall < REPORT_FINE_THRESHOLD
        ? -REPORT_FINE_PER_DAY_CENTS * DAYS_PER_QUARTER
        : 0;
  return { quarter, day, coverage, reliability, comfort, money, overall, payoutCents };
}
