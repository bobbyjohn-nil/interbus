// D7's three headway periods, each limit one predicate shared by the cursor card, the command and
// the drawing (GD-05). Peak runs 06:30–09:30 and 16:00–19:00, off-peak the rest of 05:00–24:00,
// overnight 00:00–05:00.
import { MAX_DAYTIME_HEADWAY_SECONDS, MIN_HEADWAY_SECONDS, PEAK_WINDOWS, SERVICE_DAY, SECONDS_PER_DAY } from '../config/time';
import { ok, refuse, type Result } from '../core/result';

/** The headways the line card offers, in minutes. */
export { HEADWAY_MINUTES } from '../config/lines';

export type Period = 'peak' | 'offpeak' | 'overnight';
export const PERIODS: readonly Period[] = ['peak', 'offpeak', 'overnight'];

/** The period a second of the day falls in. */
export function periodAt(secondOfDay: number): Period {
  const s = ((secondOfDay % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
  if (s < SERVICE_DAY[0] || s >= SERVICE_DAY[1]) return 'overnight';
  return PEAK_WINDOWS.some(([from, to]) => s >= from && s < to) ? 'peak' : 'offpeak';
}

/** Seconds of each period in one day: peak 6 h, off-peak 13 h, overnight 5 h. */
export function secondsPerDay(period: Period): number {
  const peak = PEAK_WINDOWS.reduce((sum, [from, to]) => sum + (to - from), 0);
  const service = SERVICE_DAY[1] - SERVICE_DAY[0];
  if (period === 'peak') return peak;
  if (period === 'offpeak') return service - peak;
  return SECONDS_PER_DAY - service;
}

/** A line's headways in whole seconds; overnight `null` means no overnight service. */
export interface Headways {
  readonly peak: number;
  readonly offpeak: number;
  readonly overnight: number | null;
}

export type HeadwayRefusal = 'headway_not_whole_seconds' | 'headway_too_short' | 'daytime_headway_too_long' | 'overnight_more_often_than_offpeak';

/**
 * D7's limits: peak and off-peak always run, at most an hour apart; no period runs a bus more often than once a minute
 * (MIN_HEADWAY_SECONDS); overnight runs no more often
 * than off-peak, or not at all, so neither a night-only nor a night-mostly line exists (EC-03).
 */
export function checkHeadways(h: Headways): Result<object, HeadwayRefusal, { limitSeconds?: number }> {
  const all = [h.peak, h.offpeak, ...(h.overnight === null ? [] : [h.overnight])];
  if (!all.every((s) => Number.isSafeInteger(s) && s > 0)) return refuse('headway_not_whole_seconds');
  if (all.some((s) => s < MIN_HEADWAY_SECONDS)) return refuse('headway_too_short', { limitSeconds: MIN_HEADWAY_SECONDS });
  if (h.peak > MAX_DAYTIME_HEADWAY_SECONDS || h.offpeak > MAX_DAYTIME_HEADWAY_SECONDS) {
    return refuse('daytime_headway_too_long', { limitSeconds: MAX_DAYTIME_HEADWAY_SECONDS });
  }
  if (h.overnight !== null && h.overnight < h.offpeak) {
    return refuse('overnight_more_often_than_offpeak', { limitSeconds: h.offpeak });
  }
  return ok();
}

/** Whether two sets of headways are the same in every period: a headway change to a line's own is none (rules/line.ts). */
export function sameHeadways(a: Headways, b: Headways): boolean {
  return a.peak === b.peak && a.offpeak === b.offpeak && a.overnight === b.overnight;
}

/** Whether a line with these headways runs at all in `period`. */
export function runsIn(h: Headways, period: Period): boolean {
  return period !== 'overnight' || h.overnight !== null;
}
