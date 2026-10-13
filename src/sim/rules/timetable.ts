// A line's timetable: the day's period windows and the headway it runs in each, from its planned
// headways, its cycle and the buses it owns (K07). The day plan (rules/schedule.ts) turns these into
// departures and buses for the costs, the forecast and the vehicle layer; the demand model reads the
// running headways for its waits.
import { PEAK_WINDOWS, SECONDS_PER_DAY, SERVICE_DAY } from '../config/time';
import { headwayIn, runningHeadway } from './cycle';
import { periodAt, type Headways, type Period } from './periods';

export interface Window {
  readonly from: number;
  readonly to: number;
  readonly period: Period;
}

/** The day's period windows in order, as [from, to) seconds of the day. */
export const DAY_WINDOWS: readonly Window[] = (() => {
  const cuts = [...new Set([0, SERVICE_DAY[0], ...PEAK_WINDOWS.flat(), SERVICE_DAY[1] % SECONDS_PER_DAY || SECONDS_PER_DAY, SECONDS_PER_DAY])].sort((a, b) => a - b);
  const windows: Window[] = [];
  for (let k = 1; k < cuts.length; k++) windows.push({ from: cuts[k - 1]!, to: cuts[k]!, period: periodAt(cuts[k - 1]!) });
  return windows;
})();

/** What the timetable reads: the line's round trip in seconds, its planned headways and the buses it owns. */
export interface Timing {
  readonly cycle: number;
  readonly headways: Headways;
  readonly buses: number;
}

/** The headway the line runs in a period, or null if it does not run then (off, or no buses). */
export function runningHeadwayIn(t: Timing, period: Period): number | null {
  const planned = headwayIn(t.headways, period);
  return planned === null ? null : runningHeadway(t.cycle, planned, t.buses);
}
