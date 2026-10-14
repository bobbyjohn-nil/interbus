// Money config rows, in whole cents. Prices stay V1's (PLAN §3; `Intralines@7af45b1:src/game/constants.ts`),
// and demand scales to them through calib.tripScale instead.

/** The first depot (V1 `DEPOT_COST`, constants.ts:31; the ladder is in config/depots.ts). */
export { DEPOT_FIRST_PRICE_CENTS as DEPOT_COST_CENTS } from './depots';
/** A sign stop (V1 `STOP_COST`, constants.ts:49). */
export const STOP_COST_CENTS = 400_000;
/** The reference fare, $2.25 (V1 `FARE_REFERENCE`, constants.ts:418). */
export const REFERENCE_FARE_CENTS = 225;
/** The city's subsidy per paid boarding (one a trip, EC-04), $1.60 (V1 `SUBSIDY_PER_RIDER`, constants.ts:78), at the reference fare or below. */
export const SUBSIDY_PER_BOARDING_CENTS = 160;
/**
 * A line's fare runs from $1.00 to $5.00 in 25¢ steps (the M3 spec, item 4; V2's band, EC-09,
 * `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/10-core.js:58-63`).
 */
export const FARE_MIN_CENTS = 100;
export const FARE_MAX_CENTS = 500;
export const FARE_STEP_CENTS = 25;
/**
 * Above the reference fare the subsidy tapers to nothing at the top fare: × (1 − (gap ÷ $2.75)²),
 * so a dearer fare has a peak, never a ramp to $5 (V2's fix for "drag to $5", EC-05,
 * `…:Gaming/src/30-sim.js:3687-3700`).
 */
export const SUBSIDY_TAPER_EXPONENT = 2;
/** The line card's fare band: every fare whose day nets within this share of the best fare's (the M3 spec, item 4). */
export const FARE_BAND_SHARE = 0.05;
/**
 * A stop is QUIET under 5 boardings a day and LOSS under −$20 a day (the M3 spec, item 5; V2's
 * thresholds, `Intralines_City_dep@archive/intralines-city-v1:Gaming/src/30-sim.js:67-68`).
 */
export const STOP_QUIET_BOARDINGS = 5;
export const STOP_LOSS_CENTS = -2_000;

/**
 * The failure floor (the M3 spec, item 10; D10): one lender's credit line lets cash go to −$150k, at
 * 0.06% a day on what is owed, charged at each day's close as an Interest row; a purchase that would
 * pass the limit is refused. Five day closes in a row below it end the run. No version built this;
 * V1's lenders are the source of the numbers (`Intralines@7af45b1:src/game/store.ts:1765-1831`).
 */
export const CREDIT_LIMIT_CENTS = 15_000_000;
export const INTEREST_PER_DAY_PPM = 600;
export const FAILURE_CLOSES = 5;

/**
 * Starting cash is k × a starter line's cost, written once at founding (D7). The starter is one
 * depot, four sign stops and the Sparrows its founding headway needs, counted by the cycle function
 * (economy/starter.ts) on a line like the debug line (3,535 m by street): 3.5 km, every 20 minutes.
 */
export const STARTER_ROUTE_M = 3_500;
export const STARTER_STOPS = 4;
export const STARTER_HEADWAY_SECONDS = 1_200;
/**
 * k in thousandths, so founding capital is whole cents: 1.333 gives $474,548 (V1 had $310,000), tuned at
 * the tuning freeze from 1.2 ($427,200) to I10's cap, where the cheapest four-bus line, $546,000, costs
 * 1.1506x it (DECISIONS, Measured, 2026-10-14; startingCash.test.ts). D7 holds it within 1.0–1.8.
 */
export const STARTING_CASH_K_PERMILLE = 1_333;
