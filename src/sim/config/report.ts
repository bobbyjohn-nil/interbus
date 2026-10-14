// The quarter's report card (the M3 spec, item 9; EC-14, EC-07, K03), as config rows. Four grades,
// 0–100 each, weighed equally into the overall; the card pays above one bar and fines below another.
// V2's card had seven grades (`Intralines_City_dep@archive/intralines-city-v1:Gaming/src/30-sim.js:
// 4865-4935`); M3's four are the spec's. The bars are set from a measured spread of opening companies
// (bench/report.ts; DECISIONS, Measured), never guessed (V3 guessed).

/** Each grade's weight in the overall. */
export const REPORT_WEIGHTS = { coverage: 0.25, reliability: 0.25, comfort: 0.25, money: 0.25 } as const;

/**
 * Coverage counts a resident by the best stop within a walk, weighted by its service: (calls a day ÷
 * 64)^0.75, held at 1, so a stop called hourly from 05:00 (19 calls) counts 0.40, half-hourly (38)
 * 0.68, and every 15 minutes (76) in full (V2's fix for orphan poles, EC-07:
 * `…:Gaming/src/30-sim.js:3884-3918`, `10-core.js:185-190`).
 */
export const COVERAGE_FULL_CALLS = 64;
export const COVERAGE_EXPONENT = 0.75;

/** Comfort: this share is the stops' tiers (boardings-weighted, Sign 0 to Transfer Hub 1); the rest, the riders not turned away. */
export const COMFORT_TIER_SHARE = 0.2;

/**
 * V1's payout and fine, at bars set from the measured spread (DECISIONS, Measured). They are stated a
 * day and paid for the quarter's days, so a quarter's card pays what its days earned whatever its
 * length: $1,600 a point and an $8,000 fine over ten days became $1,280 and $6,400 over eight (D25).
 */
export const REPORT_GRANT_THRESHOLD = 55;
export const REPORT_GRANT_PER_POINT_PER_DAY_CENTS = 16_000;
export const REPORT_FINE_THRESHOLD = 35;
export const REPORT_FINE_PER_DAY_CENTS = 80_000;
