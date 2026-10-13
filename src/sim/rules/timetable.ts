// A line's timetable, from its headways, its cycle and the buses it owns: when buses leave and how
// many are out. One source for the costs, the forecast, the demand model's waits and the vehicle
// layer, so what a bus does is what it is billed for (I6, K07). Each period window starts its
// departures at the window's start, one from each end of the line every running headway.
import { PEAK_WINDOWS, SECONDS_PER_DAY, SERVICE_DAY } from '../config/time';
import { busesForHeadway, headwayIn, runningHeadway } from './cycle';
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

/** Buses out in a period: what its running headway needs, never more than the line owns (V1's driver hours). */
export function busesInService(t: Timing, period: Period): number {
  const h = runningHeadwayIn(t, period);
  return h === null ? 0 : Math.min(t.buses, busesForHeadway(t.cycle, h));
}

/** Departures from each end of the line in [from, to) seconds of the day. */
export function departuresBetween(t: Timing, from: number, to: number): number {
  let n = 0;
  for (const w of DAY_WINDOWS) {
    const h = runningHeadwayIn(t, w.period);
    const a = Math.max(w.from, from);
    const b = Math.min(w.to, to);
    if (h === null || a >= b) continue;
    // Departures at w.from + k·h for whole k ≥ 0, counted where they fall in [a, b).
    n += Math.ceil((b - w.from) / h) - Math.ceil((a - w.from) / h);
  }
  return n;
}

/** Bus-seconds in service in [from, to) seconds of the day. */
export function busSecondsBetween(t: Timing, from: number, to: number): number {
  let s = 0;
  for (const w of DAY_WINDOWS) {
    const a = Math.max(w.from, from);
    const b = Math.min(w.to, to);
    if (a < b) s += (b - a) * busesInService(t, w.period);
  }
  return s;
}

/** Buses that leave the depot each morning and come back at night: those out by day but not overnight. */
export function dailyPullOuts(t: Timing): number {
  const byDay = Math.max(busesInService(t, 'peak'), busesInService(t, 'offpeak'));
  return Math.max(0, byDay - busesInService(t, 'overnight'));
}
