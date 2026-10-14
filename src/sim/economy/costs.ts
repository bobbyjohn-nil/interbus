// What running a line costs, hour by hour (the M2 spec, item 5): running at the model's rate per
// km, drivers for every bus out of the depot, the deadhead from the depot and back, and each depot's
// upkeep. Everything is whole cents counted from the line's day plan (rules/schedule.ts), the same
// movements the vehicle layer draws, so the forecast is the sum the hourly rows add up to, to the
// cent, and a bus is billed for what it does (I1, I6). While a line settles after a change made with
// its buses out (rules/transition.ts), each leg and drive bills at the version it ran on.
import { DEPOT_UPKEEP_CENTS } from '../config/depots';
import { WAGE_CENTS_PER_HOUR, type BusModel } from '../config/fleet';
import { stopUpkeepCents, type StopTier } from '../config/stops';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '../config/time';
import { hourOfPlan, type DayPlan } from '../rules/schedule';
import { hourOfMerged, type MergedPlan } from '../rules/transition';

/** A line as its costs see it: its day plan, its route, its model and its drives to and from the depot. */
export interface LineCostInputs {
  readonly plan: DayPlan;
  readonly routeM: number;
  readonly model: BusModel;
  /** Depot to the first stop, and back, in metres; 0 with no depot. */
  readonly pullOutM: number;
  readonly pullInM: number;
  /** While it settles after a change: the merged plan, the day its frame starts on, and each earlier version's route, model and depot drives, oldest first. */
  readonly settling?: {
    readonly merged: MergedPlan;
    readonly frameDay: number;
    readonly earlier: readonly { readonly routeM: number; readonly model: BusModel; readonly pullOutM: number; readonly pullInM: number }[];
  };
}

export interface LineCosts {
  readonly running: number;
  readonly wages: number;
  readonly deadhead: number;
}

const kmCents = (m: number, model: BusModel) => Math.round((m * model.perKmCents) / 1000);
const wageCents = (seconds: number) => Math.round((seconds * WAGE_CENTS_PER_HOUR) / SECONDS_PER_HOUR);
/** Seconds to drive `m` metres at the model's speed: the plan's drives use the same. */
export const driveSeconds = (m: number, model: BusModel) => (m / 1000 / model.kmh) * SECONDS_PER_HOUR;

/** One deadhead drive of `m` metres: its km and its driver's time. */
function deadheadTripCents(m: number, model: BusModel): number {
  return m > 0 ? kmCents(m, model) + wageCents(driveSeconds(m, model)) : 0;
}

/**
 * The costs of hour `hour` (0–23) of game day `day`: whole cents, never negative. Without a day, or
 * once the line has settled, its day plan's; before its handover, the merged plan's.
 */
export function lineCostsInHour(line: LineCostInputs, hour: number, day?: number): LineCosts {
  const s = line.settling;
  if (!s || day === undefined) {
    const h = hourOfPlan(line.plan, hour * SECONDS_PER_HOUR, (hour + 1) * SECONDS_PER_HOUR);
    return {
      running: h.legs * kmCents(line.routeM, line.model),
      wages: wageCents(h.serviceS),
      deadhead: h.pullOuts * deadheadTripCents(line.pullOutM, line.model) + h.pullIns * deadheadTripCents(line.pullInM, line.model),
    };
  }
  // The hour in the merged plan's frame, the part before the handover from it, the rest from the day plan.
  const dayStart = (day - s.frameDay) * SECONDS_PER_DAY;
  const from = dayStart + hour * SECONDS_PER_HOUR;
  const to = from + SECONDS_PER_HOUR;
  const split = Math.min(Math.max(s.merged.handover, from), to);
  const m = hourOfMerged(s.merged, from, split);
  const p = hourOfPlan(line.plan, split - dayStart, to - dayStart);
  const versions = [...s.earlier, line];
  let running = p.legs * kmCents(line.routeM, line.model);
  let deadhead = p.pullOuts * deadheadTripCents(line.pullOutM, line.model) + p.pullIns * deadheadTripCents(line.pullInM, line.model);
  versions.forEach((v, k) => {
    running += m.legs[k]! * kmCents(v.routeM, v.model);
    deadhead += m.pullOuts[k]! * deadheadTripCents(v.pullOutM, v.model) + m.pullIns[k]! * deadheadTripCents(v.pullInM, v.model);
  });
  return { running, wages: wageCents(m.serviceS + p.serviceS), deadhead };
}

/** The forecast for a day's hours from `fromHour` to 23 (of game day `day`, while a line settles): the line inspector's numbers, equal to the rows the day will bank. */
export function forecastDay(line: LineCostInputs, fromHour = 0, day?: number): LineCosts {
  let running = 0;
  let wages = 0;
  let deadhead = 0;
  for (let h = fromHour; h < 24; h++) {
    const c = lineCostsInHour(line, h, day);
    running += c.running;
    wages += c.wages;
    deadhead += c.deadhead;
  }
  return { running, wages, deadhead };
}

/** A depot's upkeep for one hour: a day's upkeep spread over 24 whole-cent hours. */
export const DEPOT_UPKEEP_PER_HOUR_CENTS = DEPOT_UPKEEP_CENTS / 24;

/** Every stop's upkeep for a day (config/stops.ts), whole cents; banked by the hour in step.ts. */
export function stopsUpkeepCents(stops: readonly { readonly tier: StopTier }[]): number {
  return stops.reduce((sum, s) => sum + stopUpkeepCents(s.tier), 0);
}
