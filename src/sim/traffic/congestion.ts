// The one congestion function (the M3 spec, item 15; K06): how much longer, or shorter, than its
// day's average a bus takes to drive a street in each half-hour, by how much of the rush the street
// takes. Timing (rules/cycle.ts) and ridership (demand/assign.ts) both read it, per period (D7);
// routing never does (V2's budget, dynamic-traffic.md). V2's congestionAt
// (`Intralines_City_dep@archive/intralines-city-v1:Gaming/src/10-core.js:766-785`) without its
// place field, bus lanes or snow, which are not in the game.
import { HOURLY_PROFILE } from '../config/demand';
import { SECONDS_PER_DAY } from '../config/time';
import { CLASS_RUSH, RUSH_CURVE, STREET_RUSH } from '../config/traffic';
import { PERIODS, periodAt, type Period } from '../rules/periods';

const SLOT_SECONDS = 1_800;
const SLOTS = SECONDS_PER_DAY / SLOT_SECONDS;

/** The curve at `hour`, straight between its points. */
function curveAt(hour: number): number {
  for (let k = 1; k < RUSH_CURVE.length; k++) {
    const [h1, v1] = RUSH_CURVE[k]!;
    if (hour <= h1) {
      const [h0, v0] = RUSH_CURVE[k - 1]!;
      return v0 + ((v1 - v0) * (hour - h0)) / (h1 - h0);
    }
  }
  return RUSH_CURVE[RUSH_CURVE.length - 1]![1];
}

/** Each half-hour's share of a day's trips: half its hour's (demand/assign.ts spreads riders the same way). */
const SLOT_TRIPS: readonly number[] = Array.from({ length: SLOTS }, (_, s) => HOURLY_PROFILE[Math.floor(s / 2)]! / 2);

/**
 * The curve at each half-hour's middle, divided by its mean over the day's trips, so a ride's factor
 * averages 1.00 over the trips that ride it and the demand calibration stands (the M3 spec's
 * magnitudes): the rush redistributes time across the day without adding any.
 */
export const RUSH: readonly number[] = (() => {
  const raw = Array.from({ length: SLOTS }, (_, s) => curveAt((s + 0.5) / 2));
  const mean = raw.reduce((sum, v, s) => sum + v * SLOT_TRIPS[s]!, 0);
  return raw.map((v) => v / mean);
})();

/** How much of the rush a street of OSM class `cls` takes. */
export const classRush = (cls: string): number => CLASS_RUSH[cls] ?? STREET_RUSH;

/** The one function: the factor on a drive's average time in half-hour `slot`, on streets taking `rush` of the rush. */
export function congestionAt(rush: number, slot: number): number {
  return 1 + (RUSH[slot]! - 1) * rush;
}

/**
 * The factor in each period, in PERIODS order: congestionAt over the period's half-hours, weighted by
 * their trips. A period's trips share it, so its round trips are one length (rules/cycle.ts) and its
 * riders feel the same (demand/assign.ts). 1 in every period at `rush` 0.
 */
export function periodCongestion(rush: number): Readonly<Record<Period, number>> {
  const sum = { peak: 0, offpeak: 0, overnight: 0 } as Record<Period, number>;
  const trips = { peak: 0, offpeak: 0, overnight: 0 } as Record<Period, number>;
  for (let s = 0; s < SLOTS; s++) {
    const period = periodAt(s * SLOT_SECONDS);
    sum[period] += congestionAt(rush, s) * SLOT_TRIPS[s]!;
    trips[period] += SLOT_TRIPS[s]!;
  }
  return Object.fromEntries(PERIODS.map((p) => [p, sum[p] / trips[p]])) as Record<Period, number>;
}
