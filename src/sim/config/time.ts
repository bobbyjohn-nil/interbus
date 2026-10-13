// The game's calendar and the three headway periods (D7). Times are whole game-seconds, so every
// boundary is exact; the sim never sees fractional time.

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3_600;
export const SECONDS_PER_DAY = 86_400;
/** A quarter is ten game days (PLAN §3), four to a year. */
export const DAYS_PER_QUARTER = 10;
export const QUARTERS_PER_YEAR = 4;

/** A new game starts paused at 05:00 on day 1 (D7). */
export const START_SECOND_OF_DAY = 5 * SECONDS_PER_HOUR;

/** The fixed step: half a game-minute, V2's `TICK_STEP_MIN` 0.5 (AR-09). */
export const STEP_SECONDS = 30;

const at = (hours: number, minutes = 0) => hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE;

/** Peak: 06:30–09:30 and 16:00–19:00, as [start, end) in seconds of the day (D7's proposal, a tunable). */
export const PEAK_WINDOWS: readonly (readonly [number, number])[] = [
  [at(6, 30), at(9, 30)],
  [at(16), at(19)],
];
/** The service day runs 05:00–24:00; off-peak is the part of it outside peak, overnight the rest. */
export const SERVICE_DAY: readonly [number, number] = [at(5), at(24)];

/** Peak and off-peak run at least this often (D7's recommendation, a tunable). */
export const MAX_DAYTIME_HEADWAY_SECONDS = at(1);
