// What running a line costs, hour by hour (the M2 spec, item 5): running at the model's rate per
// km, drivers for every bus in service, the deadhead from the depot and back, and each depot's
// upkeep. Everything is whole cents worked out from the timetable (rules/timetable.ts), so the
// forecast is the same sum the hourly rows add up to, to the cent (I1, I6).
import { DEPOT_UPKEEP_CENTS } from '../config/depots';
import { WAGE_CENTS_PER_HOUR, type BusModel } from '../config/fleet';
import { SECONDS_PER_HOUR } from '../config/time';
import { busSecondsBetween, dailyPullOuts, departuresBetween, type Timing } from '../rules/timetable';

/** A line as its costs see it: its timetable, its route, its model and its trips to and from the depot. */
export interface LineCostInputs {
  readonly timing: Timing;
  readonly routeM: number;
  readonly model: BusModel;
  /** Depot to the first stop, and the last stop back, in metres; 0 with no depot. */
  readonly pullOutM: number;
  readonly pullInM: number;
}

export interface LineCosts {
  readonly running: number;
  readonly wages: number;
  readonly deadhead: number;
}

/** Hours whose costs the deadhead lands in: buses pull out in the first service hour and return in the last. */
export const PULL_OUT_HOUR = 5;
export const PULL_IN_HOUR = 23;

const kmCents = (m: number, model: BusModel) => Math.round((m * model.perKmCents) / 1000);
const wageCents = (seconds: number) => Math.round((seconds * WAGE_CENTS_PER_HOUR) / SECONDS_PER_HOUR);
const driveSeconds = (m: number, model: BusModel) => (m / 1000 / model.kmh) * SECONDS_PER_HOUR;

/** One deadhead trip of `m` metres: its km and its driver's time. */
function deadheadTripCents(m: number, model: BusModel): number {
  return m > 0 ? kmCents(m, model) + wageCents(driveSeconds(m, model)) : 0;
}

/** The costs of hour `hour` (0–23) of a day: whole cents, never negative. */
export function lineCostsInHour(line: LineCostInputs, hour: number): LineCosts {
  const from = hour * SECONDS_PER_HOUR;
  const to = from + SECONDS_PER_HOUR;
  const perTrip = kmCents(line.routeM, line.model);
  const pullOuts = dailyPullOuts(line.timing);
  return {
    running: 2 * departuresBetween(line.timing, from, to) * perTrip,
    wages: wageCents(busSecondsBetween(line.timing, from, to)),
    deadhead:
      (hour === PULL_OUT_HOUR ? pullOuts * deadheadTripCents(line.pullOutM, line.model) : 0) +
      (hour === PULL_IN_HOUR ? pullOuts * deadheadTripCents(line.pullInM, line.model) : 0),
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
