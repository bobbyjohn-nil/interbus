// What running a line costs, hour by hour (the M2 spec, item 5): running at the model's rate per
// km, drivers for every bus out of the depot, the deadhead from the depot and back, and each depot's
// upkeep. Everything is whole cents counted from the line's day plan (rules/schedule.ts), the same
// movements the vehicle layer draws, so the forecast is the sum the hourly rows add up to, to the
// cent, and a bus is billed for what it does (I1, I6).
import { DEPOT_UPKEEP_CENTS } from '../config/depots';
import { WAGE_CENTS_PER_HOUR, type BusModel } from '../config/fleet';
import { SECONDS_PER_HOUR } from '../config/time';
import { hourOfPlan, type DayPlan } from '../rules/schedule';

/** A line as its costs see it: its day plan, its route, its model and its drives to and from the depot. */
export interface LineCostInputs {
  readonly plan: DayPlan;
  readonly routeM: number;
  readonly model: BusModel;
  /** Depot to the first stop, and back, in metres; 0 with no depot. */
  readonly pullOutM: number;
  readonly pullInM: number;
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

/** The costs of hour `hour` (0–23) of a day: whole cents, never negative. */
export function lineCostsInHour(line: LineCostInputs, hour: number): LineCosts {
  const h = hourOfPlan(line.plan, hour * SECONDS_PER_HOUR, (hour + 1) * SECONDS_PER_HOUR);
  return {
    running: h.legs * kmCents(line.routeM, line.model),
    wages: wageCents(h.serviceS),
    deadhead: h.pullOuts * deadheadTripCents(line.pullOutM, line.model) + h.pullIns * deadheadTripCents(line.pullInM, line.model),
  };
}

/** The forecast for a day's hours from `fromHour` to 23: the line inspector's numbers, equal to the rows the day will bank. */
export function forecastDay(line: LineCostInputs, fromHour = 0): LineCosts {
  let running = 0;
  let wages = 0;
  let deadhead = 0;
  for (let h = fromHour; h < 24; h++) {
    const c = lineCostsInHour(line, h);
    running += c.running;
    wages += c.wages;
    deadhead += c.deadhead;
  }
  return { running, wages, deadhead };
}

/** A depot's upkeep for one hour: a day's upkeep spread over 24 whole-cent hours. */
export const DEPOT_UPKEEP_PER_HOUR_CENTS = DEPOT_UPKEEP_CENTS / 24;
