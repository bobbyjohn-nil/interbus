// Money config rows, in whole cents. Prices stay V1's (PLAN §3; `Intralines@7af45b1:src/game/constants.ts`),
// and demand scales to them through calib.tripScale instead.

/** The first depot (V1 `DEPOT_COST`, constants.ts:31; the ladder is in config/depots.ts). */
export { DEPOT_FIRST_PRICE_CENTS as DEPOT_COST_CENTS } from './depots';
/** A sign stop (V1 `STOP_COST`, constants.ts:49). */
export const STOP_COST_CENTS = 400_000;
/** The reference fare, $2.25 (V1 `FARE_REFERENCE`, constants.ts:418). */
export const REFERENCE_FARE_CENTS = 225;
/** The city's subsidy per boarding, $1.60 (V1 `SUBSIDY_PER_RIDER`, constants.ts:78). */
export const SUBSIDY_PER_BOARDING_CENTS = 160;

/**
 * Starting cash is k × a starter line's cost, written once at founding (D7). The starter is one
 * depot, four sign stops and the Sparrows its founding headway needs, counted by the cycle function
 * (economy/starter.ts) on a line like the debug line (3,535 m by street): 3.5 km, every 20 minutes.
 */
export const STARTER_ROUTE_M = 3_500;
export const STARTER_STOPS = 4;
export const STARTER_HEADWAY_SECONDS = 1_200;
/** k in thousandths, so founding capital is whole cents: 1.2 gives $427,200 (V1 had $310,000). Week 9 tunes it within 1.0–1.8. */
export const STARTING_CASH_K_PERMILLE = 1_200;
